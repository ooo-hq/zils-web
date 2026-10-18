import { BETA_PRICING } from './pricing';

const CAP = 1e12; // keeps products finite

const clean = (n: number) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), CAP) : 0);
const cents = (n: number) => Math.round(n * 1e6) / 1e6; // strips float noise so exactly $5 is not "over"

export function estimate({ requests, tokensPerRequest, extraRuns }: { requests: number; tokensPerRequest: number; extraRuns: number }) {
  const inference = clean(requests) * clean(tokensPerRequest) / 1_000_000 * BETA_PRICING.millionInputTokens;
  const training = clean(extraRuns) * BETA_PRICING.trainingRun;
  const total = inference + training;
  const diff = cents(BETA_PRICING.startingCredit - total);
  return {
    inference, training, total,
    left: Math.max(0, diff),
    over: Math.max(0, -diff),
    usedPct: Math.min(100, total / BETA_PRICING.startingCredit * 100),
  };
}

/** 0-100 slider position to a log-scale value between lo and hi, rounded to 2 significant figures. */
export function sliderToValue(pos: number, lo: number, hi: number): number {
  const p = Number.isFinite(pos) ? Math.min(Math.max(pos, 0), 100) : 0;
  const raw = 10 ** (Math.log10(lo) + (Math.log10(hi) - Math.log10(lo)) * p / 100);
  return Number(raw.toPrecision(2));
}
