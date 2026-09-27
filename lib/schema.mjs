// The library's contract. A change here is a new SCHEMA_VERSION and a migration step in db.mjs.
export const SCHEMA_VERSION = 1;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS Theme (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  parentId INTEGER REFERENCES Theme(id) ON DELETE RESTRICT,
  sheetMarkdown TEXT,
  sheetModel TEXT,
  sheetGeneratedAt TEXT,
  changesSinceSheet INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ImportBatch (
  id INTEGER PRIMARY KEY,
  input TEXT NOT NULL,
  videoCount INTEGER NOT NULL DEFAULT 0,
  skippedCount INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Video (
  id TEXT PRIMARY KEY CHECK (length(id) = 11),
  url TEXT NOT NULL,
  title TEXT,
  channel TEXT,
  channelId TEXT,
  durationS INTEGER,
  publishedAt TEXT,
  chapters TEXT,
  language TEXT,
  state TEXT NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued','fetching','summarizing','classifying','done','no_transcript','failed')),
  error TEXT,
  themeId INTEGER REFERENCES Theme(id) ON DELETE SET NULL,
  themeSource TEXT CHECK (themeSource IN ('auto','manual','proposed')),
  proposedTheme TEXT,
  classifyConfidence INTEGER CHECK (classifyConfidence BETWEEN 0 AND 1000),
  importBatchId INTEGER REFERENCES ImportBatch(id),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS Video_theme ON Video(themeId);
CREATE INDEX IF NOT EXISTS Video_state ON Video(state);

CREATE TABLE IF NOT EXISTS Transcript (
  videoId TEXT PRIMARY KEY REFERENCES Video(id) ON DELETE CASCADE,
  language TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('manual','auto')),
  text TEXT NOT NULL,
  chars INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Summary (
  videoId TEXT PRIMARY KEY REFERENCES Video(id) ON DELETE CASCADE,
  markdown TEXT NOT NULL,
  model TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Job (
  id INTEGER PRIMARY KEY,
  videoId TEXT NOT NULL REFERENCES Video(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN ('fetch','summarize','classify')),
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','done','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  runAfter TEXT NOT NULL,
  error TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS Job_ready ON Job(state, runAfter);

CREATE TABLE IF NOT EXISTS ApiCall (
  id INTEGER PRIMARY KEY,
  provider TEXT NOT NULL,
  feature TEXT NOT NULL,
  model TEXT,
  videoId TEXT,
  themeId INTEGER,
  tokensIn INTEGER,
  tokensOut INTEGER,
  costMicrousd INTEGER NOT NULL CHECK (typeof(costMicrousd) = 'integer' AND costMicrousd >= 0),
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ApiCall_video ON ApiCall(videoId);

CREATE TABLE IF NOT EXISTS Setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS SearchIndex USING fts5(
  videoId UNINDEXED, title, summary, transcript,
  tokenize = 'unicode61 remove_diacritics 2'
);
`;
