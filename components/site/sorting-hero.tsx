'use client';
import { useEffect, useRef, useState } from 'react';
import {
  COLS, HESITATE_P, LANES, PHONE_TICK_MS, POST_ALPHA, PRE_ALPHA, READ_FRACTION, ROWS, SKY, SPAWN_MS,
  fieldGeometry, heroHeight, isPhone, itemX, visibleLanes, type Lane, type LaneId,
} from '@/lib/sorting-field';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { SiteButton } from './site-button';
import { DecisionConsole, type Decision } from './decision-console';
import css from './sorting-hero.module.css';

// Illustrative demo values (controller ruling): tag confidences until the first landing.
const INITIAL_CONF: Record<LaneId, number> = { billing: 0.97, spam: 0.99, account: 0.93, tech: 0.95, sales: 0.91, review: 0.52 };
const HESITANT = ['The invoice is wrong and the page broke', 'Cancel everything. Now.', 'Is my data still mine?'];
// Fixed spectrum stops from the spec; only the dip and the fade depend on the theme (CSS vars).
const SKY_STOPS: [number, string][] = [[0, '#ef8d5a'], [0.12, '#d9a08c'], [0.38, '#cfa2e4'], [0.5, '#dcb2ee'], [0.64, '#c3b4f6'], [0.78, '#a9b5f2'], [0.9, '#5d6688']];
const STATIC_DECISION: Decision = { text: '“Please send me a receipt.”', laneId: 'billing', confidence: 0.97 };
const SPAWN_Y = 54; // just under the strip
const lane = (id: LaneId) => LANES.find((l) => l.id === id)!;
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

type Item = { text: string; lane: Lane; hes: Lane | null; x0: number; y: number; v: number; stamped: boolean; flash: number; conf: number };

export function SortingHero({ title, description }: { title: string; description: string }) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current!, wrap = wrapRef.current!, copy = copyRef.current!;
    const cv = wrap.querySelector('canvas')!, ctx = cv.getContext('2d')!;
    const con = copy.querySelector('[data-console]')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, frames = 0, raf = 0, last = 0, spawnT = 0, side: 0 | 1 = 0;
    let onScreen = true, ready = false, drawn = false;
    const tags = Object.fromEntries(LANES.map((l) => [l.id, { pulse: 0, conf: INITIAL_CONF[l.id] }])) as Record<LaneId, { pulse: number; conf: number }>;
    const items: Item[] = [];

    const readColors = () => {
      const cs = getComputedStyle(hero), v = (n: string) => cs.getPropertyValue(n).trim();
      return {
        fgr: v('--zs-fg-rgb'), bgr: v('--zs-bg-rgb'), bg: v('--zs-panel'), dip: v('--hero-dip'), end: v('--hero-end'),
        bad: v('--zs-bad'), mono: v('--font-plex-mono') || 'monospace',
        lane: Object.fromEntries(LANES.map((l) => [l.id, v(l.cssVar) || l.color])) as Record<LaneId, string>,
      };
    };
    let C = readColors();
    const font = (w: number, px: number) => `${w} ${px}px ${C.mono}`;

    const cell = (l: Lane) => (isPhone(W) ? l.phone ?? l.desk : l.desk);
    const tagX = (l: Lane) => { const g = fieldGeometry(W, H); return g.left + cell(l).col * g.cell + 13; };
    const tagY = (l: Lane) => { const g = fieldGeometry(W, H); return g.top + cell(l).row * g.rh; };

    const emit = (d: Decision) => setDecision(d);

    function spawn() {
      let ln: Lane, text: string, hes: Lane | null = null;
      if (side === 1 && Math.random() < HESITATE_P) {
        ln = lane('review'); hes = lane('tech'); text = `“${pick(HESITANT)}”`;
      } else {
        // Ported from the mockup: Needs review joins the right-side pool about 30% of the time.
        const pool = LANES.filter((l) => (l.side === side && l.id !== 'review') || (side === 1 && l.id === 'review' && Math.random() < 0.3));
        ln = pick(pool);
        text = ln.files.length && Math.random() < 0.35 ? `[img] ${pick(ln.files)}` : `“${pick(ln.messages)}”`;
      }
      const x0 = side === 0 ? 0.1 + Math.random() * 0.1 : 0.8 + Math.random() * 0.1;
      const conf = hes ? 0.48 + Math.random() * 0.08 : 0.86 + Math.random() * 0.13;
      items.push({ text, lane: ln, hes, x0, y: SPAWN_Y + Math.random() * 20, v: 32 + Math.random() * 8, stamped: false, flash: 0, conf });
      side = side === 0 ? 1 : 0;
    }

    function drawField(dt: number) {
      const g = fieldGeometry(W, H), RH = g.rh, phone = isPhone(W);
      const grad = ctx.createLinearGradient(g.left, 0, g.right, 0);
      [...SKY_STOPS, [0.24, C.dip] as [number, string], [1, C.end] as [number, string]].forEach(([o, c]) => grad.addColorStop(o, c));
      ctx.fillStyle = grad;
      for (let c = 0; c < COLS; c++) ctx.fillRect(g.left + c * g.cell, g.bottom - SKY[c] * RH, g.cell + 0.5, SKY[c] * RH);
      const vf = ctx.createLinearGradient(0, g.bottom - 3 * RH, 0, g.bottom);
      vf.addColorStop(0, `rgba(${C.bgr},.35)`); vf.addColorStop(1, `rgba(${C.bgr},0)`);
      ctx.fillStyle = vf; ctx.fillRect(g.left, g.bottom - 3 * RH, g.right - g.left, 3 * RH);

      const shown = visibleLanes(W);
      for (const l of LANES) tags[l.id].pulse = Math.max(0, tags[l.id].pulse - dt * 1.2);
      for (const l of shown) {
        const x = g.left + cell(l).col * g.cell, y = tagY(l) + RH, p = tags[l.id].pulse;
        ctx.fillStyle = C.bg; ctx.fillRect(x, y, g.cell, RH);
        if (p > 0) {
          // Lane vars are 7-char hex, so appending "00" gives the transparent end of the glow.
          const sg = ctx.createLinearGradient(0, y, 0, y + RH);
          sg.addColorStop(0, C.lane[l.id] + '00'); sg.addColorStop(1, C.lane[l.id]);
          ctx.globalAlpha = p * 0.7; ctx.fillStyle = sg; ctx.fillRect(x, y, g.cell, RH); ctx.globalAlpha = 1;
        }
      }

      ctx.strokeStyle = `rgba(${C.fgr},.07)`; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let r = 0; r <= ROWS; r++) { const y = Math.round(g.top + r * RH) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      for (let c = 1; c < COLS; c++) { const x = Math.round(g.left + c * g.cell) + 0.5; ctx.moveTo(x, g.top + 3 * RH); ctx.lineTo(x, g.bottom); }
      ctx.stroke();

      const TF = phone ? font(500, 9.5) : font(500, 11), PAD = phone ? 10 : 16;
      for (const l of shown) {
        const x = g.left + cell(l).col * g.cell, y = tagY(l), p = tags[l.id].pulse;
        ctx.font = TF;
        const text = l.label.toUpperCase(), w = Math.max(g.cell * 1.2, RH + PAD + ctx.measureText(text).width + PAD);
        ctx.fillStyle = C.bg; ctx.fillRect(x, y, w, RH);
        ctx.strokeStyle = `rgba(${C.fgr},.1)`; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, RH - 1);
        if (p > 0) { ctx.globalAlpha = p; ctx.fillStyle = C.lane[l.id]; ctx.fillRect(x + 1, y + 1, RH - 2, RH - 2); ctx.globalAlpha = 1; }
        ctx.strokeStyle = `rgba(${C.fgr},.18)`; ctx.strokeRect(x + 0.5, y + 0.5, RH - 1, RH - 1);
        ctx.beginPath(); ctx.moveTo(x + 1, y + RH - 1); ctx.lineTo(x + RH - 1, y + 1); ctx.stroke();
        ctx.font = font(400, 7.5); ctx.fillStyle = `rgba(${C.fgr},.45)`; ctx.textAlign = 'right';
        ctx.fillText(tags[l.id].conf.toFixed(2), x + RH - 4, y + RH - 5);
        ctx.font = TF; ctx.fillStyle = `rgba(${C.fgr},.7)`; ctx.textAlign = 'left';
        ctx.fillText(text, x + RH + PAD, y + RH / 2 + 4);
      }
    }

    function drawReading() {
      if (isPhone(W)) return;
      const g = fieldGeometry(W, H), rY = H * READ_FRACTION;
      ctx.setLineDash([3, 5]); ctx.strokeStyle = `rgba(${C.fgr},.08)`;
      ctx.beginPath(); ctx.moveTo(g.left, rY); ctx.lineTo(W * 0.3, rY); ctx.moveTo(W * 0.7, rY); ctx.lineTo(g.right, rY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = font(500, 9.5); ctx.fillStyle = `rgba(${C.fgr},.22)`;
      ctx.textAlign = 'left'; ctx.fillText('READING', g.left + 10, rY - 8);
      ctx.textAlign = 'right'; ctx.fillText('READING', g.right - 10, rY - 8);
    }

    function drawItems(dt: number) {
      const rY = H * READ_FRACTION;
      ctx.font = font(400, 11); ctx.textAlign = 'center';
      for (let i = items.length - 1; i >= 0; i--) {
        const m = items[i];
        m.y += m.v * dt;
        m.flash = Math.max(0, m.flash - dt * 0.8);
        const end = tagY(m.lane) - 8;
        let x = m.x0 * W, t = 0;
        if (m.y >= rY) {
          if (!m.stamped) {
            m.stamped = true; m.flash = 1;
            emit({ text: m.text, laneId: m.lane.id, confidence: m.conf, unsureOf: m.hes?.id });
          }
          t = Math.min(1, (m.y - rY) / (end - rY));
          if (t >= 1) { tags[m.lane.id].pulse = 1; tags[m.lane.id].conf = m.conf; items.splice(i, 1); continue; }
          x = itemX(t, m.x0 * W, tagX(m.lane), m.hes ? tagX(m.hes) : null);
        }
        const pre = m.y < rY;
        const fadeIn = Math.min(1, Math.max(0, (m.y - SPAWN_Y) / 80));
        const alpha = pre ? PRE_ALPHA * fadeIn : (POST_ALPHA[0] + m.flash * (POST_ALPHA[1] - POST_ALPHA[0])) * (1 - Math.pow(t, 5));
        const half = ctx.measureText(m.text).width / 2;
        const cx = Math.max(64 + half, Math.min(W - 64 - half, x));
        ctx.fillStyle = `rgba(${C.fgr},${alpha})`;
        ctx.fillText(m.text, cx, m.y);
        if (!pre) {
          const conf = m.conf.toFixed(2);
          ctx.font = font(500, 9.5);
          ctx.globalAlpha = alpha; ctx.fillStyle = m.hes ? C.bad : C.lane[m.lane.id];
          ctx.fillText((m.hes ? `?  ${m.hes.label} ${conf}  →  review` : `→ ${m.lane.label} · ${conf}`).toUpperCase(), cx, m.y + 14);
          ctx.globalAlpha = 1;
          ctx.font = font(400, 11);
        }
      }
    }

    function draw(dt: number) {
      ctx.clearRect(0, 0, W, H);
      drawReading();
      drawField(dt);
      if (!reduce && !isPhone(W)) drawItems(dt);
      wrap.dataset.frames = String(++frames);
      drawn = true;
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      spawnT += dt * 1000;
      if (isPhone(W)) {
        items.length = 0;
        if (spawnT > PHONE_TICK_MS) {
          spawnT = 0;
          const l = pick(visibleLanes(W)), conf = 0.86 + Math.random() * 0.13;
          tags[l.id].pulse = 1; tags[l.id].conf = conf;
          emit({ text: `“${pick(l.messages)}”`, laneId: l.id, confidence: conf });
        }
      } else if (spawnT > SPAWN_MS) { spawnT = 0; spawn(); }
      draw(dt);
      raf = requestAnimationFrame(loop);
    }

    function update() {
      const run = ready && !reduce && onScreen && !document.hidden;
      if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
      else if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    function size() {
      const w = hero.clientWidth, h = hero.clientHeight;
      if (w === W && h === H) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = w; H = h; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wrap.dataset.fieldTop = String(fieldGeometry(W, H).top);
      if (reduce && drawn) draw(0); // resizing clears the canvas
    }

    function fit() {
      const bottom = con.getBoundingClientRect().bottom - hero.getBoundingClientRect().top;
      const h = heroHeight(bottom, hero.clientWidth);
      if (Math.abs(hero.offsetHeight - h) > 2) hero.style.height = `${h}px`;
      size();
    }

    fit();
    for (let i = 0; i < 3; i++) { spawn(); items[items.length - 1].y += i * 110; }
    if (reduce) emit(STATIC_DECISION);

    const ro = new ResizeObserver(fit);
    ro.observe(copy);
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; update(); });
    io.observe(hero);
    const mo = new MutationObserver(() => { C = readColors(); if (reduce && drawn) draw(0); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.addEventListener('visibilitychange', update);
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      fit();
      ready = true;
      if (reduce) draw(0); else update();
    });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect(); mo.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    <section ref={heroRef} className={css.hero}>
      <div ref={wrapRef} className={css.field} data-frames="0" aria-hidden="true">
        <canvas aria-hidden="true" />
      </div>
      <div className={css.strip}>
        <span className={css.n} aria-hidden="true">01</span>
        System 01
        <span className={css.corner} aria-hidden="true" />
      </div>
      <div ref={copyRef} className={css.copy}>
        <ZilsWordmark className={css.mark} />
        <h1 className={css.h}>{title}</h1>
        <p className={css.sub}>{description}</p>
        <div className={css.btns}>
          <SiteButton href="/early-access" variant="primary">Request early access</SiteButton>
          <SiteButton href="#workflow" variant="secondary">See how it works</SiteButton>
        </div>
        <DecisionConsole decision={decision} />
      </div>
    </section>
  );
}
