# Zils website

The Next.js website for Zils decision models, public research, the inference
playground, and the experimental customer training dashboard. The intended
production domain is **https://zils.ai**.

The model and subnet implementation lives in
[ooo-hq/zils](https://github.com/ooo-hq/zils). The Fez chat application remains a
separate project at [fez.chat](https://fez.chat).

## Local development

Use Node.js 24 and npm on macOS, Linux, or Windows:

```sh
git clone https://github.com/ooo-hq/zils-web.git
cd zils-web
npm ci
npm run dev
```

Open http://localhost:3000. Without service settings, research pages work,
the playground reports that inference is disconnected, and the training page
reports that sign-in and uploads are not configured. No results are simulated.

The header's sun/moon button changes the theme across the Zils
pages, including training panels. A first visit follows the device's color
setting; a manual choice is saved in browser storage and shared across tabs.
If browser storage is unavailable, switching still works for the current visit.

## Chess study

`/model/chess-study` publishes the completed `chess-001` mate-in-one comparison,
linked from `/model`. Scores and paired intervals come from the immutable public
record in `public/model/chess-001.json`; the frozen protocol, preparation checks,
data manifest, and report are available beside it. The publication preserves the
100% deterministic rules baseline, restricted candidate scope, retry accounting,
and single-seed limitation. It does not deploy or change a model.

## Service settings

Copy `.env.example` to `.env.local` and supply the settings for your own services.
Set the same values in the appropriate Vercel environment before building.

| Setting | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public browser key; never a service-role key |
| `NEXT_PUBLIC_ZILS_TRAINING_API_URL` | Reachable HTTPS training coordinator |
| `NEXT_PUBLIC_ZILS_API_URL` | Optional decision API base URL for key management; defaults to the training coordinator URL followed by `/decision` |
| `ZILS_DECISION_API_URL` | Complete server-side inference endpoint URL |
| `ZILS_DECISION_API_KEY` | Server-only inference bearer credential |
| `ZILS_DECISION_MODEL` | Exact model identifier expected by the inference server |
| `ZILS_DECISION_LABEL` | Public display label, such as `Zils shared · JevK5 4B` |
| `RESEND_API_KEY` | Server-only sending credential for the contact form |
| `ZILS_CONTACT_FROM` | Bare sender email address on a Resend-verified domain |
| `ZILS_CONTACT_TO` | Fixed inbox receiving contact inquiries |

`ZILS_*` and `NEXT_PUBLIC_ZILS_TRAINING_API_URL` are the canonical settings.
The corresponding `FEZ_*` names remain fallbacks for existing deployments; a
present Zils setting takes precedence, including an empty value. Credentials
remain server-only.

The playground defaults to the shared JevK5 4B release `zils-jevk5-v0.3-r1`.
Connect it to `https://training.zils.ai/decision/v1/systemone` with a server-only
API key authorized to use that model. Both endpoint and key are required to enable
Run. Pin the exact release ID rather than the `zils-shared` alias: the proxy checks
that the returned model matches the requested release and rejects incomplete answers.
The shared API does not report model latency; the playground measures total request
time and shows model timing only when a connected runtime actually supplies it.
Explicit older model settings remain supported and are not relabeled as JevK5.
When migrating an existing deployment, update the endpoint, API key, model ID,
and label together; changing the source defaults does not override deployed settings.

New training sessions use `zils-training-auth`. Existing sessions and pending
sign-in links continue using their original storage key until sign-out, avoiding
token copies or competing refresh locks in already-open tabs.

For training, configure Supabase Auth's site URL and redirect allowlist for
`https://zils.ai/train`. The coordinator must allow `https://zils.ai` as its web
origin. See the [training service setup](https://github.com/ooo-hq/zils/blob/main/docs/supabase-training.md).
Public browser settings are baked into the build, so changes require a new build.

The decision API must also allow the website origin for browser key management.
Configure preview and local-development origins only on services intended for
those environments; a Vercel preview does not automatically gain production API
access. The public API base URL is not a credential. Never place a customer key
in a `NEXT_PUBLIC_*` setting.

## Pricing page

`/pricing` presents the proposed beta launch plan: $5 prepaid credit with one
standard training run included, $2 for each additional standard run, and $0.042
per million input tokens with free output tokens. The scope of a standard run
must be agreed before starting. Larger jobs require an upfront estimate.

The page includes a local usage estimator and a link from the shared footer.
It does not initiate training, collect payments, or change the API meter.
Paid access and spending caps are explicitly planned.
Before enabling checkout, implement credit accounting and billing that counts
shared context once per request, then verify the advertised terms against the
customer training and serving workflows. Early-access links use `/contact`.

`/pricing-lab` is an unlisted scenario calculator for 100, 1,000, and 2,000
paying active customers. Each customer can use multiple Zils. Requests and total
training runs are entered per Zil and multiplied by the number of Zils per
customer. Results show the aggregate requests, free/paid training runs, and the
inference/training revenue split per customer, plus the total number of Zils at
each customer count. The default is an illustrative five-Zil ongoing month:
100,000 requests and one training run per Zil. The setup example uses five Zils
with six runs each and one free run per customer; this is not recurring demand.
One-Zil usage remains available as a preset. Mixed portfolios use per-Zil averages,
including setup runs for any new Zils created in the selected month.

It shares the public page's rates and allows changes to Zils serving and
coordination/evaluation costs, direct miner payments, fixed overhead, top-up
size, and the share redeeming their first included run. Unlike the original
calculator, total runs include free runs: at most one run per eligible customer
is discounted from the entered total, capped by that total. The free run does
not repeat per Zil or create an additional job. Miner-funded GPU costs are shown
separately and never deducted from Zils
revenue. Only direct payments made by Zils to miners are deducted. One customer
job can include multiple miner attempts; enter their combined compute expense.
All entered jobs, including free ones, incur modeled Zils and miner costs.
Cost presets are hypothetical: the default $0.10/job Zils cost and $1/job miner
cost are independent placeholders, not measured costs or a split of the old
estimate. Subnet emissions are excluded; miner profitability and capacity are
not modeled. Payment fees are amortized over consumed credit. Surplus excludes
payroll, marketing, and taxes. Inputs stay in tab memory and reset on refresh.

The buyback-and-burn scenario allocates 0–100% of positive monthly surplus after
an additional cash reserve. Allocation defaults to 0% (no policy assumed), with
editable examples for 25%, 50%, and 100%. The reserve defaults to $0 and is held
back once per customer-count scenario, capped at positive surplus. Losses remain
visible and never fund a buyback. Cash retained equals surplus minus the total
buyback spend and includes the reserve; the reserve is not an expense.

All purchased alpha is assumed burned. Estimated burned alpha equals buyback
spend after trading costs divided by the entered average USD execution price.
The $1/alpha and 1% trading-cost defaults are hypothetical, not live market data.
The execution price includes price impact; the trading-cost allowance covers
conversion, swap, and network fees and is deducted within the budget once.
The lab neither connects a wallet nor executes trades/burns, forecasts price,
models net supply after emissions, or sets a buyback policy. It uses consumed
usage only, excludes unspent prepaid credit, and does not model a starting
treasury balance or cash timing. Include payroll, marketing, and taxes in costs
or reserves before using the available-surplus estimate.

The lab has no navigation links pointing to it and requests `noindex, nofollow`.
It is not access-controlled: anyone with its URL can open it. Keep it out of any
future sitemap and do not store private business data in its defaults.

## Contact form

The homepage's **Contact us** links open `/contact`. Visitors provide a name,
email, optional company, and a message of up to 3,000 characters. The server sends
plain text to `ZILS_CONTACT_TO` through Resend, with the visitor's email as Reply-To.
The recipient and sender cannot be supplied by the visitor. Contact details are
not added to a mailing list or stored by this application.

Configure all three contact-delivery settings above in the intended Vercel
environment before merging the feature. Use a sending-only credential restricted
to the verified sender domain. Missing settings or provider errors return an
error, preserve the form contents, and never claim delivery succeeded. Retries
of the same submission use Resend's idempotency header. The route bounds request
size, checks the browser origin, validates fields, and includes a honeypot.
Before enabling public delivery, configure a Vercel Firewall rate-limit rule:
request path equals `/api/contact` AND method equals `POST`, fixed 60-second
window, 5 requests per IP address, action **Too Many Requests (429)**. Publish
the rule separately from the application deployment. The form preserves inputs
and explains when a visitor needs to wait before retrying.

See [Resend's send-email contract](https://resend.com/docs/api-reference/emails/send-email)
for sender verification, Reply-To, and idempotency behavior. Tests use a local
request double; they do not send email. Provider acceptance does not guarantee
inbox placement.

## Customer API keys

Signed-in customers can open **API keys** beside **Train a model** to create a
named key, copy its secret once, view active and revoked keys, or revoke a key
after confirmation. The full secret stays in component memory until the panel
closes, the customer acknowledges saving it, or the session ends. It is not
written to browser storage. Revoking a key stops requests using that key.

Key management uses the existing Supabase sign-in session and the decision API's
`GET /v1/keys`, `POST /v1/keys`, and `POST /v1/keys/{id}/revoke` routes. API keys
authorize prediction requests to models available to the account; they do not
create or train a model. See the
[decision API documentation](https://github.com/ooo-hq/zils/blob/main/docs/decision-api.md)
for model selection and server-side requests.

## Customer training setup

The `/train` workspace prioritizes the current unfinished run and lists past runs
below it. “Train a model” opens a side panel with four steps:
Decision, Data, Review, and Ready. The panel fills the screen on mobile.

Customers describe one decision, then drop in a UTF-8 CSV or Excel `.xlsx` file.
Older `.xls` files must be saved as `.xlsx` or CSV first. Workbooks offer a sheet
selector; an instructions tab does not prevent importing a valid examples tab.
Recognized business headers suggest the input, answer, and related-case columns.
Unrecognized fields remain unselected. Customers can supply 2–16 possible answers
or use answers found in the selected column. These are editable suggestions,
not AI-generated labels. A CSV template and synthetic example are included.

Guided preparation runs in browser memory. It accepts up to 10 MiB, 20,000 rows,
and 64 columns. Excel archives are checked against a 64 MiB expanded-size limit
and 512 entries; at most 32 sheets and four million cells across their occupied
ranges are accepted. Row and column references are checked before the reader
allocates cells, including sparse sheets. Excel uses saved formula values,
not recalculation, and dates are represented in ISO format. Empty rows are skipped
while their original spreadsheet row references remain visible during review.

The review screen offers a sample of up to 20 examples, all examples, or only
cases needing attention. Customers can correct answers, confirm examples, flag
cases for an expert, or explicitly leave them out. Original files are not modified.
Corrections and exclusions are applied before splitting. The answer and group
columns remain excluded from model inputs. Missing or unknown answers, duplicate
inputs (including conflicting labels), expert-review flags, and missing group
values block preparation until resolved or excluded. Each answer must occur in at
least three independent source groups. The readiness screen describes structural
readiness for an experiment, not sufficient data or a model-quality guarantee.

Whole groups are assigned deterministically to learning, calibration, and test
sets, aiming for 70/15/15 while representing every answer in each set. Group sizes
can change these ratios; difficult overlapping groups may require manual splitting.
The converter produces the coordinator's existing JSONL format and runs the same
local validator as advanced upload. These checks do not identify semantic duplicates,
incorrect labels, or information that would not be available at prediction time.

Customers review actual set sizes, answer coverage, input examples, acceptance
criteria, and worker-sharing consent before upload. Closing the panel preserves
the draft in browser memory; refreshing, leaving the page, or signing out clears
it. Keep the original spreadsheet and settings or download the prepared JSONL files before
leaving. Advanced JSONL upload remains available for prepared datasets and
interrupted-upload recovery. An unfinished upload blocks new submissions while
allowing customers to prepare the original files for recovery. Successful submission
closes the panel and returns focus to the current run.

Training still requires approved workers. Completion may produce no qualifying
model; an accepted download does not provision a prediction API.

## Checks and GitHub deployment

```sh
npm test
npm run types:check
npm run build
```

The tests cover CSV parsing, split isolation and coverage, repeatable output,
invalid data, and the existing create/upload/submit contract using a local request
double. Key tests cover authenticated create/list/revoke requests, metadata
redaction, invalid inputs, expired sessions, and ambiguous service failures.
They do not run model training or contact Supabase.

For the browser onboarding checks, install Chromium once and run:

```sh
npx playwright install chromium
npm run test:browser
```

The browser suite starts a local development server on port 3107 and intercepts
all service requests. It checks Excel sheet selection, corrections, exclusions,
mobile review, draft recovery, and prepared-file submission without contacting
Supabase or starting training. Browser artifacts stay in ignored `.private/`.

GitHub Actions runs those checks from a clean dependency installation. Connect
this repository through Vercel's GitHub integration with:

- Framework: Next.js
- Root directory: repository root
- Node.js: 24.x
- Production branch: `main`
- Install command: `npm ci`
- Build command: `npm run build`

Pull requests receive Vercel previews; merges to `main` deploy production.
Publish through that Git connection. Local builds are verification only.

Before assigning the production domain, verify the homepage, `/model`,
`/playground`, and `/train`, including real service configuration and sign-in
redirects. The website cannot provision an inference endpoint or training workers.

## Source and evidence

This repository preserves the extracted `web/` history from
[KennethAshley/fez](https://github.com/KennethAshley/fez), through source commit
`7303fe743e08b4fcf3c7a49eb5b5d15c0bf74049`. The original MIT license is retained.
The inherited Fez application routes and policy pages describe that separate
application; this extraction does not create new contractual terms.

Zils documentation is hosted at [docs.zils.ai](https://docs.zils.ai), and the
website links there directly. This app does not serve or redirect `/docs` paths.
The extensions directory and judge page belong to `fez.chat`; old Zils URLs
redirect to their matching Fez pages without publishing duplicate page content.

`public/model/` contains recorded public benchmark and testnet snapshots from
the model repository. Keep their original identifiers, timestamps, metrics, and
hashes. Experimental results are not a released model or a live network feed.

The homepage and `/model#jev-comparison` feature the recorded TypeSafe Jev 1.13.0
comparison against the ABCD-trained JevK5 adapter. The Jev API was evaluated on the
same 500 frozen test inputs; JevK5 predictions were reused and verified against the
original study. The comparison includes all paired predictions, source hashes,
confidence coverage, and the documented probability-format corrections under
`public/model/abcd-002-jev*`. Evidence tests recompute accuracy, F1, Brier, and
confidence coverage from those predictions. They do not call TypeSafe or train a
model. Keep the earlier training study and its frozen artifacts unchanged.

## Early access

`/early-access` collects applications; `/admin/access` is the private approval
page. Approved accounts can use the training workspace and API. The admission
migration and backend enforcement must be deployed together. See
[early-access setup](docs/early-access.md) for configuration and rollout.
