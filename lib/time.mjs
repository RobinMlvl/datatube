// Every date in the database is a UTC ISO string made from milliseconds — the one clock seam.
export const iso = (ms) => new Date(ms).toISOString();
