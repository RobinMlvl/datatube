// One SQLite file is the whole library. The web app, the worker and the MCP server each open it;
// WAL lets the readers read while the worker writes.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA, SCHEMA_VERSION } from "./schema.mjs";

export function dbPath() {
  return process.env.DATATUBE_DB?.trim() || path.join(process.cwd(), "data", "datatube.db");
}

export function migrate(db) {
  const version = db.pragma("user_version", { simple: true });
  if (version >= SCHEMA_VERSION) return;
  db.exec(SCHEMA);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

export function openDb(file = dbPath(), { readonly = false } = {}) {
  const inMemory = file === ":memory:";
  if (!inMemory && !readonly) fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file, readonly ? { readonly: true, fileMustExist: true } : {});
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  if (!readonly) {
    if (!inMemory) db.pragma("journal_mode = WAL");
    migrate(db);
  }
  return db;
}

// The web app shares one connection; kept on globalThis so a dev hot reload does not open another.
export function getDb() {
  globalThis.__datatubeDb ??= openDb();
  return globalThis.__datatubeDb;
}
