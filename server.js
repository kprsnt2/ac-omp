import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  initDb,
  getAgents,
  getConversations,
  getEvolutions,
  getLatestEpoch,
  resetDb
} from "./db.js";
import { runEpoch } from "./index.js";
import {
  isLiveOpenAiConfigured,
  setApiKey,
  setModel,
  getModel,
  getMaskedApiKey
} from "./llm.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = path.join(__dirname, "public");

initDb();

let isEpochRunning = false;
let isAutoPlaying = false;
let autoPlayTimer = null;
const sseClients = new Set();

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function triggerEpoch() {
  if (isEpochRunning) return { running: true };
  isEpochRunning = true;
  try {
    const nextEpoch = getLatestEpoch() + 1;
    await runEpoch(nextEpoch, false, broadcast);
    return { success: true, epoch: nextEpoch };
  } catch (err) {
    console.error("Epoch execution error:", err);
    broadcast({ type: "error", message: err.message });
    return { error: err.message };
  } finally {
    isEpochRunning = false;
  }
}

async function startAutoPlay() {
  if (isAutoPlaying) return;
  isAutoPlaying = true;
  broadcast({ type: "autoplay", active: true });

  const loop = async () => {
    if (!isAutoPlaying) return;
    await triggerEpoch();
    if (isAutoPlaying) {
      const waitSec = parseInt(process.env.EPOCH_INTERVAL_SEC || "4", 10);
      autoPlayTimer = setTimeout(loop, waitSec * 1000);
    }
  };
  loop();
}

function stopAutoPlay() {
  isAutoPlaying = false;
  clearTimeout(autoPlayTimer);
  broadcast({ type: "autoplay", active: false });
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. SSE Stream
  if (url.pathname === "/api/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    res.write(`data: ${JSON.stringify({ type: "connected", epoch: getLatestEpoch() })}\n\n`);
    sseClients.add(res);

    req.on("close", () => {
      sseClients.delete(res);
    });
    return;
  }

  // 2. API: Current State
  if (url.pathname === "/api/state" && req.method === "GET") {
    const data = {
      agents: getAgents(),
      latestEpoch: getLatestEpoch(),
      conversations: getConversations(null, 25),
      evolutions: getEvolutions(null).slice(0, 15),
      isEpochRunning,
      isAutoPlaying,
      model: getModel(),
      isLiveOpenAi: isLiveOpenAiConfigured(),
      maskedApiKey: getMaskedApiKey()
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
    return;
  }

  // 3. API: Run Epoch
  if (url.pathname === "/api/epoch" && req.method === "POST") {
    if (isEpochRunning) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "An epoch is already in progress" }));
      return;
    }
    // Run in background and respond quickly
    triggerEpoch();
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ accepted: true }));
    return;
  }

  // 4. API: Auto Play Toggle
  if (url.pathname === "/api/auto" && req.method === "POST") {
    if (isAutoPlaying) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ isAutoPlaying }));
    return;
  }
  // 4b. API: Configure API Key & Model
  if (url.pathname === "/api/config" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { apiKey, model } = JSON.parse(body || "{}");
        if (typeof apiKey === "string") {
          setApiKey(apiKey);
          // Persist to .env
          try {
            const envPath = path.join(__dirname, ".env");
            let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
            if (envContent.includes("OPENAI_API_KEY=")) {
              envContent = envContent.replace(/OPENAI_API_KEY=.*/, `OPENAI_API_KEY=${apiKey}`);
            } else {
              envContent += `\nOPENAI_API_KEY=${apiKey}`;
            }
            fs.writeFileSync(envPath, envContent, "utf-8");
          } catch (e) {
            console.warn("Could not persist API key to .env file:", e.message);
          }
        }
        if (typeof model === "string" && model.trim()) {
          setModel(model);
        }
        const result = {
          success: true,
          isLiveOpenAi: isLiveOpenAiConfigured(),
          model: getModel(),
          maskedApiKey: getMaskedApiKey()
        };
        broadcast({ type: "config", ...result });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. API: Reset Database
  if (url.pathname === "/api/reset" && req.method === "POST") {
    stopAutoPlay();
    resetDb();
    broadcast({ type: "reset", agents: getAgents() });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, agents: getAgents() }));
    return;
  }

  // 6. Static files
  let filePath = path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
  const ext = path.extname(filePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Fallback to index.html for SPA-style
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n🪐 Agent Cosmos Web Server live at: http://localhost:${PORT}`);
  console.log(`   Database: slim.db (SQLite)`);
  console.log(`   Model:    ${process.env.OPENAI_MODEL || "gpt-5.4-mini"}`);
  console.log(`   Open browser to http://localhost:${PORT} to watch live agent evolution.\n`);
});

export { server };
