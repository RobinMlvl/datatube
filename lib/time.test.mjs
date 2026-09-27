import { describe, expect, it } from "vitest";
import { localDayKey, startOfLocalDay, startOfLocalMonth, startOfNextLocalMonth } from "./time.mjs";

// Robin's calendar is his Mac's local time; expectations are built with the same local clock.
const AT = new Date(2026, 8, 27, 14, 35).getTime(); // 27 Sep 2026, 14:35 local

describe("the local calendar", () => {
  it("finds the start of the day, the month and the next month", () => {
    expect(startOfLocalDay(AT)).toBe(new Date(2026, 8, 27).getTime());
    expect(startOfLocalMonth(AT)).toBe(new Date(2026, 8, 1).getTime());
    expect(startOfNextLocalMonth(AT)).toBe(new Date(2026, 9, 1).getTime());
    expect(startOfNextLocalMonth(new Date(2026, 11, 31, 23, 59).getTime())).toBe(new Date(2027, 0, 1).getTime());
  });

  it("names a day by its local date", () => {
    expect(localDayKey(AT)).toBe("2026-09-27");
    expect(localDayKey(new Date(2026, 0, 5, 0, 1).getTime())).toBe("2026-01-05");
  });
});
