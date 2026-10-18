'use client';

import { useState } from 'react';
import { BETA_PRICING } from '@/lib/pricing';
import { estimate, sliderToValue } from '@/lib/pricing-estimate';
import css from './credit-estimate.module.css';

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
const formatCost = (value: number) => (value > 0 && value < 0.01 ? 'Less than $0.01' : money(value));
const count = (value: number) => value.toLocaleString('en-US');
const CREDIT = BETA_PRICING.startingCredit;

function Slider({ id, label, value, min, max, valueText, onChange }: {
  id: string; label: string; value: number; min: number; max: number; valueText: string; onChange: (v: number) => void;
}) {
  return (
    <div className={css.ctl}>
      <div className={css.top}>
        <label htmlFor={id} className={css.label}>{label}</label>
        <span className={css.val} aria-hidden="true">{valueText}</span>
      </div>
      <input
        id={id} type="range" min={min} max={max} step={1} value={value}
        aria-valuetext={valueText}
        style={{ '--p': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties}
        onChange={event => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function CreditEstimate() {
  const [reqPos, setReqPos] = useState(50);
  const [tokPos, setTokPos] = useState(50);
  const [extraRuns, setExtraRuns] = useState(0);
  const requests = sliderToValue(reqPos, 1_000, 10_000_000);
  const tokensPerRequest = sliderToValue(tokPos, 100, 10_000);
  const e = estimate({ requests, tokensPerRequest, extraRuns });
  const over = e.over > 0;
  const scale = Math.max(CREDIT, e.total) || CREDIT;

  return (
    <div className={css.calc}>
      <div className={css.inputs}>
        <h2 id="estimate-heading">See what you’d spend.</h2>
        <p className={css.lead}>Try a workload at the beta launch rates. Your first standard training run is included.</p>
        <Slider id="pricing-requests" label="Decision requests" value={reqPos} min={0} max={100} valueText={count(requests)} onChange={setReqPos} />
        <Slider id="pricing-tokens" label="Input tokens per request" value={tokPos} min={0} max={100} valueText={count(tokensPerRequest)} onChange={setTokPos} />
        <Slider id="pricing-training" label="Additional standard training runs" value={extraRuns} min={0} max={10} valueText={String(extraRuns)} onChange={setExtraRuns} />
        <p className={css.fine}>Estimate only. Changing these numbers does not run a model or create a charge.</p>
      </div>
      <div className={css.out}>
        <span className={css.label}>Estimated usage</span>
        <div className={css.total} data-testid="estimate-total">{formatCost(e.total)}</div>
        <div className={css.credit}>
          <div className={css.bar} aria-hidden="true">
            <span className={`${css.seg} ${css.inf}`} style={{ width: `${e.inference / scale * 100}%` }} />
            <span className={`${css.seg} ${css.trn}`} style={{ width: `${e.training / scale * 100}%` }} />
            {over && <span className={css.cap} data-testid="credit-end" style={{ left: `${CREDIT / scale * 100}%` }} />}
          </div>
          <div className={css.legend}>
            <span>Your first <b>${CREDIT}</b> credit</span>
            <span>{over ? `White line = end of $${CREDIT} credit` : `${e.usedPct.toFixed(0)}% used`}</span>
          </div>
        </div>
        <dl className={css.lines}>
          <div><dt>First standard training run</dt><dd className={css.inc}>Included</dd></div>
          <div><dt>Additional training</dt><dd>{formatCost(e.training)}</dd></div>
          <div><dt>Inference</dt><dd>{formatCost(e.inference)}</dd></div>
          <div><dt>Output tokens</dt><dd className={css.free}>Free</dd></div>
        </dl>
        <p className={`${css.left} ${over ? css.over : ''}`} aria-live="polite" data-testid="estimate-left">
          {over ? `${formatCost(e.over)} beyond your first $${CREDIT} credit.` : `${formatCost(e.left)} left from your first $${CREDIT} credit.`}
        </p>
        <p className={css.fine}>All amounts in USD. The ${CREDIT} top-up is credit toward usage, not an extra fee.</p>
      </div>
    </div>
  );
}
