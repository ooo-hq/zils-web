'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ALPHA_SNAPSHOT, SNAPSHOT_DATE, DEFAULT_INVESTOR_INPUTS, INVESTOR_FIELDS, modelInvestor, parseInvestorInputs, validInvestorField, type InvestorDraft, type InvestorField, type InvestorInputs, type InvestorModel } from '@/lib/investor-model';
import s from './investor-lab.module.css';

const money = (value: number, decimals = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
const number = (value: number, decimals = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(value);
const compact = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
const signed = (value: number) => `${value > 0 ? '+' : ''}${money(value)}`;
const PRESETS = [{ label: 'Downside', change: -20 }, { label: 'Snapshot', change: 0 }, { label: 'Upside', change: 25 }, { label: 'High upside', change: 50 }];
const INPUT_UNITS: Record<InvestorField, string> = { alphaPrice: '$ / α', ownerAlpha: 'α / day', share: '%', sold: '%', saleCost: '%', founder: '$ / month', bizDev: '$ / month', payroll: '%', hosting: '$ / month', infrastructure: '$ / month', other: '$ / month', hostingGrowth: '% / month', customers: '$ / month', openingCash: '$', delay: 'months' };

function CashChart({ model, openingCash }: { model: InvestorModel; openingCash: number }) {
  const balances = [openingCash, ...model.months.map(month => month.balance)];
  const low = Math.min(0, ...balances);
  const high = Math.max(0, ...balances);
  const span = high - low || 1;
  const y = (value: number) => 30 + (high - value) / span * 150;
  const x = (index: number) => 68 + index / 12 * 552;
  const points = balances.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  return (
    <svg className={s.chart} viewBox="0 0 650 220" role="img" aria-label={`Cash forecast: ${money(openingCash)} at launch, ${money(model.endingCash)} after 12 months. Exact monthly values are in the table below.`}>
      <line x1="68" x2="620" y1={y(0)} y2={y(0)} className={s.zeroLine} />
      <text x="0" y={y(high) + 4} className={s.chartLabel}>{compact(high)}</text>
      {low < high && <text x="0" y={y(low) + 4} className={s.chartLabel}>{compact(low)}</text>}
      <polygon points={`68,${y(0)} ${points} 620,${y(0)}`} className={s.chartArea} />
      <polyline points={points} className={s.chartLine} />
      <circle cx="620" cy={y(model.endingCash)} r="4" className={s.chartDot} />
      {[0, 3, 6, 9, 12].map(month => <text key={month} x={x(month)} y="211" textAnchor="middle" className={s.chartLabel}>{month === 0 ? 'Launch' : `M${month}`}</text>)}
    </svg>
  );
}

function Results({ input, model }: { input: InvestorInputs; model: InvestorModel }) {
  const first = model.months[0];
  const priceMove = (input.alphaPrice / ALPHA_SNAPSHOT - 1) * 100;
  const rows = [
    { label: 'CEO + developer', value: input.founder },
    { label: 'Business development', value: input.bizDev },
    { label: 'Employer costs', value: model.employerCosts },
    { label: 'DigitalOcean', value: input.hosting },
    { label: 'Inference + other infrastructure', value: input.infrastructure },
    { label: 'Other cash costs', value: input.other },
  ];
  return (
    <div className={s.results} id="investor-results">
      <section className={s.reportSection}>
        <div className={s.sectionTitle}><h2>01 / Monthly cash flow</h2><span>Month 1</span></div>
        <div className={s.flowRows}>
          <div><span>Estimated emissions sale proceeds</span><strong>{money(first.emissions)}</strong></div>
          <div><span>Customer cash receipts</span><strong>{money(input.customers)}</strong></div>
          <div><span>Operating cash costs</span><strong>−{money(first.costs)}</strong></div>
          <div className={s.flowTotal}><span>{first.net < 0 ? 'Monthly funding gap' : 'Monthly cash surplus'}</span><strong className={first.net < 0 ? s.loss : s.positive}>{signed(first.net)}</strong></div>
        </div>
        <p className={s.note}>{input.delay > 0 ? `Emissions begin in month ${input.delay + 1}. ` : ''}Sales are modeled at the entered price with your selected haircut. Unsold alpha is not cash. Token appreciation is excluded from cash flow until sold.</p>
        <div className={s.costBreakdown}>
          <h3>Where the money goes</h3>
          {rows.map(row => <div className={s.costRow} key={row.label}><span>{row.label}</span><b>{money(row.value)}</b><i aria-hidden="true" style={{ width: `${model.monthlyCosts > 0 ? row.value / model.monthlyCosts * 100 : 0}%` }} /></div>)}
        </div>
        <p className={s.caution}>Known-cost floor: inference, extra storage, employer costs and other overhead start at $0 because they have not been priced. Add them before treating a surplus as an operating budget. Miners fund adapter training; Zils still pays for serving and its own infrastructure.</p>
      </section>

      <section className={s.reportSection}>
        <div className={s.sectionTitle}><h2>02 / Emissions economics</h2><span>After payouts begin</span></div>
        <div className={s.equation}><span>{number(input.ownerAlpha)} α/day</span><b>×</b><span>{number(input.share, 2)}% share</span><b>×</b><span>30 days</span><b>=</b><strong>{number(model.monthlyAlpha, 2)} α</strong></div>
        <dl className={s.factGrid}>
          <div><dt>Allocated alpha value</dt><dd>{money(model.grossValue)}</dd><small>Before sale fraction and costs</small></div>
          <div><dt>Estimated cash from sales</dt><dd>{money(model.saleProceeds)}</dd><small>{number(input.sold, 2)}% sold · {number(input.saleCost, 2)}% haircut</small></div>
          <div><dt>Emissions-only break-even price</dt><dd>{model.breakEvenAlpha === null ? 'Not reachable' : money(model.breakEvenAlpha, 4)}</dd><small>{model.breakEvenAlpha === null ? 'No net sale proceeds at this setting' : 'Covers month-one costs once payouts start'}</small></div>
          <div><dt>Founder salary covered by emissions</dt><dd>{money(model.coveredFounderSalary)}<em>/mo</em></dd><small>After other entered costs, including employer costs</small></div>
        </dl>
        <p className={s.note}>{number(model.retainedAlpha, 2)} α retained per month. Price scenario: {priceMove >= 0 ? '+' : ''}{number(priceMove, 1)}% versus the {SNAPSHOT_DATE} snapshot. Customer receipts are excluded from the break-even price and covered salary calculations. Price, emissions and liquidity can change independently.</p>
      </section>

      <section className={s.reportSection}>
        <div className={s.sectionTitle}><h2>03 / Cash runway</h2><span>12 model months</span></div>
        <div className={s.runwayStats}>
          <div><span>Cash runway</span><strong>{model.runwayMonths === null ? '12+' : number(model.runwayMonths, 1)}<em> months</em></strong></div>
          <div><span>Additional funding needed</span><strong>{money(model.fundingNeeded)}</strong></div>
        </div>
        <CashChart model={model} openingCash={input.openingCash} />
        <p className={s.note}>Opening cash: {money(input.openingCash)}. Month 12 balance: {money(model.endingCash)}. Negative balances show unmet funding needs, not available cash. Funding needed covers the deepest shortfall after opening cash; it is not added to the chart. Runway assumes receipts and payments spread evenly within each month.</p>
        <details className={s.forecastTable}>
          <summary>View the 12-month cash table</summary>
          <div className={s.tableScroll} tabIndex={0} role="region" aria-label="Monthly cash forecast">
            <table><caption className={s.srOnly}>Monthly cash forecast in USD, using 30-day months</caption><thead><tr><th scope="col">Month</th><th scope="col">Cash in</th><th scope="col">Cash out</th><th scope="col">Net flow</th><th scope="col">Balance</th></tr></thead><tbody>
              {model.months.map(month => <tr key={month.month}><th scope="row">{month.month}</th><td>{money(month.receipts)}</td><td>{money(month.costs)}</td><td className={month.net < 0 ? s.loss : ''}>{signed(month.net)}</td><td className={month.balance < 0 ? s.loss : ''}>{money(month.balance)}</td></tr>)}
            </tbody></table>
          </div>
        </details>
      </section>

      <section className={s.reportSection}>
        <div className={s.sectionTitle}><h2>04 / The commercial plan</h2></div>
        <div className={s.prose}>
          <p><strong>Launch lean.</strong> One founder covers CEO and engineering, with one business development role. Emissions are intended to support operations while customer revenue develops. Positive cash flow is a target to test, not a launch guarantee.</p>
          <p><strong>Sell a useful product.</strong> Customers pay for specialized Zils and usage. This model starts with no customer receipts; explore usage, delivery costs and buybacks in the <Link href="/pricing-lab">pricing lab</Link>, then enter cash receipts and associated costs here. Any buyback spending belongs in other cash costs.</p>
          <p><strong>Separate training from serving.</strong> Miners run adapter training. The $48 DigitalOcean starting bill is hosting, not a complete GPU inference budget. Increase infrastructure costs as serving demand, storage and downloads grow.</p>
          <p><strong>Compensate the combined role.</strong> The proposed founder salary is $120,000/year at the default setting. Kruze’s 2026 US VC-backed seed CEO average is $153,000. That is context for a funded cohort; affordability here depends on realized cash and the full cost base.</p>
        </div>
      </section>
      <section className={`${s.reportSection} ${s.sources}`}>
        <h2>Assumptions & sources</h2>
        <p>The proposed deal is modeled as <strong>50% of the subnet owner’s allocation</strong>, not 50% of all subnet emissions. Entitlement, payout timing and subnet acquisition terms need confirmation. The starting snapshot is 1,296 owner α/day at $0.604169/α, observed {SNAPSHOT_DATE}; it is not refreshed automatically.</p>
        <p>Alpha price, owner emissions, salaries, customer receipts and non-DigitalOcean costs stay constant across the forecast. Only DigitalOcean’s monthly growth and the emissions start delay vary with time. Starting cash is a scenario input, not a statement of Zils’s bank balance. Acquisition costs, taxes on sales/profit, capital expenditure and unentered overhead are excluded; this is a planning model, not an accounting cash-flow statement.</p>
        <ul>
          <li><a href="https://www.tao.bot/subnets/27/holders" target="_blank" rel="noreferrer">Subnet 27 · owner emissions and alpha</a></li>
          <li><a href="https://www.digitalocean.com/pricing/droplets" target="_blank" rel="noreferrer">DigitalOcean · Droplet pricing</a></li>
          <li><a href="https://docs.digitalocean.com/products/spaces/details/pricing/" target="_blank" rel="noreferrer">DigitalOcean · storage and transfer pricing</a></li>
          <li><a href="https://kruzeconsulting.com/blog/startup-ceo-salary-report/" target="_blank" rel="noreferrer">Kruze · 2026 CEO salary report</a></li>
        </ul>
      </section>
    </div>
  );
}

export function InvestorLab() {
  const [draft, setDraft] = useState<InvestorDraft>({ ...DEFAULT_INVESTOR_INPUTS });
  const input = parseInvestorInputs(draft);
  const model = input ? modelInvestor(input) : null;
  const update = (key: InvestorField, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  const invalid = (Object.keys(INVESTOR_FIELDS) as InvestorField[]).filter(key => !validInvestorField(key, draft[key]));
  const priceChange = validInvestorField('alphaPrice', draft.alphaPrice) ? (Number(draft.alphaPrice) / ALPHA_SNAPSHOT - 1) * 100 : 0;
  const setPriceChange = (change: number) => update('alphaPrice', String(Number((ALPHA_SNAPSHOT * (1 + change / 100)).toFixed(9))));

  const field = (key: InvestorField, unit: string, sliderMax?: number, step = 1, hint?: string) => {
    const meta = INVESTOR_FIELDS[key];
    const error = !validInvestorField(key, draft[key]);
    return <div className={s.field} key={key}>
      <label htmlFor={`investor-${key}`}>{meta.label}</label>
      <div className={s.inputWrap}><input id={`investor-${key}`} type="number" inputMode={key === 'delay' ? 'numeric' : 'decimal'} min="0" max={meta.max} step={key === 'delay' ? 1 : 'any'} value={draft[key]} aria-invalid={error} aria-describedby={`investor-${key}-hint`} onChange={event => update(key, event.target.value)} /><span>{unit}</span></div>
      {sliderMax !== undefined && <input className={s.slider} type="range" min="0" max={Math.max(sliderMax, error ? 0 : Number(draft[key]))} step={step} value={error ? 0 : Number(draft[key])} aria-label={`${meta.label} slider`} aria-valuetext={`${number(error ? 0 : Number(draft[key]), 2)} ${unit}`} onChange={event => update(key, event.target.value)} />}
      <p id={`investor-${key}-hint`} className={error ? s.fieldError : s.fieldHint}>{error ? `Enter ${key === 'delay' ? 'a whole number' : 'a number'} from 0 to ${number(meta.max)}.` : hint || `Adjust the ${unit === '%' ? 'percentage' : 'amount'} or enter an exact value.`}</p>
    </div>;
  };

  return <>
    <div className={s.toolbar}><span><i /> Interactive investment scenario</span><div><a href="#investor-controls">Adjust assumptions ↓</a><button type="button" onClick={() => setDraft({ ...DEFAULT_INVESTOR_INPUTS })}>Reset</button><button type="button" disabled={!model} onClick={() => window.print()}>Print / save PDF</button></div></div>
    <section className={s.summary} aria-label="Scenario summary">
      <div className={s.mainMetric}><span>Emissions-only monthly {model && model.emissionsNet >= 0 ? 'surplus' : 'gap'}</span><strong>{model ? signed(model.emissionsNet) : '—'}</strong><p>Once payouts begin · before unentered costs</p></div>
      <div><span>Estimated emissions cash</span><strong>{model ? money(model.saleProceeds) : '—'}</strong><p>After sale fraction and haircut</p></div>
      <div><span>Monthly operating costs</span><strong>{model ? money(model.monthlyCosts) : '—'}</strong><p>{model?.coverage !== null && model ? `${number(model.coverage, 1)}% covered by emissions` : 'Enter costs to calculate coverage'}</p></div>
    </section>
    <p className={s.srOnly} role="status" aria-live="polite">{model ? `Emissions-only monthly ${model.emissionsNet < 0 ? 'gap' : 'surplus'}: ${money(Math.abs(model.emissionsNet))}.` : 'Results paused. Correct the highlighted assumptions.'}</p>
    <div className={s.lab}>
      <aside className={s.controls} id="investor-controls" aria-label="Model assumptions">
        <div className={s.controlsHeading}><h2>Your assumptions</h2><span>Change any value</span></div>
        <details open className={s.controlGroup}><summary><b>01</b> Subnet emissions</summary>
          <p className={s.groupNote}>The 50% split applies once, to the owner’s allocation. All income remains conditional on the deal.</p>
          {field('alphaPrice', '$ / α', undefined, 1, `Snapshot: $${ALPHA_SNAPSHOT} on ${SNAPSHOT_DATE}.`)}
          <label className={s.priceLabel} htmlFor="investor-price-change">Price versus snapshot <strong>{priceChange >= 0 ? '+' : ''}{number(priceChange, 1)}%</strong></label>
          <input id="investor-price-change" className={s.slider} type="range" min="-100" max={Math.max(200, Math.ceil(priceChange))} step="1" value={priceChange} aria-valuetext={`${number(priceChange, 1)} percent versus snapshot`} onChange={event => setPriceChange(Number(event.target.value))} />
          <div className={s.presets} aria-label="Alpha price scenarios">{PRESETS.map(preset => <button key={preset.change} type="button" aria-pressed={Math.abs(priceChange - preset.change) < 0.0001} onClick={() => setPriceChange(preset.change)}>{preset.label}<b>{preset.change > 0 ? '+' : ''}{preset.change}%</b></button>)}</div>
          {field('ownerAlpha', 'α / day', undefined, 1, 'Owner allocation, not total subnet emissions. Editable.')}
          {field('share', '%', 100, 1, 'Proposed Zils share; the agreement is not confirmed here.')}
          {field('sold', '%', 100, 1, 'Only the sold portion contributes cash to the model.')}
          {field('saleCost', '%', 30, 0.5, 'Allowance for conversion fees and slippage; 0 is unpriced.')}
        </details>
        <details open className={s.controlGroup}><summary><b>02</b> Team & operations</summary>
          {field('founder', '$ / mo', 20000, 250, 'One combined CEO and developer role. Gross salary.')}
          {field('bizDev', '$ / mo', 10000, 250, 'Gross salary for business development.')}
          {field('hosting', '$ / mo', 1000, 1, 'Current DigitalOcean bill: $48/month. Increase as Zils grows.')}
          {field('infrastructure', '$ / mo', 10000, 50, 'Unpriced: GPU inference, adapter storage, bandwidth and backups.')}
          {field('payroll', '%', 50, 1, 'Employer taxes, benefits and payroll overhead on both salaries.')}
          {field('other', '$ / mo', undefined, 1, 'Software, accounting, legal, buybacks or other recurring payments.')}
        </details>
        <details className={s.controlGroup}><summary><b>03</b> Growth & runway</summary>
          {field('hostingGrowth', '% / mo', 50, 1, 'Compounds from month 2; applies only to the DigitalOcean line.')}
          {field('customers', '$ / mo', undefined, 1, 'Cash actually collected. Include its delivery and payment costs above.')}
          {field('openingCash', '$', undefined, 1, 'Scenario starting balance, not a verified bank balance.')}
          {field('delay', 'months', 12, 1, '0 starts in month 1; 12 means no emissions in this forecast.')}
        </details>
        <a className={s.backToResults} href="#investor-results">View your results ↑</a>
      </aside>
      {model && input ? <Results input={input} model={model} /> : <div className={s.error} id="investor-results" role="alert"><h2>Complete the highlighted assumptions</h2><p>Results are paused so an empty or invalid input does not appear as a $0 cost.</p><ul>{invalid.map(key => <li key={key}><a href={`#investor-${key}`}>{INVESTOR_FIELDS[key].label}: enter 0–{number(INVESTOR_FIELDS[key].max)}{key === 'delay' ? ' whole months' : ''}.</a></li>)}</ul></div>}
    </div>
    <section className={s.printAssumptions}><h2>Scenario inputs</h2><dl>{(Object.keys(INVESTOR_FIELDS) as InvestorField[]).map(key => <div key={key}><dt>{INVESTOR_FIELDS[key].label}</dt><dd>{draft[key]} {INPUT_UNITS[key]}</dd></div>)}</dl></section>
    <div className={s.mobileResult}><div><span>Emissions-only / month</span><strong>{model ? signed(model.emissionsNet) : 'Check inputs'}</strong></div><a href="#investor-results">View results ↑</a></div>
  </>;
}
