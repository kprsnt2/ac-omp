import { resetDb, getAgents } from "./db.js";

console.log("Resetting slim.db to initial seed state...");
resetDb();
const agents = getAgents();
console.log(`✔ Database reset complete.`);
console.log(`Active Agents reseeded at Generation 1:`);
for (const a of agents) {
  console.log(`  - ${a.name} (${a.archetype}): Gen ${a.generation}`);
}
