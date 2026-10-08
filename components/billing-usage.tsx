import { formatCredit, type UsageSummary } from '@/lib/billing';
import styles from '@/app/(home)/billing/billing.module.css';

const count = (value: string) => BigInt(value).toLocaleString();

export function BillingUsage({ usage }: { usage?: UsageSummary }) {
  return <section id="usage" className={styles.usage} aria-labelledby="usage-heading">
    <header className={styles.usageHeading}><div><h2 id="usage-heading">Account usage</h2><p>Across all your models and API keys.</p></div><span>Last 30 days</span></header>
    {!usage ? <p className={styles.emptyHistory}>Usage reporting is not available yet. Your balance and payment history are shown below.</p> : <>
      <dl className={styles.usageStats}>
        <div><dt>Completed API calls</dt><dd>{count(usage.calls)}</dd><p>{count(usage.failed_calls)} failed · {count(usage.active_calls)} in progress</p></div>
        <div><dt>Billable input tokens</dt><dd>{count(usage.input_tokens)}</dd><p>From completed calls</p></div>
        <div><dt>Completed training runs</dt><dd>{count(usage.training_runs)}</dd><p>{count(usage.failed_training_runs)} failed · {count(usage.active_training_runs)} in progress</p></div>
        <div><dt>Usage spend</dt><dd className={styles.usageSpend}>{formatCredit((BigInt(usage.inference_spend_nanos) + BigInt(usage.training_spend_nanos)).toString())}</dd><p>API {formatCredit(usage.inference_spend_nanos)} · Training {formatCredit(usage.training_spend_nanos)}</p></div>
      </dl>
      <h3>API usage by model</h3>
      {!usage.models.length ? <p className={styles.emptyHistory}>No recorded API usage in this period. Your models will appear here after you make a call.</p> : <div className={styles.usageTableScroll} tabIndex={0} role="region" aria-label="API usage by model">
        <table className={styles.usageTable}>
          <thead><tr><th scope="col">Model</th><th scope="col">Completed calls</th><th scope="col">Input tokens</th><th scope="col">API spend</th></tr></thead>
          <tbody>{usage.models.map(model => <tr key={model.model_id === null ? 'unrecorded' : `model:${model.model_id}`}>
            <th scope="row"><span>{model.model_name || model.model_id || 'Model not recorded'}</span>{!model.model_id && <small>Earlier calls without model details</small>}</th>
            <td>{count(model.calls)}{(model.failed_calls !== '0' || model.active_calls !== '0') && <small>{count(model.failed_calls)} failed · {count(model.active_calls)} in progress</small>}</td>
            <td>{count(model.input_tokens)}</td><td>{formatCredit(model.spend_nanos)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <details className={styles.usageHelp}><summary>About this report</summary><p>Includes activity recorded since billing was enabled, within the last 30 days. Calls and training runs are grouped by when they started; spend is grouped by when it was charged. One batch item counts as one API call.</p><p>Included training runs count toward completed runs and cost $0. Top-ups and refunds are listed separately below. Rejected requests that never start are not counted. Older calls stay in account totals when their model was not recorded.</p></details>
    </>}
  </section>;
}
