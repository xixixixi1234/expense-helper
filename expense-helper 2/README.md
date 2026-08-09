# ExpenseHelper — AI Audit Assistant

A single-claim expense audit UI (matching the provided design) with drag-and-drop
receipt upload and a GPT-backed chat assistant. Deployable to Railway.

## Local run

```bash
npm install
cp .env.example .env      # then paste your OpenAI key
npm start                 # http://localhost:3000
```

## Deploy to Railway

1. Push this folder to a GitHub repo.
2. Railway → **New Project → Deploy from GitHub repo** → pick the repo.
3. Railway → **Variables**, add:
   - `OPENAI_API_KEY` = your key
   - `OPENAI_MODEL` = `gpt-4o-mini` (optional)
4. Railway auto-detects Node (Nixpacks) and runs `npm start`. It sets `PORT` for you.

Alternatively with the CLI: `railway up`.

## How the assistant behaves

The chat sends the claim details to GPT and asks it to assess the claim against a
standard expense guide, while reminding the auditor that the final Approve/Reject
call is theirs. When the claim genuinely looks clean, it says so and notes you may
click Approve.

**Without an API key**, the app returns a clearly-labelled demo placeholder:

> This claim is valid. The hotel cost fits a normal 3 night trip. The receipt is
> present and the claim is on time. Click Approve to finalize.

Set `OPENAI_API_KEY` to switch from placeholder to real model output.

## Files

- `server.js` — Express server, `/api/chat`, `/api/upload`, `/api/health`
- `public/index.html` — the UI
- `railway.json` / `Procfile` — deploy config
