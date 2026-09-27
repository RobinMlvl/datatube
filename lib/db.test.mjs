import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "./db.mjs";

const T = "2026-09-27T10:00:00.000Z";
const fresh = () => openDb(":memory:");
const addVideo = (db, id = "aaaaaaaaaaa") =>
  db.prepare("INSERT INTO Video (id, url, state, createdAt, updatedAt) VALUES (?, ?, 'queued', ?, ?)").run(id, `https://www.youtube.com/watch?v=${id}`, T, T);

describe("the schema", () => {
  it("creates every table and records its version", () => {
    const db = fresh();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all();
    expect(tables).toEqual(expect.arrayContaining(["Video", "Transcript", "Summary", "Theme", "ImportBatch", "Job", "ApiCall", "Setting", "SearchIndex"]));
    expect(db.pragma("user_version", { simple: true })).toBe(1);
  });

  it("refuses a video state, a job step or a theme source outside the contract", () => {
    const db = fresh();
    expect(() => db.prepare("INSERT INTO Video (id, url, state, createdAt, updatedAt) VALUES ('bbbbbbbbbbb', 'u', 'weird', ?, ?)").run(T, T)).toThrow(/CHECK/);
    addVideo(db);
    expect(() => db.prepare("INSERT INTO Job (videoId, step, runAfter, createdAt, updatedAt) VALUES ('aaaaaaaaaaa', 'dance', ?, ?, ?)").run(T, T, T)).toThrow(/CHECK/);
    expect(() => db.prepare("UPDATE Video SET themeSource = 'guess' WHERE id = 'aaaaaaaaaaa'").run()).toThrow(/CHECK/);
  });

  it("refuses a cost that is not a non-negative integer", () => {
    const db = fresh();
    const insert = db.prepare("INSERT INTO ApiCall (provider, feature, costMicrousd, createdAt) VALUES ('deepseek', 'summary', ?, ?)");
    expect(() => insert.run(1.5, T)).toThrow(/CHECK/);
    expect(() => insert.run(-1, T)).toThrow(/CHECK/);
    expect(() => insert.run(1500, T)).not.toThrow();
  });

  it("removes a video's transcript, summary and jobs with it", () => {
    const db = fresh();
    addVideo(db);
    db.prepare("INSERT INTO Transcript (videoId, language, kind, text, chars) VALUES ('aaaaaaaaaaa', 'en', 'auto', '[00:01] hi', 10)").run();
    db.prepare("INSERT INTO Summary (videoId, markdown, model, createdAt) VALUES ('aaaaaaaaaaa', '# x', 'm', ?)").run(T);
    db.prepare("INSERT INTO Job (videoId, step, runAfter, createdAt, updatedAt) VALUES ('aaaaaaaaaaa', 'fetch', ?, ?, ?)").run(T, T, T);
    db.prepare("DELETE FROM Video WHERE id = 'aaaaaaaaaaa'").run();
    for (const table of ["Transcript", "Summary", "Job"]) {
      expect(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get()).toBe(0);
    }
  });

  it("migrates a file once and reopens it as it was", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "datatube-db-"));
    const file = path.join(dir, "nested", "lib.db");
    const first = openDb(file);
    addVideo(first);
    first.close();
    const again = openDb(file);
    expect(again.prepare("SELECT COUNT(*) FROM Video").pluck().get()).toBe(1);
    again.close();
    const reader = openDb(file, { readonly: true });
    expect(() => addVideo(reader, "ccccccccccc")).toThrow(/readonly/i);
    reader.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
