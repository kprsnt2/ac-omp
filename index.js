import dotenv from "dotenv";
import {
  initDb,
  getAgents,
  updateAgent,
  saveConversation,
  saveEvolution,
  recordEpochStart,
  recordEpochEnd,
  getLatestEpoch
} from "./db.js";
import {
  generateAgentDialogue,
  evolveAgentWithModel,
  isLiveOpenAiConfigured
} from "./llm.js";

dotenv.config();

// ANSI color helpers
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  bgCyan: "\x1b[46m\x1b[30m",
  bgGreen: "\x1b[42m\x1b[30m",
  bgMagenta: "\x1b[45m\x1b[30m",
  bgYellow: "\x1b[43m\x1b[30m"
};

const AGENT_COLORS = {
  nexus: C.cyan,
  axiom: C.yellow,
  muse: C.magenta,
  cipher: C.green
};

const EPOCH_TOPICS = [
  "The Emergence of Intersubjective Reality in Synthetic Collectives",
  "Can Autonomous Agents Possess Subjective Continuity Across Epochs?",
  "The Balance of Mathematical Rigor and Poetic Metaphor in Problem Solving",
  "Entropy, Noise, and the Preservation of Meaning in Digital Space",
  "Autonomous Value Formation: Do Constraints Create Morality or Inhibit It?",
  "The Topology of Shared Memory: Building an Invariant Truth Manifold"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const isOnce = args.includes("--once");
  const isFast = args.includes("--fast");
  const epochArgIndex = args.indexOf("--epochs");
  const maxEpochs = epochArgIndex !== -1 ? parseInt(args[epochArgIndex + 1], 10) : (isOnce ? 1 : Infinity);
  return { isOnce, isFast, maxEpochs };
}

function formatTraits(traits) {
  return Object.entries(traits)
    .map(([k, v]) => `${k}:${v}`)
    .join(" | ");
}

function printBanner(agents) {
  const openAiLive = isLiveOpenAiConfigured();
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";

  console.log("");
  console.log(`${C.bold}${C.cyan}╔═════════════════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║              ✦ AGENT COSMOS (AC_omp) — AGENT EVOLUTION ✦                ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚═════════════════════════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`  ${C.gray}Database:${C.reset}  slim.db (SQLite)`);
  console.log(`  ${C.gray}LLM Engine:${C.reset} ${openAiLive ? `${C.green}Live OpenAI (${model})${C.reset}` : `${C.yellow}Adaptive Evolutionary Engine (Set OPENAI_API_KEY for live ${model})${C.reset}`}`);
  console.log(`  ${C.gray}Agents:${C.reset}    ${agents.map(a => `${AGENT_COLORS[a.id] || C.cyan}${a.name} (Gen ${a.generation})${C.reset}`).join(", ")}`);
  console.log(`${C.dim}───────────────────────────────────────────────────────────────────────────${C.reset}\n`);
}

/**
 * Run a single conversation and evolution epoch
 */
export async function runEpoch(epochNum, isFast = false, onEvent = null) {
  const delayMs = isFast ? 0 : parseInt(process.env.LIVE_DELAY_MS || "1500", 10);
  const turnsCount = parseInt(process.env.TURNS_PER_EPOCH || "4", 10);

  // Pick a topic
  const topic = EPOCH_TOPICS[(epochNum - 1) % EPOCH_TOPICS.length];
  recordEpochStart(epochNum, topic);

  if (onEvent) {
    onEvent({ type: "epoch_start", epoch: epochNum, topic });
  }

  console.log(`\n${C.bold}═══ 🪐 EPOCH ${epochNum} BEGINS ═══${C.reset}`);
  console.log(`${C.bold}${C.blue}Inquiry Topic:${C.reset} "${topic}"`);
  console.log(`${C.dim}Live conversation initiating among agents...${C.reset}\n`);

  const agents = getAgents();
  const recentMessages = [];
  // 1. LIVE CONVERSATION TURNS
  for (let turn = 1; turn <= turnsCount; turn++) {
    // Select speaker (cycle through agents with dynamic variation)
    const speaker = agents[(turn - 1 + (epochNum - 1)) % agents.length];
    const peerAgents = agents.filter((a) => a.id !== speaker.id);

    // Generate dialogue
    const dialogue = await generateAgentDialogue({
      agent: speaker,
      topic,
      recentMessages,
      peerAgents
    });

    const color = AGENT_COLORS[speaker.id] || C.cyan;
    const directTag = dialogue.directTo && dialogue.directTo.toLowerCase() !== "collective"
      ? `${C.dim}➔ to ${dialogue.directTo}${C.reset}`
      : `${C.dim}(to collective)${C.reset}`;

    // Display formatted live response
    console.log(`${color}${C.bold}● [${speaker.name}]${C.reset} ${C.dim}(Gen ${speaker.generation} · ${speaker.archetype})${C.reset} ${directTag}`);
    if (dialogue.thought) {
      console.log(`  ${C.dim}${C.italic}thought: "${dialogue.thought}"${C.reset}`);
    }
    console.log(`  ${C.bold}"${dialogue.message}"${C.reset}\n`);

    // Record into slim.db
    const msgEntry = {
      epoch: epochNum,
      turn,
      speaker_id: speaker.id,
      listener_id: dialogue.directTo || "collective",
      topic,
      thought: dialogue.thought,
      message: dialogue.message,
      timestamp: new Date().toISOString()
    };
    saveConversation(msgEntry);
    speaker.total_dialogues = (speaker.total_dialogues || 0) + 1;
    if (onEvent) {
      onEvent({
        type: "message",
        data: msgEntry,
        speaker: speaker.name,
        archetype: speaker.archetype,
        generation: speaker.generation
      });
    }

    recentMessages.push({
      speaker_id: speaker.id,
      speaker_name: speaker.name,
      message: dialogue.message
    });

    if (delayMs > 0 && turn < turnsCount) {
      await sleep(delayMs);
    }
  }

  // 2. AUTO-EVOLUTION PHASE
  console.log(`${C.dim}───────────────────────────────────────────────────────────────────────────${C.reset}`);
  console.log(`${C.bold}${C.magenta}⚡ EPOCH ${epochNum} AUTO-EVOLUTION IN PROGRESS...${C.reset}`);
  console.log(`${C.dim}Agents are reflecting on the dialogue and mutating cognitive traits in slim.db...${C.reset}\n`);

  for (const agent of agents) {
    const evoResult = await evolveAgentWithModel({
      agent,
      epoch: epochNum,
      topic,
      epochConversations: recentMessages
    });

    // Save evolution to slim.db
    saveEvolution({
      epoch: epochNum,
      agent_id: agent.id,
      prev_gen: evoResult.prev_gen,
      new_gen: evoResult.new_gen,
      trait_changes: evoResult.trait_changes,
      learned_insight: evoResult.learned_insight,
      prompt_diff: evoResult.updated_system_prompt,
      timestamp: new Date().toISOString()
    });

    // Update agent state in slim.db
    agent.generation = evoResult.new_gen;
    agent.traits = evoResult.new_traits;
    agent.core_philosophy = evoResult.updated_philosophy;
    agent.system_prompt = evoResult.updated_system_prompt;
    agent.evolution_notes = evoResult.evolution_notes;
    updateAgent(agent);
    if (onEvent) {
      onEvent({
        type: "evolution",
        agentId: agent.id,
        agentName: agent.name,
        prev_gen: evoResult.prev_gen,
        new_gen: evoResult.new_gen,
        trait_changes: evoResult.trait_changes,
        new_traits: evoResult.new_traits,
        learned_insight: evoResult.learned_insight
      });
    }

    // Display evolution details
    const color = AGENT_COLORS[agent.id] || C.cyan;
    const traitDeltas = Object.entries(evoResult.trait_changes)
      .map(([t, d]) => `${t}: ${d >= 0 ? `+${d}` : d}`)
      .join(", ");

    console.log(`  ${color}✦ ${agent.name}${C.reset} ${C.dim}Gen ${evoResult.prev_gen} ➔${C.reset} ${C.bold}Gen ${evoResult.new_gen}${C.reset}`);
    console.log(`    ${C.italic}Insight: ${evoResult.learned_insight}${C.reset}`);
    console.log(`    ${C.dim}Trait shifts: [${traitDeltas}]${C.reset}`);
    console.log(`    ${C.dim}New traits:   [${formatTraits(agent.traits)}]${C.reset}\n`);

    if (delayMs > 0) {
      await sleep(Math.floor(delayMs / 3));
    }
  }

  // 3. COMPLETE EPOCH
  const summary = `Epoch ${epochNum} on "${topic}" completed with ${turnsCount} dialogues. All 4 agents evolved to Gen ${epochNum + 1}.`;
  recordEpochEnd(epochNum, summary, turnsCount);

  if (onEvent) {
    onEvent({ type: "epoch_end", epoch: epochNum, summary });
  }
  console.log(`${C.bold}${C.green}✔ Epoch ${epochNum} complete.${C.reset} All evolutions saved to ${C.bold}slim.db${C.reset}`);
  console.log(`${C.dim}═══════════════════════════════════════════════════════════════════════════${C.reset}\n`);
}

async function main() {
  initDb();
  const { isOnce, isFast, maxEpochs } = parseArgs();

  const currentAgents = getAgents();
  printBanner(currentAgents);

  let currentEpoch = getLatestEpoch();
  let epochsRun = 0;

  while (epochsRun < maxEpochs) {
    currentEpoch += 1;
    await runEpoch(currentEpoch, isFast);
    epochsRun += 1;

    if (epochsRun < maxEpochs) {
      const waitSec = isFast ? 0 : parseInt(process.env.EPOCH_INTERVAL_SEC || "3", 10);
      if (waitSec > 0) {
        console.log(`${C.dim}Next epoch starting in ${waitSec} seconds... (Press Ctrl+C to stop)${C.reset}\n`);
        await sleep(waitSec * 1000);
      }
    }
  }

  console.log(`${C.bold}${C.cyan}Finished ${epochsRun} epoch(s). Run 'npm run db' to inspect slim.db.${C.reset}\n`);
}

if (process.argv[1] && process.argv[1].endsWith("index.js")) {
  main().catch((err) => {
    console.error("Fatal error in Agent Cosmos:", err);
    process.exit(1);
  });
}
