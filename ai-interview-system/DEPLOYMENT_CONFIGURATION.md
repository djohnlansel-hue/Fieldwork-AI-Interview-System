# Fieldwork Deployment Configuration

Configure these environment variables in the Render web service settings. Do not commit secrets to GitHub or put them in browser JavaScript.

## Required for server-managed login

- `APP_USERNAME`: the administrator username used to sign in.
- `APP_PASSWORD`: a strong, unique password.
- `APP_SESSION_SECRET`: a randomly generated secret of at least 32 characters.

If these three values are not set correctly, server-managed login is not enabled. After saving environment variables, redeploy the service. Sessions expire after eight hours; logout clears the session cookie.

## Required for real AI question generation

- `OPENAI_API_KEY`: API key for the AI provider.
- `OPENAI_MODEL` (optional): model name; defaults to `gpt-4o-mini`.

If the AI key is missing or the provider is unavailable, the app transparently falls back to template-based questions.

## Supabase persistence

- `SUPABASE_URL`: the project's Supabase URL.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only service-role key. Never expose this value in frontend code.

The database must contain the `public.fieldwork_app_state` table. Check `/healthz` after deployment; it should report `storage: "supabase"` when configured correctly.

## After changing settings

1. Save environment variables in Render and redeploy.
2. Open `/healthz` and check the reported storage and authentication configuration.
3. Sign in and test creating a survey, generating questions, saving answers, and exporting reports.
4. Keep API keys and passwords private. Do not send them in chat or add them to source control.
