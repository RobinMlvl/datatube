import { describe, expect, it, vi } from "vitest";
import { openDb } from "./db.mjs";
import { importInput } from "./importer.mjs";

const T0 = Date.parse("2026-09-27T10:00:00.000Z");

describe("importInput", () => {
  it("queues each new video once, expands lists, counts duplicates and says what it could not read", async () => {
    const db = openDb(":memory:");
    db.prepare("INSERT INTO Video (id, url, state, createdAt, updatedAt) VALUES ('ccccccccccc', 'u', 'done', 't', 't')").run();
    const listEntries = vi.fn(async (url) => {
      if (url.includes("broken")) throw new Error("ERROR: playlist does not exist");
      return [{ videoId: "bbbbbbbbbbb", title: "Part 2" }, { videoId: "aaaaaaaaaaa", title: "Part 1" }, { videoId: "ccccccccccc", title: "Old" }];
    });
    const text = [
      "https://youtu.be/aaaaaaaaaaa",
      "https://www.youtube.com/playlist?list=PLgood",
      "https://www.youtube.com/playlist?list=PLbroken",
      "hello",
    ].join("\n");
    const out = await importInput(db, text, { listEntries, now: () => T0 });
    expect(out).toMatchObject({ imported: 2, skipped: 2, invalid: ["hello"], errors: [{ input: "https://www.youtube.com/playlist?list=PLbroken", message: "ERROR: playlist does not exist" }] });
    expect(listEntries).not.toHaveBeenCalledWith("https://youtu.be/aaaaaaaaaaa");
    expect(db.prepare("SELECT id, title, state FROM Video WHERE id != 'ccccccccccc' ORDER BY id").all()).toEqual([
      { id: "aaaaaaaaaaa", title: null, state: "queued" },
      { id: "bbbbbbbbbbb", title: "Part 2", state: "queued" },
    ]);
    expect(db.prepare("SELECT videoId, step FROM Job ORDER BY videoId").all()).toEqual([
      { videoId: "aaaaaaaaaaa", step: "fetch" },
      { videoId: "bbbbbbbbbbb", step: "fetch" },
    ]);
    expect(db.prepare("SELECT videoCount, skippedCount FROM ImportBatch").get()).toEqual({ videoCount: 2, skippedCount: 2 });
  });

  it("creates no batch when there is nothing to import", async () => {
    const db = openDb(":memory:");
    const out = await importInput(db, "nope", { listEntries: vi.fn(), now: () => T0 });
    expect(out).toEqual({ batchId: null, imported: 0, skipped: 0, invalid: ["nope"], errors: [] });
    expect(db.prepare("SELECT COUNT(*) FROM ImportBatch").pluck().get()).toBe(0);
  });
});
