/**
 * @OnlyCurrentDoc
 *
 * Flashcards MVP (Google Apps Script Web App, container-bound to the Sheet)
 *
 * Deployment (MVP/no-auth):
 * - Execute as: Me
 * - Who has access: Anyone
 *
 * Embedding:
 * - doGet() sets XFrameOptionsMode.ALLOWALL so it can render in an iframe.
 *
 * Audio (optional):
 * - If the sheet has an "Audio_path" column (e.g. "1.mp3"), the web app can
 *   serve it from Drive via `?audio=<filename>` and the UI can play it.
 */

const CONFIG = {
  // Container-bound: this script must be attached to the spreadsheet.
  SHEET_NAME: "Flashcards_Sheet",

  // Header names (case/spacing-insensitive) used to locate columns.
  PROMPT_HEADER: "Characters",
  ANSWER_HEADER: "Answer",
  PINYIN_HEADER: "Pinyin", // optional

  // Optional (if present, set to the selected grade 1-4)
  SCORE_HEADER: "Score",

  // Optional: mp3 filename in a Drive folder (e.g. "1.mp3").
  AUDIO_HEADER: "Audio_path",
  // Drive folder that contains the audio files referenced by AUDIO_HEADER.
  AUDIO_FOLDER_ID: "1L7jo9HZw_QRj_Kn_fvB9enr5NsADgsyD",

  // Optional: if present, only TRUE rows are eligible.
  ENABLED_HEADER: "enabled",

  // Optional: if set (number), only cards with Day <= DAY_LIMIT are eligible.
  DAY_HEADER: "Day",
  DAY_LIMIT: null,

  // Progress columns (auto-created if missing).
  LAST_REVIEWED_HEADER: "last_reviewed",
  LAST_SCORE_HEADER: "last_score",
  REVIEW_COUNT_HEADER: "review_count",

  HEADER_ROW: 1
};

function doGet(e) {
  const audio = e && e.parameter && e.parameter.audio;
  if (audio) return serveAudio_(audio);

  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Flashcards")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getNextCard() {
  const sheet = getCardSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length < CONFIG.HEADER_ROW) {
    throw new Error("Sheet has no header row.");
  }

  const headerValues = data[CONFIG.HEADER_ROW - 1];
  const headerMap = buildHeaderMap_(headerValues);

  const promptCol = mustCol_(headerMap, CONFIG.PROMPT_HEADER, headerValues);
  const answerCol = mustCol_(headerMap, CONFIG.ANSWER_HEADER, headerValues);
  const pinyinCol = optionalCol_(headerMap, CONFIG.PINYIN_HEADER);
  const audioCol = optionalCol_(headerMap, CONFIG.AUDIO_HEADER);
  const enabledCol = optionalCol_(headerMap, CONFIG.ENABLED_HEADER);
  const dayCol = optionalCol_(headerMap, CONFIG.DAY_HEADER);

  const candidates = [];
  for (let r = CONFIG.HEADER_ROW; r < data.length; r++) {
    const row = data[r];
    const prompt = row[promptCol];
    if (prompt === "" || prompt === null) continue;

    if (
      CONFIG.DAY_LIMIT !== null &&
      CONFIG.DAY_LIMIT !== undefined &&
      dayCol !== null
    ) {
      const rawDay = row[dayCol];
      if (rawDay === "" || rawDay === null) continue;
      const dayVal = Number(rawDay);
      if (!Number.isFinite(dayVal)) continue;
      if (dayVal > Number(CONFIG.DAY_LIMIT)) continue;
    }

    if (enabledCol !== null) {
      const enabled = row[enabledCol];
      if (!isTruthySheetValue_(enabled)) continue;
    }

    candidates.push({
      rowNumber: r + 1, // 1-based sheet row number
      prompt: String(prompt),
      answer: String(row[answerCol] ?? ""),
      pinyin: pinyinCol !== null ? String(row[pinyinCol] ?? "") : "",
      audioPath:
        audioCol !== null ? String(row[audioCol] ?? "").trim() : ""
    });
  }

  if (candidates.length === 0) {
    throw new Error(
      "No cards found. Check sheet name, headers, and (optional) enabled/day columns."
    );
  }

  // Random pick, but avoid repeating the immediately previous served row when possible.
  const props = PropertiesService.getScriptProperties();
  const lastRow = Number(props.getProperty("last_served_row") || "0");

  let chosen = null;
  for (let i = 0; i < 20; i++) {
    const c = candidates[Math.floor(Math.random() * candidates.length)];
    if (candidates.length === 1 || c.rowNumber !== lastRow) {
      chosen = c;
      break;
    }
  }
  if (!chosen) chosen = candidates[Math.floor(Math.random() * candidates.length)];

  props.setProperty("last_served_row", String(chosen.rowNumber));
  return chosen;
}

function gradeCard(rowNumber, score) {
  const rowNum = Number(rowNumber);
  const s = Number(score);
  if (!Number.isFinite(rowNum) || rowNum <= CONFIG.HEADER_ROW) {
    throw new Error("Invalid rowNumber.");
  }
  if (![1, 2, 3, 4].includes(s)) throw new Error("Score must be 1, 2, 3, or 4.");

  const sheet = getCardSheet_();
  const headerRange = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, sheet.getLastColumn());
  const headerValues = headerRange.getValues()[0];
  let headerMap = buildHeaderMap_(headerValues);

  headerMap = ensureProgressColumns_(sheet, headerValues, headerMap);

  const lastReviewedCol = mustCol_(
    headerMap,
    CONFIG.LAST_REVIEWED_HEADER,
    headerValues
  );
  const lastScoreCol = mustCol_(headerMap, CONFIG.LAST_SCORE_HEADER, headerValues);
  const reviewCountCol = mustCol_(
    headerMap,
    CONFIG.REVIEW_COUNT_HEADER,
    headerValues
  );
  const scoreCol = optionalCol_(headerMap, CONFIG.SCORE_HEADER);

  const reviewCountCell = sheet.getRange(rowNum, reviewCountCol + 1);
  const currentCount = Number(reviewCountCell.getValue() || 0);
  const nextCount = Number.isFinite(currentCount) ? currentCount + 1 : 1;

  sheet.getRange(rowNum, lastReviewedCol + 1).setValue(new Date());
  sheet.getRange(rowNum, lastScoreCol + 1).setValue(s);
  reviewCountCell.setValue(nextCount);
  if (scoreCol !== null) {
    sheet.getRange(rowNum, scoreCol + 1).setValue(s);
  }

  return { ok: true };
}

function getCardSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (CONFIG.SHEET_NAME) {
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (sheet) return sheet;
  }
  const sheets = ss.getSheets();
  if (sheets.length === 0) throw new Error("Spreadsheet has no sheets.");
  return sheets[0];
}

function buildHeaderMap_(headerValues) {
  const map = {};
  for (let i = 0; i < headerValues.length; i++) {
    const raw = headerValues[i];
    if (raw === "" || raw === null) continue;
    const key = normalizeHeader_(raw);
    if (!key) continue;
    if (map[key] === undefined) map[key] = i;
  }
  return map;
}

function normalizeHeader_(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\w]/g, "");
}

function mustCol_(headerMap, headerName, headerValues) {
  const idx = optionalCol_(headerMap, headerName);
  if (idx === null) {
    const found = listHeaders_(headerValues);
    const suffix = found ? " Found headers: " + found : "";
    throw new Error('Missing required header: "' + headerName + '".' + suffix);
  }
  return idx;
}

function optionalCol_(headerMap, headerName) {
  const key = normalizeHeader_(headerName);
  return headerMap[key] === undefined ? null : headerMap[key];
}

function listHeaders_(headerValues) {
  if (!headerValues || !headerValues.length) return "";
  const parts = headerValues
    .map((h) => String(h ?? "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "";
}

function ensureProgressColumns_(sheet, headerValues, headerMap) {
  const wanted = [
    CONFIG.LAST_REVIEWED_HEADER,
    CONFIG.LAST_SCORE_HEADER,
    CONFIG.REVIEW_COUNT_HEADER
  ];

  let added = false;
  for (const name of wanted) {
    if (optionalCol_(headerMap, name) !== null) continue;

    headerValues.push(name);
    headerMap[normalizeHeader_(name)] = headerValues.length - 1;
    added = true;
  }

  if (added) {
    sheet
      .getRange(CONFIG.HEADER_ROW, 1, 1, headerValues.length)
      .setValues([headerValues]);
  }

  return headerMap;
}

function isTruthySheetValue_(value) {
  // Accept TRUE/true, "TRUE", 1, "1", "yes", etc.
  if (value === true) return true;
  if (value === false) return false;
  const s = String(value).trim().toLowerCase();
  if (s === "") return false;
  return ["true", "1", "yes", "y"].includes(s);
}

function serveAudio_(audioPath) {
  const name = String(audioPath || "").trim();
  if (!name) {
    return ContentService.createTextOutput("Missing audio filename.").setMimeType(
      ContentService.MimeType.TEXT
    );
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = "audio_id:" + name;
  const cachedId = cache.get(cacheKey);
  if (cachedId) {
    try {
      const blob = DriveApp.getFileById(cachedId).getBlob();
      blob.setName(name);
      blob.setContentType("audio/mpeg");
      return blob;
    } catch (err) {
      // Fall through to re-resolve by name.
    }
  }

  const folderId = String(CONFIG.AUDIO_FOLDER_ID || "").trim();
  if (!folderId) {
    return ContentService.createTextOutput(
      "Audio folder not configured (CONFIG.AUDIO_FOLDER_ID)."
    ).setMimeType(ContentService.MimeType.TEXT);
  }

  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByName(name);
  if (!files.hasNext()) {
    return ContentService.createTextOutput('Audio not found: "' + name + '"').setMimeType(
      ContentService.MimeType.TEXT
    );
  }

  const file = files.next();
  cache.put(cacheKey, file.getId(), 60 * 60 * 6); // 6h
  const blob = file.getBlob();
  blob.setName(name);
  blob.setContentType("audio/mpeg");
  return blob;
}
