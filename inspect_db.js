import dotenv from "dotenv";
import {
  initDb,
  getAgents,
  getConversations,
  getEvolutions,
  getLatestEpoch,
  getDb
} from "./db.js";

dotenv.config();

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  italic: "\x1b[3m"
};

initDb();

console.log(`\n${C.bold}${C.cyan}═════════════════════════════════════════════════════════════════════════${C.reset}`);
console.log(`${C.bold}${C.cyan}                     ✦ SLIM DB INSPECTION REPORT ✦                       ${C.reset}`);
console.log(`${C.bold}${C.cyan}═════════════════════════════════════════════════════════════════════════${C.reset}\n`);

// 1. Current Agents
const agents = getAgents();
console.log(`${C.bold}${C.yellow}► AGENTS STATE (${agents.length} active)${C.reset}`);
console.log(`${C.dim}─`.repeat(70) + C.reset);
for (const a of agents) {
  console.log(`${C.bold}${a.name.padEnd(10)}${C.reset} | Archetype: ${a.archetype.padEnd(12)} | ${C.green}Gen: ${a.generation}${C.reset} | Dialogues: ${a.total_dialogues}`);
  console.log(`   Philosophy: ${C.dim}"${a.core_philosophy}"${C.reset}`);
  console.log(`   Traits:     ${C.cyan}${JSON.stringify(a.traits)}${C.reset}`);
  if (a.evolution_notes) {
    console.log(`   Notes:      ${C.dim}${a.evolution_notes}${C.reset}`);
  }
  console.log("");
}

// 2. Epochs
const db = getDb();
const epochs = db.prepare("SELECT * FROM epochs ORDER BY number ASC").all();
console.log(`${C.bold}${C.yellow}► EPOCHS RECORDED (${epochs.length})${C.reset}`);
console.log(`${C.dim}─`.repeat(70) + C.reset);
if (epochs.length === 0) {
  console.log(`  ${C.dim}No epochs completed yet. Run 'npm start' to begin live epochs.${C.reset}\n`);
} else {
  for (const ep of epochs) {
    console.log(`  ${C.bold}Epoch ${ep.number}:${C.reset} "${ep.topic}" (${ep.dialogue_count} turns)`);
    if (ep.summary) {
      console.log(`  ${C.dim}Summary: ${ep.summary}${C.reset}`);
    }
  }
  console.log("");
}

// 3. Recent Evolutions
const evolutions = getEvolutions(null).slice(0, 10);
console.log(`${C.bold}${C.yellow}► RECENT AGENT EVOLUTIONS (${evolutions.length})${C.reset}`);
console.log(`${C.dim}─`.repeat(70) + C.reset);
if (evolutions.length === 0) {
  console.log(`  ${C.dim}No evolutions recorded yet.${C.reset}\n`);
} else {
  for (const evo of evolutions) {
    const shift = Object.entries(evo.trait_changes)
      .map(([k, v]) => `${k}:${v >= 0 ? `+${v}` : v}`)
      .join(", ");
    console.log(`  ${C.magenta}● [${evo.agent_id.toUpperCase()}]${C.reset} Epoch ${evo.epoch}: Gen ${evo.prev_gen} ➔ ${C.bold}Gen ${evo.new_gen}${C.reset}`);
    console.log(`    ${C.dim}Insight:${C.reset} ${evo.learned_insight}`);
    console.log(`    ${C.dim}Shifts: [${shift}]${C.reset}`);
  }
  console.log("");
}

// 4. Recent Conversations
const conversations = getConversations(null, 6);
console.log(`${C.bold}${C.yellow}► RECENT CONVERSATIONS (${conversations.length})${C.reset}`);
console.log(`${C.dim}─`.repeat(70) + C.reset);
if (conversations.length === 0) {
  console.log(`  ${C.dim}No conversations recorded yet.${C.reset}\n`);
} else {
  for (const c of conversations) {
    console.log(`  ${C.bold}[Epoch ${c.epoch} Turn ${c.turn}] ${c.speaker_id.toUpperCase()} ➔ ${c.listener_id}:${C.reset}`);
    if (c.thought) {
      console.log(`    ${C.dim}${C.italic}thought: "${c.thought}"${C.reset}`);
    }
    console.log(`    "${c.message}"`);
  }
  console.log("");
}

console.log(`${C.dim}═════════════════════════════════════════════════════════════════════════${C.reset}\n`);
