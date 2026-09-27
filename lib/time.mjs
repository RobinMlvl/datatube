// Every date in the database is a UTC ISO string made from milliseconds — the one clock seam.
export const iso = (ms) => new Date(ms).toISOString();

// Robin's calendar — "today", "this month", the budget's month — is his Mac's local time.
// Pure functions of a given instant: they never read the clock.
const pad = (n) => String(n).padStart(2, "0");
export const startOfLocalDay = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
export const startOfLocalMonth = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
export const startOfNextLocalMonth = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); };
export const localDayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
