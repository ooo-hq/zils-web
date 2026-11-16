'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AgentSteps } from '@/components/agent-training-card';
import { LinkLoading } from '@/components/workspace-loading';
import { Section, workspacePage } from '@/components/workspace-page';
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

/** The top of /train: the three places training examples can come from, in the order we recommend them. */
export function TrainSources({ apiUrl, token }: { apiUrl?: string | null; token: () => Promise<string> }) {
  const [report, setReport] = useState<RelayReport | null>(null);
  const api = useMemo(() => apiUrl ? relayReportApi(apiUrl, token) : null, [apiUrl, token]);
  useEffect(() => {
    if (!api) return;
    const controller = new AbortController();
    // The status line is a convenience; the gateway page reports failures.
    api.get(controller.signal).then(value => { if (!controller.signal.aborted) setReport(value); }).catch(() => {});
    return () => controller.abort();
  }, [api]);
  return <section className={css.sources} aria-label="Where your examples come from">
    <Section label="Where your examples come from" />
    <ol>
      <li className={workspacePage.split} data-preferred>
        <div className={css.head}>
          <span className={workspacePage.status} data-tone="busy">Recommended</span>
          <h3>Your app, through the learning gateway</h3>
          <p>Point your app at your learning gateway address and keep using your provider. Zils saves each decision your provider makes, then trains a model from them. There is no file to prepare.</p>
        </div>
        <div className={css.act}>
          <p role="status" className={css.state} data-on={report?.saving_since ? '' : undefined}>{report ? gatewayStatus(report) : ''}</p>
          <div className={workspacePage.actions}><Link href="/gateway" className={training.button}>{report && !report.relay ? 'Set up the gateway' : 'Open the gateway'}<LinkLoading /></Link></div>
          <p className={workspacePage.fine}>Training opens at {TRAIN_FROM_ROWS} saved answers to one question. Works with OpenAI and Claude.</p>
        </div>
      </li>
      <li className={workspacePage.split}>
        <div className={css.head}>
          <h3>A file or a table</h3>
          <p>Upload a spreadsheet or CSV with the right answer in one column, check it on one screen and start the run.</p>
        </div>
        <div className={css.act}>
          <div className={workspacePage.actions}><Link href="/train/new" className={training.secondary}>Upload a table<LinkLoading /></Link></div>
          <p className={workspacePage.fine}>No file yet? You can <Link href="/train/teach">teach by example</Link>: type a few cases and their answers.</p>
        </div>
      </li>
      <li className={workspacePage.split}>
        <div className={css.head}>
          <h3>Your coding agent or the command line</h3>
          <p>Your coding agent can turn a spreadsheet or export into training data, check the cost and start the run. Zils tells it to ask you before choosing open or private training, and it can’t spend more than the limit you agree.</p>
          <p className={workspacePage.fine}>Needs Node.js 20 and Python 3.11 or later. Runs it starts appear on Models.</p>
        </div>
        <div><AgentSteps ask="Train a Zils model on tickets.csv that decides the team." /></div>
      </li>
    </ol>
  </section>;
}
