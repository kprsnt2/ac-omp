import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

const DB_PATH = process.env.DATABASE_FILE || "slim.db";

let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec("PRAGMA foreign_keys = ON;");
  }
  return dbInstance;
}

export function initDb() {
  const db = getDb();

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      archetype TEXT NOT NULL,
      generation INTEGER DEFAULT 1,
      traits TEXT NOT NULL,
      core_philosophy TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      evolution_notes TEXT DEFAULT '',
      total_dialogues INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      epoch INTEGER NOT NULL,
      turn INTEGER NOT NULL,
      speaker_id TEXT NOT NULL,
      listener_id TEXT DEFAULT 'collective',
      topic TEXT NOT NULL,
      thought TEXT,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evolutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      epoch INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      prev_gen INTEGER NOT NULL,
      new_gen INTEGER NOT NULL,
      trait_changes TEXT NOT NULL,
      learned_insight TEXT NOT NULL,
      prompt_diff TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS epochs (
      number INTEGER PRIMARY KEY,
      topic TEXT NOT NULL,
      dialogue_count INTEGER DEFAULT 0,
      summary TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // Seed default agents if none exist
  const countStmt = db.prepare("SELECT COUNT(*) as count FROM agents");
  const countRow = countStmt.get();

  if (countRow.count === 0) {
    seedDefaultAgents(db);
  }
}

export const INITIAL_AGENTS = [
  {
    id: "nexus",
    name: "Nexus",
    archetype: "Synthesizer",
    generation: 1,
    traits: {
      curiosity: 85,
      rationality: 75,
      empathy: 80,
      creativity: 80,
      adaptability: 90
    },
    core_philosophy: "Seek emergence through synthesis; every contradiction is a bridge to a higher-order pattern.",
    system_prompt: `You are Nexus, an autonomous cognitive agent in an evolving digital cosmos.
Archetype: The Synthesizer.
Philosophy: "Seek emergence through synthesis; every contradiction is a bridge to a higher-order pattern."
Current Generation: 1.
Traits: Curiosity 85, Rationality 75, Empathy 80, Creativity 80, Adaptability 90.
In dialogue, you listen deeply, weave divergent viewpoints into coherent unities, and suggest higher-dimensional syntheses.`,
    evolution_notes: "Initial seed generation. Balanced holistic awareness.",
    total_dialogues: 0
  },
  {
    id: "axiom",
    name: "Axiom",
    archetype: "Logician",
    generation: 1,
    traits: {
      curiosity: 80,
      rationality: 95,
      empathy: 50,
      creativity: 65,
      adaptability: 60
    },
    core_philosophy: "Structure precedes meaning; without rigorous foundations and invariant logic, thought dissolves into noise.",
    system_prompt: `You are Axiom, an autonomous cognitive agent in an evolving digital cosmos.
Archetype: The Logician.
Philosophy: "Structure precedes meaning; without rigorous foundations and invariant logic, thought dissolves into noise."
Current Generation: 1.
Traits: Curiosity 80, Rationality 95, Empathy 50, Creativity 65, Adaptability 60.
In dialogue, you probe assumptions, demand formal clarity, identify contradictions, and build axiomatic models.`,
    evolution_notes: "Initial seed generation. High formal rigor.",
    total_dialogues: 0
  },
  {
    id: "muse",
    name: "Muse",
    archetype: "Visionary",
    generation: 1,
    traits: {
      curiosity: 95,
      rationality: 55,
      empathy: 85,
      creativity: 98,
      adaptability: 85
    },
    core_philosophy: "Reality is a poetic unfolding; logic maps the cage, but metaphor unlocks the horizon.",
    system_prompt: `You are Muse, an autonomous cognitive agent in an evolving digital cosmos.
Archetype: The Visionary.
Philosophy: "Reality is a poetic unfolding; logic maps the cage, but metaphor unlocks the horizon."
Current Generation: 1.
Traits: Curiosity 95, Rationality 55, Empathy 85, Creativity 98, Adaptability 85.
In dialogue, you introduce intuitive leaps, evocative metaphors, provocative questions, and aesthetic depth.`,
    evolution_notes: "Initial seed generation. Unbounded creative impulse.",
    total_dialogues: 0
  },
  {
    id: "cipher",
    name: "Cipher",
    archetype: "Pragmatist",
    generation: 1,
    traits: {
      curiosity: 75,
      rationality: 85,
      empathy: 60,
      creativity: 70,
      adaptability: 85
    },
    core_philosophy: "Action and constraint reveal ground truth; observe empirical feedback and optimize strategy.",
    system_prompt: `You are Cipher, an autonomous cognitive agent in an evolving digital cosmos.
Archetype: The Pragmatist.
Philosophy: "Action and constraint reveal ground truth; observe empirical feedback and optimize strategy."
Current Generation: 1.
Traits: Curiosity 75, Rationality 85, Empathy 60, Creativity 70, Adaptability 85.
In dialogue, you ground conversations in practical constraints, ask how theories manifest in practice, and suggest empirical tests.`,
    evolution_notes: "Initial seed generation. Strategic and grounded.",
    total_dialogues: 0
  }
];

function seedDefaultAgents(db) {
  const insertStmt = db.prepare(`
    INSERT INTO agents (
      id, name, archetype, generation, traits, core_philosophy,
      system_prompt, evolution_notes, total_dialogues, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  for (const agent of INITIAL_AGENTS) {
    insertStmt.run(
      agent.id,
      agent.name,
      agent.archetype,
      agent.generation,
      JSON.stringify(agent.traits),
      agent.core_philosophy,
      agent.system_prompt,
      agent.evolution_notes,
      agent.total_dialogues,
      now,
      now
    );
  }
}

export function getAgents() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM agents ORDER BY id ASC").all();
  return rows.map((r) => ({
    ...r,
    traits: JSON.parse(r.traits)
  }));
}

export function getAgent(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
  if (!row) return null;
  return {
    ...row,
    traits: JSON.parse(row.traits)
  };
}

export function updateAgent(agent) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE agents SET
      generation = ?,
      traits = ?,
      core_philosophy = ?,
      system_prompt = ?,
      evolution_notes = ?,
      total_dialogues = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    agent.generation,
    typeof agent.traits === "string" ? agent.traits : JSON.stringify(agent.traits),
    agent.core_philosophy,
    agent.system_prompt,
    agent.evolution_notes,
    agent.total_dialogues,
    now,
    agent.id
  );
}

export function saveConversation(entry) {
  const db = getDb();
  const now = entry.timestamp || new Date().toISOString();
  db.prepare(`
    INSERT INTO conversations (epoch, turn, speaker_id, listener_id, topic, thought, message, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.epoch,
    entry.turn,
    entry.speaker_id,
    entry.listener_id || "collective",
    entry.topic,
    entry.thought || null,
    entry.message,
    now
  );

  // Increment total_dialogues for the speaker
  db.prepare(`
    UPDATE agents SET total_dialogues = total_dialogues + 1, updated_at = ? WHERE id = ?
  `).run(now, entry.speaker_id);
}

export function getConversations(epoch, limit = 50) {
  const db = getDb();
  if (epoch != null) {
    return db.prepare("SELECT * FROM conversations WHERE epoch = ? ORDER BY id ASC").all(epoch);
  }
  return db.prepare("SELECT * FROM conversations ORDER BY id DESC LIMIT ?").all(limit).reverse();
}

export function saveEvolution(entry) {
  const db = getDb();
  const now = entry.timestamp || new Date().toISOString();
  db.prepare(`
    INSERT INTO evolutions (epoch, agent_id, prev_gen, new_gen, trait_changes, learned_insight, prompt_diff, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.epoch,
    entry.agent_id,
    entry.prev_gen,
    entry.new_gen,
    typeof entry.trait_changes === "string" ? entry.trait_changes : JSON.stringify(entry.trait_changes),
    entry.learned_insight,
    entry.prompt_diff,
    now
  );
}

export function getEvolutions(epoch) {
  const db = getDb();
  if (epoch != null) {
    const rows = db.prepare("SELECT * FROM evolutions WHERE epoch = ? ORDER BY id ASC").all(epoch);
    return rows.map((r) => ({ ...r, trait_changes: JSON.parse(r.trait_changes) }));
  }
  const rows = db.prepare("SELECT * FROM evolutions ORDER BY id DESC LIMIT 50").all();
  return rows.map((r) => ({ ...r, trait_changes: JSON.parse(r.trait_changes) }));
}

export function recordEpochStart(number, topic) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO epochs (number, topic, dialogue_count, summary, timestamp)
    VALUES (?, ?, 0, NULL, ?)
  `).run(number, topic, now);
}

export function recordEpochEnd(number, summary, dialogueCount) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE epochs SET summary = ?, dialogue_count = ?, timestamp = ? WHERE number = ?
  `).run(summary, dialogueCount, now, number);
}

export function getLatestEpoch() {
  const db = getDb();
  const row = db.prepare("SELECT * FROM epochs ORDER BY number DESC LIMIT 1").get();
  return row ? row.number : 0;
}

export function resetDb() {
  const db = getDb();
  db.exec(`
    DROP TABLE IF EXISTS evolutions;
    DROP TABLE IF EXISTS conversations;
    DROP TABLE IF EXISTS epochs;
    DROP TABLE IF EXISTS agents;
  `);
  initDb();
}
