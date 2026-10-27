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

## Connect Supabase PostgreSQL

Fieldwork can use the PostgreSQL database included with Supabase. It uses the existing `/api/state` interface and stores the app's versioned state as JSONB in a `fieldwork_app_state` table.

1. Create or open your project at https://supabase.com/dashboard.
2. In Supabase, open **Project Settings → Database** and find the database connection string. Use the URI/connection string for the PostgreSQL database (not the anon/public API key). If using a connection pooler, choose the session pooler if the direct connection is not available to your host.
3. In the Render dashboard, open the Fieldwork web service → **Environment** and add `SUPABASE_DB_URL` with the Supabase PostgreSQL connection string. Keep it secret; do not put it in source code or commit it to GitHub. If the URI has placeholders, replace them with your actual database password and URL-encode special characters in the password.
4. Save changes and redeploy the Render web service.
5. Open `/healthz` on your deployed app. Success should return `{"ok":true,"storage":"supabase"}`. The server creates `fieldwork_app_state` and an initial empty state row automatically.

The app prioritizes `SUPABASE_DB_URL` when it is set. `DATABASE_URL` remains supported for other PostgreSQL providers. Without either variable, local development falls back to the JSON file. Set `PGSSLMODE=disable` only for a local PostgreSQL server that does not support TLS.

### Data migration and safety

Connecting a new Supabase project does not automatically import old data from `fieldwork-data.json` or browser localStorage. Back up and migrate any existing records before switching, otherwise the new database will start with an empty state. Keep database credentials private. The current prototype still needs authentication/authorization, backups and restore testing, retention controls, and stronger multi-user conflict handling before it is used for sensitive research data.

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
