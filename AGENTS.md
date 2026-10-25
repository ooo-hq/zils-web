<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Website standards

This repository owns the zils.ai website: public research pages, the inference
playground, account keys and billing, and the customer training dashboard. It
talks to hosted services only over HTTP, configured by the settings in
`README.md`. Model, evaluation and protocol code live in `zils`; hosted APIs,
billing and the training coordinator live in `zils-platform`; documentation is
served from `zils-docs` at docs.zils.ai, not from this app.

Keep `ZILS_*` service credentials server-only; only `NEXT_PUBLIC_*` values may
reach the browser, and the Supabase key must be the publishable key. Never
simulate results when a service is unconfigured. Preserve the `FEZ_*` fallback
settings and the inherited Fez routes described in `README.md`.

Run `npm test`, `npm run types:check` and `npm run build` before a pull request;
`npm run test:browser` covers onboarding with all service requests intercepted.
`npm test` compiles an explicit list of `lib/` files: add a new tested module to
that list in `package.json`. Merges to `main` deploy production through Vercel's
GitHub integration; never deploy from a local build. Keep local plans, logs and
browser artifacts in ignored `.private/`.
