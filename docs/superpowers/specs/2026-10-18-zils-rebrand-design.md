# zils.ai rebrand: marketing site design

Date: 18 October 2026
Status: ready for owner approval
Mockups: [`2026-10-18-zils-rebrand/mockups/`](2026-10-18-zils-rebrand/mockups/) (open `home.html`; every page links to the others; the sun/moon button switches light and dark)

## 1. Intent

Zils keeps its message and its logo, and gets a look with more professionalism and more mystery: nostalgic 80s science fiction made quiet and futuristic. The visitor is someone who uses LLMs and is curious about decision models but may not quite get them yet. In the first seconds they should feel that Zils has a story, without the site telling it, and they should understand what Zils does from the copy and from the hero, which shows decisions being made.

The current copy already explains Zils well. This rebrand changes the feel, the structure and the amount of text on screen. It does not rewrite the message.

### Goals

- A dark, calm, instrument-panel look with a warm orange-to-periwinkle spectrum, in both dark and light mode.
- A hero that explains the product by showing it: examples arrive, get read, and land in answer lanes, while a live console reports each decision.
- A clear reading order on every page: the headline first, then the main action, then one visual. Everything else is quiet or collapsed.
- The same system across every marketing page, including phones.

### Non-goals

- The workspace: dashboard, train, models, keys, usage, billing, playground, CLI pages and docs.zils.ai. These get a second pass later. This change must not alter them, apart from the theme default (9.2).
- New copy, new claims or new numbers. Copy changes are limited to the ones listed in section 7.
- Sign-in, early-access and contact backends. The forms keep their current behavior.

### Anti-goals (a failure even if it ships)

- Spelling out the lore. The mystery is suggested by structure, motion and labels, never by a backstory paragraph.
- Busy pages. The owner rejected versions where background text, explanations or equal-volume white text competed with the headline.
- Synthwave clichés. A slatted sun over a grid floor was tried and rejected as cheap. So were an amber CRT header, an LED-dot horizon, a full background gradient wash and drawn image thumbnails.
- Fake data presented as live. Anything labeled live must be live (see section 9).

## 2. Scope

| Page | Route | Notes |
|---|---|---|
| Home | `/` | Hero plus six sections |
| Examples | `/examples` | Five demos |
| Research | `/model` | Nav label stays "Research"; study sub-pages follow the same system |
| Pricing | `/pricing` | |
| Miners | `/miners` | Absorbs `/bittensor` |
| Early access | `/early-access` | |
| Contact | `/contact` | |
| Privacy, Terms | `/privacy`, `/terms` | One legal template |
| Sign in | new split page; route is the builder's choice | Replaces the current "Sign in to your workspace" entry point for marketing visitors |
| Not found | `not-found` | |

`/bittensor` redirects permanently to `/miners`. The nav item "Bittensor" becomes "Miners".

The research study pages (`/model/b300-study`, `/model/chess-study`, `/model/flight-study`) were not mocked. They use the Research page's components (section rows, tables, bars, collapsed details).

Other routes that use the shared site header or footer today (`/app`, `/pricing-lab`, `/cli/authorize`, `/a/[id]`) get the new nav and footer, so no old "bittensor" link survives. Their page bodies are not restyled in this pass; they wait for the workspace pass. (Builder-check call.)

## 3. Design system

### 3.1 Surfaces and structure

Two surfaces, taken from Todai's site (the owner's reference): dark gutters on the left and right, and a slightly lighter content column between them. Together they read as one calm panel instead of text floating on black.

- Gutters are 56 px wide on desktop. Each gutter is separated from the column by a 1 px rail.
- Each section starts with a 40 px **section row**: a number in the left gutter (`01`, `02`, …), a monospace uppercase label, an optional right-aligned note, and a small orange corner triangle at the column's top-left edge below the row.
- Cells inside the column are divided by 1 px lines. Notices use a dashed rule.
- On phones (below 900 px) the gutters collapse to 0 and the column has a 16 px inner margin.

### 3.2 Color

Dark (the default everywhere when no choice is saved, see 9.2):

| Token | Value | Use |
|---|---|---|
| gutter | `#0f0f13` | page sides, footer, nav (92% opacity with blur) |
| panel | `#18191e` | content column |
| raised | `#1d1e24` | console, cards, hover rows |
| line | white at 7% | rails, rows, cell borders |
| text-1 | `#e8e6ef` | headings, numbers |
| text-2 | `#e8e6ef` at 58% | body text |
| text-3 | `#e8e6ef` at 50% minimum | labels, captions (see 9.4) |
| logo | `#8f88ff` | the wordmark on dark |
| orange | `#ff7a2f` | the one primary button, LIVE, corner markers, focus and active accents |

Light:

| Token | Value |
|---|---|
| gutter | `#ecebf1` |
| panel | `#faf9fc` |
| raised | `#f1eff6` |
| line | `#1c1a26` at 10% |
| text-1 | `#1c1a26` |
| text-2 | `#1c1a26` at 64% |
| text-3 | `#1c1a26` at 48% minimum |
| logo | `#4b44c8` (the original logo purple) |
| accents | deeper versions of peach, lilac and periwinkle so text in those colors stays readable: `#c2582a`, `#6a59cc`, `#4a5fc4` |

**The spectrum** is one grainy gradient: `#ef8d5a` → `#d9a08c` → `#cfa2e4` → `#c3b4f6` → `#a9b5f2` → `#8ea6ff`. Orange is its warm end, so orange belongs to the brand gradient rather than standing apart. Grain is a fractal-noise overlay at roughly 35% in overlay blend. The spectrum is used for blocks, bars, icon tiles, the hero skyline and large numerals. It is never a page background.

**Lane colors are fixed site-wide**, so an answer has the same color wherever it appears: Billing `#f08a4b`, Spam `#e7a58f`, Account changes `#d7a6e8`, Technical support `#c3b2f6`, Sales `#a9b5f2`, Needs review `#8ea6ff`. Result-badge colors: Higher accuracy uses peach, Hardware follow-up periwinkle, Mixed result pink, No gain grey.

### 3.3 Type

- **Logo:** the existing Grenze Gotisch wordmark (`components/zils-wordmark.tsx`), unchanged. It must never be uppercased by an inherited style. Mockups hit that bug twice.
- **Headings and body:** Inter Tight. Headings use weight 300 with tight tracking (−0.02 to −0.03 em). Body uses 400. This replaces Plex Sans on marketing pages only.
- **Labels, nav, buttons, data:** IBM Plex Mono, uppercase with 0.1–0.14 em tracking for labels. Plex Mono is already loaded.
- Display sizes: page H1 `clamp(44px, 6vw, 84px)`, section H2 `clamp(28px, 3.2vw, 44px)`.

### 3.4 Text rules (the quiet hierarchy)

- Only headings and key numbers use text-1. Body is text-2. Labels are text-3.
- One headline and at most one short line per block. Longer explanations, methods and caveats go in collapsed rows ("+ Full test details").
- Copy stays word for word unless section 7 lists a change.

### 3.5 Components

- **Nav:** sticky, 64 px. Logo on the left. Links (Examples, Research, Miners, Pricing) at the true page center, absolutely centered so the right-side buttons can't push them off. On the right, a theme toggle (square icon button) and an outlined "Early access" button. The active page gets an orange underline. Links hide below 960 px.
  - The nav stays auth-aware, as `SiteHeader` / `AccountMenu` is today. Signed out: a quiet "Sign in" text link to the sign-in page, then "Early access". Signed in: "Early access" becomes today's Account menu (Your workspace, Billing, Sign out), restyled. (Builder-check call.)
- **Footer:** three link columns (Build: Docs, Examples, Pricing, Early access · Explore: Research, Miners, Model source · Keep in touch: Changelog, Discord, X, Contact) plus the brand block "Specialized models. Decisions that are yours." A bottom row holds "Your data. Your decision model.", Privacy, Terms and ©. The footer pins to the bottom of the viewport on short pages.
- **Buttons:** primary is orange fill with dark text (white text in light mode). Secondary is outlined. Both use uppercase mono.
- **Answer tag:** a box with a hatched square (a diagonal line) on its left holding a tiny confidence number, then the label in uppercase mono. When a decision lands, the square fills with the lane color and fades.
- **Console:** see 4.2.
- **Result strip:** two thin bars (Zils as spectrum, JEV as hatched grey) with counts, then the difference in large light numerals.
- **Collapsed rows:** full-width, mono uppercase summary with a peach `+` / `−`.
- **Tables:** mono uppercase headers, generous row height, numbers in tabular figures, hover lifts to the raised surface.

### 3.6 Motion

- Sections fade up 16 px over 0.8 s when they scroll into view. Cells stagger by about 110 ms.
- Bars fill from the left over about 1.4 s. Percentages count up alongside.
- The hero canvas and console run continuously. Pause them when off-screen or when the tab is hidden.
- `prefers-reduced-motion`: no fades, fills or counting. Everything renders in its final state. The hero shows a static frame and the console shows one completed decision.

### 3.7 Light and dark

A sun/moon toggle sits in the nav and on the sign-in page. The choice persists across pages using the existing theme storage key (`lib/theme.ts`), so it carries into the workspace too. With no saved choice, every page starts dark (see 9.2).

## 4. Home

Reference: `mockups/home.html`.

### 4.1 Hero, "The Sorting"

The hero is a full-width canvas behind the copy. The copy is centered: logo (72 px), "Teach AI to make decisions your way.", the existing sub-line, then "Request early access" (primary) and "See how it works". Below them is the console (4.2). A strip under the nav reads **System 01**. There is no decisions counter at launch (9.1).

At the bottom of the canvas sits the **answer field**: a grid of 10 columns by 6 rows, 42 px each, spanning the column between the rails.

- **Skyline:** the bottom rows hold a gradient skyline. Column heights in rows are `[4, 3, 2, 3, 4, 4, 3, 4, 3, 2]`. The horizontal gradient runs `#ef8d5a`, `#d9a08c`, a dark dip at 24%, `#cfa2e4`, `#dcb2ee`, `#c3b4f6`, `#a9b5f2`, `#5d6688`, then fades into the background. A soft top shade sits over the top three rows. In light mode the dip and the fade use light values.
- **Tags:** six answer tags at (column, row): Billing (0, 2), Spam (1, 1), Account changes (3, 0), Technical support (6, 0), Sales (8, 1), Needs review (7, 2). Under each tag is a dark one-cell "slot" where examples drop in.
- **Examples:** a new example appears every 2.4 s, alternating sides. Each starts high up in the left or right side zone, never in the center column behind the copy.
  - Before the reading line (44% of the hero height) an example is drawn at 12% opacity.
  - When it crosses the reading line, it is stamped: it brightens to about 26–46%, shows `→ LANE · 0.94` in its lane color under the text, and the console narrates it.
  - It then eases into its tag's slot. On landing, the tag square fills with the lane color and the slot glows from below.
- **Hesitation:** about 16% of right-side examples are ambiguous ("Cancel everything. Now."). They drift toward Technical support, waver, then commit to Needs review with confidence around 0.5. Their stamp reads `? TECHNICAL SUPPORT 0.51 → REVIEW` in `#ff8f6b`.
- **Mixed input:** about a third of examples are image file names shown as text (`[img] crash-screenshot.png`). No thumbnails.
- A faint dashed "READING" line appears on the sides only.

**Phones (below 700 px):** the field uses 34 px rows, full width, and shows four tags in two rows: Technical support (0, 0), Account changes (5, 0), Billing (0, 2), Needs review (5, 2). Spam and Sales are hidden. The falling examples stop, because they collide with the copy. Instead, a decision lands in a random visible tag every 2.6 s, and the console narrates it. The buttons stack full-width.

**Spacing:** the hero's height grows so the answer field always starts at least 40 px below the console's bottom edge, at every width.

### 4.2 The console (the focal point)

A 480 px card centered under the buttons. It sits on the raised surface with a firmer border (text at 18%), a 2 px spectrum line on its top edge, a soft warm glow underneath, and a 6 px ring in the page color.

- **Header:** `ZILS · SYSTEM 01 · SUPPORT-ROUTER` on the left. On the right, a **LIVE DEMO** pill: orange text on a translucent orange fill, an orange border, and a dot with a pulsing ring. On phones the header text truncates with an ellipsis.
- **Body:** monospace, 13 px. It types three lines per decision, with a blinking cursor: `> in "…"`, `> answer Billing` (in the lane's accent), `> confidence 0.93` (lilac). Each new line flashes a faint orange background as it appears. Ambiguous cases show `unsure: Technical support?` then `→ Needs review`.
- Timing: about 650 ms per line, then a 1.8 s hold. If decisions arrive faster, the console skips to the latest one.
- The console narrates the same decisions the canvas shows.

### 4.3 Sections

Each section has a numbered section row. The copy is the current copy.

1. **02 · How it works:** "Show it what a good answer looks like." Three cells:
   - You show it the answers: the example table, with answers as lane-colored chips.
   - Zils learns the job: lane-colored dots drift into a grainy spectrum tile with the Zils mark.
   - A new message comes in: message, answer, why, and "Show another message ↻" to cycle examples.
   - Disclaimer line underneath.
2. **03 · Jobs:** "Same idea, different jobs." Four cells: Sort requests, Flag problems, Score matches, Rank options. Each has a 44 px grainy icon tile from its slice of the spectrum, two lines of text and its question in mono. Rank options keeps the "SDK 0.3.0 · Experimental" badge and its fine print. Then the CTA pair.
3. **04 · What you get:** three cells, each with a small readout card: model card, held-out result bars, API request. These values are placeholders (section 8). Then a dashed "Before you upload." notice with "Read how data is handled →".
4. **05 · Research:** "See what training changed." On the left, the lead paragraph and links. On the right, the bars: JEV 70.6% hatched, Zils 79.2% spectrum, both counting up, then "+8.6 percentage points vs TypeSafe JEV" in peach. The fine print is unchanged.
5. **06 · Start:** "Start with a decision you know how to make." with the CTA pair, sitting on a 10-column spectrum skyline that rises column by column on scroll.

## 5. Other pages

### Examples (`mockups/examples.html`)

The owner rejected the first version as too text-heavy. Rule: one question → one visual → who was right → one score row.

- **Intro:** "See what Zils decides." and one line: "Zils beside TypeSafe JEV in every demo. Same inputs, real recorded answers."
- **Picker:** five tiles showing only the title and the score difference (+97, +7, +37, −3, +7). The active tile gets a lane-colored top bar and a filled square.
- **Demos**, one headline each:
  - **Survive Doom:** the real recordings (`/examples/doom-zils-100001.mp4`, `doom-jev-100001.mp4`) play side by side. Each status flips to "Reached the exit · 9.7 s" or "Died · 2.2 s" when its video ends. "Replay ↺" restarts both.
  - **Review a post:** the post as a single quote, then Zils "Approve · Right" vs JEV "Do not approve · Wrong". Key: "Right = matches Bitcast's label." "Another post" cycles through the five recorded posts.
  - **Find the mate:** "White to move. Which check is mate?" A board plus two choice cards (Zils's move, JEV's move). Tapping a card plays it on the board and shows "Checkmate" or "Check, king escapes". The board uses text-color squares at 7% and 2.5% so it stays visible on both surfaces.
  - **Sort an inbox:** five replies. "Sort with Zils" reveals each intent chip in turn.
  - **Referee a shopping AI:** two chat bubbles (the assistant quoting a review, the shopper holding its answer), then Zils "Wait · Right" vs JEV "Answer · Wrong".
- **Score row:** Zils bar and count, JEV bar and count, the difference (shown in grey when JEV leads). "Full test details" collapses the definition, the training note and the links.

### Research (`mockups/research.html`)

- **Hero:** on the left, the headline, sub-line, CTA and fine print. On the right, a before/after card (57.8% → 79.2%, counting up, the after value in spectrum text) and the one recorded correction.
- **Sticky numbered index** on the left (02 Findings … 10 Metric guide). It highlights the section in view and hides on phones.
- **Findings:** one row per result, with a colored badge, the claim and caveat on the left, and the number on the right.
- **Support:** the **500-mark outcome grid**, 50 columns that paint in on scroll (324 both correct in lilac, 72 only Zils in orange, 29 only JEV in blue, 75 both wrong in grey), with a legend. Then the three stats, the confidence table and collapsed method notes.
- **Chess and Flights:** bars that fill on scroll (Zils spectrum, JEV hatched, baseline grey). Flights adds a three-step January → February → March timeline.
- **Base tier, d3-mini, Earlier benchmark:** restyled tables. **Every row from the current page stays.** The mockup condenses two tables only for brevity.
- **Metric guide:** a two-by-two glossary.

### Pricing (`mockups/pricing.html`)

- **Hero:** "Your model. Pay as you go." with a "Beta launch pricing" tag and one line.
- **01 · One plan:** a large grainy-spectrum "$5" with "prepaid credit. Your first training run is included, and the full $5 stays for usage." Then the CTA and "Paid access is coming. Top-ups are not available yet." On the right, four rate rows: Included / $2 per run / $0.042 / Free. "What's in a standard run?" moves into the small print under the rates.
- **02 · Estimate:** three log-scale sliders (requests 1k–10M, default 100,000; tokens 100–10k, default 1,000; extra runs 0–10). A large total ($4.20 at defaults) and a **$5 credit bar**: spectrum for inference, peach for training. Past $5, a white marker shows where the credit ends and the overage appears in orange. The math must match `lib/pricing-model.ts`.
- **03 · Details:** the five FAQs as collapsed rows, answers word for word. Then the closing CTA.

### Miners (`mockups/miners.html`)

The information model follows REAX's miner leaderboard. The look is Zils.

- **Hero:** "Miner leaderboard" and "Who is online, and whose models customers kept. Outside miners join at mainnet." A strip row reads "Testnet · subnet 579" and "Updated HH:MM UTC".
- **Four numbers:** Online now (2/4), Jobs, Models selected, Current base.
- **Leaderboard (the main element):** columns #, Miner (large UID, with the hotkey and base underneath), Status (dot plus label), Selected ("4 of 28 jobs"), Median skill (spectrum bar plus value) and Last seen.
  - Click a header to sort; the default is Selected. Non-online miners dim to 45%.
  - On phones each row becomes two lines: UID and status on the left, selected and skill on the right.
  - Data comes from the existing live source (`lib/network-miners.ts`), refreshed every minute.
- **"How to read the leaderboard"** (collapsed): Selected, Skill, and statuses. Status wording, approved: Online, checked in within the last minute; Never seen, registered but never checked in; Disabled, gets no new jobs.
- **03 · Base tier:** one line, "Beat d3-mini to become the base." with "Round two · not scheduled". "What we have tried" is collapsed and holds the base-tier timeline from today's `/miners`.
- **Testnet rehearsal · 25 Sept 2026** is its own collapsed row. It holds everything from today's `/bittensor` page, word for word: the round loop (Train, Submit, Evaluate, Reward), participants, publication receipt, the weight-allocation table (UID, correct / 224, requested weight, on-chain value), methodology, compute notes and limitations. Nothing from `/bittensor` is deleted. (Builder-check call.)
- Links: Miner guide, Base tier rules, Public chain view.

### Early access, Contact (`mockups/early-access.html`, `contact.html`)

- Split layout: the headline and one or two lines on the left, the form on the right. Underline inputs, mono labels, and a peach focus underline.
- **Early access:** one email field, "Join early access", and "Already invited? Sign in to your workspace →" linking to the sign-in page. A 10-column spectrum skyline closes the page.
- **Contact:** Name, Email, Company (optional) and "How can we help?". The current hint text and "We'll reply by email" stay.
- Both keep the hidden `website` honeypot and the current submit behavior. Success replaces the form with a short confirmation ("You're on the list." / "Message sent.").

### Sign in (`mockups/sign-in.html`)

The owner asked for a half-and-half page.

- **Left half:** the brand. Logo, "System 01", "Specialized models. Decisions that are yours.", "Your workspace · training, models, usage", four answer tags whose squares light in turn, and a spectrum skyline that rises on load, all over a faint grid.
- **Right half:** "Sign in." and "Open your Zils workspace." Then "Continue with Google", an "or" divider, an email field, and "Email me a sign-in link", using the existing `signInWithOAuth` and `signInWithOtp` with `shouldCreateUser: false`. Below: "Workspaces are invite-only for now. New here? Get early access". Success: "Check your email." Terms and Privacy note at the bottom. Theme toggle at the top right.
- **Phones:** the halves stack. The brand half shrinks and drops the tags.
- A visitor who is already signed in is sent straight to `/train`. (Builder-check call.)

### Legal and 404 (`mockups/privacy.html`, `404.html`)

- **Legal:** the title, "Updated …" in mono, a lead paragraph, a sticky numbered index of the sections, and body text at about 760 px wide. Text unchanged.
- **404:** a giant spectrum "404", "No decision for this page.", "The link may be old, or the page has moved.", Go home / See examples, and the skyline.

## 6. Responsive rules

- Breakpoints: 960 px (nav links hide), 900 px (gutters collapse and grids go to one column), 700 px (phone hero and the miners two-line rows).
- No horizontal scrolling at 375 px on any page. Grid and flex children that hold tables or long mono text need `min-width: 0`. Research and the homepage Research block overflowed without it.
- Tables that can't reflow (Research, d3-mini) scroll inside their own container.

## 7. Copy changes

All other copy stays word for word.

- Nav: "Bittensor" → "Miners". Footer: Bittensor removed (merged).
- Examples: the intro is cut to the headline plus one line (above). Demo headlines are shortened to questions ("Should this creator post be approved?", "White to move. Which check is mate?", "What does each reply want?"). Definitions move into "Full test details".
- Miners: the new hero line (above). The existing explanations move into collapsed rows.
- Pricing: "What's in a standard run?" moves into the small print.
- Corner readouts call the models **System 01**.

## 8. Placeholders that need real values before launch

- Home 04: the model card values, the held-out result bars (92/88/84%, 31 mistakes) and the `zils.decide(...)` snippet. Use real SDK syntax and a real or clearly labeled example.
- Examples: the inbox intent labels (Wrong person, Book a call, Follow up later, Referral, Opt out) are guesses; use the recorded labels. The chess position is a stand-in; use the three recorded positions. "Another post" needs the five recorded posts.
- Hero example messages are illustrative. That is fine, but the console must not imply they are real customer data (9.1).

## 9. Constraints for the build

### 9.1 Nothing fake looks live (decided 18 Oct)

- The hero launches **without a decisions counter**; the strip reads "System 01". Nothing in zils-web counts decisions served today (`/api/counts` counts skill installs). A real counter can come later with platform work.
- The console pill reads **LIVE DEMO**. The animation keeps its pulse, but it doesn't claim real traffic.
- The miners "Updated" time and leaderboard come from the real live source.

### 9.2 Theme default (decided 18 Oct)

With no saved choice, **every page defaults to dark**, workspace included. Change the shared pre-paint script in `lib/theme.ts` (and `ThemeSync`) from "follow the OS" to "dark unless a choice is saved". An explicit choice still wins everywhere. This is the one intended change to the workspace: users who never chose a theme and run a light-mode OS will now see the workspace in its existing dark theme. The workspace's dark styling itself is unchanged.

### 9.3 Scope the new tokens to the marketing pages

`app/global.css` tokens (`--zils-page`, `--zils-accent`, …) and `components/site-header.tsx` / `site-footer.tsx` are shared with the workspace. The new surfaces, spectrum, type and nav/footer must apply only to the marketing routes. For example: a marketing route group or layout that sets a scope class, with new tokens defined under it. The workspace must render exactly as today, apart from the theme default (9.2). Verify by visually diffing `/train`, `/models`, `/playground` and `/keys` before and after.

### 9.4 Accessibility

- Body and label text must meet WCAG AA (4.5:1). On the dark panel that means text at 50% opacity or more. The mockups' 38–42% labels fail and must be raised. Decorative canvas text (falling examples) is exempt and must be `aria-hidden`.
- The hero canvas is `aria-hidden`. The console is a polite live region announcing at most one decision every few seconds, and silent under reduced motion.
- Visible focus rings (peach) on every interactive element. Sliders, sortable headers, demo tiles and chess cards are keyboard-operable.
- Orange-on-white primary buttons use white text in light mode for contrast.

### 9.5 Implementation notes

- Inter Tight via `next/font/google` (weights 200–500), applied only in the marketing scope.
- The hero canvas is a client component. It uses device-pixel-ratio scaling, reads theme colors from CSS variables (no hard-coded dark values; the mockups had to patch about 60), pauses off-screen and when the tab is hidden, and resizes with its container.
- Avoid class names that collide with shared components. The mockups hit `.status` and `.links` clashes.
- Keep the Doom videos lazy-loaded; they start when the demo scrolls into view.

## 10. Calls made during design (owner to check while reading)

- The section numbering style and the 56 px gutter width.
- The console card width (480 px) and its glow strength.
- Phone hero: hiding the Spam and Sales tags, and replacing falling examples with timed decisions.
- Moving "What's in a standard run?" into the pricing small print.
- The 404 line "No decision for this page."
- The legal template shared by Privacy and Terms.
- A sign-in route as a new marketing page.

## 11. Owner decisions

All settled on 18 October 2026: launch without a decisions counter, relabel the console pill LIVE DEMO, and default to dark everywhere when no choice is saved (9.1, 9.2). Also settled during design: site first, with docs, playground and workspace in a later pass; `/bittensor` merges into `/miners`; the miner status wording is approved; light mode is included; a split sign-in page is added.

## 12. Left to the builder

- Component boundaries, file layout and how the marketing scope is wired.
- Exact easing curves and minor spacing, within the mockups' look.
- How the research study sub-pages map onto the shared components.
- How the content fixes the design surfaced are scheduled. These are copy work, not this design: Research still names the retired JevK5 as the research model, and the miners history needs updating.
