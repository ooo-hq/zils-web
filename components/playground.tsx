'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sessionHeaders } from '@/components/auth-session';
import { DecisionPlayground } from '@/components/decision-playground';
import type { ModelOption } from '@/lib/playground';
import s from './playground.module.css';

export function Playground({ configured, models: shared, apiUrl }: { configured: boolean; models: ModelOption[]; apiUrl: string | null }) {
  const [models, setModels] = useState(shared);
  const [modelId, setModelId] = useState(shared[0].id);
  // The customer's own key lives only in this component's memory: never stored, logged or put in a URL.
  const [apiKey, setApiKey] = useState('');
  const model = models.find(m => m.id === modelId) ?? models[0];
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const result = await fetch('/api/playground', { headers: await sessionHeaders(), signal: controller.signal });
        const body = await result.json();
        if (result.ok && Array.isArray(body.models) && body.models.length) setModels(body.models);
      } catch { /* The shared model stays available. */ }
    })();
    return () => controller.abort();
  }, []);
  return <div>
    <div className={s.modelBar}>
      <div><label className={s.label} htmlFor="playground-model">Model</label>
        <select id="playground-model" className={s.input} value={model.id} onChange={e => setModelId(e.target.value)}>
          {models.map(m => <option key={m.id} value={m.id}>{m.own ? `${m.label} (your model)` : m.label}</option>)}
        </select></div>
      {model.own && <div><label className={s.label} htmlFor="playground-key">Your API key</label>
        <input id="playground-key" className={s.input} type="password" autoComplete="off" spellCheck={false} placeholder="zils_sk_…" value={apiKey} onChange={e => setApiKey(e.target.value.trim())} />
        <p className={s.helper}>Used for this tab only and never saved. <Link href="/keys">Create a key</Link></p></div>}
    </div>
    <DecisionPlayground configured={configured} model={model} apiKey={apiKey} apiUrl={apiUrl} />
  </div>;
}
