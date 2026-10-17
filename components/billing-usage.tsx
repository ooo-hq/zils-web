import type { CSSProperties } from 'react';
import texture from '@/components/light.module.css';
import { formatCredit, type UsageSummary } from '@/lib/billing';
import styles from '@/app/(home)/billing/billing.module.css';

const count = (value: string) => BigInt(value).toLocaleString('en-US');
const share = (part: bigint, whole: bigint) => whole > 0n ? Number((part * 1000n) / whole) / 10 : 0;

/** Spend as a utility-meter readout: each digit on its own wheel. */
function Meter({ value }: { value: string }) {
  let wheel = 0;
  return <span className={styles.meter} role="img" aria-label={value}>
    <span aria-hidden="true" className={styles.wheels}>{[...value].map((char, index) => /\d/.test(char)
      ? <span key={index} className={styles.wheel} style={{ '--wheel': wheel++ } as CSSProperties}><span>{char}</span></span>
      : <span key={index} className={styles.wheelMark}>{char}</span>)}</span>
  </span>;
}

function DotBar({ value }: { value: number }) {
  return <span aria-hidden="true" className={styles.dotTrack}><span className={styles.dotFill} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></span>;
}

export function BillingUsage({ usage }: { usage?: UsageSummary }) {
  if (!usage) return <section id="usage" className={styles.usage} aria-labelledby="usage-heading">
    <h2 id="usage-heading" className={styles.sectionHeading}>Account usage</h2>
    <p className={styles.emptyHistory}>Usage reporting is not available yet. You can still check your credit and payment history.</p>
  </section>;
  const api = BigInt(usage.inference_spend_nanos), training = BigInt(usage.training_spend_nanos), total = api + training;
  return <section id="usage" className={styles.usage} aria-labelledby="usage-heading">
    <div className={styles.meterPanel}>
      <div aria-hidden="true" className={`${styles.texture} ${texture.scanlines}`} />
      <div className={styles.meterHead}><h2 id="usage-heading">Account usage</h2><span>Last 30 days, across all your models and API keys</span></div>
      <dl className={styles.meterBody}>
        <div className={styles.meterTotal}><dt>Spent</dt><dd><Meter value={formatCredit(total.toString())} /></dd></div>
        <div className={styles.split}>
          <div><dt>API calls</dt><dd>{formatCredit(usage.inference_spend_nanos)}</dd><DotBar value={share(api, total)} /></div>
          <div><dt>Training</dt><dd>{formatCredit(usage.training_spend_nanos)}</dd><DotBar value={share(training, total)} /></div>
        </div>
      </dl>
    </div>
    <dl className={styles.readouts}>
      <div><dt>Completed API calls</dt><dd>{count(usage.calls)}</dd><p>{count(usage.failed_calls)} failed, {count(usage.active_calls)} in progress</p></div>
      <div><dt>Billable input tokens</dt><dd>{count(usage.input_tokens)}</dd><p>{usage.unmetered_calls === '0' ? 'From completed calls' : `Token counts unavailable for ${count(usage.unmetered_calls)} earlier calls`}</p></div>
      <div><dt>Completed training runs</dt><dd>{count(usage.training_runs)}</dd><p>{count(usage.failed_training_runs)} failed, {count(usage.active_training_runs)} in progress</p></div>
    </dl>
  </section>;
}

export function BillingUsageDetails({ usage }: { usage?: UsageSummary }) {
  if (!usage) return null;
  const calls = usage.models.reduce((sum, model) => sum + BigInt(model.calls), 0n);
  return <section id="model-usage" className={styles.usageDetails} aria-labelledby="model-usage-heading">
    <div className={styles.sectionRow}><h2 id="model-usage-heading" className={styles.sectionHeading}>API usage by model</h2><span>Last 30 days</span></div>
    {!usage.models.length ? <p className={styles.emptyHistory}>No recorded API usage in this period. Your models will appear here after you make a call.</p> : <div className={styles.usageTableScroll} tabIndex={0} role="region" aria-label="Model usage table">
      <table className={styles.usageTable}>
        <thead><tr><th scope="col">Model</th><th scope="col">Share of calls</th><th scope="col">Completed calls</th><th scope="col">Input tokens</th><th scope="col">API spend</th></tr></thead>
        <tbody>{usage.models.map(model => <tr key={model.model_id === null ? 'unrecorded' : `model:${model.model_id}`}>
          <th scope="row"><span>{model.model_name || model.model_id || 'Model not recorded'}</span>{!model.model_id && <small>Earlier calls without model details</small>}</th>
          <td className={styles.shareCell}><span className={styles.shareInner}><DotBar value={share(BigInt(model.calls), calls)} /><span>{share(BigInt(model.calls), calls).toFixed(0)}%</span></span></td>
          <td>{count(model.calls)}{(model.failed_calls !== '0' || model.active_calls !== '0') && <small>{count(model.failed_calls)} failed, {count(model.active_calls)} in progress</small>}</td>
          <td>{count(model.input_tokens)}</td><td>{formatCredit(model.spend_nanos)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    <details className={styles.usageHelp}><summary>About this report</summary><p>Shows the last 30 days. Calls and training runs are grouped by when they started; spend is grouped by when it was charged. One batch item counts as one API call.</p><p>Included and pre-billing training runs count toward completed runs and cost $0. Top-ups and refunds are on the Billing page. Rejected requests that never start are not counted. Earlier calls stay in account totals when model or billable token details were not recorded.</p></details>
  </section>;
}
