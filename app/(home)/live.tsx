'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

// Illustrative decisions matching the homepage's three use cases. These
// are not model outputs; the instrument says so on its face.
const DECISIONS = [
  {
    task: 'Choose the right model',
    context: 'Extract the total and due date from this invoice as JSON.',
    options: ['small model', 'large model'],
    p: [0.86, 0.14],
  },
  {
    task: 'Select the next tool',
    context: 'Customer: “Where is my order #4412? It said Tuesday.”',
    options: ['order_lookup', 'search_docs', 'handoff'],
    p: [0.78, 0.15, 0.07],
  },
  {
    task: 'Know when to escalate',
    context: 'Agent retried twice. Tests still fail on the same assertion.',
    options: ['continue', 'retry', 'ask for review'],
    p: [0.09, 0.21, 0.7],
  },
] as const;

const TICK_MS = 40;
const CYCLE = 150; // ticks per decision (6s)

/** Context and probabilities animate together in the single illustrative demo. */
export function DecisionInstrument() {
  const reduced = useReducedMotion();
  // Start on the settled first frame: identical on server and client, and
  // the whole story for no-JS and reduced-motion visitors.
  const [tick, setTick] = useState(CYCLE - 1);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced !== false || paused) return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [reduced, paused]);

  const d = DECISIONS[Math.floor(tick / CYCLE) % DECISIONS.length];
  const local = tick % CYCLE;
  const typed = Math.min(d.context.length, local * 2);
  const barStart = Math.ceil(d.context.length / 2) + 6;
  const settle = Math.min(Math.max((local - barStart) / 34, 0), 1);
  const stamped = settle >= 1;
  const probs: readonly number[] = d.p;
  const best = probs.indexOf(Math.max(...probs));

  return (
    <div className="mx-auto w-full max-w-xl overflow-hidden rounded-md border border-neutral-200 text-left">
      <div className="flex items-center justify-between gap-4 bg-white px-5 py-3 text-xs text-neutral-600">
        <span>Decision example <span className="text-neutral-400">/ illustrative</span></span>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? 'Play decision animation' : 'Pause decision animation'}
          className="rounded-sm px-2 py-1 text-[var(--zils-accent)] hover:bg-[var(--zils-soft)] motion-reduce:hidden"
        >
          {paused ? 'Play' : 'Pause'}
        </button>
      </div>
      <div className="bg-[var(--zils-ink)] px-5 py-6 text-sm leading-6 sm:px-6">
        <p className="text-xs text-[#b5b0f4]">{d.task}</p>
        <p className="mt-3 min-h-[4.5rem] text-neutral-100 sm:min-h-12">
          {d.context.slice(0, typed)}
          {typed < d.context.length && <span aria-hidden="true" className="ml-1 inline-block h-3.5 w-px translate-y-0.5 bg-[#b5b0f4]" />}
        </p>
        <div className="mt-5 space-y-3" role="img" aria-label={`Probabilities: ${d.options.map((option, i) => `${option} ${d.p[i]}`).join(', ')}`}>
          {d.options.map((option, i) => {
            const value = d.p[i] * settle;
            const selected = stamped && i === best;
            return (
              <div key={option} className="grid grid-cols-[6.25rem_1fr_2.5rem] items-center gap-3 font-mono text-xs sm:grid-cols-[7.5rem_1fr_3rem]">
                <span className={selected ? 'text-white' : 'text-neutral-400'}>{option}</span>
                <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-sm bg-white/10">
                  <span className={`block h-full ${selected ? 'bg-[#b5b0f4]' : 'bg-neutral-500'}`} style={{ width: `${value * 100}%` }} />
                </span>
                <span className={`text-right tabular-nums ${selected ? 'text-[#b5b0f4]' : 'text-neutral-400'}`}>{value.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/15 pt-4 text-xs">
          <span className="text-neutral-400">Probabilities out. No generated prose.</span>
          <span className="font-medium text-[#b5b0f4]">{stamped ? d.options[best] : 'Reading context…'}</span>
        </div>
      </div>
    </div>
  );
}

export type ReplayTab = { tab: string; lines: readonly (readonly [tone: 'c' | 'o' | 'k' | 'a', text: string])[] };

const TONE = { c: 'text-neutral-400', o: 'text-neutral-200', k: 'text-[#b5b0f4]', a: 'text-white' } as const;

/** Static, selectable excerpts from the public round record. */
export function RoundReplay({ tabs, caption }: { tabs: readonly ReplayTab[]; caption: string }) {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const lines = tabs[selected].lines;

  return (
    <div className="min-w-0">
      <div role="tablist" aria-label="Recorded round stages" className="flex flex-wrap gap-1.5">
        {tabs.map((tab, index) => (
          <button
            key={tab.tab}
            ref={(node) => { buttons.current[index] = node; }}
            id={`round-tab-${index}`}
            role="tab"
            type="button"
            aria-selected={index === selected}
            aria-controls="round-panel"
            tabIndex={index === selected ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
              else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = tabs.length - 1;
              else return;
              event.preventDefault();
              setSelected(next);
              buttons.current[next]?.focus();
            }}
            className={`rounded-sm px-4 py-2 text-xs font-medium transition-colors ${index === selected ? 'bg-[var(--zils-accent)] text-white' : 'bg-white text-neutral-600 ring-1 ring-neutral-200 hover:text-[var(--zils-accent)]'}`}
          >
            {tab.tab}
          </button>
        ))}
      </div>
      <div id="round-panel" role="tabpanel" aria-labelledby={`round-tab-${selected}`} tabIndex={0} className="mt-4 overflow-hidden rounded-md bg-[var(--zils-ink)]">
        <div className="border-b border-white/15 px-5 py-3 text-xs text-neutral-400">Recorded testnet round</div>
        <pre className="min-h-[320px] overflow-x-auto px-5 py-5 font-mono text-xs leading-7">
          {lines.map(([tone, text], index) => <div key={`${selected}-${index}`} className={TONE[tone]}>{text}</div>)}
        </pre>
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-500">{caption}</p>
    </div>
  );
}
