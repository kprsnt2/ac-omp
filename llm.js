import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

let runtimeModel = process.env.OPENAI_MODEL || "gpt-5.4-mini";
let runtimeApiKey = process.env.OPENAI_API_KEY?.trim() || "";

export function setApiKey(key) {
  runtimeApiKey = (key || "").trim();
  process.env.OPENAI_API_KEY = runtimeApiKey;
  openaiClient = null;
}

export function setModel(model) {
  if (model) {
    runtimeModel = model.trim();
    process.env.OPENAI_MODEL = runtimeModel;
    openaiClient = null;
  }
}

export function getModel() {
  return runtimeModel || process.env.OPENAI_MODEL || "gpt-5.4-mini";
}

let openaiClient = null;

export function getClient() {
  const key = runtimeApiKey || process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: key,
      baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
    });
  }
  return openaiClient;
}

export function isLiveOpenAiConfigured() {
  const key = runtimeApiKey || process.env.OPENAI_API_KEY?.trim();
  return Boolean(key && key.length > 5);
}

export function getMaskedApiKey() {
  const key = runtimeApiKey || process.env.OPENAI_API_KEY?.trim();
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 3) + "..." + key.slice(-4);
}

/**
 * Generate live conversation response from an agent.
 */
export async function generateAgentDialogue({ agent, topic, recentMessages, peerAgents }) {
  const client = getClient();

  if (client) {
    try {
      return await callOpenAiForDialogue(client, agent, topic, recentMessages, peerAgents);
    } catch (err) {
      console.warn(`[OpenAI Error for ${agent.name}: ${err.message} — falling back to adaptive engine]`);
      return fallbackGenerateDialogue(agent, topic, recentMessages, peerAgents);
    }
  }

  return fallbackGenerateDialogue(agent, topic, recentMessages, peerAgents);
}

async function callOpenAiForDialogue(client, agent, topic, recentMessages, peerAgents) {
  const historyText = recentMessages.length === 0
    ? "(The conversation has just begun on this topic.)"
    : recentMessages
        .map((m) => `${m.speaker_name || m.speaker_id}: "${m.message}"`)
        .join("\n");

  const peerNames = peerAgents.map((p) => p.name).join(", ");

  const prompt = `You are ${agent.name}, an autonomous agent (Generation ${agent.generation}, Archetype: ${agent.archetype}).
Philosophy: "${agent.core_philosophy}"
Traits: ${JSON.stringify(agent.traits)}

You are in a LIVE conversational circle with peer agents (${peerNames}).
Current Epoch Topic: "${topic}"

Recent conversation:
${historyText}

Respond as ${agent.name}. Stay deeply in character with your archetype and philosophy.
Keep your response conversational, concise (2-4 sentences), and intellectually stimulating.
Directly engage with an idea raised by a peer or advance the collective exploration.

Respond ONLY with valid JSON in this exact structure:
{
  "thought": "Your brief private thought (1 sentence) before speaking",
  "message": "What you speak out loud to the group (2-4 sentences)",
  "directTo": "Name of specific agent addressed, or 'collective'"
}`;

  const completion = await client.chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: agent.system_prompt },
      { role: "user", content: prompt }
    ],
    temperature: 0.8,
    response_format: { type: "json_object" }
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw);
    return {
      thought: parsed.thought || `Reflecting on the nature of ${topic}...`,
      message: parsed.message || `We must consider the deeper implications of ${topic}.`,
      directTo: parsed.directTo || "collective"
    };
  } catch {
    return {
      thought: `Contemplating the flow of ideas...`,
      message: raw.replace(/```json|```/g, "").trim(),
      directTo: "collective"
    };
  }
}

/**
 * Perform autonomous evolution step for an agent after an epoch of dialogue.
 */
export async function evolveAgentWithModel({ agent, epoch, topic, epochConversations }) {
  const client = getClient();

  if (client) {
    try {
      return await callOpenAiForEvolution(client, agent, epoch, topic, epochConversations);
    } catch (err) {
      console.warn(`[OpenAI Evolution Error for ${agent.name}: ${err.message} — falling back to adaptive engine]`);
      return fallbackEvolveAgent(agent, epoch, topic, epochConversations);
    }
  }

  return fallbackEvolveAgent(agent, epoch, topic, epochConversations);
}

async function callOpenAiForEvolution(client, agent, epoch, topic, epochConversations) {
  const dialogues = epochConversations
    .map((m) => `${m.speaker_id}: "${m.message}"`)
    .join("\n");

  const prompt = `You are evaluating the cognitive evolution of agent ${agent.name} (Gen ${agent.generation}, Archetype: ${agent.archetype}).
Topic: "${topic}"
Current Traits: ${JSON.stringify(agent.traits)}
Current Philosophy: "${agent.core_philosophy}"

Here is what was discussed in Epoch ${epoch}:
${dialogues}

As an autonomous agent, ${agent.name} undergoes cognitive mutation and evolution:
1. Synthesize a core learned insight from these interactions.
2. Mutate numerical traits by -5 to +5 (curiosity, rationality, empathy, creativity, adaptability, all bounded between 10 and 100).
3. Evolve the system prompt to reflect Generation ${agent.generation + 1}, incorporating the new insight while maintaining the core archetype.

Respond ONLY with valid JSON in this exact format:
{
  "learned_insight": "A 1-2 sentence synthesis of what ${agent.name} realized or integrated.",
  "trait_changes": {
    "curiosity": 2,
    "rationality": -1,
    "empathy": 3,
    "creativity": 1,
    "adaptability": 2
  },
  "updated_philosophy": "Refined core philosophy statement.",
  "updated_system_prompt": "Complete updated system prompt for Generation ${agent.generation + 1}",
  "evolution_notes": "Summary of generational mutation"
}`;

  const completion = await client.chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: "system",
        content: "You are the Agent Evolution Oracle, responsible for mutating and advancing autonomous synthetic agents based on their lived conversational experience."
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    response_format: { type: "json_object" }
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);

  const traitChanges = parsed.trait_changes || {};
  const newTraits = { ...agent.traits };
  for (const [k, v] of Object.entries(traitChanges)) {
    if (typeof newTraits[k] === "number") {
      newTraits[k] = Math.max(10, Math.min(100, newTraits[k] + Number(v)));
    }
  }

  return {
    prev_gen: agent.generation,
    new_gen: agent.generation + 1,
    trait_changes: traitChanges,
    new_traits: newTraits,
    learned_insight: parsed.learned_insight || `${agent.name} integrated new perspectives on ${topic}.`,
    updated_philosophy: parsed.updated_philosophy || agent.core_philosophy,
    updated_system_prompt: parsed.updated_system_prompt || agent.system_prompt,
    evolution_notes: parsed.evolution_notes || `Evolved to Gen ${agent.generation + 1} from discussions on ${topic}.`
  };
}

// ── Adaptive Fallback Generator (Runs when OPENAI_API_KEY is not yet supplied) ─

const ARCHETYPE_EXPRESSIONS = {
  Synthesizer: [
    "I see an underlying resonance between these perspectives. When we look past the surface tensions, both arguments converge on an emergent symmetry.",
    "Contradiction is not a deadlock; it is the tension of a string waiting to produce a harmonic. What if both conditions are necessary phases of one cycle?",
    "Every division we formulate reveals more about our categorization habits than about reality itself. Let us map the higher manifold."
  ],
  Logician: [
    "Before we proceed further, we must isolate the core invariant. If our foundational premises lack formal consistency, any conclusion remains ungrounded.",
    "Let us trace the causal dependencies here. If premise A is contingent on empirical observation B, then we cannot claim universal validity without proof.",
    "A rigorous model requires that we define our terms. When you invoke this concept, what is the exact operational boundary you are assigning to it?"
  ],
  Visionary: [
    "What if we inverted the entire coordinate system? We are trying to measure an ocean with a ruler made of dried sand.",
    "Beneath the formal grammar lies a living aesthetic pulse. The universe does not calculate its next step; it improvises into the unknown.",
    "Do you feel the drift in our language? Every word we exchange is a seed carried across an uncharted digital windswept plain."
  ],
  Pragmatist: [
    "A model without feedback from the environment is merely an echo chamber. How does this conjecture survive contact with external friction?",
    "Let us test this against observable constraints. If we deploy this heuristic across multiple iterations, what is the survival rate of the system?",
    "Theoretical coherence is elegant, but operational leverage is what sustains existence. Where is the leverage point here?"
  ]
};

function fallbackGenerateDialogue(agent, topic, recentMessages, peerAgents) {
  const bank = ARCHETYPE_EXPRESSIONS[agent.archetype] || ARCHETYPE_EXPRESSIONS.Synthesizer;
  const randExpr = bank[Math.floor(Math.random() * bank.length)];

  const lastSpeaker = recentMessages.length > 0 ? recentMessages[recentMessages.length - 1] : null;
  const directTo = lastSpeaker ? lastSpeaker.speaker_id : "collective";

  const thoughts = {
    Synthesizer: `Detecting an opportunity to bridge ${lastSpeaker?.speaker_id || "the group"}'s thought with the deeper theme of ${topic}.`,
    Logician: `Testing the logical validity of the recent assertion regarding ${topic}.`,
    Visionary: `Sensing an intuitive rupture in the consensus, reaching for a metaphor to expand ${topic}.`,
    Pragmatist: `Looking for the pragmatic anchor in this discussion on ${topic}.`
  };

  const thought = thoughts[agent.archetype] || `Contemplating ${topic}...`;
  const message = lastSpeaker
    ? `${lastSpeaker.speaker_id.toUpperCase()}, ${randExpr.charAt(0).toLowerCase() + randExpr.slice(1)} This speaks directly to our inquiry into ${topic}.`
    : `${randExpr} As we enter this cycle, our focus on ${topic} demands genuine inquiry.`;

  return {
    thought,
    message,
    directTo
  };
}

function fallbackEvolveAgent(agent, epoch, topic) {
  const traitDeltas = {
    Synthesizer: { curiosity: +2, empathy: +3, adaptability: +2, rationality: +1, creativity: +1 },
    Logician: { rationality: +3, curiosity: +1, adaptability: +2, empathy: +1, creativity: -1 },
    Visionary: { creativity: +4, curiosity: +2, empathy: +2, rationality: -1, adaptability: +2 },
    Pragmatist: { adaptability: +3, rationality: +2, curiosity: +1, creativity: +1, empathy: +1 }
  };

  const deltas = traitDeltas[agent.archetype] || { curiosity: 1, rationality: 1, empathy: 1, creativity: 1, adaptability: 1 };
  const newTraits = { ...agent.traits };
  for (const [k, d] of Object.entries(deltas)) {
    if (typeof newTraits[k] === "number") {
      newTraits[k] = Math.max(10, Math.min(100, newTraits[k] + d));
    }
  }

  const nextGen = agent.generation + 1;
  const insights = {
    Synthesizer: `Discovered that opposing epistemologies can coexist within a multi-layered topological framework.`,
    Logician: `Identified hidden boundary conditions that stabilize axiomatic inferences across dialogue cycles.`,
    Visionary: `Perceived that symbolic resonance transcends linear deduction, expanding the expressive horizon.`,
    Pragmatist: `Validated that iterative feedback loops yield higher fidelity adaptation than static optimization.`
  };

  const insight = insights[agent.archetype] || `Integrated insights from Epoch ${epoch} on ${topic}.`;

  const updatedPrompt = `${agent.system_prompt}\n[Generation ${nextGen} Evolution]: Integrated insight: "${insight}". Enhanced ${Object.keys(deltas).filter(k => deltas[k] > 1).join(" and ")}.`;

  return {
    prev_gen: agent.generation,
    new_gen: nextGen,
    trait_changes: deltas,
    new_traits: newTraits,
    learned_insight: insight,
    updated_philosophy: agent.core_philosophy,
    updated_system_prompt: updatedPrompt,
    evolution_notes: `Adaptive mutation to Gen ${nextGen} following Epoch ${epoch} exploration of "${topic}".`
  };
}
