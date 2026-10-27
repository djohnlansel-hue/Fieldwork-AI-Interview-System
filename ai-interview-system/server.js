const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, "fieldwork-data.json");
// Use Supabase's PostgreSQL connection string when supplied; DATABASE_URL remains supported.
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const DATABASE_URL = SUPABASE_DB_URL || process.env.DATABASE_URL;
const storageProvider = SUPABASE_DB_URL ? "supabase" : DATABASE_URL ? "postgresql" : "json-file";
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      // Supabase and hosted PostgreSQL connections normally require TLS.
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    })
  : null;

let databaseReady;
async function initializeDatabase() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fieldwork_app_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL DEFAULT 2,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    INSERT INTO fieldwork_app_state (id, version, data)
    VALUES (1, 2, '{"surveys":[],"respondents":[],"sessions":[],"questions":[],"responses":[],"activity":[]}'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log("Fieldwork " + storageProvider + " storage is ready.");
}

if (pool) {
  databaseReady = initializeDatabase().catch((error) => {
    console.error("Fieldwork database initialization failed:", error.message);
    throw error;
  });
  pool.on("error", (error) => console.error("Unexpected database pool error:", error.message));
}

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/healthz", async (_req, res) => {
  if (!pool) return res.status(200).json({ ok: true, storage: "json-file" });
  try {
    await databaseReady;
    await pool.query("SELECT 1");
    return res.status(200).json({ ok: true, storage: storageProvider });
  } catch {
    return res.status(503).json({ ok: false, storage: storageProvider, error: "Database unavailable" });
  }
});

app.get("/api/state", async (_req, res) => {
  try {
    if (pool) {
      await databaseReady;
      const result = await pool.query("SELECT version, data FROM fieldwork_app_state WHERE id = 1");
      if (!result.rows.length) {
        return res.status(500).json({ error: "Application state row is missing" });
      }
      return res.json({ version: result.rows[0].version, data: result.rows[0].data });
    }

    const raw = await fs.readFile(DATA_FILE, "utf8");
    return res.json(JSON.parse(raw));
  } catch (error) {
    if (!pool && error.code === "ENOENT") {
      return res.json({ version: 2, data: { surveys: [], respondents: [], sessions: [], questions: [], responses: [], activity: [] } });
    }
    console.error("Unable to read Fieldwork state:", error.message);
    return res.status(503).json({ error: pool ? "Database unavailable; saved data was not changed." : "Unable to read saved data" });
  }
});

app.put("/api/state", async (req, res) => {
  if (!req.body || req.body.version !== 2 || !req.body.data || typeof req.body.data !== "object" || Array.isArray(req.body.data)) {
    return res.status(400).json({ error: "Invalid state payload" });
  }

  try {
    if (pool) {
      await databaseReady;
      await pool.query(
        `INSERT INTO fieldwork_app_state (id, version, data, updated_at)
         VALUES (1, $1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, data = EXCLUDED.data, updated_at = NOW()`,
        [req.body.version, JSON.stringify(req.body.data)]
      );
      return res.json({ ok: true, storage: storageProvider, savedAt: new Date().toISOString() });
    }

    const tmp = DATA_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(req.body, null, 2), "utf8");
    await fs.rename(tmp, DATA_FILE);
    return res.json({ ok: true, storage: "json-file", savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Unable to persist Fieldwork state:", error.message);
    return res.status(503).json({ error: pool ? "Database unavailable; save failed. Please retry." : "Unable to persist data" });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const server = app.listen(PORT, () => console.log("Fieldwork server listening on " + PORT));
async function shutdown() {
  server.close(async () => {
    if (pool) await pool.end().catch(() => {});
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
