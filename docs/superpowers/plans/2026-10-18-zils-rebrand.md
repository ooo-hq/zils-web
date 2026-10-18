# zils.ai Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the zils.ai marketing pages in the approved design (dark two-surface layout, spectrum, "Sorting" hero, quiet copy, light mode, split sign-in, `/bittensor` merged into `/miners`) without changing the workspace beyond the new dark theme default.

**Architecture:** New design tokens live under a `.zs` scope class in `app/global.css`, so only marketing markup sees them. Shared site primitives go in `components/site/`. Pure logic (hero geometry, pricing estimate, miner board, theme resolution) goes in `lib/` with node unit tests. Pages keep their routes in `app/(home)/` and swap their bodies to the new components. Existing data libraries and JSON (`data/*.json`, `lib/*-study.ts`, `lib/network-miners.ts`) stay the source of every number.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind 4 with CSS modules, TypeScript, `next/font/google`, Playwright, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-18-zils-rebrand-design.md`. Mockups: `docs/superpowers/specs/2026-10-18-zils-rebrand/mockups/`. The mockups are the visual reference for every task; open the named mockup next to the task.

## Global Constraints

- Next.js 16 has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing route, layout, font, redirect or metadata code (repo `AGENTS.md`).
- Work on branch `rebrand-build`, cut from `rebrand-design`, in the `zils-rebrand` worktree. Commit after every task. Commit messages carry **no** Claude/co-author attribution. Never push without the owner's word.
- No new npm dependencies. Inter Tight comes from `next/font/google`; IBM Plex Mono is already loaded.
- Copy stays word for word except spec §7: nav "Bittensor" becomes "Miners"; Examples intro and demo headlines are shortened; the Miners hero line is new; "What's in a standard run?" moves into the Pricing small print; corner readouts say "System 01".
- The hero strip reads "System 01" with **no decisions counter**. The console pill reads **LIVE DEMO**.
- With no saved choice, every page defaults to **dark**. An explicit choice wins everywhere. Storage key stays `zils-theme`.
- Tokens are scoped: nothing outside `.zs` changes. The workspace (`/train`, `/models`, `/playground`, `/keys`, `/usage`, `/billing`, `/dashboard`, `/cli/authorize` bodies) must render exactly as before, apart from the theme default.
- Text on the dark panel uses at least 50% opacity (WCAG AA 4.5:1). Decorative canvas text is `aria-hidden` and exempt.
- `prefers-reduced-motion`: no fades, fills, counting or canvas animation. Show the final state.
- No horizontal scroll at 320–375 px on any marketing route.
- Dark tokens: gutter `#0f0f13`, panel `#18191e`, raised `#1d1e24`, line `rgba(255,255,255,.07)`, text-1 `#e8e6ef`, logo `#8f88ff`, orange `#ff7a2f`. Light tokens: gutter `#ecebf1`, panel `#faf9fc`, raised `#f1eff6`, line `rgba(28,26,38,.10)`, text-1 `#1c1a26`, logo `#4b44c8`, accents `#c2582a` / `#6a59cc` / `#4a5fc4`.
- Spectrum: `#ef8d5a 0%, #d9a08c 18%, #cfa2e4 42%, #c3b4f6 64%, #a9b5f2 82%, #8ea6ff 100%`, with grain overlay. Lane colors: Billing `#f08a4b`, Spam `#e7a58f`, Account changes `#d7a6e8`, Technical support `#c3b2f6`, Sales `#a9b5f2`, Needs review `#8ea6ff`.
- Every new `lib/*.ts` file must be added to the `test` script's file list in `package.json` so `npm test` compiles it.
- Avoid class names that collide with shared or injected styles (`.status`, `.links`). Prefix CSS-module classes per component.

## Review Focus

1. **The miners API returns other statuses, nothing, or nulls.** It can return `stale` or `offline` (not just online, unseen, disabled), `median_skill: null`, an empty list, or `networkMiners()` can return `null` because the API is down. Expected: every status gets a label, null skill shows "No candidates yet", and an outage shows an "unavailable" panel instead of crashing. Tests in Task 12.
2. **Theme storage is blocked or holds garbage.** `localStorage` can throw, or hold `"blue"`. Expected: the page renders dark, with no error and no flash of light. Test in Task 2.
3. **The pricing calculator at its edges.** 0 requests, 0 tokens, the maximum, and a total of exactly $5.00. Expected: "$0.00 left" at exactly $5, overage only above it, and no `NaN` or negative amounts. Test in Task 11.
4. **The hero at extreme sizes and states.** 320 px width, a resize mid-animation, a hidden tab, reduced motion. Expected: the console never overlaps the tags, the canvas pauses when hidden or off-screen, and reduced motion shows a static frame. Tests in Tasks 6–7.
5. **Old links.** `/bittensor`, `/bittensor#…` and `/examples#chess` (or any demo hash). Expected: `/bittensor` permanently redirects to `/miners`, and each examples hash still opens its demo. Tests in Tasks 9 and 12.

---

### Task 1: Branch and workspace baseline

**Files:**
- Create: `tests/browser/workspace-unchanged.spec.ts`
- Create: `tests/browser/workspace-unchanged.spec.ts-snapshots/*` (generated)
- Create: `tests/browser/record-content-baseline.spec.ts` (runs only when `RECORD_BASELINE=1`)
- Create: `tests/browser/fixtures/content-baseline.json` (generated)

**Interfaces:**
- Produces:
  - The snapshot spec every later task re-runs to prove the workspace hasn't changed.
  - `content-baseline.json`, shaped `{ model: { tables: { caption: string; rows: string[] }[] }, privacy: { h2: string[]; paragraphs: number }, terms: { h2: string[]; paragraphs: number }, bittensor: { text: string } }`. Tasks 10, 12 and 14 assert that nothing from it was dropped.

- [ ] **Step 1: Create the branch**

Run: `git switch -c rebrand-build rebrand-design`
Expected: `Switched to a new branch 'rebrand-build'`

- [ ] **Step 2: Write `workspace-unchanged.spec.ts`**

For each route in `['/train', '/models', '/playground', '/keys']` and each theme in `['light', 'dark']`:
- set `localStorage['zils-theme']` to that theme with `page.addInitScript`,
- set viewport 1440×1000 and `reducedMotion: 'reduce'`,
- `goto(route)`, wait for `networkidle`, and run `expect(page).toHaveScreenshot(\`${route.slice(1)}-${theme}.png\`, { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.002 })`.

Use the existing `tests/browser/signed-in.ts` helper where a route needs a session.

- [ ] **Step 3: Record baselines on the unchanged code**

Run: `npx playwright test workspace-unchanged --update-snapshots`
Expected: 8 snapshots written, all pass.

- [ ] **Step 4: Write and run the content recorder**

`record-content-baseline.spec.ts` visits `/model`, `/privacy`, `/terms` and `/bittensor` and writes `content-baseline.json` in the shape above:
- every `<table>` on `/model`, with its caption (or nearest heading) and each row's normalized `innerText`,
- the H2 texts and `<p>` count inside `main` on the two policy pages,
- the normalized `innerText` of `/bittensor`'s `main`.

Run: `RECORD_BASELINE=1 npx playwright test record-content-baseline`
Expected: the file is written and non-empty.

- [ ] **Step 5: Commit**

```bash
git add tests/browser/workspace-unchanged.spec.ts tests/browser/workspace-unchanged.spec.ts-snapshots tests/browser/record-content-baseline.spec.ts tests/browser/fixtures/content-baseline.json
git commit -m "test: snapshot workspace pages before the rebrand"
```

---

### Task 2: Dark theme default

**Files:**
- Modify: `lib/theme.ts`
- Modify: `components/theme.tsx`
- Modify: `package.json` (add `lib/theme.ts` to the `test` file list)
- Create: `tests/theme.test.cjs`
- Modify: `tests/browser/theme.spec.ts`

**Interfaces:**
- Produces: `resolveTheme(saved: unknown): 'light' | 'dark'` in `lib/theme.ts`. `themeScript` and `ThemeSync` both use it, with the same rule.

- [ ] **Step 1: Write the failing unit test** in `tests/theme.test.cjs`

```js
const { resolveTheme, themeScript } = require('../.private/test-build/theme.js');
test('no saved choice resolves to dark', () => assert.equal(resolveTheme(null), 'dark'));
test('explicit choices win', () => { assert.equal(resolveTheme('light'), 'light'); assert.equal(resolveTheme('dark'), 'dark'); });
test('garbage resolves to dark', () => { for (const v of ['blue', '', undefined, 1]) assert.equal(resolveTheme(v), 'dark'); });
test('the pre-paint script no longer reads the OS preference', () => assert.ok(!themeScript.includes('prefers-color-scheme')));
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- --test-name-pattern=resolve`
Expected: FAIL, `resolveTheme is not a function`.

- [ ] **Step 3: Implement**

- Add `resolveTheme` to `lib/theme.ts`.
- Rewrite `themeScript` so it sets `data-theme` to the saved `light`/`dark` value, else `dark`, inside the existing try/catch.
- In `components/theme.tsx`, `applyTheme` uses `resolveTheme`. Remove the `prefers-color-scheme` listener from `ThemeSync`; keep the `storage` listener.

- [ ] **Step 4: Run the unit tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Update `tests/browser/theme.spec.ts`**

Rename and rewrite the first test as "theme starts dark until the visitor chooses, then survives navigation and reload":
- With `colorScheme: 'light'` emulated and no storage, `/` has `html[data-theme="dark"]`.
- After clicking the toggle it is `light`, and that holds across `/model` and a reload.
- Add a case where `localStorage.getItem` throws (an init script overriding `Storage.prototype.getItem`): the page renders `data-theme="dark"` with no `pageerror`.
- Keep the cross-tab test, and the mobile overflow test with its route list unchanged.

- [ ] **Step 6: Run the browser specs**

Run: `npx playwright test theme workspace-unchanged`
Expected: theme specs PASS. Workspace `*-dark` snapshots PASS. Workspace `*-light` snapshots PASS, because they set the theme explicitly.

- [ ] **Step 7: Commit**

```bash
git add lib/theme.ts components/theme.tsx package.json tests/theme.test.cjs tests/browser/theme.spec.ts
git commit -m "feat: default to dark when no theme is saved"
```

---

### Task 3: Site tokens, fonts and scope

**Files:**
- Modify: `app/global.css` (append a `.zs` block)
- Modify: `app/layout.tsx` (add Inter Tight)
- Create: `components/site/site.module.css` (spectrum, grain, rails, shared utility classes)
- Create: `tests/browser/site-tokens.spec.ts`

**Interfaces:**
- Produces:
  - CSS custom properties under `.zs`: `--zs-gutter`, `--zs-panel`, `--zs-raised`, `--zs-line`, `--zs-fg` (hex), `--zs-fg-rgb`, `--zs-bg-rgb`, `--zs-t2` (fg at .58 dark / .64 light), `--zs-t3` (fg at .50 dark / .52 light), `--zs-logo`, `--zs-orange`, `--zs-peach`, `--zs-lilac`, `--zs-peri`, `--zs-bad`, `--zs-spectrum`, `--zs-grain`, and the lane colors `--zs-lane-billing|spam|account|tech|sales|review`.
  - Light values under `[data-theme=light] .zs`.
  - Font variable `--font-inter-tight` on `<html>`. Inside `.zs`, `font-family: var(--font-inter-tight)` for sans, Plex Mono for `.zs-mono`.

- [ ] **Step 1: Write the failing spec** `site-tokens.spec.ts`

On `/contact` (any page that loads `global.css`):
- inject `<div class="zs" id="probe">` via `page.evaluate`,
- assert `getComputedStyle(probe).getPropertyValue('--zs-panel').trim()` is `#18191e` in dark and `#faf9fc` after setting `data-theme="light"`,
- assert `--zs-t3` resolves to an alpha of at least 0.5.

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test site-tokens`
Expected: FAIL, empty property.

- [ ] **Step 3: Implement**

Add the token block with the Global Constraints values and Inter Tight (weights 200, 300, 400, 500, `variable: '--font-inter-tight'`).

- [ ] **Step 4: Run**

Run: `npx playwright test site-tokens workspace-unchanged`
Expected: PASS, and the workspace snapshots are unchanged.

- [ ] **Step 5: Commit**

```bash
git add app/global.css app/layout.tsx components/site/site.module.css tests/browser/site-tokens.spec.ts
git commit -m "feat: add scoped rebrand tokens and Inter Tight"
```

---

### Task 4: Site primitives

Reference: any mockup, especially `home.html` and `research.html`.

**Files:**
- Create: `components/site/site-frame.tsx` and `.module.css`
- Create: `components/site/section-row.tsx`
- Create: `components/site/reveal.tsx`
- Create: `components/site/count-up.tsx`
- Create: `components/site/details-row.tsx`
- Create: `components/site/score-bars.tsx` and `.module.css`
- Create: `components/site/site-button.tsx`
- Create: `tests/browser/site-primitives.spec.ts`
- Create: `app/(home)/_preview/site-primitives/page.tsx` (a dev-only fixture page; `notFound()` when `process.env.NODE_ENV === 'production'`)

**Interfaces:**
- Produces:
  - `SiteFrame({ children, current?: NavId }: …)`: renders `.zs` root, nav (Task 5), the gutters + column grid (56 px gutters, collapse below 900 px), and the footer. It is the one wrapper every marketing page uses.
  - `SectionRow({ n?: string, label: string, note?: string })`: 40 px row, gutter number, corner marker.
  - `Reveal({ children, delay?: number, as?: 'div'|'section' })` (client): adds `data-in` when 25% visible. With reduced motion it starts in the final state.
  - `CountUp({ value: number, decimals?: number, suffix?: string, start: boolean, durationMs?: number })` (client).
  - `DetailsRow({ summary: string, children })`: native `<details>` with the `+`/`−` marker.
  - `ScoreBars({ rows: { label: ReactNode, value: number, max: number, display: string, kind: 'zils'|'jev'|'base', note?: string }[], animate?: boolean })`: fills on reveal.
  - `SiteButton({ href, variant: 'primary'|'secondary', children })`.

- [ ] **Step 1: Write the failing spec** `site-primitives.spec.ts`

Against `/_preview/site-primitives`:
- with reduced motion, every `[data-reveal]` has `data-in` on load, and the `CountUp` text equals its final value (`79.2%`);
- without reduced motion, scrolling `ScoreBars` into view makes its fills reach `transform: matrix(1, 0, 0, 1, 0, 0)` within 2 s;
- `DetailsRow` opens on Enter;
- the page has no horizontal overflow at 375 px.

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test site-primitives`
Expected: FAIL, 404.

- [ ] **Step 3: Implement the primitives and the fixture page**

Match the mockups' measurements: section row height 40 px, gutter 56 px, H1 `clamp(44px, 6vw, 84px)`.

- [ ] **Step 4: Run**

Run: `npx playwright test site-primitives`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/site app/\(home\)/_preview tests/browser/site-primitives.spec.ts
git commit -m "feat: add rebrand site primitives"
```

---

### Task 5: Nav, footer and page shell

Reference: the nav and footer on every mockup; `sign-in.html` for the sign-in link target.

**Files:**
- Modify: `components/site-header.tsx`. It keeps the export `SiteHeader({ current?: NavId, tone? })` so `/cli/authorize`, `/pricing-lab` and `SitePage` still compile; `tone` is ignored.
- Modify: `components/site-footer.tsx` and `.module.css`
- Modify: `components/site-page.tsx` (wrap in `.zs` frame styles; body styling unchanged for `/cli`, `/pricing-lab`)
- Modify: `components/account-menu.tsx` (restyle only, keep behavior)
- Modify: `tests/browser/account-menu.spec.ts`, `tests/browser/theme.spec.ts` (nav link name `research` keeps working; `Miners` replaces `bittensor`)
- Create: `tests/browser/site-nav.spec.ts`

**Interfaces:**
- Produces:
  - `type NavId = 'examples' | 'model' | 'miners' | 'pricing'`
  - `LINKS = [examples /examples, research /model (id model), miners /miners, pricing /pricing]`. Labels render as "Examples", "Research", "Miners", "Pricing" in uppercase mono.
  - Footer groups: Build: Docs, Examples, Pricing, Early access. Explore: Research, Miners, Model source. Keep in touch: Changelog, Discord, X, Contact.

- [ ] **Step 1: Write the failing spec** `site-nav.spec.ts`

- At 1440 px, the center of `nav[aria-label="Main navigation"]` is within 2 px of `innerWidth / 2`, both signed out and signed in.
- Signed out, the header shows a "Sign in" link to `/sign-in` and an "Early access" link. Signed in (`signed-in.ts`), "Early access" is replaced by the Account menu (Your workspace, Billing, Sign out).
- There is no "Bittensor" link in the header or footer.
- The current page's link has `aria-current="page"`.
- The footer sits at the viewport bottom on a short page (`/contact` at 1440×1600: the footer's bottom equals the document height).
- The wordmark text is never uppercase: `getComputedStyle(wordmark).textTransform === 'none'` in both header and footer.

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test site-nav`
Expected: FAIL.

- [ ] **Step 3: Implement**

- The links are absolutely centered.
- On the right: `ThemeToggle` (square, bordered), then the "Sign in" text link (signed out only), then the outlined "Early access" button or the `AccountMenu`.
- Links hide below 960 px. The header is sticky, 64 px tall, with the gutter color at 92% opacity and an 8 px backdrop blur.

- [ ] **Step 4: Run**

Run: `npx playwright test site-nav account-menu theme workspace-unchanged`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/site-header.tsx components/site-footer.tsx components/site-footer.module.css components/site-page.tsx components/account-menu.tsx tests/browser
git commit -m "feat: rebrand nav, footer and page shell"
```

---

### Task 6: Sorting field logic

**Files:**
- Create: `lib/sorting-field.ts`
- Create: `tests/sorting-field.test.cjs`
- Modify: `package.json` (test list)

**Interfaces:**
- Produces:
  - `type Lane = { id: 'billing'|'spam'|'account'|'tech'|'sales'|'review'; label: string; color: string; desk: { col: number; row: number }; phone: { col: number; row: number } | null; side: 0 | 1; messages: string[]; files: string[] }`
  - `LANES: Lane[]` with the spec §4.1 positions. Desk: billing (0,2), spam (1,1), account (3,0), tech (6,0), sales (8,1), review (7,2). Phone: tech (0,0), account (5,0), billing (0,2), review (5,2); spam and sales are `null`. Messages and files are copied from `mockups/home.html`.
  - `SKY = [4, 3, 2, 3, 4, 4, 3, 4, 3, 2]`, `COLS = 10`, `ROWS = 6`
  - `isPhone(width: number): boolean`, true below 700
  - `rowHeight(width: number): number`, 34 on phones, else 42
  - `fieldGeometry(width: number, height: number): { left: number; right: number; cell: number; top: number; bottom: number; rh: number }`. Gutters are 56 px on desktop and 0 on phones.
  - `visibleLanes(width: number): Lane[]`
  - `heroHeight(consoleBottom: number, width: number): number`, which equals `max(isPhone ? 720 : 860, ceil(consoleBottom + 40 + 6 * rowHeight(width)))`
  - `READ_FRACTION = 0.44`, `SPAWN_MS = 2400`, `PHONE_TICK_MS = 2600`, `HESITATE_P = 0.16`, `PRE_ALPHA = 0.12`, `POST_ALPHA = [0.26, 0.46]`
  - `itemX(t: number, x0: number, target: number, tempt: number | null): number`. Eased cubic path. When `tempt` is set, it drifts to `tempt` by `t = 0.55`, wobbles, then commits to `target`.

- [ ] **Step 1: Write the failing tests** in `tests/sorting-field.test.cjs`

```js
test('phone lanes are the four in spec positions', () => assert.deepEqual(visibleLanes(375).map(l => [l.id, l.phone.col, l.phone.row]), [['billing',0,2],['account',5,0],['tech',0,0],['review',5,2]]));
test('desk shows all six lanes', () => assert.equal(visibleLanes(1440).length, 6));
test('hero keeps 40px between console and field', () => { const w = 1100, h = heroHeight(653, w); assert.ok(fieldGeometry(w, h).top - 653 >= 40); });
test('hero never shrinks below its floor', () => { assert.equal(heroHeight(100, 1440), 860); assert.equal(heroHeight(100, 375), 720); });
test('phone tags fit the width', () => { for (const l of visibleLanes(320)) { const g = fieldGeometry(320, 720); assert.ok(g.left + l.phone.col * g.cell + 150 <= 320); } });
test('itemX ends at target, hesitant or not', () => { assert.equal(itemX(1, 10, 200, null), 200); assert.equal(itemX(1, 10, 200, 120), 200); });
test('hesitant path passes the tempting lane mid-flight', () => assert.ok(Math.abs(itemX(0.55, 10, 300, 120) - 120) < 8));
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- --test-name-pattern="lanes|hero|itemX|phone"`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/sorting-field.ts`**

Pure functions only: no DOM, no randomness inside the exported functions. Callers pass in random values.

- [ ] **Step 4: Run**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/sorting-field.ts tests/sorting-field.test.cjs package.json
git commit -m "feat: add sorting hero geometry and paths"
```

---

### Task 7: Sorting hero and decision console

Reference: `mockups/home.html` (the `.frame` block and its canvas script).

**Files:**
- Create: `components/site/sorting-hero.tsx` (client) and `.module.css`
- Create: `components/site/decision-console.tsx` (client) and `.module.css`
- Create: `tests/browser/sorting-hero.spec.ts`

**Interfaces:**
- Consumes: everything from Task 6. `SiteButton`.
- Produces:
  - `SortingHero({ title: string, description: string })`: renders the strip "System 01", the wordmark, title, description, the two buttons, `DecisionConsole`, and the `aria-hidden` canvas.
  - `type Decision = { text: string; laneId: Lane['id']; confidence: number; unsureOf?: Lane['id'] }`
  - `DecisionConsole({ decision: Decision | null })`: types three lines (650 ms each, 1.8 s hold), always showing the latest decision. Header `ZILS · SYSTEM 01 · SUPPORT-ROUTER` plus the **LIVE DEMO** pill. The body is a `role="log" aria-live="polite"` region that only receives the finished three-line text.

- [ ] **Step 1: Write the failing spec** `sorting-hero.spec.ts`

- At widths 1440, 1100, 768, 375 and 320: the console's bottom plus 40 is ≤ the field top (read the field top from a `data-field-top` attribute the component sets on the canvas wrapper), and there is no horizontal overflow.
- The pill text is `LIVE DEMO`, and no element contains "decisions made".
- The canvas has `aria-hidden="true"`.
- Within 6 s at 1440 px, the console shows a line matching `/^> answer (Billing|Spam|Account changes|Technical support|Sales|Needs review)$/`.
- With reduced motion: after 3 s, `data-frames` on the canvas wrapper is `≤ 1` (the component increments it per drawn frame), and the console shows one completed decision.
- Hidden tab: `Object.defineProperty(document, 'hidden', { value: true, configurable: true })`, then dispatch `visibilitychange`. `data-frames` stops increasing for 2 s.
- In light mode, the canvas reads its colors from CSS: sample one skyline pixel and assert it isn't pure black.

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test sorting-hero`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Draw with DPR scaling. Read colors from `getComputedStyle(root)` on theme change; watch `data-theme` with a `MutationObserver`.
- Animate with `requestAnimationFrame`. Pause when an `IntersectionObserver` says the hero is off-screen or `document.hidden` is true.
- On phones (`isPhone`), skip falling items and pulse a random visible lane every `PHONE_TICK_MS`.
- Set the hero height from `heroHeight(consoleBottom, width)` on mount and on resize.
- Console styling per spec §4.2: 480 px wide, raised surface, 18% border, 2 px spectrum top edge, warm glow, 6 px page-color ring, pulsing ring on the pill dot, and an orange flash on each new line.

- [ ] **Step 4: Run**

Run: `npx playwright test sorting-hero`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/site/sorting-hero.* components/site/decision-console.* tests/browser/sorting-hero.spec.ts
git commit -m "feat: add the sorting hero and live demo console"
```

---

### Task 8: Home page

Reference: `mockups/home.html`.

**Files:**
- Modify: `app/(home)/page.tsx`, `app/(home)/home.module.css`
- Modify: `components/home-decision-story.tsx` and `.module.css` (restyle into the three-cell "How it works")
- Modify: `components/support-study.tsx` (`SupportStudySummary` uses `ScoreBars`)
- Modify: `tests/browser/home-decision-story.spec.ts`
- Create: `tests/browser/home.spec.ts`

**Interfaces:**
- Consumes: `SiteFrame`, `SectionRow`, `Reveal`, `ScoreBars`, `SortingHero`, `DetailsRow`, `SiteButton`.
- Section rows: `02 How it works`, `03 Jobs`, `04 What you get`, `05 Research`, `06 Start`. `USE_CASES` gains the Rank options entry with the "SDK 0.3.0 · Experimental" badge and its existing fine print.

- [ ] **Step 1: Write the failing spec** `home.spec.ts`

- Headings appear in order: "Teach AI to make decisions your way.", "Show it what a good answer looks like.", "Same idea, different jobs.", "What you get.", "See what training changed.", "Start with a decision you know how to make."
- The research bars show `70.6%` and `79.2%` once scrolled into view (reduced motion: immediately).
- "Show another message" cycles to a different message.
- The "Before you upload." notice links to the data-handling page.
- No horizontal overflow at 375 px.
- Section 04's readout cards render from a `HOME_READOUTS` constant in `app/(home)/page.tsx`, with each value commented `// placeholder: owner to supply`. Each card carries `data-placeholder="true"`, and the test asserts all three do. That keeps them findable until the owner supplies real values (spec §8).

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test home`
Expected: FAIL.

- [ ] **Step 3: Implement**

Copy stays from the current `page.tsx` constants. Visuals follow the mockup (cells, icon tiles, readout cards, dashed notice, closing skyline).

- [ ] **Step 4: Run**

Run: `npx playwright test home home-decision-story workspace-unchanged`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(home\)/page.tsx app/\(home\)/home.module.css components/home-decision-story.* components/support-study.tsx tests/browser
git commit -m "feat: rebuild the home page in the rebrand"
```

---

### Task 9: Examples page

Reference: `mockups/examples.html`.

**Files:**
- Modify: `app/(home)/examples/page.tsx`
- Modify: `components/bitcast-examples.tsx` and `.module.css` (the picker, the score row and "Full test details")
- Modify: `components/doom-examples.tsx`, `components/oro-examples.tsx` and their modules (new layouts)
- Modify: `tests/browser/examples-deep-links.spec.ts`, `doom-examples.spec.ts`, `oro-examples.spec.ts`, `chess-study.spec.ts`

**Interfaces:**
- Consumes: `data/decision-examples.json` (`examples`, `replies`, `chess`), `lib/doom-examples.ts`, `lib/oro-examples.ts`, `ScoreBars`, `DetailsRow`.
- Picker tiles: title plus the difference (`+97`, `+7`, `+37`, `−3`, `+7`), computed from the existing scores, not hard-coded.
- Inbox labels come from `replies[].intent`. Chess uses the recorded `chess.examples` positions (three). "Another post" cycles `examples`. None of the mockup placeholders survive.

- [ ] **Step 1: Update the specs to the new structure**

- Each hash (`#doom`, `#content`, `#chess`, `#inbox`, `#oro`) selects its tile and demo.
- Doom statuses become "Reached the exit · 9.7 s" and "Died · 2.2 s" on `ended`.
- Chess: clicking Zils's move shows "Checkmate"; JEV's move shows "Check, king escapes". Board squares are visible: the light/dark square contrast is ≥ 1.2:1 in both themes.
- The inbox chips equal the JSON intents.
- When JEV leads (inbox), the difference renders as "+3" with the grey class and the caption "more replies for JEV".
- "Full test details" contains each demo's existing study text, word for word.

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test examples doom oro chess`
Expected: FAIL.

- [ ] **Step 3: Implement**

The intro and headlines use the spec §7 shortened copy. Videos are lazy and start when visible.

- [ ] **Step 4: Run**

Run: `npx playwright test examples doom oro chess`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(home\)/examples components/bitcast-examples.* components/doom-examples.* components/oro-examples.* tests/browser
git commit -m "feat: rebuild examples with lighter demos"
```

---

### Task 10: Research page and study pages

Reference: `mockups/research.html`.

**Files:**
- Modify: `app/(home)/model/page.tsx`, `components/research-guide.tsx` and `.module.css`, `components/research-evidence.tsx`, `components/jev-comparison.tsx`
- Create: `components/site/outcome-grid.tsx` (client)
- Create: `components/site/sticky-index.tsx` (client)
- Modify: `app/(home)/model/{b300-study,chess-study,flight-study}/page.tsx` (wrap in `SiteFrame`; use `SectionRow`, `ScoreBars`, `DetailsRow` for their existing content)
- Modify: `tests/browser/research-page.spec.ts`, `b300-study.spec.ts`, `chess-study.spec.ts`

**Interfaces:**
- Produces:
  - `OutcomeGrid({ groups: { label: string; count: number; color: string }[], columns?: number })`: 50 columns on desktop, 25 on phones. Paints in on reveal.
  - `StickyIndex({ items: { id: string; label: string }[] })`: highlights the section in view, hidden below 960 px.
- The outcome counts come from `lib/jev-comparison.ts` (both 324, Zils only 72, JEV only 29, neither 75). Assert against the data, not literals.

- [ ] **Step 1: Update `research-page.spec.ts`**

- The index lists Findings … Metric guide and marks the visible section `aria-current="true"`.
- The outcome grid has 500 cells, with color groups matching the data counts.
- **Every table row from today's page is present:** for each entry in `content-baseline.json` → `model.tables`, every row text appears in `/model` (normalized whitespace).
- No horizontal overflow at 375 px (the main column has `min-width: 0`; wide tables scroll inside their wrapper).

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test research b300 chess-study`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run**

Run: `npx playwright test research b300 chess-study`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(home\)/model components/research-* components/jev-comparison.tsx components/site/outcome-grid.tsx components/site/sticky-index.tsx tests/browser
git commit -m "feat: rebuild research with index and outcome grid"
```

---

### Task 11: Pricing page

Reference: `mockups/pricing.html`.

**Files:**
- Create: `lib/pricing-estimate.ts`
- Create: `tests/pricing-estimate.test.cjs`
- Modify: `package.json` (test list)
- Modify: `app/(home)/pricing/page.tsx` and its components
- Create: `components/site/credit-estimate.tsx` (client)

**Interfaces:**
- Consumes: `BETA_PRICING` from `lib/pricing.ts`.
- Produces:
  - `estimate({ requests, tokensPerRequest, extraRuns }: { requests: number; tokensPerRequest: number; extraRuns: number }): { inference: number; training: number; total: number; left: number; over: number; usedPct: number }`. Inputs are clamped to ≥ 0 and non-finite values are treated as 0. `left` and `over` are never both > 0.
  - `sliderToValue(pos: number, lo: number, hi: number): number`. Log scale; 0–100 position, rounded to 2 significant figures.

- [ ] **Step 1: Write the failing tests** in `tests/pricing-estimate.test.cjs`

```js
test('defaults cost $4.20 with $0.80 left', () => { const e = estimate({ requests: 100000, tokensPerRequest: 1000, extraRuns: 0 }); near(e.total, 4.2); near(e.left, 0.8); assert.equal(e.over, 0); });
test('two extra runs go $3.20 over', () => { const e = estimate({ requests: 100000, tokensPerRequest: 1000, extraRuns: 2 }); near(e.total, 8.2); near(e.over, 3.2); assert.equal(e.left, 0); });
test('exactly $5 leaves zero, not overage', () => { const e = estimate({ requests: 0, tokensPerRequest: 0, extraRuns: 2.5 }); assert.equal(e.over, 0); near(e.left, 0); });
test('zeros and garbage are safe', () => { for (const bad of [0, -5, NaN, Infinity]) { const e = estimate({ requests: bad, tokensPerRequest: bad, extraRuns: bad }); assert.ok(Number.isFinite(e.total) && e.total >= 0); } });
test('slider midpoints hit the defaults', () => { assert.equal(sliderToValue(50, 1000, 10000000), 100000); assert.equal(sliderToValue(50, 100, 10000), 1000); });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- --test-name-pattern="cost|over|safe|slider"`
Expected: FAIL.

- [ ] **Step 3: Implement the lib, `CreditEstimate`, and the page**

- `CreditEstimate`: sliders with labels, a live total, the credit bar (spectrum for inference, peach for training), a white end-of-credit marker when over, and the "left"/"beyond" line.
- Sliders are native `input[type=range]` with `aria-valuetext` set to the formatted value.
- Page: the big "$5" panel, the rates, the small print now including "What's in a standard run?", and the FAQs as `DetailsRow`.

- [ ] **Step 4: Run**

Run: `npm test && npx playwright test theme`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pricing-estimate.ts tests/pricing-estimate.test.cjs package.json app/\(home\)/pricing components/site/credit-estimate.tsx
git commit -m "feat: rebuild pricing with the credit estimate"
```

---

### Task 12: Miners page and the /bittensor merge

Reference: `mockups/miners.html`.

**Files:**
- Create: `lib/miner-board.ts`
- Create: `tests/miner-board.test.cjs`
- Modify: `package.json` (test list)
- Modify: `app/(home)/miners/page.tsx`
- Create: `components/site/miner-board.tsx` (client: sorting)
- Delete: `app/(home)/bittensor/page.tsx` (its content moves; see Step 3)
- Modify: `next.config.mjs` (redirect)
- Create: `tests/browser/miners.spec.ts`

**Interfaces:**
- Consumes: `networkMiners()`, `Miner`, `NetworkMiners` from `lib/network-miners.ts`.
- Produces:
  - `STATUS_LABEL: Record<Miner['status'], string>`: `online` "Online", `stale` "Seen recently", `offline` "Offline", `unseen` "Never seen", `disabled` "Disabled"
  - `isActive(m: Miner): boolean`, true only for `online` (others dim to 45%)
  - `type SortKey = 'selected' | 'uid' | 'status' | 'skill' | 'lastSeen'`
  - `sortMiners(miners: Miner[], key: SortKey): Miner[]`. Descending, stable, ties broken by skill (null last).
  - `boardNumbers(n: NetworkMiners): { online: number; total: number; jobs: number; selected: number }`, where jobs is the sum of `training.assigned` and selected is the sum of `training.selected`.

- [ ] **Step 1: Write the failing tests** in `tests/miner-board.test.cjs`

```js
test('every API status has a label', () => { for (const s of ['online','stale','offline','unseen','disabled']) assert.ok(STATUS_LABEL[s]); });
test('sort by selected desc with skill tiebreak, nulls last', () => assert.deepEqual(sortMiners(fixture, 'selected').map(m => m.uid), [1, 101, 102, 100]));
test('board numbers sum the fixture', () => assert.deepEqual(boardNumbers(net), { online: 2, total: 4, jobs: 44, selected: 9 }));
test('empty list is fine', () => assert.deepEqual(sortMiners([], 'skill'), []));
```

Build the fixture from the four miners in `mockups/miners.html`: UIDs 1, 101, 102, 100 with assigned 28/14/2/0, selected 4/3/2/0, skill .98/.94/.71/null.

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- --test-name-pattern="status|sort|board|empty"`
Expected: FAIL.

- [ ] **Step 3: Implement the lib, the board and the page**

- Page order: hero ("Miner leaderboard", the new one-liner), strip row (`Testnet · subnet 579`, `Updated HH:MM UTC` from `as_of`), the four numbers, the board, "How to read the leaderboard" (the approved status wording, plus "Seen recently" and "Offline" described from today's page text), the base tier line and "What we have tried" (today's `/miners` timeline), and then **"Testnet rehearsal · 25 Sept 2026"**.
- That last row holds every section of today's `bittensor/page.tsx` verbatim. Move the JSX and its data, then delete the page.
- When `networkMiners()` returns `null`, render a panel: "The leaderboard is unavailable right now." The rest of the page still renders.
- Phone rows are two lines (UID and status | selected and skill), with no header row.

- [ ] **Step 4: Add the redirect**

In `next.config.mjs`: `{ source: '/bittensor', destination: '/miners', permanent: true }`.

- [ ] **Step 5: Write and run `miners.spec.ts`**

- `/bittensor` returns 308 to `/miners`.
- Clicking the "Median skill" header re-sorts.
- The rehearsal row, once opened, contains every sentence of `content-baseline.json` → `bittensor.text`. Split on `. ` and assert each non-empty sentence is present, normalized.
- With the training API mocked to return 500, the unavailable panel shows and there's no `pageerror`.
- No overflow at 375 px.

Run: `npm test && npx playwright test miners`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/miner-board.ts tests/miner-board.test.cjs package.json app/\(home\)/miners next.config.mjs components/site/miner-board.tsx tests/browser/miners.spec.ts
git rm app/\(home\)/bittensor/page.tsx
git commit -m "feat: miner leaderboard absorbs bittensor"
```

---

### Task 13: Early access, contact and sign-in

Reference: `mockups/early-access.html`, `contact.html`, `sign-in.html`.

**Files:**
- Modify: `app/(home)/early-access/page.tsx`, `components/email-signup.tsx`
- Modify: `app/(home)/contact/page.tsx`, `components/contact-form.tsx`
- Create: `app/(home)/sign-in/page.tsx`, `components/site/sign-in-panel.tsx` (client) and `.module.css`
- Modify: `lib/training-auth.ts` (add `sendSignInLink`), `components/training-dashboard.tsx` (use it)
- Modify: `tests/browser/early-access-signup.spec.ts`, `google-auth.spec.ts`
- Create: `tests/browser/sign-in.spec.ts`

**Interfaces:**
- Consumes: `signInWithGoogle(client, origin, '/train')` from `lib/training-auth.ts`, `useAuthSession()` from `components/auth-session.ts`, and the same `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: origin + '/train' } })` call that `training-dashboard.tsx` uses. Extract it to `lib/training-auth.ts` as `sendSignInLink(client, email, origin)` and use it from both places.

- [ ] **Step 1: Write the failing spec** `sign-in.spec.ts`

- Signed out: "Continue with Google" starts OAuth (assert the request the existing `google-auth.spec.ts` intercepts); submitting an email shows "Check your email."
- Signed in (`signed-in.ts`): `/sign-in` redirects to `/train`.
- At 375 px the halves stack and the tags are hidden.
- The theme toggle works on the page.
- The Early access page's "Sign in to your workspace" link goes to `/sign-in`.
- Contact and Early access success states show "Message sent." and "You're on the list.", and the honeypot field is still present and hidden.

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test sign-in early-access google-auth`
Expected: FAIL.

- [ ] **Step 3: Implement**

The split layouts follow the mockups; form behavior and copy are unchanged.

- [ ] **Step 4: Run**

Run: `npx playwright test sign-in early-access google-auth workspace-unchanged`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(home\)/early-access app/\(home\)/contact app/\(home\)/sign-in components/email-signup.tsx components/contact-form.tsx components/site/sign-in-panel.* lib/training-auth.ts components/training-dashboard.tsx tests/browser
git commit -m "feat: split sign-in page and restyled forms"
```

---

### Task 14: Legal pages and 404

Reference: `mockups/privacy.html`, `404.html`.

**Files:**
- Modify: `components/policy-page.tsx` (layout, plus a sticky index built from `PolicySection` titles)
- Create: `app/not-found.tsx`
- Modify: `tests/policy-routes.test.cjs` if it asserts markup
- Create: `tests/browser/legal.spec.ts`

**Interfaces:**
- Consumes: `SiteFrame`, `SectionRow`, `StickyIndex`.

- [ ] **Step 1: Write the failing spec** `legal.spec.ts`

- `/privacy` and `/terms` each list their H2s in the index, in order, equal to `content-baseline.json` → `privacy.h2` / `terms.h2`, and keep the same `<p>` count.
- `/no-such-page` returns 404 with "No decision for this page." and links to `/` and `/examples`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test legal`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run**

Run: `npm test && npx playwright test legal`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/policy-page.tsx app/not-found.tsx tests
git commit -m "feat: legal template and 404 in the rebrand"
```

---

### Task 15: Cross-site checks and cleanup

**Files:**
- Create: `tests/browser/site-rebrand.spec.ts`
- Delete: `app/(home)/_preview/` (the fixture page from Task 4), unless the owner wants it kept
- Modify: anything the checks catch

**Interfaces:** none new.

- [ ] **Step 1: Write `site-rebrand.spec.ts`**

For every marketing route (`/`, `/examples`, `/model`, `/model/chess-study`, `/model/flight-study`, `/model/b300-study`, `/pricing`, `/miners`, `/early-access`, `/contact`, `/sign-in`, `/privacy`, `/terms`, `/no-such-page`), in both themes and at 320, 375, 768 and 1440 px:
- `scrollWidth ≤ innerWidth`.
- Every visible text node inside `.zs` that isn't under `[aria-hidden="true"]` has a contrast ratio ≥ 4.5 against its effective background. Compute it in `page.evaluate` with a small luminance helper.
- Every element matching `a, button, input, select, summary, [tabindex="0"]` shows a visible focus ring when focused (outline or box-shadow is not `none`).
- With reduced motion, no CSS animation is running 1 s after load (`document.getAnimations().filter(a => a.playState === 'running').length === 0`).
- No "Bittensor" text and no "decisions made" text anywhere.

- [ ] **Step 2: Run the whole suite**

Run: `npm run lint && npm run types:check && npm test && npx playwright test`
Expected: all PASS, including `workspace-unchanged`.

- [ ] **Step 3: Fix whatever fails, then re-run Step 2**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: cross-site rebrand checks and cleanup"
```

- [ ] **Step 5: Report to the owner**

List the branch, the commits, the `HOME_READOUTS` placeholders still waiting on real values, and screenshots of each page in both themes from `.private/`.
