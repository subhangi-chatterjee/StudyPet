import express from "express";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 8787;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());

function questDurationGuidance(focusMode) {
  switch ((focusMode || "").toLowerCase()) {
    case "locked in":
      return "Prefer 30-45 minute steps.";
    case "distracted":
      return "Prefer 10-15 minute steps.";
    case "exhausted":
      return "Prefer 5 minute micro-quests.";
    case "normal":
    default:
      return "Prefer 20-30 minute steps.";
  }
}

app.post("/quests", async (req, res) => {
  try {
    const { assignment, focus_mode: focusMode } = req.body || {};
    if (!assignment?.title) {
      return res.status(400).json({ error: "assignment.title is required" });
    }

    const prompt = [
      "You are an ADHD-friendly study coach that turns school assignments into small RPG-like quests.",
      "Be encouraging and concrete. Never use shame, punishment, or guilt.",
      questDurationGuidance(focusMode),
      "Return only JSON matching this schema:",
      JSON.stringify({
        quests: [
          {
            title: "string",
            description: "string",
            xp_reward: 10,
            estimated_minutes: 10
          }
        ]
      }),
      `Assignment title: ${assignment.title}`,
      `Subject: ${assignment.subject || "General"}`,
      `Due date: ${assignment.due_at || "Unknown"}`,
      `Estimated workload in minutes: ${assignment.estimated_minutes || 30}`,
      "Generate 3 to 6 quests.",
      "Each quest must be specific, easy to start, and useful."
    ].join("\n");

    const response = await client.responses.create({
      model: "gpt-5.2",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "quest_chain",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              quests: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    xp_reward: { type: "integer" },
                    estimated_minutes: { type: "integer" }
                  },
                  required: ["title", "description", "xp_reward", "estimated_minutes"]
                }
              }
            },
            required: ["quests"]
          }
        }
      }
    });

    res.json(JSON.parse(response.output_text));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate quests" });
  }
});

app.post("/coach", async (req, res) => {
  try {
    const { assignments = [], focus_mode: focusMode } = req.body || {};

    const prompt = [
      "You are an ADHD-friendly study coach for a pocket study pet device.",
      "Choose what the student should work on right now.",
      "Prioritize urgency, ease of starting, and current mental energy.",
      "Return only JSON matching this schema:",
      JSON.stringify({
        recommendation: {
          title: "string",
          reason: "string",
          estimated_minutes: 15
        }
      }),
      `Focus mode: ${focusMode || "normal"}`,
      `Assignments: ${JSON.stringify(assignments)}`
    ].join("\n");

    const response = await client.responses.create({
      model: "gpt-5.2",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "coach_recommendation",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              recommendation: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  reason: { type: "string" },
                  estimated_minutes: { type: "integer" }
                },
                required: ["title", "reason", "estimated_minutes"]
              }
            },
            required: ["recommendation"]
          }
        }
      }
    });

    res.json(JSON.parse(response.output_text));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate coaching recommendation" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Study Pet backend listening on port ${port}`);
});
