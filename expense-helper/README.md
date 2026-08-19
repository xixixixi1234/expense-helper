# ExpenseHelper - AI Audit Experiment Platform (Gemini)

An expense-audit UI for a human-subjects experiment. Participants log in with an
ID, review 3 preset invoices (image + AI-extracted fields), chat with a Gemini
audit assistant, and Approve/Reject. All actions are logged for analysis. An
admin panel manages the preset invoices and exports the data.

## Pages
- `/`            Participant login (enter a participant ID)
- `/experiment`  Participant view: 3 preset invoices, AI chat, Approve/Reject
- `/admin`       Admin: upload/edit the 3 presets, view + export participant data

## Deploy to Railway
1. Put these files at the **repo root** (not inside a subfolder).
2. Railway -> Deploy from GitHub repo.
3. Railway -> Variables:
   - `GEMINI_API_KEY` = your Google AI Studio key  (get one free at aistudio.google.com)
   - `GEMINI_MODEL`   = `gemini-1.5-flash` (optional)
   - `ADMIN_KEY`      = a password of your choice (default `admin123` - CHANGE IT)
4. Settings -> Networking -> Generate Domain to get a public URL.

## Admin workflow
1. Go to `/admin`, enter your `ADMIN_KEY`.
2. For each of the 3 invoices: upload the real invoice image, edit the Fields JSON
   (employee, amount, dates, etc.), click Save.
3. Give participants the site URL. They log in and review.
4. Come back to `/admin`, click **Download JSONL** to get all logged events.

## IMPORTANT - data persistence
Data is written to `data/events.jsonl` on the server's local disk. Railway's disk
is **ephemeral**: a restart or redeploy wipes it. **Export your data (Download JSONL)
as soon as your session finishes.** For long-running studies, attach a Railway
Volume and set `DATA_DIR` / `UPLOAD_DIR` to the mounted path.

## Without a key
If `GEMINI_API_KEY` is not set, extraction and chat return clearly-labelled
placeholder responses so you can preview the flow.
