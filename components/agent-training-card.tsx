'use client';

import { useState } from 'react';
import { InstallCommand } from '@/components/site/install-command';
import { Section, workspacePage } from '@/components/workspace-page';
import css from './agent-training-card.module.css';

const AGENTS = { 'Claude Code': 'claude', Codex: 'codex' } as const;
type Agent = keyof typeof AGENTS;

/** Which coding agent, then the three steps: add Zils over MCP, sign in once, and what to ask. */
export function AgentSteps({ ask }: { ask: string }) {
  const [agent, setAgent] = useState<Agent>('Claude Code');
  return <>
    <div className={css.agents}>{(Object.keys(AGENTS) as Agent[]).map(name => <button key={name} type="button" aria-pressed={agent === name} onClick={() => setAgent(name)}>{name}</button>)}</div>
    <div className={css.steps}>
      <div className={css.step}><span>Add Zils to {agent}</span><InstallCommand command={`${AGENTS[agent]} mcp add zils -- npx -y @zils/cli mcp`} label="Add Zils to your agent" copiedText="Command copied." /></div>
      <div className={css.step}><span>Sign in once, with this account</span><InstallCommand command="npx -y @zils/cli login" label="Sign in once" copiedText="Command copied." /></div>
      <div className={css.step}><span>Then ask it</span><p className={css.ask}>{ask}</p></div>
    </div>
  </>;
}

/** The MCP path to training: one line adds Zils to the customer's agent, which then prepares the file and starts the run. */
export function AgentTrainingCard() {
  return <section id="train-with-your-agent" aria-label="Train with your agent">
    <Section label="Train with your agent" />
    <div className={workspacePage.split}>
      <div className={css.head}>
        <h3 id="agent-training-title">Ask your coding agent to train it.</h3>
        <p>Your coding agent can turn a spreadsheet or export into training data, check the cost and start the run. Zils tells it to ask you before choosing open or private training, and it can’t spend more than the limit you agree.</p>
        <p className={workspacePage.fine}>Needs Node.js 20 and Python 3.11 or later. Runs it starts appear here.</p>
      </div>
      <div><AgentSteps ask="Train a Zils model on tickets.csv that decides the team." /></div>
    </div>
  </section>;
}
