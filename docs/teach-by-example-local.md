# Teach by example: local prototype

Branch: `codex/teach-by-example`. Start with `npm ci` and `npm run dev -- --hostname 127.0.0.1 --port 3118`, then open `http://127.0.0.1:3118/train/teach`.

Click **Try with sample examples** for a complete walkthrough, or describe a task and paste your own input/answer pairs. CSV, XLSX, JSON, JSONL, and NDJSON imports reuse the existing data reader and field mapping. JSON can contain an array of records or a single record; wrapped record lists are selectable. Nested objects and arrays stay intact as JSON text for review. Review each answer, resolve gaps, and inspect the separate learning, calibration, and test cases.

Choose **I have training data** to skip the walkthrough. Supply prepared JSONL/NDJSON training, calibration, and evaluation files, a run name, and acceptance thresholds. This reuses the existing submission schemas and dataset validator, including duplicate IDs and overlap checks. The review shows counts and settings; it does not start a run or transfer files to the existing dashboard. Switching paths preserves the in-memory draft.

Choose **Documents** when adding examples, or use the document shortcut on the first step. PDF, DOCX, TXT, and Markdown are read locally, one document at a time (10 MiB maximum; PDFs up to 50 pages). PDF.js reads PDF text; existing ZIP/XML dependencies read Word body text and tables. Word headers, footers, images, and comments are not extracted. PDFs without text require OCR, which is not connected. Partial PDFs identify pages without readable text.

The document workspace lets users edit the text, request fields, inspect matching source lines, correct values, and confirm their review. Suggestions match explicit labels only: there is no semantic extraction or image understanding. Missing or conflicting values stay blank. Reviewed fields can be exported as JSON or added to the teaching draft. Source-document groups remain intact when splitting examples; task-specific answers still require review. Text is limited to 200,000 characters for inspection and 16,000 characters per teaching input or answer.

## Scope

- All examples stay in browser memory. Refreshing or closing the tab loses them; save the prepared draft first.
- No model calls, training jobs, billing, or backend uploads. PDF.js is loaded only when opening a PDF.
- The route renders the not-found page outside development. The existing training page is unchanged.
- Writing and extraction illustrate onboarding; live support needs task-specific training adapters. The draft is not a coordinator submission payload.
- Three distinct cases per outcome permit a preview split, not a claim that the dataset is sufficient. Comparison answers are explicitly illustrative.

## Verification

- 164 tests pass, including teaching-flow checks and four document tests covering text/Word parsing, file limits, field evidence, missing/conflicting values, review requirements, and teaching-example limits.
- Type checking, targeted lint, and the production build pass.
- Browser: sample walkthrough, CSV import with mapping, wrapped JSON list selection, JSONL import, nested input preservation, missing-answer rejection, answer corrections invalidating review, mobile review scrolling, and light/dark layouts verified. Malformed JSONL identifies its source line and preserves previously imported examples.
- Browser: real synthetic PDF and DOCX imports, field suggestions, corrections clearing review, source grouping, document state surviving path switches, and an empty-text PDF preserving the previous document verified. Prepared files validate with counts of 2/2/2; overlapping files invalidate the review and show the duplicate-ID error. Both new paths were checked at a 390px mobile width.
- Prepared JSON was read from the rendered preview and checked: nine reviewed examples split 3/3/3. Evidence is in `.private/verification/`.
- The in-app browser did not confirm the Blob download. **View or copy the prepared draft** and **View or copy fields** expose the same JSON as fallbacks. Download saving in a normal browser remains unverified.
- Production response contains the not-found page and no teaching form. Next.js streams this response with HTTP 200 and a 404 fallback marker.
