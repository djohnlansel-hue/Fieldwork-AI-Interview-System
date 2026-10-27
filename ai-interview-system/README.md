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

## Persistent database (PostgreSQL)

Fieldwork supports PostgreSQL for persistent server-side storage while preserving the existing `/api/state` interface and browser backup.

1. Create a PostgreSQL database with your hosting provider (for example, a Render PostgreSQL database).
2. In the Fieldwork **web service** settings, add an environment variable named `DATABASE_URL` with the database's **internal connection string** when the database and web service are in the same Render region.
3. Redeploy the web service. On startup, Fieldwork creates the `fieldwork_app_state` table and initializes an empty state row if one does not exist.
4. Check `/healthz`; when PostgreSQL is connected, the response includes `"storage":"postgresql"`.
5. Check the service logs for `Fieldwork PostgreSQL storage is ready.`

Keep `DATABASE_URL` private. Never commit database credentials to GitHub. For local development, omit `DATABASE_URL` to use the JSON-file fallback; set `PGSSLMODE=disable` only when your local database does not support TLS.

### Data and migration notes

The PostgreSQL table stores the app's existing versioned state as JSONB, so surveys, respondents, sessions, questions, responses, and activity continue using the same application API. This upgrade does not intentionally delete existing data. It does not automatically import an existing `fieldwork-data.json` file into PostgreSQL; back up and import that data before switching an existing deployment if it contains records you need. The browser's localStorage backup remains a separate client-side copy and is not a substitute for database backups.

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

The database upgrade provides persistent server-side storage, not a complete production security system. The prototype still needs authentication/authorization, role-based access, backups/restore testing, data retention controls, and stronger multi-user conflict handling before storing sensitive research data. Browser recording currently creates a browser-session media URL; durable media storage and speech-to-text are not implemented. Question generation and sentiment estimates are local heuristics, not a connected LLM service.
