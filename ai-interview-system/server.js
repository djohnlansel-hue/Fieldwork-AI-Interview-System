const express = require("express");
const path = require("path");
const crypto = require("crypto");
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

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self)");
  next();
});

app.use(express.json({ limit: "2mb" }));
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



const APP_USERNAME = process.env.APP_USERNAME || "";
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const APP_SESSION_SECRET = process.env.APP_SESSION_SECRET || "";
const authRequested = Boolean(APP_USERNAME || APP_PASSWORD || APP_SESSION_SECRET);
const authConfigured = Boolean(APP_USERNAME && APP_PASSWORD && APP_SESSION_SECRET.length >= 32);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const loginAttempts = new Map();

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", APP_SESSION_SECRET).update(encoded).digest("base64url");
  return encoded + "." + signature;
}
function readSession(req) {
  if (!authRequested) return { authenticated: true, username: "configured-by-deployment" };
  if (!authConfigured) return null;
  const cookies = String(req.headers.cookie || "").split(";").map(x => x.trim());
  const token = cookies.find(x => x.startsWith("fieldwork_session="))?.slice("fieldwork_session=".length);
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", APP_SESSION_SECRET).update(encoded).digest("base64url");
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.exp < Date.now() || payload.u !== APP_USERNAME) return null;
    return { authenticated: true, username: payload.u };
  } catch { return null; }
}

app.get("/api/session", (req, res) => {
  const session = readSession(req);
  res.setHeader("Cache-Control", "no-store");
  return res.json({ authRequired: authRequested, authConfigured, authenticated: Boolean(session), username: session?.username || null });
});

app.post("/api/login", (req, res) => {
  if (!authConfigured) return res.status(503).json({ error: "Login is not configured securely. Set APP_USERNAME, APP_PASSWORD, and a 32-character APP_SESSION_SECRET in Render." });
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const recent = (loginAttempts.get(key) || []).filter(time => now - time < 60_000);
  if (recent.length >= 10) return res.status(429).json({ error: "Too many login attempts. Please wait a minute and try again." });
  recent.push(now); loginAttempts.set(key, recent);
  const username = String(req.body?.username || "");
  const password = String(req.body?.password || "");
  if (!safeEqual(username, APP_USERNAME) || !safeEqual(password, APP_PASSWORD)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  const token = signSession({ u: APP_USERNAME, exp: Date.now() + SESSION_TTL_MS });
  res.setHeader("Set-Cookie", "fieldwork_session=" + token + "; HttpOnly; Path=/; SameSite=Strict; Max-Age=" + Math.floor(SESSION_TTL_MS / 1000) + (process.env.NODE_ENV === "production" ? "; Secure" : ""));
  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true });
});

app.post("/api/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "fieldwork_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0" + (process.env.NODE_ENV === "production" ? "; Secure" : ""));
  return res.json({ ok: true });
});

app.use("/api", (req, res, next) => {
  if (req.path === "/session" || req.path === "/login" || req.path === "/logout") return next();
  if (authRequested && !authConfigured) return res.status(503).json({ error: "Server login is enabled but misconfigured. Set APP_USERNAME, APP_PASSWORD, and APP_SESSION_SECRET (at least 32 characters)." });
  if (!readSession(req)) return res.status(401).json({ error: "Please log in to access Fieldwork." });
  next();
});

const generationAttempts = new Map();
app.post("/api/generate-questions", async (req, res) => {
  const now = Date.now();
  const clientKey = req.ip || req.socket.remoteAddress || "unknown";
  const recent = (generationAttempts.get(clientKey) || []).filter(time => now - time < 60_000);
  if (recent.length >= 10) return res.status(429).json({ error: "Too many AI generation requests. Please wait a minute and try again." });
  recent.push(now); generationAttempts.set(clientKey, recent);
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
            content: "You are an information-systems requirements analyst. Create neutral, clear, non-leading interview questions. Return valid JSON only in the shape {\"questions\":[{\"text\":string,\"category\":string,\"difficulty\":\"Easy\"|\"Medium\"|\"Hard\",\"relevance\":number,\"tags\":string[],\"followUp\":string}]}. Categories should be relevant to workflow, pain points, system limitations, user expectations, desired features, or general. Do not claim to have interviewed anyone."
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
      supabaseConfigured: false,
      authConfigured,
      authRequested
    });
  }

  try {
    const { error } = await supabase
      .from("fieldwork_app_state")
      .select("id")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    return res.json({ ok: true, storage: "supabase", supabaseConfigured: true, authConfigured, authRequested });
  } catch (error) {
    console.error("Supabase health check failed:", error.message);
    return res.status(503).json({
      ok: false,
      storage: "supabase",
      supabaseConfigured: true,
      authConfigured,
      authRequested,
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
