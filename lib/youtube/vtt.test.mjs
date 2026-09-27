import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseVtt, transcriptText } from "./vtt.mjs";

const fixture = (name) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("parseVtt", () => {
  it("keeps the clean text of YouTube's rolling auto captions, once, without word tags", () => {
    expect(parseVtt(fixture("auto.en.vtt"))).toEqual([
      { startS: 2, text: "hello everyone welcome" },
      { startS: 5, text: "to the breakout setup" },
      { startS: 3723, text: "stop & target at 2R" },
    ]);
  });

  it("reads every cue of manual subtitles, lines joined, tags stripped, repeats dropped", () => {
    expect(parseVtt(fixture("manual.fr.vtt"))).toEqual([
      { startS: 1, text: "Bonjour à tous, bienvenue" },
      { startS: 65, text: "On attend la clôture au-dessus de la résistance." },
    ]);
  });

  it("returns nothing for an empty or broken file", () => {
    expect(parseVtt("")).toEqual([]);
    expect(parseVtt("WEBVTT\n\nnot a cue")).toEqual([]);
  });

  it("writes the transcript one stamped line per segment", () => {
    expect(transcriptText([{ startS: 2, text: "hello" }, { startS: 3723, text: "late" }])).toBe("[00:02] hello\n[1:02:03] late");
  });
});
