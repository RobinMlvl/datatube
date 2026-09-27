import { describe, expect, it } from "vitest";
import { frontMatter, slug, themeBundleFile, themeSheetFile, videoSheetFile } from "./export.mjs";

const VIDEO = { id: "dQw4w9WgXcQ", title: 'Breakout: "the" setup', channel: "Trader Joe", publishedAt: "2026-04-12", durationS: 3753, language: "en" };

describe("export", () => {
  it("makes a safe file name", () => {
    expect(slug("Trading › Breakout Stratégie!")).toBe("trading-breakout-strategie");
    expect(slug("")).toBe("untitled");
  });

  it("writes YAML front matter, leaving out what is unknown", () => {
    expect(frontMatter({ title: 'a "b"', videos: 2, theme: null })).toBe('---\ntitle: "a \\"b\\""\nvideos: 2\n---\n');
  });

  it("exports a video sheet with its provenance", () => {
    const f = videoSheetFile({ video: VIDEO, summary: "# Breakout\n\n## 🎯 Core idea\nx\n", themePath: "Trading › Breakout", model: "deepseek-v4-flash" });
    expect(f.filename).toBe("breakout-the-setup-dQw4w9WgXcQ.md");
    expect(f.content).toBe([
      "---",
      'source: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"',
      'title: "Breakout: \\"the\\" setup"',
      'channel: "Trader Joe"',
      'published: "2026-04-12"',
      'duration: "1:02:33"',
      'language: "en"',
      'theme: "Trading › Breakout"',
      'generated_by: "DataTube · deepseek-v4-flash"',
      "---",
      "",
      "# Breakout\n\n## 🎯 Core idea\nx\n",
    ].join("\n"));
  });

  it("exports a theme sheet, and a bundle with every video sheet after it", () => {
    const sheet = themeSheetFile({ path: "Trading › Breakout", sheetMarkdown: "# Trading › Breakout\n", model: "m", generatedAt: "2026-09-27T10:00:00.000Z", videoCount: 2 });
    expect(sheet.filename).toBe("trading-breakout.md");
    expect(sheet.content).toContain('theme: "Trading › Breakout"\nvideos: 2\ngenerated_at: "2026-09-27T10:00:00.000Z"');
    const bundle = themeBundleFile({ path: "Trading › Breakout", sheetMarkdown: null, model: "m", generatedAt: null, videos: [{ video: VIDEO, summary: "# One\n" }] });
    expect(bundle.filename).toBe("trading-breakout-bundle.md");
    expect(bundle.content).toContain("No consolidated sheet yet");
    expect(bundle.content).toContain("<!-- source: https://www.youtube.com/watch?v=dQw4w9WgXcQ -->\n# One");
  });
});
