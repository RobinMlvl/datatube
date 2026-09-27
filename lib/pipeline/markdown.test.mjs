import { describe, expect, it } from "vitest";
import { assertSections, bodyFrom, canonicalHeadings, parseChapters, sectionText, sheetHeader, summaryBody } from "./markdown.mjs";

const VIDEO = { id: "dQw4w9WgXcQ", title: "Breakout strategy", channel: "Trader Joe", durationS: 3753, language: "en", publishedAt: "2026-04-12" };
const SHEET = `# Breakout strategy
**Channel:** Trader Joe · **Duration:** 1:02:33 · **Language:** en · **Published:** 2026-04-12 · **Link:** https://www.youtube.com/watch?v=dQw4w9WgXcQ

## 🎯 Core idea
Trade the break of a range.
## 📊 Chapters
- \`00:00–01:35\` **Intro** — why ranges
## 💡 Key points
- Wait for the close — [01:05] "wait for the candle to close"
## 🛠️ In practice
Not in the video
`;

describe("sheet markdown", () => {
  it("writes the title and the metadata line from the database, never from the model", () => {
    expect(sheetHeader(VIDEO)).toBe("# Breakout strategy\n**Channel:** Trader Joe · **Duration:** 1:02:33 · **Language:** en · **Published:** 2026-04-12 · **Link:** https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(sheetHeader({ id: "dQw4w9WgXcQ" })).toContain("# dQw4w9WgXcQ\n**Channel:** — · **Duration:** —");
  });

  it("drops anything the model wrote before the first expected section", () => {
    expect(bodyFrom("Sure! Here it is:\n# Title\n## 🎯 Core idea\nx", "## 🎯 Core idea")).toBe("## 🎯 Core idea\nx");
    expect(bodyFrom("no section at all", "## 🎯 Core idea")).toBe("no section at all");
  });

  it("refuses a sheet that misses a section", () => {
    expect(() => assertSections("## 🎯 Core idea\n## 💡 Key points", ["## 🎯 Core idea", "## 📊 Chapters"], "The summary")).toThrow(/Chapters/);
  });

  it("reads one section, and the body without the header", () => {
    expect(sectionText(SHEET, "## 🎯 Core idea")).toBe("Trade the break of a range.");
    expect(sectionText(SHEET, "## 🛠️ In practice")).toBe("Not in the video");
    expect(summaryBody(SHEET).startsWith("## 🎯 Core idea")).toBe(true);
  });

  it("reads stored chapters, and nothing from junk", () => {
    expect(parseChapters('[{"startS":0,"title":"Intro"}]')).toEqual([{ startS: 0, title: "Intro" }]);
    expect(parseChapters("not json")).toEqual([]);
    expect(parseChapters(null)).toEqual([]);
  });

  it("puts back a heading whose invisible variation selector the model dropped", () => {
    const loose = "## 🎯 Core idea\nx\n## 🛠 In practice\ny";
    expect(canonicalHeadings(loose, ["## 🎯 Core idea", "## 🛠️ In practice"])).toBe("## 🎯 Core idea\nx\n## 🛠️ In practice\ny");
  });
});
