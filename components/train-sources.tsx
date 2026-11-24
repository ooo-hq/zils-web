'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ImageIcon } from 'lucide-react';
import { AgentSteps } from '@/components/agent-training-card';
import { LinkLoading } from '@/components/workspace-loading';
import { Section, workspacePage } from '@/components/workspace-page';
import { starters } from '@/components/teach-by-example';
import type { TeachingTask } from '@/lib/teach-by-example';
import { relayReportApi, TRAIN_FROM_ROWS, type RelayReport } from '@/lib/relay-report';
import training from '@/app/(home)/train/train.module.css';
import css from './train-sources.module.css';

const plural = (count: number, word: string) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

/** Where the gateway stands for this account, in one line. The report lists at most the most recent questions, so a capped count says so. */
function gatewayStatus(report: RelayReport) {
  if (!report.relay) return 'Not set up yet.';
  if (!report.saving_since) return 'Set up. Not collecting.';
  const saved = report.questions.reduce((sum, question) => sum + question.rows, 0);
  return `Collecting. ${plural(saved, 'answer')} saved from ${report.questions_total > report.questions.length ? `your ${report.questions.length} most recent questions` : plural(report.questions.length, 'question')}.`;
}

/** One way in: a heading on the left, what to do on the right. */
function Way({ id, title, intro, preferred, children }: { id: string; title: string; intro: ReactNode; preferred?: boolean; children: ReactNode }) {
  return <li data-preferred={preferred ? '' : undefined}>
    <section aria-labelledby={id} className={workspacePage.split}>
      <div className={css.head}>
        {preferred && <span className={workspacePage.status} data-tone="busy">Recommended</span>}
        <h3 id={id}>{title}</h3>
        {intro}
      </div>
      <div className={css.act}>{children}</div>
    </section>
  </li>;
}

export type Teach = { start: 'guided' | 'images'; kind?: TeachingTask['kind'] };

/** Every way a model starts, in the order we recommend them, each doing its first step in its own row. `file` is the drop zone;
    `onTeach` opens the step-by-step teaching in place. */
export function TrainSources({ relay, file, onTeach }: { relay: ReturnType<typeof relayReportApi> | null; file: ReactNode; onTeach: (teach: Teach) => void }) {
  const [report, setReport] = useState<RelayReport | null>(null);
  useEffect(() => {
    if (!relay) return;
    const controller = new AbortController();
    // The list is a convenience; the gateway page reports failures.
    relay.get(controller.signal).then(value => { if (!controller.signal.aborted) setReport(value); }).catch(() => {});
    return () => controller.abort();
  }, [relay]);
  return <section className={css.sources} aria-label="Ways to start" id="ways-to-start">
    <Section label="Start training" />
    <ol>
      <Way id="way-agent" title="Your coding agent" preferred intro={<>
        <p>Your coding agent finds the decisions your code makes, or turns a spreadsheet or export into training data, checks the cost and starts the run. Zils tells it to ask you before choosing open or private training, and it can’t spend more than the limit you agree.</p>
        <p className={workspacePage.fine}>Needs Node.js 20 and Python 3.11 or later. Runs it starts appear on Models.</p>
      </>}>
        <AgentSteps ask="Find the decisions in this repo that Zils could make, measure Zils on them, and train a model for any it misses." />
      </Way>
      <Way id="way-gateway" title="From your gateway" intro={<p>Point your app at your learning gateway address and keep using your provider. Zils saves each answer your provider gives, then trains a model from them. There is no file to prepare.</p>}>
        <p role="status" className={css.state} data-on={report?.saving_since ? '' : undefined}>{report ? gatewayStatus(report) : ''}</p>
        {report && report.questions.length > 0 && <ul className={css.questions}>{report.questions.map(question => {
          const name = question.instructions || Object.keys(question.fields).join(', ');
          return <li key={question.id}>
            {question.rows >= TRAIN_FROM_ROWS
              ? <Link href={`/train?gateway=${question.id}`} scroll={false} aria-label={`Train on “${name}”`}>{name}<LinkLoading /></Link>
              : <span>{name}</span>}
            <small>{question.rows >= TRAIN_FROM_ROWS ? `${question.rows.toLocaleString()} saved` : `${question.rows.toLocaleString()} saved · opens at ${TRAIN_FROM_ROWS}`}</small>
          </li>;
        })}</ul>}
        <div className={workspacePage.actions}><Link href="/gateway" className={training.secondary}>{report && !report.relay ? 'Set up the gateway' : 'Open the gateway'}<LinkLoading /></Link></div>
      </Way>
      <Way id="way-file" title="Drop a file" intro={<p>A spreadsheet (CSV or Excel), JSON or JSON Lines, one example per row with the right answer in one column. You check what it reads and decides on one screen, then train.</p>}>
        {file}
      </Way>
      <Way id="way-typed" title="Type examples" intro={<p>No file yet? Pick the kind of task, type a few cases and their answers, and Zils walks you through the rest step by step.</p>}>
        <div className={css.tasks}>
          {(Object.keys(starters) as TeachingTask['kind'][]).map(kind => { const choice = starters[kind], Icon = choice.icon;
            return <button type="button" key={kind} onClick={() => onTeach({ start: 'guided', kind })}><Icon size={20} strokeWidth={1.5} aria-hidden="true" /><strong>{choice.title}</strong><span>{choice.description}</span></button>; })}
          <button type="button" onClick={() => onTeach({ start: 'images' })}><ImageIcon size={20} strokeWidth={1.5} aria-hidden="true" /><strong>Decide from photos</strong><span>Spot damage. Sort pictures.</span></button>
        </div>
      </Way>
    </ol>
  </section>;
}
