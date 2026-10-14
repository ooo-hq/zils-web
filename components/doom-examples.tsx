'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Gamepad2, Play, RotateCcw } from 'lucide-react';
import { doomExamples, gameSeconds } from '@/lib/doom-examples';
import { ZilsWordmark } from './zils-wordmark';
import base from './bitcast-examples.module.css';
import s from './doom-examples.module.css';

const models = { zils: { name: 'Zils' }, jev: { name: 'TypeSafe JEV', mark: 'J' } } as const;
const outcomeText = { success: 'Collected the armor', death: 'Died', timeout: 'Ran out of time' } as const;
const seconds = (tics: number) => `${gameSeconds(tics).toFixed(1)} s`;

export function DoomDemo() {
  const videos = { zils: useRef<HTMLVideoElement>(null), jev: useRef<HTMLVideoElement>(null) };
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState({ zils: false, jev: false });
  const all = () => [videos.zils.current, videos.jev.current].filter((v): v is HTMLVideoElement => v !== null);
  function play() {
    setEnded({ zils: false, jev: false });
    all().forEach(v => { v.currentTime = 0; });
    Promise.all(all().map(v => v.play())).then(() => setPlaying(true), () => setPlaying(false));
  }
  function reset() {
    all().forEach(v => { v.pause(); v.currentTime = 0; });
    setPlaying(false); setEnded({ zils: false, jev: false });
  }
  // Both recordings start on load so the comparison is visible before any click.
  useEffect(() => { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) all().forEach(v => v.play().catch(() => {})); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    <div className={base.appHeader}><div><Gamepad2 size={18} /><strong>{doomExamples.scenario}</strong><span>ViZDoom study</span></div><span className={base.recorded}>Real results, replayed</span></div>
    <div className={base.demoToolbar}>
      <div><h2>Zils reaches the armor. JEV dies in the doorway.</h2><p>Same map, same start, same information. Both recordings run together, in game time.</p></div>
      <button className={playing || ended.zils ? base.secondary : base.primary} type="button" onClick={playing || ended.zils ? reset : play}>{playing || ended.zils ? <><RotateCcw size={16} />Reset</> : <><Play size={16} />Play both</>}</button>
    </div>
    <div className={s.screens}>
      {(['zils', 'jev'] as const).map(model => {
        const clip = doomExamples.clips[model];
        const done = ended[model];
        return <section key={model} className={s.screen} aria-label={`${models[model].name} recording`}>
          <header>{model === 'zils' ? <h3 className={s.wordmark}><ZilsWordmark className={s.logo} /></h3> : <><span className={s.jevMark}>J</span><h3>{models[model].name}</h3></>}<span className={done ? (clip.outcome === 'success' ? base.match : base.caution) : s.pending} aria-live="polite">{done ? <>{clip.outcome === 'success' ? <Check size={14} /> : <span aria-hidden="true">!</span>}{outcomeText[clip.outcome]} at {seconds(clip.gameTics)}</> : playing ? 'Playing' : 'Ready'}</span></header>
          <div className={s.frame}>
            <video ref={videos[model]} src={clip.src} poster={doomExamples.poster} muted playsInline preload="metadata" onPlay={() => setPlaying(true)} onEnded={() => setEnded(prev => ({ ...prev, [model]: true }))} aria-label={`${models[model].name} on test seed ${doomExamples.seed}`} />
            {done && <p className={`${s.stamp} ${clip.outcome === 'success' ? s.stampWin : s.stampLoss}`}>{outcomeText[clip.outcome]}</p>}
          </div>
          <dl className={s.stats}>
            <div><dt>Game time</dt><dd>{seconds(clip.gameTics)}</dd></div>
            <div><dt>Health left</dt><dd>{Math.max(0, clip.health)}</dd></div>
            <div><dt>Decisions</dt><dd>{clip.decisions}</dd></div>
          </dl>
        </section>;
      })}
    </div>
    <details className={base.exampleDetails}><summary>Behind this game</summary><div>
      <p>Test seed {doomExamples.seed} is a selected highlight: the lowest-numbered held-out start where trained Zils collected the green armor and JEV died. {doomExamples.audit.eligibleHighlights} of the 100 starts qualified; none went the other way. Both runs began from the same frame and the same observation, and the recorded hashes match. The footage is rendered from the native game recordings with labels added, not a recreated win.</p>
      <p>Both models received the same text: health, the names and screen positions of visible enemies and the armor, the previous observation and the last action. Neither saw pixels, the map, or anything off-screen. Thinking paused the game, so playback is game time at {doomExamples.fps} tics per second and omits inference waits.</p>
      <p>Zils: {doomExamples.zilsModel} with one adapter trained on {doomExamples.trainingExamples.toLocaleString()} decisions from a scripted reference program. JEV: a live call to TypeSafe’s API, version {doomExamples.jevModel}, with no task training.</p>
    </div></details>
  </>;
}

export function DoomStudyDetails() {
  const o = doomExamples.outcomes, e = doomExamples.evidence;
  return <>
    <p>{doomExamples.date}: 100 held-out starts of ViZDoom 1.3.0’s unmodified Deadly Corridor scenario, difficulty 5, with a 2,100-tic limit. Success means collecting the armor and reaching the map’s exit. Trained Zils: {o.zils.success} successes, {o.zils.timeout} timeouts, {o.zils.death} death. JEV: {o.jev.death} deaths and {o.jev.technical_failure} technical failure, counted separately. The untrained H2O base died in all 100. The scripted reference program Zils learned from succeeded in all 100.</p>
    <p>Training, development and test seed lists were disjoint, but the map is shared, so this measures robustness to the scenario’s randomness, not play on unseen levels. The structured observations and custom action interface make it different from standard pixel-based ViZDoom scores.</p>
    <p>The paired success difference is +{doomExamples.pairedDifference.points} points, with a descriptive 95% seed-bootstrap interval of {doomExamples.pairedDifference.bootstrap95[0]} to {doomExamples.pairedDifference.bootstrap95[1]} points; Zils’s Wilson 95% interval is {(100 * doomExamples.zilsSuccessWilson95[0]).toFixed(1)}% to {(100 * doomExamples.zilsSuccessWilson95[1]).toFixed(1)}%. The native replay audit verified {doomExamples.audit.replaysVerified} completed episodes and matched starting frames for all {doomExamples.audit.matchedStarts} seeds. JEV’s one technical failure, seed {doomExamples.interruptedSeed}, was an operator-interrupted episode and is not counted as a death.</p>
    <p className={s.evidence}><a href={e.report}>Full benchmark report</a><a href={e.seeds} download>All 100 starts (CSV)</a><a href={e.results}>Results (JSON)</a></p>
  </>;
}
