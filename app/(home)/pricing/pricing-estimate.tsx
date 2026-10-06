'use client';

import { useState } from 'react';
import s from './pricing.module.css';

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);

export function PricingEstimate({ startingCredit, trainingRun, millionInputTokens }: {
  startingCredit: number;
  trainingRun: number;
  millionInputTokens: number;
}) {
  const [requests, setRequests] = useState('100000');
  const [tokens, setTokens] = useState('1000');
  const [extraRuns, setExtraRuns] = useState('0');
  const counts = [requests, tokens, extraRuns].map(Number);
  const valid = [requests, tokens, extraRuns].every(value => value.trim() !== '')
    && counts.every(value => Number.isSafeInteger(value) && value >= 0)
    && Number.isSafeInteger(counts[0] * counts[1]);
  const inference = valid ? counts[0] * counts[1] / 1_000_000 * millionInputTokens : 0;
  const training = valid ? counts[2] * trainingRun : 0;
  const total = inference + training;
  const remaining = startingCredit - total;
  const formatCost = (value: number) => value > 0 && value < 0.01 ? 'Less than $0.01' : money(value);

  return (
    <section className={s.estimate} aria-labelledby="estimate-heading">
      <div className={s.estimateInputs}>
        <h2 id="estimate-heading">See what you’d spend.</h2>
        <p>Try a workload at the beta launch rates. Your first standard training run is included.</p>
        <div className={s.fields}>
          <label htmlFor="pricing-requests">Decision requests
            <input id="pricing-requests" type="number" min="0" step="1" inputMode="numeric" value={requests} onChange={event => setRequests(event.target.value)} aria-describedby="pricing-estimate-help" />
          </label>
          <label htmlFor="pricing-tokens">Input tokens per request
            <input id="pricing-tokens" type="number" min="0" step="1" inputMode="numeric" value={tokens} onChange={event => setTokens(event.target.value)} aria-describedby="pricing-estimate-help" />
          </label>
          <label htmlFor="pricing-training">Additional standard training runs
            <input id="pricing-training" type="number" min="0" step="1" inputMode="numeric" value={extraRuns} onChange={event => setExtraRuns(event.target.value)} aria-describedby="pricing-estimate-help" />
          </label>
        </div>
        <p id="pricing-estimate-help" className={s.estimateHint}>{valid ? 'Estimate only. Changing these numbers does not run a model or create a charge.' : 'Enter a non-negative whole number in each field. Very large values are outside this estimator’s range.'}</p>
      </div>
      <div className={s.receipt} aria-live="polite" aria-atomic="true">
        <h3>Your usage estimate</h3>
        <dl>
          <div><dt>First standard training run</dt><dd>Included</dd></div>
          <div><dt>Additional training</dt><dd>{valid ? formatCost(training) : '—'}</dd></div>
          <div><dt>Inference</dt><dd>{valid ? formatCost(inference) : '—'}</dd></div>
          <div><dt>Output tokens</dt><dd>Free</dd></div>
        </dl>
        <div className={s.total}><span>Estimated usage</span><strong>{valid ? formatCost(total) : '—'}</strong></div>
        <p className={s.balance}>{!valid ? 'Add valid amounts to see your estimate.' : remaining >= 0
          ? `${formatCost(remaining)} left from your first $${startingCredit} credit.`
          : `${formatCost(-remaining)} beyond your first $${startingCredit} credit.`}</p>
        <p className={s.receiptNote}>All amounts in USD. The ${startingCredit} top-up is credit toward usage, not an extra fee.</p>
      </div>
    </section>
  );
}
