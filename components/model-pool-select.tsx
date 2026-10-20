'use client';

import { useEffect, useId, useState } from 'react';
import { newerBase, poolSelection, trainingBase, type BaseConfig, type BaseMigration, type PoolSelection } from '@/lib/base-model';

export function ModelPoolSelect({ apiUrl, modality, disabled, onChange, migration }: { apiUrl?: string; modality: 'text' | 'images'; disabled?: boolean; onChange: (selection: PoolSelection | null) => void; migration?: BaseMigration }) {
  const id = useId();
  const [config, setConfig] = useState<BaseConfig>();
  const [error, setError] = useState('');
  const [pool, setPool] = useState('d3-mini');
  const [channel, setChannel] = useState<'stable' | 'latest'>('stable');
  useEffect(() => {
    if (!apiUrl) return;
    const controller = new AbortController();
    trainingBase(apiUrl, controller.signal).then(setConfig).catch(() => { if (!controller.signal.aborted) setError('Model availability could not be loaded. Reopen training to retry.'); });
    return () => controller.abort();
  }, [apiUrl]);
  const migrationJob = migration?.job, migrationTarget = migration?.target;
  useEffect(() => {
    if (!config) { onChange(null); return; }
    if (migrationTarget) {
      onChange(migrationJob ? newerBase(config, migrationJob, migrationTarget)?.selection ?? null : null);
    } else {
      onChange(poolSelection(config, pool, channel, modality));
    }
  }, [config, pool, channel, modality, onChange, migrationJob, migrationTarget]);
  if (error) return <p role="alert">{error}</p>;
  if (!config) return <p role="status">Checking model availability…</p>;
  if (migration) {
    if (!migration.job) return <p role="status">Checking your current model…</p>;
    const target = newerBase(config, migration.job, migration.target);
    return target
      ? <p>Starting base: <strong>{target.name}</strong> · {target.selection.base_channel === 'stable' ? 'Stable' : 'Latest'} channel. This base stays fixed for your run.</p>
      : <p role="alert">This migration is no longer available. Return to your model to check available bases.</p>;
  }
  if (!config.pools) return null;
  const selected = config.pools[pool];
  return <fieldset disabled={disabled}>
    <label htmlFor={`${id}-pool`}>Model pool</label>
    <select id={`${id}-pool`} value={pool} onChange={event => { setPool(event.target.value); setChannel('stable'); }}>
      {Object.values(config.pools).map(entry => <option key={entry.id} value={entry.id} disabled={!['stable', 'latest'].some(c => poolSelection(config, entry.id, c as 'stable' | 'latest', modality))}>{entry.name}{entry.parameters_billions ? ` · ${entry.parameters_billions}B` : ''}{!['stable', 'latest'].some(c => poolSelection(config, entry.id, c as 'stable' | 'latest', modality)) ? ' · unavailable' : ''}</option>)}
    </select>
    <label htmlFor={`${id}-channel`}>Base channel</label>
    <select id={`${id}-channel`} value={channel} onChange={event => setChannel(event.target.value as 'stable' | 'latest')}>
      {(['stable', 'latest'] as const).map(c => <option key={c} value={c} disabled={!poolSelection(config, pool, c, modality)}>{c === 'stable' ? 'Stable' : 'Latest'}{!poolSelection(config, pool, c, modality) ? ' · unavailable' : ''}</option>)}
    </select>
    <p>{selected?.channels[channel].name} · {selected?.availability[channel].max_input_tokens.toLocaleString()} input tokens. The selected base stays fixed for this run.</p>
    {!poolSelection(config, pool, channel, modality) && <p role="status">This pool has no qualified {modality === 'images' ? 'image' : 'text'} training capacity available.</p>}
  </fieldset>;
}
