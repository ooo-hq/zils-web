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
const workloadFields: ModelField[] = ['zils', 'requests', 'tokens', 'runs', 'newCustomers'];
const costFields: ModelField[] = ['inference', 'training', 'minerPayment', 'fixed', 'topup'];
const buybackFields: ModelField[] = ['buybackPercent', 'cashReserve', 'alphaPrice', 'buybackFeePercent'];

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
        <p className={s.hint}>One customer can use several specialized Zils. Enter average usage per Zil for the month you want to model.</p>
        <div className={s.presets} role="group" aria-label="Customer portfolio examples">
          {Object.entries(WORKLOADS).map(([key, preset]) => (
            <button key={key} type="button" aria-pressed={workloadFields.every(field => inputs[field].trim() !== '' && Number(inputs[field]) === Number(preset[field as keyof typeof preset]))}
              onClick={() => setInputs(previous => ({ ...previous, zils: preset.zils, requests: preset.requests, tokens: preset.tokens, runs: preset.runs, newCustomers: preset.newCustomers }))}>
              {preset.label}
            </button>
          ))}
        </div>
        <p className={s.presetHint}>One Zil and Five Zils use one training run per Zil in an ongoing month. Setup month uses five Zils with six runs each and one free run per new customer. These are examples, not usage forecasts.</p>
        <div className={s.fields}>{workloadFields.map(field)}</div>
        <p className={s.hint}>Include all training runs, paid and free. Only one first run is free per customer, across all their Zils; the discount is capped by the total runs entered.</p>
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
          <summary>Adjust Zils costs</summary>
          <div className={s.fields}>{costFields.map(field)}</div>
          <p className={s.hint}>Enter only costs Zils pays. Include any Zils-funded idle serving capacity, evaluation and retries. Use fixed overhead for shared costs such as storage and support; do not also count them per job. Direct miner payments default to $0.</p>
        </details>
        <details className={s.details}>
          <summary>Miner GPU costs — separate</summary>
          <div className={s.fields}>{field('minerCompute')}</div>
          <p className={s.hint}>Estimate total GPU expense across all miner attempts for one customer job. This is shown separately and never deducted from Zils revenue. It does not include miner rewards or establish miner profitability.</p>
        </details>
        <section className={s.buybackInputs} aria-labelledby="buyback-inputs-heading">
          <h3 id="buyback-inputs-heading">Buyback &amp; burn</h3>
          <p className={s.hint}>Choose how much positive surplus to spend after setting cash aside. All alpha bought is assumed burned. The default 0% leaves allocation undecided.</p>
          <div className={s.presets} role="group" aria-label="Buyback allocation examples">
            {[0, 25, 50, 100].map(percent => <button key={percent} type="button"
              aria-pressed={inputs.buybackPercent.trim() !== '' && Number(inputs.buybackPercent) === percent}
              onClick={() => setInputs(previous => ({ ...previous, buybackPercent: String(percent) }))}>{percent}%</button>)}
          </div>
          <div className={s.fields}>{buybackFields.map(field)}</div>
          <p className={s.hint}>The $1 alpha price and 1% trading costs are examples, not live quotes. Use the average price you expect to pay, including price impact. Trading costs cover conversion, swap, and network fees within the buyback budget.</p>
          <p className={s.hint}>The monthly reserve stays with Zils and is held back once per scenario. Include payroll, marketing, and taxes in your costs or reserve before treating surplus as spendable.</p>
        </section>
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
        <p className={s.costNotice}>Miners fund adapter training. Zils surplus deducts the Zils costs entered here, payment fees, and fixed overhead. Buybacks are then allocated after the cash reserve.</p>
        {!results || !unit ? (
          <p id="model-error" role="alert" className={s.error}>Enter a valid amount in each field. Zils, requests, and tokens must be whole numbers; top-ups start at ${BETA_PRICING.startingCredit}, percentages are 0–100%, and alpha execution price must be greater than $0.</p>
        ) : (
          <div aria-live="polite" aria-atomic="true">
            <div className={s.unitSpend}>
              <span>Revenue per customer · selected month</span>
              <strong>{usd(unit.revenuePerCustomer, 2)}</strong>
              <span>{usd(unit.inferenceRevenuePerCustomer, 2)} inference + {usd(unit.trainingRevenuePerCustomer, 2)} paid training</span>
            </div>
            <div className={s.portfolioSummary}>
              <p>Requests per customer: <b>{count(unit.requestsPerCustomer)}</b> ({count(assumptions!.zils)} × {count(assumptions!.requests)} per Zil).</p>
              <p>Training runs per customer: <b>{count(unit.jobsPerCustomer)}</b> ({count(assumptions!.zils)} × {count(assumptions!.runs)} per Zil). {count(unit.freeJobsPerCustomer)} free + {count(unit.paidJobsPerCustomer)} paid on average.</p>
            </div>
            <div className={s.tableWrap} role="region" aria-label="Monthly scenario comparison" tabIndex={0}>
              <table className={s.table}>
                <caption className="sr-only">Estimated monthly economics at 100, 1,000, and 2,000 paying customers</caption>
                <thead><tr><th scope="col">Customers</th><th scope="col">Usage revenue</th><th scope="col">Zils variable costs</th><th scope="col">Payment fees</th><th scope="col">Surplus before buybacks</th></tr></thead>
                <tbody>{results.map(row => (
                  <tr key={row.customers}>
                    <th scope="row">{count(row.customers)}<span className={s.rowNote}>{count(row.zils)} Zils</span></th>
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
            <p className={s.hint}>Surplus includes {usd(assumptions!.fixed)} in monthly fixed overhead. Payroll, marketing, and taxes are excluded unless you include them in costs. Dollar amounts in tables are rounded.</p>
            <section className={s.buybackResults} aria-labelledby="buyback-results-heading">
              <div className={s.sectionHeading}>
                <h3 id="buyback-results-heading">Buyback &amp; burn</h3>
                <span className={s.scenarioBadge}>Scenario only</span>
              </div>
              <p className={s.hint}>Surplus → cash reserve → buyback → burn. Allocate {count(assumptions!.buybackPercent)}% of what remains after reserving up to {usd(assumptions!.cashReserve)} each month.</p>
              {assumptions!.buybackPercent === 0 && <p className={s.buybackNotice}>Choose a buyback percentage under Assumptions to estimate the burn.</p>}
              <div className={s.tableWrap} role="region" aria-label="Buyback and burn scenarios" tabIndex={0}>
                <table className={`${s.table} ${s.buybackTable}`}>
                  <caption className="sr-only">Monthly buyback spending, estimated alpha burned, and Zils cash retained</caption>
                  <thead><tr><th scope="col">Customers</th><th scope="col">Available after reserve</th><th scope="col">Buyback spend</th><th scope="col">Est. alpha burned</th><th scope="col">Cash retained</th></tr></thead>
                  <tbody>{results.map(row => <tr key={row.customers}>
                    <th scope="row">{count(row.customers)}</th>
                    <td>{usd(row.buybackAvailable)}</td>
                    <td>{usd(row.buybackSpend)}<span className={s.rowNote}>{usd(row.buybackFees, 2)} fees included</span></td>
                    <td className={s.burn}>{count(row.alphaBurned)} α</td>
                    <td className={row.retainedCash < 0 ? s.loss : s.surplus}>{usd(row.retainedCash)}<span className={s.rowNote}>{usd(row.reserveHeld)} reserve included</span></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <p className={s.hint}>Estimated alpha burned = buyback spend after trading costs ÷ average alpha execution price. Cash retained includes the reserve; it is not deducted a second time. No positive surplus after the reserve means no buyback.</p>
              <p className={s.hint}>This models spending and burning all purchased alpha. It executes no trades or burns, and does not predict token price or net supply after emissions.</p>
            </section>
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
          <p>Customer counts stay at 100, 1,000, and 2,000. Requests and total training runs are multiplied by Zils per customer; owning a Zil adds no subscription or model-slot fee. Every Zil uses the entered average workload. Change those averages to represent different parts of an app.</p>
          <p>The setup example describes one month of experimentation. It does not assume those six runs per Zil repeat every month. For an established customer, set ongoing retraining separately and set first-free-run redemption to 0%. For a month that includes new Zils, include their setup runs in the average training runs per Zil.</p>
          <p>Zils and miner costs are assumptions, not measurements. The default $0.10/job for Zils coordination/evaluation and $1/job for miner compute are independent placeholders. Replace them with your own costs. These scenarios are not demand or capacity forecasts.</p>
          <p>Subnet emissions are not counted as customer revenue or a Zils cash expense. Any payment Zils makes directly to miners belongs in direct miner payments and is deducted once. Miner compute is shown separately; without rewards and capacity data, this page does not estimate miner profit or network sustainability.</p>
          <p>The ${BETA_PRICING.startingCredit} top-up is prepaid usage, not an extra monthly fee. Revenue here represents consumed usage. Unspent credit is excluded.</p>
          <p>Buybacks use consumed-usage surplus, never unspent customer credit. Reserves are additional cash set aside for the modeled month, not a starting bank balance. Cash retained is a modeled monthly amount, not a treasury balance or a cash-flow forecast. Alpha price, trading costs, and allocation are editable assumptions, not a buyback commitment.</p>
          <p>Payment fees use <a href="https://stripe.com/pricing" target="_blank" rel="noreferrer">US domestic card rates</a> of 2.9% + $0.30 per top-up, spread over consumed credit. Cash timing and transaction rounding will differ. A first free run reduces billable runs, while all entered runs still incur the modeled Zils and miner costs.</p>
        </div>
      </section>
    </div>
  );
}
