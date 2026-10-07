import result from '@/public/model/flight-delay-001.json';
import manifest from '@/public/model/flight-delay-001-manifest.json';

export const flightStudy = result;
export const flightSplits = manifest.splits;
export const flightSource = '/model/flight-delay-001.json';
export const flightMethod = 'https://github.com/ooo-hq/zils/blob/5f34adc/docs/flight-delay-001.md';

const base = result.metrics.base_calibrated;
const adapter = result.metrics.adapter_calibrated;
export const flightImprovement = ((base.brier - adapter.brier) / base.brier * 100).toFixed(1);

export const flightComparisons = [
  { name: 'Shared Zils', note: 'No flight-specific training', metrics: base, adapted: false },
  { name: 'Flight-trained Zils', note: 'Trained on January flights', metrics: adapter, adapted: true },
  { name: 'Historical delay rates', note: 'Simple baseline from the same training data', metrics: result.metrics.historical_rate, adapted: false },
] as const;
