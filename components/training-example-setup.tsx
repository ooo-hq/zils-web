'use client';

import { useState } from 'react';
import type { ColumnMapping, CsvData } from '@/lib/training-csv';
import styles from '@/app/(home)/train/train.module.css';

type Props = {
  csv: CsvData;
  mapping: ColumnMapping;
  independent: boolean;
  onMapping: (mapping: ColumnMapping) => void;
  onIndependent: (independent: boolean) => void;
};

export function TrainingExampleSetup({ csv, mapping, independent, onMapping, onIndependent }: Props) {
  const [example, setExample] = useState(0);
  const [grouped, setGrouped] = useState(Boolean(mapping.group));
  const [editing, setEditing] = useState(!mapping.answer || !mapping.inputs.length);
  const value = (header: string) => csv.rows[example][csv.headers.indexOf(header)] || '';
  const excerpt = (header: string) => {
    const text = value(header);
    return text ? text.slice(0, 180) + (text.length > 180 ? '…' : '') : 'Empty in this example';
  };
  return <>
    <div className={styles.exampleNavigator}>
      <span aria-live="polite">Example {example + 1} of {csv.rows.length.toLocaleString()}</span>
      <div><button type="button" className={styles.secondary} aria-label="Previous example" disabled={example === 0} onClick={() => setExample(previous => previous - 1)}>Previous</button><button type="button" className={styles.secondary} aria-label="Next example" disabled={example === csv.rows.length - 1} onClick={() => setExample(previous => previous + 1)}>Next</button></div>
    </div>
    <div className={styles.teachingPreview} aria-label="Example interpretation">
      <div><h4>Zils reads</h4>{mapping.inputs.length ? mapping.inputs.map(header => <p key={header}>{value(header) || 'Empty in this example'}</p>) : <p className={styles.previewPlaceholder}>Choose the information below.</p>}</div>
      <div><h4>Should answer</h4><p>{mapping.answer ? value(mapping.answer) || 'This example needs a correct answer.' : 'Choose the answer below.'}</p></div>
    </div>
    <details className={styles.details} open={editing} onToggle={event => setEditing(event.currentTarget.open)}>
      <summary>Change what Zils reads or answers</summary>
      <fieldset className={styles.teachingQuestion}>
        <legend>Which part is the correct answer?</legend>
        <div className={styles.dataChoices}>{csv.headers.map(header => <label key={header} className={styles.dataChoice} data-selected={mapping.answer === header}>
          <input type="radio" name="correct-answer" required value={header} checked={mapping.answer === header} onChange={() => onMapping({ ...mapping, answer: header, group: mapping.group === header ? '' : mapping.group, inputs: mapping.inputs.filter(name => name !== header) })} />
          <span><strong>{excerpt(header)}</strong><small>{header}</small></span>
        </label>)}</div>
      </fieldset>
      <fieldset className={styles.teachingQuestion}>
        <legend>What information was available before deciding?</legend>
        <p>Leave out the answer and anything added after the decision.</p>
        <div className={styles.dataChoices}>{csv.headers.filter(header => header !== mapping.answer && header !== mapping.group).map(header => <label key={header} className={styles.dataChoice} data-selected={mapping.inputs.includes(header)}>
          <input type="checkbox" checked={mapping.inputs.includes(header)} onChange={event => onMapping({ ...mapping, inputs: event.target.checked ? [...mapping.inputs, header] : mapping.inputs.filter(name => name !== header) })} />
          <span><strong>{excerpt(header)}</strong><small>{header}</small></span>
        </label>)}</div>
      </fieldset>
    </details>
    <fieldset className={styles.teachingQuestion}>
      <legend>Do any examples belong to the same case?</legend>
      <p>For example, messages from one ticket. Related examples must stay together during evaluation.</p>
      <label className={styles.checkLabel}><input type="radio" name="related-examples" required checked={grouped} onChange={() => { setGrouped(true); onIndependent(false); }} /><span>Yes. Keep related examples together.</span></label>
      {grouped && <div className={styles.relatedChoice}>
        <label htmlFor="group-column">Use this reference to identify each case</label>
        <select id="group-column" required value={mapping.group} onChange={event => { const group = event.target.value; onMapping({ ...mapping, group, inputs: mapping.inputs.filter(name => name !== group) }); }}>
          <option value="">Choose a ticket, order, or document reference</option>
          {csv.headers.filter(header => header !== mapping.answer).map(header => <option key={header} value={header}>{header} — {excerpt(header)}</option>)}
        </select>
      </div>}
      <label className={styles.checkLabel}><input type="radio" name="related-examples" required checked={!grouped && independent} onChange={() => { setGrouped(false); onIndependent(true); onMapping({ ...mapping, group: '' }); }} /><span>No. I checked: every example is a separate case.</span></label>
    </fieldset>
  </>;
}
