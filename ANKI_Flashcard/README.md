# Flashcards MVP (Google Apps Script + Google Sheets)

Minimal web app for reviewing Chinese flashcards:

1. Shows 1 prompt (e.g., Hanzi)
2. Reveal answer (e.g., meaning)
3. Grade 1-4
4. (Optional) Play audio per card
4. Saves result to the sheet
5. Loads next card

## Files

- `/Users/rogermoreno/Documents/ANKI_Flashcard/gas/Code.gs`
- `/Users/rogermoreno/Documents/ANKI_Flashcard/gas/index.html`
- `/Users/rogermoreno/Documents/ANKI_Flashcard/gas/appsscript.json`

## Setup (manual copy/paste)

1. Open the Google Sheet, then Extensions > Apps Script (creates a container-bound script).
2. Create two files:
   - `Code.gs` (paste `/gas/Code.gs`)
   - `index.html` (paste `/gas/index.html`)
3. In Project Settings, ensure "Show appsscript.json manifest file in editor" is enabled, then paste `/gas/appsscript.json`.
4. In `Code.gs`, update `CONFIG`:
   - `SHEET_NAME`: `Flashcards_Sheet`
   - `PROMPT_HEADER`: `Characters`
   - `TRADITIONAL_HEADER`: `Traditional` (optional)
   - `ANSWER_HEADER`: `Answer`
   - `PINYIN_HEADER`: `Pinyin` (optional)
   - Audio (optional):
     - `AUDIO_HEADER`: `Audio_path` (sheet column with filenames like `1.mp3`)
     - `AUDIO_FOLDER_ID`: Drive folder id containing those mp3 files
   - Optional: set `DAY_LIMIT` to only review rows where `Day <= DAY_LIMIT`
5. Deploy:
   - Deploy > New deployment > Web app
   - Execute as: **Me**
    - Who has access: **Anyone** (or "Anyone with Google account" if you accept login)
6. Copy the Web App URL ending in `/exec`.

## Embed on rologs.com

Use the iframe template at:

- `/Users/rogermoreno/Documents/ANKI_Flashcard/rologs-embed.html`

If embedding fails:
- Confirm `doGet()` uses `setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)`.
- Check your site CSP (if you set one) allows `frame-src` for `https://script.google.com` (and sometimes `https://*.googleusercontent.com`).

## Sheet expectations (MVP)

Header row is required.

Required columns:
- prompt column (e.g., `Characters`)
- answer column (e.g., `Answer`)

Optional column:
- `enabled` (TRUE/FALSE). If present, only TRUE rows are reviewed.
- `Traditional` (optional). If present, the app shows Traditional directly under the main `Characters` prompt on the same card.

Progress columns are auto-created (if missing) on first grade:
- `last_reviewed`
- `last_score`
- `review_count`

Optional:
- If your sheet has a `Score` column, it will also be set to the selected grade (1-4).
- If you set `DAY_LIMIT` in `Code.gs`, only rows with `Day <= DAY_LIMIT` are eligible.
- If your sheet has an `Audio_path` column, the UI shows a small play button next to the prompt.

## OAuth note

`/Users/rogermoreno/Documents/ANKI_Flashcard/gas/Code.gs` uses `@OnlyCurrentDoc` + `SpreadsheetApp.getActiveSpreadsheet()` to keep scopes restricted to the current spreadsheet (helps avoid "This app is blocked" errors).

Audio requires Drive read access (the script serves files from the configured Drive folder).
If you don't get prompted during deployment, open the Apps Script editor and run `authorizeAudioAccess()` once to grant Drive permissions.

If Drive authorization is blocked (you see "This app is blocked"), avoid Drive scopes entirely:
- Share the audio files as "Anyone with the link"
- Put either a full public URL, or the Drive *file id* (recommended), into the `Audio_path` cell
  - file id looks like: `1AbC...` (from a link like `https://drive.google.com/file/d/<ID>/view`)
  - the app will convert file ids to `https://drive.google.com/uc?export=download&id=<ID>` for playback
