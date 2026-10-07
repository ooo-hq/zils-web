'use client';

import { useState } from 'react';
import { BETA_PRICING } from '@/lib/pricing';
import {
  DEFAULT_MODEL_INPUTS, DELIVERY_COSTS, MODEL_FIELDS, WORKLOADS, modelPricing, parseModelInputs,
  type ModelField, type ModelInputs,
} from '@/lib/pricing-model';
import s from './pricing-lab.module.css';

const usd = (value: number, decimals = 0) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(value);
const count = (value: number) => new Intl.NumberFormat('en-US').format(value);
const customerCounts = [100, 1_000, 2_000];
const workloadFields: ModelField[] = ['requests', 'tokens', 'runs'];
const costFields: ModelField[] = ['inference', 'training', 'minerPayment', 'fixed', 'topup', 'newCustomers'];

export function PricingLab() {
  const [inputs, setInputs] = useState<ModelInputs>(DEFAULT_MODEL_INPUTS);
  const assumptions = parseModelInputs(inputs);
  const results = assumptions ? customerCounts.map(customers => modelPricing(assumptions, customers)) : null;
  const unit = results?.[0];
  const costPreset = Object.entries(DELIVERY_COSTS).find(([, preset]) =>
    Number(preset.inference) === Number(inputs.inference) && Number(preset.training) === Number(inputs.training))?.[0] ?? 'custom';

  function field(key: ModelField) {
    const spec = MODEL_FIELDS[key];
    const value = Number(inputs[key]);
    const invalid = !inputs[key].trim() || !Number.isFinite(value) || value < spec.min || value > spec.max
      || (spec.step === 1 && !Number.isSafeInteger(value));
    return (
      <label className={s.field} key={key} htmlFor={`model-${key}`}>
        {spec.label}
        <input id={`model-${key}`} type="number" min={spec.min} max={spec.max} step={spec.step}
          inputMode={spec.step === 1 ? 'numeric' : 'decimal'} value={inputs[key]} aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'model-error' : undefined}
          onChange={event => setInputs(previous => ({ ...previous, [key]: event.target.value }))} />
      </label>
    );
  }

  return (
    <div className={s.lab}>
      <section className={s.assumptions} aria-labelledby="assumptions-heading">
        <div className={s.sectionHeading}>
          <h2 id="assumptions-heading">Assumptions</h2>
          <button type="button" className={s.reset} onClick={() => setInputs({ ...DEFAULT_MODEL_INPUTS })}>Reset</button>
        </div>
        <p className={s.hint}>Per paying, active customer each month.</p>
        <div className={s.presets} role="group" aria-label="Usage presets">
          {Object.entries(WORKLOADS).map(([key, preset]) => (
            <button key={key} type="button" aria-pressed={workloadFields.every(field => inputs[field].trim() !== '' && Number(inputs[field]) === Number(preset[field as keyof typeof preset]))}
              onClick={() => setInputs(previous => ({ ...previous, requests: preset.requests, tokens: preset.tokens, runs: preset.runs }))}>
              {preset.label}
            </button>
          ))}
        </div>
        <div className={s.fields}>{workloadFields.map(field)}</div>
        <label className={s.field} htmlFor="model-cost-preset">
          Hypothetical Zils costs
          <select id="model-cost-preset" value={costPreset} onChange={event => {
            const preset = DELIVERY_COSTS[event.target.value as keyof typeof DELIVERY_COSTS];
            if (preset) setInputs(previous => ({ ...previous, inference: preset.inference, training: preset.training }));
          }}>
            {Object.entries(DELIVERY_COSTS).map(([key, preset]) => <option key={key} value={key}>{preset.label} — ${preset.inference}/M tokens, ${preset.training}/job</option>)}
            <option value="custom" disabled>Custom costs</option>
          </select>
        </label>
        <p className={s.hint}>These presets cover Zils serving and coordination/evaluation only. All amounts are editable placeholders, not measured costs.</p>
        <details className={s.details}>
          <summary>Adjust Zils costs &amp; first free runs</summary>
          <div className={s.fields}>{costFields.map(field)}</div>
          <p className={s.hint}>Enter only costs Zils pays. Include any Zils-funded idle serving capacity, evaluation and retries. Use fixed overhead for shared costs such as storage and support; do not also count them per job. Direct miner payments default to $0.</p>
        </details>
        <details className={s.details}>
          <summary>Miner GPU costs — separate</summary>
          <div className={s.fields}>{field('minerCompute')}</div>
          <p className={s.hint}>Estimate total GPU expense across all miner attempts for one customer job. This is shown separately and never deducted from Zils revenue. It does not include miner rewards or establish miner profitability.</p>
        </details>
      </section>

      <section className={s.results} aria-labelledby="results-heading">
        <div className={s.resultHeading}>
          <h2 id="results-heading">Zils monthly economics</h2>
          <span>USD</span>
        </div>
        <div className={s.rateStrip}>
          <span>${BETA_PRICING.millionInputTokens} / million input tokens</span>
          <span>${BETA_PRICING.trainingRun} / extra run</span>
          <span>${BETA_PRICING.startingCredit} prepaid credit</span>
        </div>
        <p className={s.costNotice}>Miners fund adapter training. Zils surplus deducts only the Zils costs entered here, payment fees, and fixed overhead.</p>
        {!results || !unit ? (
          <p id="model-error" role="alert" className={s.error}>Enter a valid amount in each field. Requests and tokens must be whole numbers; top-ups start at ${BETA_PRICING.startingCredit} and the first-free-run share is 0–100%.</p>
        ) : (
          <div aria-live="polite" aria-atomic="true">
            <div className={s.unitSpend}>
              <span>Monthly usage per customer</span>
              <strong>{usd(unit.revenuePerCustomer, 2)}</strong>
            </div>
            <div className={s.tableWrap} role="region" aria-label="Monthly scenario comparison" tabIndex={0}>
              <table className={s.table}>
                <caption className="sr-only">Estimated monthly economics at 100, 1,000, and 2,000 paying customers</caption>
                <thead><tr><th scope="col">Customers</th><th scope="col">Usage revenue</th><th scope="col">Zils variable costs</th><th scope="col">Payment fees</th><th scope="col">Zils surplus</th></tr></thead>
                <tbody>{results.map(row => (
                  <tr key={row.customers}>
                    <th scope="row">{count(row.customers)}</th>
                    <td>{usd(row.revenue)}<div className={s.barTrack} aria-hidden="true"><div className={s.bar} style={{ width: row.revenue > 0 ? `${row.customers / 20}%` : '0%' }} /></div></td>
                    <td>{usd(row.delivery)}</td>
                    <td>{usd(row.fees)}</td>
                    <td className={row.surplus < 0 ? s.loss : s.surplus}>{usd(row.surplus)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className={s.breakEven}>
              {unit.breakEvenCustomers === null
                ? 'No customer count covers the modeled costs at this usage.'
                : unit.breakEvenCustomers === 0
                  ? 'No fixed overhead to recover at these assumptions.'
                  : <><strong>{count(unit.breakEvenCustomers)} paying customers</strong> to cover the modeled costs.</>}
            </p>
            <p className={s.hint}>Surplus includes {usd(assumptions!.fixed)} in monthly fixed overhead. Before payroll, marketing, and taxes. Table amounts are rounded to whole dollars.</p>
            <details className={s.details}>
              <summary>See Zils cost breakdown</summary>
              <div className={s.tableWrap} role="region" aria-label="Zils variable cost breakdown" tabIndex={0}>
                <table className={s.table}>
                  <caption className="sr-only">Monthly costs deducted from Zils revenue</caption>
                  <thead><tr><th scope="col">Customers</th><th scope="col">Serving</th><th scope="col">Coordination &amp; evaluation</th><th scope="col">Direct miner payments</th></tr></thead>
                  <tbody>{results.map(row => <tr key={row.customers}><th scope="row">{count(row.customers)}</th><td>{usd(row.serving)}</td><td>{usd(row.training)}</td><td>{usd(row.minerPayments)}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
            <section className={s.minerCosts} aria-labelledby="miner-costs-heading">
              <h3 id="miner-costs-heading">Miner compute · not deducted</h3>
              <p className={s.hint}>Separate network expense across paid jobs and first free jobs. Multiple miner attempts belong to one customer job.</p>
              <div className={s.tableWrap} role="region" aria-label="Miner compute cost scenarios" tabIndex={0}>
                <table className={s.table}>
                  <caption className="sr-only">Illustrative miner GPU costs, excluded from Zils surplus</caption>
                  <thead><tr><th scope="col">Customers</th><th scope="col">Training jobs</th><th scope="col">Miner GPU costs</th></tr></thead>
                  <tbody>{results.map(row => <tr key={row.customers}><th scope="row">{count(row.customers)}</th><td>{count(row.trainingJobs)}</td><td>{usd(row.minerCompute)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          </div>
        )}
        <div className={s.notes}>
          <h3>Read the numbers correctly.</h3>
          <p>Zils and miner costs are assumptions, not measurements. The default $0.10/job for Zils coordination/evaluation and $1/job for miner compute are independent placeholders. Replace them with your own costs. These scenarios are not demand or capacity forecasts.</p>
          <p>Subnet emissions are not counted as customer revenue or a Zils cash expense. Any payment Zils makes directly to miners belongs in direct miner payments and is deducted once. Miner compute is shown separately; without rewards and capacity data, this page does not estimate miner profit or network sustainability.</p>
          <p>The ${BETA_PRICING.startingCredit} top-up is prepaid usage, not an extra monthly fee. Revenue here represents consumed usage. Unspent credit is excluded.</p>
          <p>Payment fees use <a href="https://stripe.com/pricing" target="_blank" rel="noreferrer">US domestic card rates</a> of 2.9% + $0.30 per top-up, spread over consumed credit. Cash timing and transaction rounding will differ. New-customer free training is included only when you set its share above zero.</p>
        </div>
      </section>
    </div>
  );
}
