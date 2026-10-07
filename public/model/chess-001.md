# Chess 001: completed mate-in-one comparison

**Fresh chess-trained JevK5 had the highest observed checkmate accuracy: 50.78%.** All three models completed the same 512 held-out positions. The table and paired intervals below distinguish observed rank from evidence of an advantage.

| Model | Checkmates / 512 | Accuracy | Mean probability on mating moves | Marginal NLL | Errors at ≥90% confidence |
| --- | ---: | ---: | ---: | ---: | ---: |
| Fresh chess-trained JevK5 | 260 | 50.78% | 43.25% | 1.059 | 2 / 18 confident choices |
| TypeSafe Jev 1.13.0 | 223 | 43.55% | 38.70% | 1.294 | 3 / 11 confident choices |
| Shared JevK5 | 220 | 42.97% | 36.08% | 1.164 | 0 / 0 confident choices |

These are decisions among **all legal checking moves**, with 2–16 candidates allowed by the protocol. The actual test sample has 2–10 candidates per position. Any move that immediately checkmates receives credit; 15 test positions have multiple correct answers. This does not measure unrestricted chess or full-game strength.

## Paired differences

| Comparison | Accuracy difference | Paired 95% interval |
| --- | ---: | ---: |
| Trained JevK5 minus Shared JevK5 | +7.81 percentage points | +3.32 to +12.11 points |
| Trained JevK5 minus TypeSafe Jev 1.13.0 | +7.23 percentage points | +2.15 to +12.30 points |

Intervals use the preregistered 2,000 paired whole-game bootstrap resamples, seed 557. Each game contributes one position. Intervals containing zero do not establish a reliable direction. They are individual intervals for two comparisons, without multiplicity adjustment. One adapter seed and one fixed recipe were run.

## Baselines and scope

Uniform random choice has expected accuracy **33.93%**; first-listed move achieves **34.77%**; the capture-material heuristic achieves **36.52%**. A deterministic chess-rules oracle solves **100%**. The AI comparison tests specialization, not superiority over chess software.

The dataset contains 2,048 training, 512 reserved calibration, and 512 test positions from 3,072 different source games. Calibration was unused. Exact and color-swapped vertical-mirror positions were deduplicated globally. The first 200,000 records of the pinned public Lichess archive supplied the pool; this is not a uniform sample of the full database. Public pretraining overlap and related tactical patterns remain possible.

## Execution and reliability

The fresh rank-16 adapter trained for one epoch with 512 optimizer steps on an **NVIDIA GeForce RTX 4090**. Training and saving took **22.69 minutes**, excluding loading and input preparation. Peak training tensor allocation was **8.52 GiB**; this excludes resident services and other GPU overhead. The recipe, native temperature, and final-checkpoint selection remained fixed.

The eight-example smoke completed two optimizer steps. Both smoke and full adapters passed step-zero parity, finite-gradient, saved-tensor, changed-prediction, and independent fresh-process reload checks. Full reload maximum probability difference was **0.00000000** on the training probe. Training code read only the training export; the worker also held a separate unlabeled test-input export. No held-out labels were staged there.

Jev returned a valid result on the first attempt for **506/512** positions. **6** rejected responses were retained and recovered within the three-attempt limit: five probability vectors failed the sum check and one returned choice disagreed with its probability maximum. The quality table describes validated responses after retries, not first-attempt reliability. No positions were dropped and no incomplete model runs entered the comparison.

The API recorded **518 requests**, including rejected responses, with **330,437 input tokens** and **30,176 output tokens**. These are vendor-reported usage counts, not a calculated bill. API latency includes networking and retry waits; local-GPU latency includes local encoding and inference, so the two are not equivalent serving-speed measurements.

All **1,536 predictions** passed an independent coverage, probability, provenance, and executable-checkmate audit. The 15 chess checks passed locally and on the worker. The shared base weights and serving fingerprint were unchanged, and both experiment units finished successfully. **No model was deployed or promoted.**

## Reproduction and evidence

See the [fixed protocol](chess-001-protocol.json), [preparation evidence](chess-001-preparation.json), [data manifest](chess-001-manifest.json), and [full run evidence](chess-001.json). The protocol and preparation record retain their original pre-run wording and bytes. Raw predictions, labels, adapter files, rejected API responses, and private operational logs were retained outside the public repository.

The full evidence includes exploratory success counts by number of candidates. Those breakdowns were computed after the fixed comparison and were not used to select data, tune the adapter, or choose the final checkpoint.
