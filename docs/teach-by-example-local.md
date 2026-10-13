# Teach by example: local prototype

Start with `npm ci` and `npm run dev -- --hostname 127.0.0.1 --port 3118`, then open `http://127.0.0.1:3118/train/teach`. The development/build scripts prepare the local OCR assets automatically.

Click **Try with sample examples** for a complete walkthrough, or describe a task and paste your own input/answer pairs. CSV, XLSX, JSON, JSONL, and NDJSON imports reuse the existing data reader and field mapping. The answer column is optional for unlabeled examples. JSON can contain an array of records or a single record; wrapped record lists are selectable. Nested objects and arrays stay intact as JSON text for review. Review each answer, resolve gaps, and inspect the separate learning, calibration, and test cases.

Choose **I have training data** to skip the walkthrough. Supply prepared JSONL/NDJSON training, calibration, and evaluation files, a run name, and acceptance thresholds. This reuses the existing submission schemas and dataset validator, including duplicate IDs and overlap checks. The review shows counts and settings; it does not start a run or transfer files to the existing dashboard. Switching paths preserves the in-memory draft.

Choose **Images** for Imajev photo preparation. Select JPEG/PNG files or labelled folders, review thumbnails, assign answers and shared item references, and preview separate training/calibration/evaluation sets. Labels can come from CSV, XLSX, JSON, JSONL, or NDJSON using filename, answer, and optional group fields (one matching sheet/list, up to 1 MiB). Existing image mapping and split validation are reused. Duplicate image content is rejected. The local preview accepts 120 photos, 10 MiB each, 100 MiB total, up to 24 megapixels and 8,192 pixels per side. The exported draft includes metadata and hashes, not the original image bytes; keep the photos separately. Invalid replacement files preserve the previous draft.

Choose **Documents** when adding examples, or use the document shortcut on the first step. PDF, DOCX, TXT, Markdown, JPEG, and PNG are read locally, one document at a time (10 MiB maximum; PDFs up to 50 pages). PDF.js reads PDF text; existing ZIP/XML dependencies read Word body text and tables. Word headers, footers, embedded images, and comments are not extracted.

English OCR reads image files and PDF pages without readable text (up to 10 scanned pages per document). **Read every PDF page with OCR** handles mixed pages or incomplete text layers and limits the entire PDF to 10 pages. The worker, engine, and English language data come from the same app origin; no file is sent to an OCR service. OCR runs only when needed, can be stopped, and times out after three minutes. Original image previews or file links support manual checking. Empty scans, excessive page counts, and cancellation preserve the previous document. OCR accuracy depends on image quality; handwriting and languages other than English are not validated.

The document workspace lets users edit the text, request fields, inspect matching source lines, correct values, and confirm their review. Field suggestions match explicit labels only; they do not infer meaning. Missing or conflicting values stay blank. Reviewed fields can be exported as JSON or added to the teaching draft. Source-document groups remain intact when splitting examples; task-specific answers still require review. Text is limited to 200,000 characters for inspection and 16,000 characters per teaching input or answer.

## Assisted decision review

After bringing examples, the guided **Sort or make a decision** path offers **Teach Zils what you mean**. It reserves whole source cases for calibration and final testing before inference; these assignments survive later edits and draft export. Newly added cases remain for learning unless they belong to an existing reserved case. Duplicates and conflicting case assignments are rejected. Small reserved sets may not cover every answer; these are preparation splits, not evidence of adequate evaluation data.

A pass evaluates up to 24 unreviewed learning examples (fewer for large inputs), selects the two smallest top-choice probability margins and one random audit case, and asks for correct labels and optional rationales. A small pool produces a smaller batch. Human labels are never sent during prediction. Only reviewed learning examples from the current pass inform a proposed rule revision. The candidate is re-evaluated against the same pool. Scores use reviewed learning examples and are explicitly fitting checks, not independent quality estimates. Rule changes require explicit acceptance; rejection preserves the current task. Editing feedback invalidates the proposal. Editing task instructions or source inputs clears the in-flight review, while preserving the reserved splits.

This is a native Zils implementation of the review pattern investigated in [jev-align](https://github.com/sutro-sh/jev-align), using the existing decision and setup transports. It does not install jev-align or run its Python/GEPA optimizer. One bounded rule proposal is generated per request, with no automatic optimization loop or automatic acceptance.

For a live local connection, configure the existing `ZILS_DECISION_API_URL`, `ZILS_DECISION_API_KEY`, and optional `ZILS_DECISION_MODEL`, plus `ZILS_SETUP_API_URL`, `ZILS_SETUP_API_KEY`, and `ZILS_SETUP_MODEL` in `.env.local`, then restart the development server. Keys remain server-side. The new `/api/teaching/align` route operates only in local development and Vercel preview deployments, requires the same Origin for POSTs, limits request sizes, and validates inputs and provider outputs. Keep Vercel deployment protection enabled for previews. It is not a production multi-tenant endpoint. Preview deployments without model credentials offer sample and manual review only.

Without credentials, use **Try with sample examples → Review my examples → Try the sample review**. This uses only the known synthetic support examples and visibly labels all predictions, proposals, and comparisons as fixed simulations. It never silently substitutes sample results for a failed live call.

Manual review and the prepared-data path remain available. Writing, extraction and image tasks do not use assisted inference yet. No notifications, saved server-side sessions, production monitoring, or live training submission are added. Review queues and results remain in memory; approved rules, rationales, labels and frozen splits are included in the final draft.

## Scope

- Drafts are stored only in browser memory. Refreshing or closing the tab loses them; save the prepared draft first.
- No training jobs, billing changes, or persistent backend uploads. Optional live assisted review sends selected text examples to configured model services; their usage charges may apply. PDF.js and Tesseract are loaded as needed. OCR engine/language downloads may be cached; document content stays in browser memory.
- The route renders the not-found page outside local development and Vercel previews. The existing training page is unchanged.
- Writing and extraction illustrate onboarding; live support needs task-specific training adapters. The draft is not a coordinator submission payload.
- Three distinct cases per outcome permit a preview split, not a claim that the dataset is sufficient. Comparison answers are explicitly illustrative.

## Verification

- Assisted review: all 177 tests, type checking, targeted lint, and production build pass. Browser checks cover the sample batch, rationales, stale-proposal invalidation, rejection, acceptance, mobile width, and export with approved rules and preserved 7/1/1 splits. Live transport validation uses controlled provider responses; no real provider trial was run because this checkout has no credentials.

- 177 tests pass, including document parsing, image file limits, JSON/JSONL labels, duplicate image detection, reviewed exports, and preservation of item groups.
- Type checking, targeted lint, and the production build pass.
- Browser: sample walkthrough, CSV import with mapping, wrapped JSON list selection, JSONL import, nested input preservation, missing-answer rejection, answer corrections invalidating review, mobile review scrolling, and light/dark layouts verified. Malformed JSONL identifies its source line and preserves previously imported examples.
- Browser: real synthetic PDF and DOCX imports, field suggestions, corrections clearing review, source grouping, document state surviving path switches, and an empty-text PDF preserving the previous document verified. Prepared files validate with counts of 2/2/2; overlapping files invalidate the review and show the duplicate-ID error. Both new paths were checked at a 390px mobile width.
- Prepared JSON was read from the rendered preview and checked: nine reviewed examples split 3/3/3. Evidence is in `.private/verification/`.
- Image/OCR browser checks: synthetic PNG/JPEG invoices and an image-only PDF produced the expected invoice number, vendor, total, and due date. Blank scans, full-page OCR limits, and cancellation preserved prior text. Twelve images with CSV and JSONL labels produced 8/2/2 splits; correcting a label invalidated review. An unreadable replacement image preserved all twelve photos. Image intake, label cards, and scan review fit a 390px mobile viewport.
- The in-app browser did not confirm the Blob download. **View or copy the prepared draft** and **View or copy fields** expose the same JSON as fallbacks. Download saving in a normal browser remains unverified.
- Production response contains the not-found page and no teaching form. Next.js streams this response with HTTP 200 and a 404 fallback marker.
