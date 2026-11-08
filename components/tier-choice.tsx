'use client';

import { useId } from 'react';
import type { TrainingTier } from '@/lib/training';
import css from './tier-choice.module.css';

type Props = {
  value: TrainingTier | null;
  onChange: (tier: TrainingTier) => void;
  /** What the customer is sending: 'examples' or 'photos'. */
  data: string;
  /** The private tier's price, as the flow states it. */
  price: string;
  disabled?: boolean;
};

/** Who trains the run. Nothing is preselected: open sends training data to network miners, so the customer chooses. */
export function TierChoice({ value, onChange, data, price, disabled }: Props) {
  const name = useId();
  return <fieldset className={css.tiers} disabled={disabled}>
    <legend>Who trains this run?</legend>
    <label className={css.tier}>
      <input type="radio" name={name} checked={value === 'open'} onChange={() => onChange('open')} />
      <span><strong>Open tier · free</strong> Zils network miners train it. They receive your training {data} and must delete them within 7 days of the run finishing; Zils cannot verify that they do. Use only data you are allowed to share this way.</span>
    </label>
    <label className={css.tier}>
      <input type="radio" name={name} checked={value === 'private'} onChange={() => onChange('private')} />
      <span><strong>Private · {price}</strong> Only Zils workers train it.</span>
    </label>
  </fieldset>;
}
