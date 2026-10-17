'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { SignInPrompt } from '@/components/signed-in-only';
import { CopyField } from '@/components/trained-model-quickstart';
import { useWorkspaceModels } from '@/components/workspace-models';
import { WorkspaceLoading } from '@/components/workspace-loading';
import { billingApi, formatCredit, type BillingSummary } from '@/lib/billing';
import { curlCommand } from '@/lib/model-quickstart';
import type { TrainingConfig } from '@/lib/training-config';
import s from './workspace-home.module.css';

const day = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

export function WorkspaceHome({ config, sharedModel }: { config: TrainingConfig; sharedModel: string | null }) {
  const { client, session, models, error } = useWorkspaceModels(config);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const owner = session?.user.id;
  useEffect(() => {
    if (!client || !owner || !config.decisionApiUrl) return;
    const controller = new AbortController();
    const token = async () => { const { data } = await client.auth.getSession(); return data.session?.user.id === owner ? data.session.access_token : ''; };
    // Usage is a summary here; the Usage page reports billing errors.
    billingApi(config.decisionApiUrl, token).summary(controller.signal).then(setSummary).catch(() => {});
    return () => controller.abort();
  }, [client, owner, config.decisionApiUrl]);
  const curl = useMemo(() => config.decisionApiUrl && sharedModel ? curlCommand(config.decisionApiUrl, {
    model: sharedModel,
    state: 'Customer email: "Please cancel my subscription before the next billing date."',
    questions: { wants_cancel: { type: 'noul', instructions: 'Is the customer asking to cancel?' } },
  }) : null, [config.decisionApiUrl, sharedModel]);

  if (session === undefined) return <WorkspaceLoading label="Opening your workspace" />;
  if (!session) return <SignInPrompt title="Sign in to your workspace">Train models on your own examples, then call them from your app.</SignInPrompt>;
  const usage = summary?.usage;
  return <div className={s.grid}>
    <section className={s.quickstart} aria-labelledby="quickstart-title">
      <h2 id="quickstart-title">Quickstart</h2>
      <ol className={s.steps}>
        <li><div><h3>Create an API key</h3><p>Keys belong to your account. Keep them on your server.</p></div><Link href="/keys" className={s.action}>API keys</Link></li>
        <li><div><h3>Choose a model</h3><p>Start with the shared Zils model, or use one of your own by its API name.</p></div><Link href="/models" className={s.action}>Your models</Link></li>
        <li className={s.code}><div><h3>Send a request</h3><p>Ask any number of questions about one input. Every answer comes back as a probability.</p></div>
          {curl ? <CopyField label="Request as curl" value={curl} language="bash" /> : <p className={s.muted}>The Zils API address is not configured for this site.</p>}
        </li>
      </ol>
      <Link href="/playground" className={s.more}>Try requests in the playground<ArrowUpRight size={14} aria-hidden="true" /></Link>
    </section>

    <div className={s.side}>
    <aside className={s.usage} aria-labelledby="usage-title">
      <div className={s.cardHeading}><h2 id="usage-title">Usage</h2><Link href="/billing">View</Link></div>
      <dl>
        <div><dt>Available credit</dt><dd className={s.figure}>{summary ? formatCredit(summary.available_nanos) : '—'}</dd></div>
        <div><dt>API calls, last 30 days</dt><dd>{usage ? Number(usage.calls).toLocaleString() : '—'}</dd></div>
        <div><dt>Spend, last 30 days</dt><dd>{usage ? formatCredit((BigInt(usage.inference_spend_nanos) + BigInt(usage.training_spend_nanos)).toString()) : '—'}</dd></div>
      </dl>
    </aside>

    <section className={s.models} aria-labelledby="latest-models-title">
      <div className={s.cardHeading}><h2 id="latest-models-title">Latest models</h2><Link href="/models">View all</Link></div>
      {error ? <p role="alert" className={s.muted}>{error}</p>
        : !models ? <p className={s.muted} role="status">Loading your models…</p>
        : !models.length ? <p className={s.muted}>No models yet. <Link href="/train/teach">Train your first model</Link> on examples your team has reviewed.</p>
        : <ul>{models.slice(0, 3).map(job => <li key={job.id}>
          <Link href={`/models/${job.id}`}><strong>{job.name}</strong><code>{job.workflow?.model_alias || job.workflow?.model_name || job.workflow?.model_id}</code></Link>
          <span>Ready{job.created_at && ` · trained ${day(job.created_at)}`}</span>
        </li>)}</ul>}
    </section>
    </div>
  </div>;
}
