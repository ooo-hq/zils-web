import { CountUp } from './count-up';

/** Before/after percentages that count up on mount. Final values without JS or under reduced motion. */
export function CountPair({ before, after, className }: { before: number; after: number; className: string }) {
  return (
    <dl className={className} aria-label="Accuracy before and after training">
      <div><dt>Before training</dt><dd><CountUp value={before} decimals={1} suffix="%" start /></dd></div>
      <div><dt>After training</dt><dd><CountUp value={after} decimals={1} suffix="%" start /></dd></div>
    </dl>
  );
}
