'use client';

import { useState } from 'react';
import { InstallCommand } from '@/components/site/install-command';
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
