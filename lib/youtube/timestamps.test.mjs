import { describe, expect, it } from "vitest";
import { formatTimestamp, lineSeconds, linkTimestamps, parseTimestamp } from "./timestamps.mjs";

describe("timestamps", () => {
  it("formats minutes:seconds, and hours only past one hour", () => {
    expect(formatTimestamp(0)).toBe("00:00");
    expect(formatTimestamp(65.9)).toBe("01:05");
    expect(formatTimestamp(3723)).toBe("1:02:03");
  });

  it("reads what it writes, and nothing else", () => {
    expect(parseTimestamp("01:05")).toBe(65);
    expect(parseTimestamp("1:02:03")).toBe(3723);
    expect(parseTimestamp("75:10")).toBe(4510);
    expect(parseTimestamp("00:00:02.310")).toBe(2);
    expect(parseTimestamp("1:5")).toBeNull();
    expect(parseTimestamp("soon")).toBeNull();
  });

  it("reads the second of a transcript line", () => {
    expect(lineSeconds("[01:05] wait for the close")).toBe(65);
    expect(lineSeconds("no stamp")).toBeNull();
  });

  it("turns each bare [MM:SS] into a seek link, and leaves existing links alone", () => {
    expect(linkTimestamps('Stop under the range — [01:05] "wait for the close"'))
      .toBe('Stop under the range — [01:05](#t=65) "wait for the close"');
    expect(linkTimestamps("[1:02:03] late")).toBe("[1:02:03](#t=3723) late");
    expect(linkTimestamps("[01:05](#t=65)")).toBe("[01:05](#t=65)");
    expect(linkTimestamps("[Video A · 01:05]")).toBe("[Video A · 01:05]");
  });
});
