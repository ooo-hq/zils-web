export const ALPHA_SNAPSHOT = 0.604169;
export const SNAPSHOT_DATE = '8 Oct 2026';
export const MONTH_DAYS = 30;

export const INVESTOR_FIELDS = {
  alphaPrice: { label: 'Alpha price', value: ALPHA_SNAPSHOT, max: 1000 },
  ownerAlpha: { label: 'Owner alpha per day', value: 1296, max: 1000000 },
  share: { label: 'Zils share of owner allocation', value: 50, max: 100 },
  sold: { label: 'Alpha sold for cash', value: 100, max: 100 },
  saleCost: { label: 'Sale costs and slippage', value: 0, max: 100 },
  founder: { label: 'CEO + developer salary', value: 10000, max: 100000 },
  bizDev: { label: 'Business development salary', value: 3000, max: 100000 },
  payroll: { label: 'Employer costs on salaries', value: 0, max: 100 },
  hosting: { label: 'DigitalOcean hosting', value: 48, max: 1000000 },
  infrastructure: { label: 'Inference, storage and other infrastructure', value: 0, max: 1000000 },
  other: { label: 'Other monthly cash costs', value: 0, max: 1000000 },
  hostingGrowth: { label: 'Monthly DigitalOcean cost growth', value: 0, max: 100 },
  customers: { label: 'Monthly customer cash receipts', value: 0, max: 10000000 },
  openingCash: { label: 'Opening cash balance', value: 0, max: 100000000 },
  delay: { label: 'Months before emissions begin', value: 0, max: 12 },
} as const;

export type InvestorField = keyof typeof INVESTOR_FIELDS;
export type InvestorInputs = Record<InvestorField, number>;
export type InvestorDraft = Record<InvestorField, string>;
export const DEFAULT_INVESTOR_INPUTS = Object.fromEntries(
  Object.entries(INVESTOR_FIELDS).map(([key, field]) => [key, String(field.value)]),
) as InvestorDraft;

export function validInvestorField(key: InvestorField, raw: string): boolean {
  const value = Number(raw);
  return raw.trim() !== '' && Number.isFinite(value) && value >= 0 &&
    value <= INVESTOR_FIELDS[key].max && (key !== 'delay' || Number.isInteger(value));
}

export function parseInvestorInputs(draft: InvestorDraft): InvestorInputs | null {
  if ((Object.keys(INVESTOR_FIELDS) as InvestorField[]).some(key => !validInvestorField(key, draft[key]))) return null;
  return Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, Number(value)])) as InvestorInputs;
}

export function modelInvestor(input: InvestorInputs) {
  const monthlyAlpha = input.ownerAlpha * MONTH_DAYS * input.share / 100;
  const soldAlpha = monthlyAlpha * input.sold / 100;
  const grossValue = monthlyAlpha * input.alphaPrice;
  const saleProceeds = soldAlpha * input.alphaPrice * (1 - input.saleCost / 100);
  const salaries = input.founder + input.bizDev;
  const employerCosts = salaries * input.payroll / 100;
  const fixedCosts = salaries + employerCosts + input.infrastructure + input.other;
  const monthlyCosts = fixedCosts + input.hosting;
  const cashPerDollarOfAlpha = soldAlpha * (1 - input.saleCost / 100);
  // Emissions-only break-even once payouts start, including the sale fraction and haircut.
  const breakEvenAlpha = monthlyCosts === 0 ? 0 : cashPerDollarOfAlpha > 0 ? monthlyCosts / cashPerDollarOfAlpha : null;
  const coveredFounderSalary = Math.max(0, (saleProceeds - input.hosting - input.infrastructure - input.other) /
    (1 + input.payroll / 100) - input.bizDev);
  let balance = input.openingCash;
  let runwayMonths: number | null = null;
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const hosting = input.hosting * (1 + input.hostingGrowth / 100) ** index;
    const costs = fixedCosts + hosting;
    const emissions = index < input.delay ? 0 : saleProceeds;
    const receipts = emissions + input.customers;
    const net = receipts - costs;
    if (runwayMonths === null && net < 0 && balance + net < 0) {
      runwayMonths = index + Math.max(0, balance) / -net;
    }
    balance += net;
    return { month, hosting, costs, emissions, receipts, net, balance };
  });
  return {
    monthlyAlpha, soldAlpha, retainedAlpha: monthlyAlpha - soldAlpha, grossValue, saleProceeds,
    salaries, employerCosts, monthlyCosts, breakEvenAlpha, coveredFounderSalary,
    emissionsNet: saleProceeds - monthlyCosts,
    coverage: monthlyCosts > 0 ? saleProceeds / monthlyCosts * 100 : null,
    months, runwayMonths, endingCash: balance,
    fundingNeeded: Math.max(0, ...months.map(month => -month.balance)),
  };
}

export type InvestorModel = ReturnType<typeof modelInvestor>;
