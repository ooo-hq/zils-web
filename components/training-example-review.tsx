'use client';

import { useState } from 'react';
import type { ColumnMapping, CsvData } from '@/lib/training-csv';
import type { DataReview, ReviewEdit, ReviewEdits } from '@/lib/training-review';
import styles from '@/app/(home)/train/train.module.css';

type Props = {
  data: CsvData;
  mapping: ColumnMapping;
  outcomes: string[];
  edits: ReviewEdits;
  report: DataReview;
  onEdit: (index: number, edit: ReviewEdit) => void;
};

export function TrainingExampleReview({ data, mapping, outcomes, edits, report, onEdit }: Props) {
  const [filter, setFilter] = useState<'sample' | 'issues' | 'all'>('sample');
  const [selected, setSelected] = useState(report.sample[0] ?? 0);
  const attention = [...new Set(report.issues.map(issue => issue.index))].sort((a, b) => a - b);
  const indices = filter === 'all' ? data.rows.map((_, index) => index) : filter === 'issues' ? attention : report.sample;
  const index = indices.includes(selected) ? selected : indices[0] ?? 0;
  const position = indices.indexOf(index);
  const edit = edits[index] || {};
  const answer = edit.answer ?? data.rows[index][data.headers.indexOf(mapping.answer)] ?? '';
  const sourceRow = data.sourceRows?.[index] ?? index + 2;
  const issues = report.issues.filter(issue => issue.index === index);
  const update = (change: ReviewEdit, next = false) => {
    onEdit(index, { ...edit, ...change });
    if (next && position < indices.length - 1) setSelected(indices[position + 1]);
  };

  return <>
    <div className={styles.readinessStats} aria-label="Example review progress">
      <div><strong>{report.included.toLocaleString()}</strong><span>Included</span></div>
      <div data-attention={attention.length > 0}><strong>{attention.length}</strong><span>Need attention</span></div>
      <div><strong>{report.excluded}</strong><span>Left out</span></div>
    </div>
    <label htmlFor="review-filter">Examples to review</label>
    <select id="review-filter" value={filter} onChange={event => {
      const next = event.target.value as typeof filter;
      setFilter(next); setSelected(next === 'issues' ? attention[0] ?? 0 : next === 'sample' ? report.sample[0] ?? 0 : 0);
    }}>
      <option value="sample">Suggested sample ({report.sample.length})</option>
      <option value="issues">Need attention ({attention.length})</option>
      <option value="all">All examples ({data.rows.length})</option>
    </select>
    {indices.length ? <>
      <div className={styles.exampleNavigator}>
        <span aria-live="polite">Example {position + 1} of {indices.length} · Spreadsheet row {sourceRow}</span>
        <div><button type="button" className={styles.secondary} disabled={position <= 0} onClick={() => setSelected(indices[position - 1])}>Previous</button><button type="button" className={styles.secondary} disabled={position >= indices.length - 1} onClick={() => setSelected(indices[position + 1])}>Next</button></div>
      </div>
      <div className={styles.reviewExample} data-excluded={Boolean(edit.excluded)}>
        <div className={styles.reviewExampleHeading}><h4>Information available before deciding</h4><span>{edit.excluded ? 'Left out' : edit.needsReview ? 'Needs an expert' : edit.confirmed ? 'Confirmed' : 'Not yet reviewed'}</span></div>
        <dl>{mapping.inputs.map(header => <div key={header}><dt>{header}</dt><dd>{data.rows[index][data.headers.indexOf(header)] || 'Empty in this example'}</dd></div>)}</dl>
        <label htmlFor="review-answer">Correct answer</label>
        <select id="review-answer" value={answer} disabled={edit.excluded} onChange={event => update({ answer: event.target.value, confirmed: false, needsReview: false })}>
          <option value="">Choose the correct answer</option>
          {answer && !outcomes.includes(answer) && <option value={answer} disabled>{answer} (not a possible answer)</option>}
          {outcomes.map(outcome => <option key={outcome} value={outcome}>{outcome}</option>)}
        </select>
        {!edit.excluded && issues.length > 0 && <ul className={styles.reviewIssues}>{[...new Set(issues.map(issue => issue.message))].map(message => <li key={message}>{message}</li>)}</ul>}
        <div className={styles.reviewActions}>
          <button type="button" className={styles.secondary} disabled={edit.excluded || !outcomes.includes(answer)} onClick={() => update({ confirmed: true, needsReview: false }, true)}>Confirm{position < indices.length - 1 ? ' and next' : ' answer'}</button>
          <button type="button" className={styles.textButton} disabled={edit.excluded} onClick={() => update({ needsReview: true, confirmed: false }, true)}>Needs an expert</button>
          <button type="button" className={styles.textButton} onClick={() => update({ excluded: !edit.excluded, confirmed: false, needsReview: false })}>{edit.excluded ? 'Include again' : 'Leave out of this run'}</button>
        </div>
      </div>
    </> : <p role="status" className={styles.notice}>{filter === 'issues' ? 'No examples need attention. Review the suggested sample before continuing.' : 'No examples are included. Choose “All examples” to include a case again.'}</p>}
    <p className={styles.localNote}>{report.confirmed} examples confirmed here. {filter === 'sample' && 'The sample covers different answers; it does not verify every example. '}Corrections apply only to this run. Your spreadsheet stays unchanged.</p>
    <div className={styles.readinessChecks} aria-live="polite">
      <h4>{attention.length || report.blockers.length ? 'Before training' : 'Data checks passed'}</h4>
      {attention.length > 0 && <p>Review or leave out {attention.length} {attention.length === 1 ? 'example' : 'examples'} needing attention.</p>}
      {report.blockers.length > 0 && <ul>{report.blockers.map(message => <li key={message}>{message}</li>)}</ul>}
      {!attention.length && !report.blockers.length && <p>Every included example has an allowed answer, and each answer has at least three separate cases.</p>}
      <p>These checks confirm that we can prepare an experiment. They do not establish that there is enough data to meet your accuracy target.</p>
    </div>
  </>;
}
