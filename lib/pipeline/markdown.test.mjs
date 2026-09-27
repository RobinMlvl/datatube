import { describe, expect, it } from "vitest";
import { assertSections, bodyFrom, canonicalHeadings, sectionText, sheetHeader, summaryBody } from "./markdown.mjs";

const VIDEO = { id: "dQw4w9WgXcQ", title: "Breakout strategy", channel: "Trader Joe", durationS: 3753, language: "en", publishedAt: "2026-04-12" };
const SHEET = `# Breakout strategy
**Channel:** Trader Joe · **Duration:** 1:02:33 · **Language:** en · **Published:** 2026-04-12 · **Link:** https://www.youtube.com/watch?v=dQw4w9WgXcQ

## 📝 Summary
Trade the break of a range.
## 🎯 Key takeaways
- Wait for a candle to close outside the range.
## 🛠️ Method
Not in the video
`;

describe("sheet markdown", () => {
  it("writes the title and the metadata line from the database, never from the model", () => {
    expect(sheetHeader(VIDEO)).toBe("# Breakout strategy\n**Channel:** Trader Joe · **Duration:** 1:02:33 · **Language:** en · **Published:** 2026-04-12 · **Link:** https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(sheetHeader({ id: "dQw4w9WgXcQ" })).toContain("# dQw4w9WgXcQ\n**Channel:** — · **Duration:** —");
  });

  it("drops anything the model wrote before the first expected section", () => {
    expect(bodyFrom("Sure! Here it is:\n# Title\n## 📝 Summary\nx", "## 📝 Summary")).toBe("## 📝 Summary\nx");
    expect(bodyFrom("no section at all", "## 📝 Summary")).toBe("no section at all");
  });

  it("refuses a sheet that misses a section", () => {
    expect(() => assertSections("## 📝 Summary\n## 🎯 Key takeaways", ["## 📝 Summary", "## 🛠️ Method"], "The summary")).toThrow(/Method/);
  });

  it("reads one section, and the body without the header", () => {
    expect(sectionText(SHEET, "## 📝 Summary")).toBe("Trade the break of a range.");
    expect(sectionText(SHEET, "## 🛠️ Method")).toBe("Not in the video");
    expect(summaryBody(SHEET).startsWith("## 📝 Summary")).toBe(true);
  });

  it("puts back a heading whose invisible variation selector the model dropped", () => {
    const loose = "## 📝 Summary\nx\n## 🛠 Method\ny";
    expect(canonicalHeadings(loose, ["## 📝 Summary", "## 🛠️ Method"])).toBe("## 📝 Summary\nx\n## 🛠️ Method\ny");
  });
});
