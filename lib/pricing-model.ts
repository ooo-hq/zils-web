import { BETA_PRICING } from './pricing';

export const MODEL_FIELDS = {
  zils: { label: 'Zils per customer', min: 0, max: 10_000, step: 1 },
  requests: { label: 'Requests per Zil / month', min: 0, max: 1_000_000_000, step: 1 },
  tokens: { label: 'Input tokens per request', min: 0, max: 1_000_000, step: 1 },
  runs: { label: 'Total training runs per Zil this month', min: 0, max: 10_000, step: 'any' },
  inference: { label: 'Zils serving cost per million input tokens ($)', min: 0, max: 100, step: 'any' },
  training: { label: 'Zils coordination + evaluation per job ($)', min: 0, max: 10_000, step: 'any' },
  minerPayment: { label: 'Direct payment from Zils to miners per job ($)', min: 0, max: 10_000, step: 'any' },
  minerCompute: { label: 'Miner GPU cost per customer job ($)', min: 0, max: 100_000, step: 'any' },
  fixed: { label: 'Zils fixed overhead per month ($)', min: 0, max: 10_000_000, step: 'any' },
  topup: { label: 'Average top-up ($)', min: BETA_PRICING.startingCredit, max: 100_000, step: 'any' },
  newCustomers: { label: 'Customers redeeming their first free run (%)', min: 0, max: 100, step: 'any' },
} as const;

export type ModelField = keyof typeof MODEL_FIELDS;
export type ModelInputs = Record<ModelField, string>;
export type ModelAssumptions = Record<ModelField, number>;

export const WORKLOADS = {
  single: { label: 'One Zil', zils: '1', requests: '100000', tokens: '1000', runs: '1', newCustomers: '0' },
  multiple: { label: 'Five Zils', zils: '5', requests: '100000', tokens: '1000', runs: '1', newCustomers: '0' },
  setup: { label: 'Setup month', zils: '5', requests: '100000', tokens: '1000', runs: '6', newCustomers: '100' },
} as const;

export const DELIVERY_COSTS = {
  lean: { label: 'Lean', inference: '0.005', training: '0.05' },
  base: { label: 'Base', inference: '0.02', training: '0.10' },
  stress: { label: 'Stress', inference: '0.06', training: '0.50' },
} as const;

export const DEFAULT_MODEL_INPUTS: ModelInputs = {
  zils: WORKLOADS.multiple.zils,
  requests: WORKLOADS.multiple.requests,
  tokens: WORKLOADS.multiple.tokens,
  runs: WORKLOADS.multiple.runs,
  inference: DELIVERY_COSTS.base.inference,
  training: DELIVERY_COSTS.base.training,
  minerPayment: '0',
  minerCompute: '1',
  fixed: '500',
  topup: '5',
  newCustomers: '0',
};

export function parseModelInputs(inputs: ModelInputs): ModelAssumptions | null {
  const values = {} as ModelAssumptions;
  for (const key of Object.keys(MODEL_FIELDS) as ModelField[]) {
    const value = Number(inputs[key]);
    const field = MODEL_FIELDS[key];
    if (!inputs[key]?.trim() || !Number.isFinite(value) || value < field.min || value > field.max
      || (field.step === 1 && !Number.isSafeInteger(value))) return null;
    values[key] = value;
  }
  return values;
}

export function modelPricing(assumptions: ModelAssumptions, customers: number) {
  const requestsPerCustomer = assumptions.zils * assumptions.requests;
  const millionTokens = requestsPerCustomer * assumptions.tokens / 1_000_000;
  const jobsPerCustomer = assumptions.zils * assumptions.runs;
  // One first-run credit per customer across their entire portfolio. It discounts
  // an entered job; it never creates an extra job or repeats for every Zil.
  const freeJobsPerCustomer = Math.min(jobsPerCustomer, assumptions.newCustomers / 100);
  const paidJobsPerCustomer = jobsPerCustomer - freeJobsPerCustomer;
  const inferenceRevenuePerCustomer = millionTokens * BETA_PRICING.millionInputTokens;
  const trainingRevenuePerCustomer = paidJobsPerCustomer * BETA_PRICING.trainingRun;
  const revenuePerCustomer = inferenceRevenuePerCustomer + trainingRevenuePerCustomer;
  const servingPerCustomer = millionTokens * assumptions.inference;
  const trainingPerCustomer = jobsPerCustomer * assumptions.training;
  const minerPaymentsPerCustomer = jobsPerCustomer * assumptions.minerPayment;
  // Miner-funded GPU work is a separate network expense, not a Zils deduction.
  const deliveryPerCustomer = servingPerCustomer + trainingPerCustomer + minerPaymentsPerCustomer;
  // Allocate transaction fees across consumed credit, rather than modeling cash timing.
  const feeRate = 0.029 + 0.30 / assumptions.topup;
  const feesPerCustomer = revenuePerCustomer * feeRate;
  const contributionPerCustomer = revenuePerCustomer - deliveryPerCustomer - feesPerCustomer;
  const revenue = customers * revenuePerCustomer;
  const delivery = customers * deliveryPerCustomer;
  const fees = customers * feesPerCustomer;
  return {
    customers, revenue, delivery, fees, revenuePerCustomer, contributionPerCustomer, feeRate,
    zils: customers * assumptions.zils,
    requestsPerCustomer, jobsPerCustomer, freeJobsPerCustomer, paidJobsPerCustomer,
    inferenceRevenuePerCustomer, trainingRevenuePerCustomer,
    freeTrainingJobs: customers * freeJobsPerCustomer,
    paidTrainingJobs: customers * paidJobsPerCustomer,
    serving: customers * servingPerCustomer,
    training: customers * trainingPerCustomer,
    minerPayments: customers * minerPaymentsPerCustomer,
    trainingJobs: customers * jobsPerCustomer,
    minerCompute: customers * jobsPerCustomer * assumptions.minerCompute,
    surplus: revenue - delivery - fees - assumptions.fixed,
    breakEvenCustomers: contributionPerCustomer > 0
      ? Math.ceil(assumptions.fixed / contributionPerCustomer)
      : contributionPerCustomer === 0 && assumptions.fixed === 0 ? 0 : null,
  };
}
