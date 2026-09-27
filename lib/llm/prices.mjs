// What a call costs, in integer micro-USD. Rates are micro-USD per MILLION tokens, so
// tokens × rate / 1 000 000 is micro-USD. BigInt all along; one rounding (half-up), of the total.
// DeepSeek grid of 2026-09-16, TypeSafe Jev input-only — as Dewex OS bills them.
const RATES = {
  "deepseek-v4-flash": {
    peak: { miss: 300_000n, hit: 6_000n, out: 1_200_000n },
    offPeak: { miss: 150_000n, hit: 3_000n, out: 600_000n },
  },
  "jev-1.13.0": { flat: { miss: 42_000n, hit: 42_000n, out: 0n } },
};

export function isDeepseekPeak(at) {
  const day = at.getUTCDay();
  const hour = at.getUTCHours();
  return day >= 1 && day <= 5 && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10));
}

function ratesFor(model, at) {
  const entry = RATES[model];
  if (!entry) throw new Error(`No price for model "${model}"`);
  if (entry.flat) return entry.flat;
  return isDeepseekPeak(at) ? entry.peak : entry.offPeak;
}

export function costMicrousd(model, { missTokens = 0, hitTokens = 0, outTokens = 0 }, at) {
  const r = ratesFor(model, at);
  const total = BigInt(missTokens) * r.miss + BigInt(hitTokens) * r.hit + BigInt(outTokens) * r.out;
  return Number((total + 500_000n) / 1_000_000n);
}
