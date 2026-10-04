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
  const value = (header: string) => csv.rows[example][csv.headers.indexOf(header)] || '';
  const excerpt = (header: string) => {
    const text = value(header);
    return text ? text.slice(0, 180) + (text.length > 180 ? '…' : '') : 'Empty in this example';
  };
  return <>
    <p>Show us the answer your team chose and the information they used. The choices below come from your own file.</p>
    <div className={styles.exampleNavigator}>
      <span aria-live="polite">Example {example + 1} of {csv.rows.length.toLocaleString()}</span>
      <div><button type="button" className={styles.secondary} aria-label="Previous example" disabled={example === 0} onClick={() => setExample(previous => previous - 1)}>Previous</button><button type="button" className={styles.secondary} aria-label="Next example" disabled={example === csv.rows.length - 1} onClick={() => setExample(previous => previous + 1)}>Next</button></div>
    </div>

    <fieldset className={styles.teachingQuestion}>
      <legend>What’s the right answer?</legend>
      <p id="answer-help">Choose the result your team has already checked. For a support ticket, that might be “Billing.”</p>
      <div className={styles.dataChoices}>{csv.headers.map(header => <label key={header} className={styles.dataChoice} data-selected={mapping.answer === header}>
        <input type="radio" name="correct-answer" required value={header} checked={mapping.answer === header} aria-describedby="answer-help" onChange={() => onMapping({ ...mapping, answer: header, group: mapping.group === header ? '' : mapping.group, inputs: mapping.inputs.filter(name => name !== header) })} />
        <span><strong>{excerpt(header)}</strong><small>From “{header}” in your file</small></span>
      </label>)}</div>
    </fieldset>

    <fieldset className={styles.teachingQuestion}>
      <legend>What should Zils read to make the decision?</legend>
      <p id="information-help">Choose what your team knew before deciding, such as the customer’s message. Leave out anything added after the decision.</p>
      <div className={styles.dataChoices}>{csv.headers.filter(header => header !== mapping.answer && header !== mapping.group).map(header => <label key={header} className={styles.dataChoice} data-selected={mapping.inputs.includes(header)}>
        <input type="checkbox" checked={mapping.inputs.includes(header)} aria-describedby="information-help" onChange={event => onMapping({ ...mapping, inputs: event.target.checked ? [...mapping.inputs, header] : mapping.inputs.filter(name => name !== header) })} />
        <span><strong>{excerpt(header)}</strong><small>From “{header}” in your file</small></span>
      </label>)}</div>
    </fieldset>

    <div className={styles.teachingPreview} aria-label="How this example teaches Zils">
      <div><h4>Zils reads</h4>{mapping.inputs.length ? mapping.inputs.map(header => <p key={header}>{value(header) || 'Empty in this example'}</p>) : <p className={styles.previewPlaceholder}>Choose information above to see it here.</p>}</div>
      <div><h4>Should answer</h4><p>{mapping.answer ? value(mapping.answer) || 'This example needs a correct answer.' : 'Choose the right answer above.'}</p></div>
    </div>
    <p className={styles.help}>This is a preview of your choices. The right answer is kept separate from what Zils reads.</p>

    <fieldset className={styles.teachingQuestion}>
      <legend>Do any examples belong together?</legend>
      <p>For example, several messages from one support ticket, or several items from one order. We keep them together so Zils is tested on cases it hasn’t already learned from.</p>
      <label className={styles.checkLabel}><input type="radio" name="related-examples" required checked={grouped} onChange={() => { setGrouped(true); onIndependent(false); }} /><span>Use a ticket, order, or document reference to keep related examples together.</span></label>
      <label className={styles.checkLabel}><input type="radio" name="related-examples" required checked={!grouped && independent} onChange={() => { setGrouped(false); onIndependent(true); onMapping({ ...mapping, group: '' }); }} /><span>No, I checked: each example is a separate case.</span></label>
      {grouped && <div className={styles.relatedChoice}>
        <label htmlFor="group-column">Which detail tells us they belong together?</label>
        <select id="group-column" required value={mapping.group} onChange={event => { const group = event.target.value; onMapping({ ...mapping, group, inputs: mapping.inputs.filter(name => name !== group) }); }}>
          <option value="">Choose a shared reference, such as a ticket ID</option>
          {csv.headers.filter(header => header !== mapping.answer).map(header => <option key={header} value={header}>{header} — {excerpt(header)}</option>)}
        </select>
        <small>Examples from the same case must have the same reference. For the sample file, this is “case_group.” This detail is used to organize examples, not to teach the decision.</small>
      </div>}
    </fieldset>
  </>;
}
