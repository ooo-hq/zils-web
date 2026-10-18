'use client';

import { useEffect, useRef, useState } from 'react';
import { doomExamples, gameSeconds } from '@/lib/doom-examples';
import { DetailsRow } from './site/details-row';
import { StageHead, Who } from './examples-shared';
import base from './bitcast-examples.module.css';
import s from './doom-examples.module.css';

const outcomeText = { success: 'Reached the exit', death: 'Died', timeout: 'Ran out of time' } as const;
const seconds = (tics: number) => `${gameSeconds(tics).toFixed(1)} s`;
const models = ['zils', 'jev'] as const;

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
  // Videos load on demand and start when the pair is on screen. Reduced motion waits for Replay.
  useEffect(() => {
    const el = videos.zils.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); play(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    <StageHead title="Zils reaches the armor. JEV dies in the doorway."><button type="button" className={base.exBtn} onClick={play}>Replay ↺</button></StageHead>
    <div className={s.duo}>
      {models.map(model => {
        const clip = doomExamples.clips[model];
        const done = ended[model];
        const name = model === 'zils' ? 'Zils' : 'TypeSafe JEV';
        return <section key={model} aria-label={`${name} recording`}>
          <div className={s.ph}>
            <Who model={model} />
            <span className={`${base.exTag} ${done ? (clip.outcome === 'success' ? base.exGood : base.exBad) : base.exWait}`} aria-live="polite">{done ? `${outcomeText[clip.outcome]} · ${seconds(clip.gameTics)}` : playing ? 'Playing' : 'Ready'}</span>
          </div>
          <video ref={videos[model]} className={s.video} src={clip.src} poster={doomExamples.poster} muted playsInline preload="none" onPlay={() => setPlaying(true)} onEnded={() => setEnded(prev => ({ ...prev, [model]: true }))} aria-label={`${name} on test seed ${doomExamples.seed}`} />
        </section>;
      })}
    </div>
    <DetailsRow summary="Behind this game"><DoomGameDetails /></DetailsRow>
  </>;
}

function DoomGameDetails() {
  return <div className={base.exBehind}>
    <p>Test seed {doomExamples.seed} is a selected highlight: the lowest-numbered held-out start where trained Zils collected the green armor and JEV died. {doomExamples.audit.eligibleHighlights} of the 100 starts qualified; none went the other way. Both runs began from the same frame and the same observation, and the recorded hashes match. The footage is rendered from the native game recordings with labels added, not a recreated win.</p>
    <p>Both models received the same text: health, the names and screen positions of visible enemies and the armor, the previous observation and the last action. Neither saw pixels, the map, or anything off-screen. Thinking paused the game, so playback is game time at {doomExamples.fps} tics per second and omits inference waits.</p>
    <p>Zils: {doomExamples.zilsModel} with one adapter trained on {doomExamples.trainingExamples.toLocaleString()} decisions from a scripted reference program. JEV: a live call to TypeSafe’s API, version {doomExamples.jevModel}, with no task training.</p>
  </div>;
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
