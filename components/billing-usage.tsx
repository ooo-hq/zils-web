import { formatCredit, type UsageSummary } from '@/lib/billing';
import styles from '@/app/(home)/billing/billing.module.css';

const count = (value: string) => BigInt(value).toLocaleString('en-US');

export function BillingUsage({ usage }: { usage?: UsageSummary }) {
  if (!usage) return <section id="usage" className={styles.usage} aria-labelledby="usage-heading">
    <h2 id="usage-heading" className={styles.sectionHeading}>Account usage</h2>
    <p className={styles.emptyHistory}>Usage reporting is not available yet. You can still check your credit and payment history.</p>
  </section>;
  const total = BigInt(usage.inference_spend_nanos) + BigInt(usage.training_spend_nanos);
  return <section id="usage" className={styles.usage} aria-labelledby="usage-heading">
    <div className={styles.plan}>
      <div className={styles.start}>
        <h2 id="usage-heading">Account usage</h2>
        <p className={styles.startAmount}><strong>{formatCredit(total.toString())}</strong><span>spent in the last 30 days</span></p>
        <p className={styles.startNote}>Across all your models and API keys.</p>
      </div>
      <dl className={styles.rates}>
        <div className={styles.rate}><dt>API spend<span>Calls to your models and the shared model</span></dt><dd>{formatCredit(usage.inference_spend_nanos)}</dd></div>
        <div className={styles.rate}><dt>Training spend<span>Included runs count as $0</span></dt><dd>{formatCredit(usage.training_spend_nanos)}</dd></div>
        <div className={styles.rate}><dt>Completed API calls<span>{count(usage.failed_calls)} failed, {count(usage.active_calls)} in progress</span></dt><dd>{count(usage.calls)}</dd></div>
        <div className={styles.rate}><dt>Billable input tokens<span>{usage.unmetered_calls === '0' ? 'From completed calls' : `Token counts unavailable for ${count(usage.unmetered_calls)} earlier calls`}</span></dt><dd>{count(usage.input_tokens)}</dd></div>
        <div className={styles.rate}><dt>Completed training runs<span>{count(usage.failed_training_runs)} failed, {count(usage.active_training_runs)} in progress</span></dt><dd>{count(usage.training_runs)}</dd></div>
      </dl>
    </div>
  </section>;
}

export function BillingUsageDetails({ usage }: { usage?: UsageSummary }) {
  if (!usage) return null;
  return <section id="model-usage" className={styles.usageDetails} aria-labelledby="model-usage-heading">
    <div className={styles.sectionRow}><h2 id="model-usage-heading" className={styles.sectionHeading}>API usage by model</h2><span>Last 30 days</span></div>
    {!usage.models.length ? <p className={styles.emptyHistory}>No recorded API usage in this period. Your models will appear here after you make a call.</p> : <div className={styles.usageTableScroll} tabIndex={0} role="region" aria-label="Model usage table">
      <table className={styles.usageTable}>
        <thead><tr><th scope="col">Model</th><th scope="col">Completed calls</th><th scope="col">Input tokens</th><th scope="col">API spend</th></tr></thead>
        <tbody>{usage.models.map(model => <tr key={model.model_id === null ? 'unrecorded' : `model:${model.model_id}`}>
          <th scope="row"><span>{model.model_name || model.model_id || 'Model not recorded'}</span>{!model.model_id && <small>Earlier calls without model details</small>}</th>
          <td>{count(model.calls)}{(model.failed_calls !== '0' || model.active_calls !== '0') && <small>{count(model.failed_calls)} failed, {count(model.active_calls)} in progress</small>}</td>
          <td>{count(model.input_tokens)}</td><td>{formatCredit(model.spend_nanos)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    <details className={styles.usageHelp}><summary>About this report</summary><p>Shows the last 30 days. Calls and training runs are grouped by when they started; spend is grouped by when it was charged. One batch item counts as one API call.</p><p>Included and pre-billing training runs count toward completed runs and cost $0. Top-ups and refunds are on the Billing page. Rejected requests that never start are not counted. Earlier calls stay in account totals when model or billable token details were not recorded.</p></details>
  </section>;
}
