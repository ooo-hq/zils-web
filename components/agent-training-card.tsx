'use client';

import { useState } from 'react';
import { InstallCommand } from '@/components/site/install-command';
import css from './agent-training-card.module.css';

const AGENTS = { 'Claude Code': 'claude', Codex: 'codex' } as const;
type Agent = keyof typeof AGENTS;

/** The MCP path to training: one line adds Zils to the customer's agent, which then prepares the file and starts the run. */
export function AgentTrainingCard() {
  const [agent, setAgent] = useState<Agent>('Claude Code');
  return <section className={css.card} aria-labelledby="agent-training-title">
    <div className={css.head}>
      <div><h2 id="agent-training-title">Train with your agent</h2><p>Your coding agent can turn a spreadsheet or export into training data, check the cost and start the run. Zils tells it to ask you before choosing open or private training, and it can’t spend more than the limit you agree.</p></div>
      <div className={css.agents}>{(Object.keys(AGENTS) as Agent[]).map(name => <button key={name} type="button" aria-pressed={agent === name} onClick={() => setAgent(name)}>{name}</button>)}</div>
    </div>
    <div className={css.step}><span>Add Zils to {agent}</span><InstallCommand command={`${AGENTS[agent]} mcp add zils -- npx -y @zils/cli mcp`} label="Add Zils to your agent" copiedText="Command copied." /></div>
    <div className={css.step}><span>Sign in once, with this account</span><InstallCommand command="npx -y @zils/cli login" label="Sign in once" copiedText="Command copied." /></div>
    <div className={css.step}><span>Then ask it</span><p className={css.ask}>Train a Zils model on tickets.csv that decides the team.</p></div>
    <p className={css.note}>Needs Node.js 20 and Python 3.11 or later. Runs it starts appear here.</p>
  </section>;
}
