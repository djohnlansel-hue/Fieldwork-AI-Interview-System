# Fieldwork — AI-Assisted Interview System

A lightweight, responsive web app for creating survey topics, managing interview guides, tracking respondents, capturing interview answers, and reviewing basic analytics.

## Run locally

Requires Node.js 20 or newer.

```bash
cd ai-interview-system
npm install
npm start
```

Open http://localhost:10000.

## Connect Supabase using the Supabase client

Fieldwork uses the Supabase JavaScript client. It does not require a direct PostgreSQL connection string or the `pg` package. Supabase's hosted database itself is PostgreSQL, but the app communicates through the Supabase API.

### 1. Create the table in Supabase

Open https://supabase.com/dashboard, select your project, and go to **SQL Editor → New query**. Run this SQL:

```sql
create table if not exists public.fieldwork_app_state (
  id smallint primary key check (id = 1),
  version integer not null default 2,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.fieldwork_app_state enable row level security;
```

The server inserts the initial state row automatically when needed. The server uses the service-role key and keeps it on the server; do not expose it in browser code.

### 2. Configure Render

In the Render Dashboard, open the Fieldwork web service → **Environment** and add these variables:

- `SUPABASE_URL` — your Supabase project URL (Project Settings → API).
- `SUPABASE_SERVICE_ROLE_KEY` — the service-role/secret key from your Supabase project's API settings. Keep this secret and server-only. Never put it in frontend code or commit it to GitHub.

Remove the old `SUPABASE_DB_URL` and `DATABASE_URL` variables if they were added for the direct PostgreSQL connection. Save and redeploy the service.

### 3. Verify

Open `/healthz` on the deployed app. Success should return:

```json
{"ok":true,"storage":"supabase"}
```

If it returns an error, check that both environment variables are correct and that the SQL table was created.

### Data migration and safety

This change does not automatically import old records from `fieldwork-data.json` or browser localStorage. Back up and migrate any records you need before switching. The service-role key bypasses normal Row Level Security checks, so it must remain secret and be used only by the server. This prototype still needs authentication/authorization and stronger multi-user conflict handling before it is used for sensitive research data.

## Included features

- Responsive teal-and-cream Fieldwork interface.
- Survey topics and interview session setup.
- Manual question creation, category/tag metadata, and a reusable question bank.
- Respondent directory and individual, group, and randomized session setup.
- Per-question text answers and Likert-style response capture when configured.
- Browser voice/video recording attempt after explicit consent confirmation.
- Interview history, review, keyword-based sentiment estimates, keyword counts, and CSV exports.
- Browser-local backup and server persistence with a connected/offline indicator.

## Important limitations

Question generation and sentiment estimates are local heuristics, not a connected LLM service. Browser recording currently creates a browser-session media URL; durable media storage and speech-to-text are not implemented.
