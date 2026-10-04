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

## Service settings

Copy `.env.example` to `.env.local` and supply the settings for your own services.
Set the same values in the appropriate Vercel environment before building.

| Setting | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public browser key; never a service-role key |
| `NEXT_PUBLIC_FEZ_TRAINING_API_URL` | Reachable HTTPS training coordinator |
| `FEZ_DECISION_API_URL` | Complete server-side inference endpoint URL |
| `FEZ_DECISION_API_KEY` | Server-only inference bearer credential |
| `FEZ_DECISION_MODEL` | Exact model identifier expected by the inference server |
| `FEZ_DECISION_LABEL` | Public display label, such as `Zils 0.8B · experimental` |

The existing `FEZ_*` setting names, model identifiers, and recorded evidence
schemas remain compatible with running services. Rebranding does not change
checkpoints or recorded results. Never commit credentials or copy production
secrets into a preview deployment.

For training, configure Supabase Auth's site URL and redirect allowlist for
`https://zils.ai/train`. The coordinator must allow `https://zils.ai` as its web
origin. See the [training service setup](https://github.com/ooo-hq/zils/blob/main/docs/supabase-training.md).
Public browser settings are baked into the build, so changes require a new build.

## Customer training setup

The `/train` page explains suitable examples before sign-in and provides a blank
CSV template and a synthetic support-routing example. After signing in, customers
can define a decision, choose its 2–50 possible answers, load a UTF-8 CSV, map
information/answer/source-group columns, and review the prepared data before
submitting to the existing training coordinator.

Guided CSV preparation runs in browser memory. It accepts up to 10 MiB, 20,000
examples, and 64 columns. The selected answer and source-group columns are excluded
from model inputs. Missing or unknown answers, duplicate inputs (including
conflicting labels), and missing group values block preparation. Each answer must
occur in at least three independent source groups. This is a structural minimum,
not a recommendation for sufficient training or evaluation data.

Whole groups are assigned deterministically to learning, calibration, and test
sets, aiming for 70/15/15 while representing every answer in each set. Group sizes
can change these ratios; difficult overlapping groups may require manual splitting.
The converter produces the coordinator's existing JSONL format and runs the same
local validator as advanced upload. These checks do not identify semantic duplicates,
incorrect labels, or information that would not be available at prediction time.

Customers review actual set sizes, answer coverage, input examples, acceptance
criteria, and worker-sharing consent before upload. Draft data is not persisted:
keep the original CSV and settings or download the prepared JSONL files before
leaving. Advanced JSONL upload remains available for manually prepared datasets and
interrupted-upload recovery. An in-memory saved job locks its preparation form
until resumed, submitted, or canceled to avoid accidental duplicate creation.

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
double. They do not run model training or contact Supabase.

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

`public/model/` contains recorded public benchmark and testnet snapshots from
the model repository. Keep their original identifiers, timestamps, metrics, and
hashes. Experimental results are not a released model or a live network feed.
