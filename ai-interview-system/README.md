# Fieldwork — AI-Assisted Interview System

A lightweight, responsive web app for creating interview guides, tracking respondents, capturing interview answers, and reviewing basic analytics.

## Run locally

Requires Node.js 20 or newer.

```bash
cd ai-interview-system
npm install
npm start
``

Open http://localhost:10000.

## Included in this update

- Responsive teal-and-cream Fieldwork interface.
- Survey creation for structured, semi-structured, and unstructured interviews.
- Context-aware local question suggestions in English and Tagalog; a 50-question cap per survey.
- Manual question creation, category/tag metadata, and a reusable question bank.
- Respondent directory and individual, group, and randomized session setup.
- Per-question text answers and Likert-style response capture when a Likert question is configured.
- Browser voice/video recording attempt after explicit consent confirmation.
- Interview history, review, keyword-based sentiment estimates, keyword counts, and CSV exports.
- Local browser backup and a JSON persistence API, with a connected/offline indicator.

## Storage and recording notes

The app stores application state in `fieldwork-data.json` on the server and keeps a browser-local backup in localStorage. This is a small single-instance persistence layer, not a production database. Do not deploy it for sensitive or multi-user research without authentication, authorization, backups, and a proper database.

Media recording uses browser permissions and currently creates a browser-session media URL; durable media storage and speech-to-text transcription are not yet implemented. The question generator, sentiment estimates, and keyword extraction are local heuristic features, not a connected large-language-model service. Sentiment is approximate and should be reviewed by a human.

Offline support provides a local browser backup and reconnect retry, but it is not encrypted and does not yet implement robust multi-device conflict resolution. Avoid storing confidential or personally identifying research data in this prototype.

PDF/Word/Excel report templates, scheduled report delivery, real-time speech transcription/highlighting/follow-up prompts, full multilingual translation for all Philippine languages, and production-grade encrypted offline sync remain future work.
