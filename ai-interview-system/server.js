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
