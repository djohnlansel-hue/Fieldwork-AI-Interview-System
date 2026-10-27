const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, "fieldwork-data.json");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

const EMPTY_STATE = {
  surveys: [],
  respondents: [],
  sessions: [],
  questions: [],
  responses: [],
  activity: []
};

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

async function readSupabaseState() {
  const { data, error } = await supabase
    .from("fieldwork_app_state")
    .select("version,data")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const { data: inserted, error: insertError } = await supabase
      .from("fieldwork_app_state")
      .insert({ id: 1, version: 2, data: EMPTY_STATE })
      .select("version,data")
      .single();

    if (insertError) throw insertError;
    return { version: inserted.version, data: inserted.data };
  }

  return { version: data.version, data: data.data };
}


app.post("/api/generate-questions", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "AI generation is not configured. Add OPENAI_API_KEY to the server environment."
    });
  }

  const body = req.body || {};
  const systemName = String(body.system || "").trim().slice(0, 200);
  const role = String(body.role || "user").trim().slice(0, 120);
  const type = String(body.type || "Structured");
  const language = String(body.language || "English");
  const count = Math.max(1, Math.min(50, Number.parseInt(body.count, 10) || 8));
  const allowedTypes = new Set(["Structured", "Semi-Structured", "Unstructured"]);
  const allowedLanguages = new Set(["English", "Tagalog", "Hiligaynon", "Cebuano"]);
  if (!systemName || !allowedTypes.has(type) || !allowedLanguages.has(language)) {
    return res.status(400).json({ error: "Please provide a system name, supported interview type, and supported language." });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are an information-systems requirements analyst. Create neutral, clear, non-leading interview questions. Return valid JSON only in the shape {\\"questions\\":[{\\"text\\":string,\\"category\\":string,\\"difficulty\\":\\"Easy\\"|\\"Medium\\"|\\"Hard\\",\\"relevance\\":number,\\"tags\\":string[],\\"followUp\\":string}]}. Categories should be relevant to workflow, pain points, system limitations, user expectations, desired features, or general. Do not claim to have interviewed anyone."
          },
          {
            role: "user",
            content: "Create exactly " + count + " interview questions in " + language + " for the information system/project: " + systemName + ". Respondent role: " + role + ". Interview style: " + type + ". For Structured, use concise specific questions suitable for consistent comparison. For Semi-Structured, include open prompts and useful follow-ups. For Unstructured, use broad conversational prompts. Make questions specific to the provided system, non-duplicative, easy to understand, and suitable for requirements gathering. Relevance must be 1-5. Keep all question text and follow-ups in the requested language."
          }
        ]
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("AI question generation failed:", response.status, payload.error?.message || "Unknown provider error");
      return res.status(502).json({ error: "The AI provider could not generate questions. Check the server key, model, and usage limits." });
    }

    let parsed;
    try {
      parsed = JSON.parse(payload.choices?.[0]?.message?.content || "{}");
    } catch {
      return res.status(502).json({ error: "The AI provider returned an invalid question format. Please try again." });
    }
    const generated = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = generated.slice(0, count).map((q) => ({
      text: String(q.text || "").trim().slice(0, 1000),
      category: String(q.category || "General").trim().slice(0, 80),
      difficulty: ["Easy", "Medium", "Hard"].includes(q.difficulty) ? q.difficulty : "Medium",
      relevance: Math.max(1, Math.min(5, Number(q.relevance) || 3)),
      tags: Array.isArray(q.tags) ? q.tags.map(t => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 8) : [],
      followUp: String(q.followUp || "").trim().slice(0, 500)
    })).filter(q => q.text);
    if (!questions.length) return res.status(502).json({ error: "No valid questions were returned. Please try again." });
    return res.json({ questions, provider: "openai", model: process.env.OPENAI_MODEL || "gpt-4o-mini" });
  } catch (error) {
    console.error("AI question generation request failed:", error.message);
    return res.status(502).json({ error: "Could not reach the AI provider. Please try again later." });
  }
});

app.get("/healthz", async (_req, res) => {
  if (!supabase) {
    return res.status(200).json({
      ok: true,
      storage: "json-file",
      supabaseConfigured: false
    });
  }

  try {
    const { error } = await supabase
      .from("fieldwork_app_state")
      .select("id")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    return res.json({ ok: true, storage: "supabase" });
  } catch (error) {
    console.error("Supabase health check failed:", error.message);
    return res.status(503).json({
      ok: false,
      storage: "supabase",
      error: "Supabase connection or table setup failed"
    });
  }
});

app.get("/api/state", async (_req, res) => {
  try {
    if (supabase) {
      return res.json(await readSupabaseState());
    }

    const raw = await fs.readFile(DATA_FILE, "utf8");
    return res.json(JSON.parse(raw));
  } catch (error) {
    if (!supabase && error.code === "ENOENT") {
      return res.json({ version: 2, data: EMPTY_STATE });
    }
    console.error("Unable to read Fieldwork state:", error.message);
    return res.status(503).json({
      error: supabase
        ? "Supabase unavailable; saved data was not changed."
        : "Unable to read saved data"
    });
  }
});

app.put("/api/state", async (req, res) => {
  if (!req.body || req.body.version !== 2 || !req.body.data ||
      typeof req.body.data !== "object" || Array.isArray(req.body.data)) {
    return res.status(400).json({ error: "Invalid state payload" });
  }

  try {
    if (supabase) {
      const { error } = await supabase
        .from("fieldwork_app_state")
        .upsert({
          id: 1,
          version: req.body.version,
          data: req.body.data,
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });

      if (error) throw error;
      return res.json({
        ok: true,
        storage: "supabase",
        savedAt: new Date().toISOString()
      });
    }

    const tmp = DATA_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(req.body, null, 2), "utf8");
    await fs.rename(tmp, DATA_FILE);
    return res.json({
      ok: true,
      storage: "json-file",
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Unable to persist Fieldwork state:", error.message);
    return res.status(503).json({
      error: supabase
        ? "Supabase save failed. Please retry."
        : "Unable to persist data"
    });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const server = app.listen(PORT, () => console.log("Fieldwork server listening on " + PORT));
async function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
