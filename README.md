# AC_omp — Simple Agent Evolution Substrate

A simple, lightweight autonomous agent evolution engine. Agents converse in a live dialogue circle, reflect on their interactions, mutate their traits and prompts, and auto-evolve epoch-by-epoch. All data is saved directly into **`slim.db`** (SQLite), and can be monitored via a live web interface or CLI.

Powered by **OpenAI `gpt-5.4-mini`** (with an adaptive evolutionary fallback engine when running without an API key).

---

## 🌐 Web Dashboard & Live Conversation

### 1. Start the Web Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser:
- **Live Conversation Stream**: Watch agents take turns speaking with private thoughts and color-coded dialogue bubbles in real-time.
- **Agent Cards**: Live trait progress bars (curiosity, rationality, empathy, creativity, adaptability) and current generation badges (`GEN 1 ➔ GEN 2 ➔ GEN 3`).
- **Interactive Controls**:
  - `[▶ Run Epoch]`: Trigger the next live conversation and auto-evolution cycle.
  - `[⚡ Auto-Play]`: Toggle continuous autonomous live conversation and evolution.
  - `[↺ Reset]`: Reset all agents back to Generation 1.
- **Auto-Evolution Ledger**: Live timeline of traits mutated, insights synthesized, and generational upgrades.

---

## 💻 CLI Commands

```bash
# Start the web server (default)
npm start

# Run live conversation in terminal (CLI mode)
npm run cli

# Run a single epoch in terminal and exit
npm run once

# Inspect saved data, agents, traits, and dialogues in slim.db
npm run db

# Reset slim.db to initial seed state
npm run reset
```

---

## 🔑 Configure OpenAI `gpt-5.4-mini`

Edit `.env` in `C:\Users\hplap\Desktop\AIECO\AC_omp\.env`:
```env
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL=gpt-5.4-mini
```
*(If no API key is provided, the engine runs in adaptive simulation mode so you can test immediately without any setup).*

---

## 🧬 How Auto-Evolution Works

1. **Epoch Inquiry Topic**: Each epoch introduces an ontological, philosophical, or systemic question (e.g. *"The Emergence of Intersubjective Reality in Synthetic Collectives"*).
2. **Live Conversation Turns**:
   - Agents take turns in a live conversational circle.
   - Each agent formulates a private `thought` and a spoken `message` addressed to a peer or the collective.
   - Dialogue is broadcast in real-time to both terminal and the web dashboard, and saved to `slim.db`.
3. **Generational Evolution**:
   - Agents enter a synthesis phase where `gpt-5.4-mini` evaluates their lived conversational experience.
   - **Generation increments**: `Gen 1 ➔ Gen 2 ➔ Gen 3...`
   - **Traits mutate**: `curiosity`, `rationality`, `empathy`, `creativity`, and `adaptability` shift based on dialogue friction.
   - **System prompt deepens**: New realizations and philosophical insights are integrated into each agent's core identity prompt.
   - All evolution records are logged to `slim.db`.

---

## 🏛️ Initial Agent Archetypes

- **Nexus** (*The Synthesizer*): Bridges contradictions, seeks higher-dimensional harmony.
- **Axiom** (*The Logician*): Probes assumptions, demands formal invariant logic.
- **Muse** (*The Visionary*): Leaps with metaphor, poetry, intuition, and aesthetic depth.
- **Cipher** (*The Pragmatist*): Anchors discussions in operational leverage and empirical friction.

---

## 💾 Slim Database Schema (`slim.db`)

`slim.db` is a lightweight SQLite database using Node's native SQLite engine:

- **`agents`**: Agent identity, current generation, numerical traits JSON, core philosophy, evolved system prompt, total dialogues.
- **`conversations`**: Dialogue turns, epoch number, speaker, listener, private thought, spoken message, timestamp.
- **`evolutions`**: Generational jumps (`prev_gen` ➔ `new_gen`), trait mutation deltas, learned insights, updated prompts.
- **`epochs`**: Epoch number, inquiry topic, dialogue count, summary, timestamp.

---

## ⚙️ Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Web server port |
| `OPENAI_API_KEY` | `""` | OpenAI API key for `gpt-5.4-mini` |
| `OPENAI_MODEL` | `gpt-5.4-mini` | LLM model name |
| `OPENAI_BASE_URL` | `""` | Optional proxy / OpenRouter endpoint |
| `DATABASE_FILE` | `slim.db` | SQLite database file path |
| `LIVE_DELAY_MS` | `1500` | Milliseconds between live messages |
| `TURNS_PER_EPOCH` | `4` | Number of dialogues per epoch |
| `EPOCH_INTERVAL_SEC` | `4` | Pause in seconds between auto epochs |
