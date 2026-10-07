# TypeSafe Jev vs ABCD-trained JevK5

Measured 2026-10-06. All 500 frozen ABCD test conversations received a valid action answer. TypeSafe Jev was called live; the two JevK5 columns reuse hash-verified predictions from the completed ABCD-002 evaluation.

| Model | Correct / 500 | Accuracy | Macro F1 | Brier (lower is better) |
|---|---:|---:|---:|---:|
| TypeSafe Jev 1.13.0 | 353 | 70.6% | 0.6108 | 0.403536 |
| ABCD-trained JevK5 (1,024 training examples) | 396 | 79.2% | 0.7583 | 0.337545 |
| Shared JevK5 | 289 | 57.8% | 0.4964 | 0.616934 |

Trained JevK5 minus TypeSafe Jev: **+8.6 percentage points**, with a 95% paired bootstrap interval of **+4.8 to +12.2 points** (2,000 resamples of conversations, seed 553).
Trained JevK5 alone got 72 cases right; Jev alone got 29 right. Both were correct on 324; both were wrong on 75.

## Method

Both received identical prior conversation text, compact workflow catalog, instructions, and all 30 action choices in the same order. No test labels, current answer, future turns, or scenario metadata were sent. The 1,024-example adapter was selected on separate development cases before these test inputs were prepared. No training, prompt tuning, calibration fitting, or model selection took place in this comparison.

This tests exact agreement with a recorded next support action when an action is due. It does not establish full conversation success, general model superiority, or unique policy correctness. The task and prompt were previously developed for JevK5; Jev received the same information without separate prompt optimization. Public-data pretraining overlap cannot be excluded.

## Confidence and review

Use the probability assigned to the returned choice consistently across models. TypeSafe’s separate confidence field is retained but not compared directly to JevK5 top probability.

| Model | Cases at ≥90% probability | Wrong among those cases | Accuracy among those cases |
|---|---:|---:|---:|
| TypeSafe Jev 1.13.0 | 176 | 8 | 95.5% |
| ABCD-trained JevK5 (1,024 training examples) | 381 | 44 | 88.5% |
| Shared JevK5 | 65 | 16 | 75.4% |

## Probability formatting

47 Jev answers triggered the original strict sum-to-one validator, and 1 returned choice disagreed with its probability ranking. All 500 calls returned HTTP 200, the exact pinned model, all 30 options, and an allowed choice. Observed distribution sums range from 0.9900 to 1.0000. Before computing Jev accuracy, the response-format amendment specified normalization for deviations up to 0.02 and retaining actual returned choices; the original responses and flags are preserved. No API calls were repeated for these issues, and no cases were omitted.
Jev Brier before normalization: 0.403489; after: 0.403536. Accuracy uses the returned choice and is unaffected. Jev had 5 exact top-probability ties; returned choices resolve ties. Probability calibration and NLL are limited by the precision of the returned scores.

Using canonical option-order probability argmax instead of the returned choice gives 354/500 correct (70.8%). This sensitivity includes both ties and the ranking mismatch.

## Cost and timing

Jev reported 1,595,919 input tokens across 500 calls: **$0.06703** at the documented $0.042 per million input tokens. No output charge. This is inference usage only, not a measured invoice or total model-development cost.
Jev median/p95 response time: 317.8/713.2 ms, including network transport, at concurrency 4. The initial request was sequential. Historical JevK5 timing is local GPU inference and is not a comparable end-to-end speed benchmark.

One initial sandbox connection attempt failed before an HTTP response. Its three network attempts are archived separately in sandbox-network-attempt/. The 500 successful external API calls each completed on their first attempt.

## Evidence

- [Recorded comparison and provenance](/model/abcd-002-jev.json)
- [Complete scores and paired intervals](/model/abcd-002-jev-results.json)
- [All 500 paired predictions](/model/abcd-002-jev-predictions.json)
- [Original training study](/model/abcd-002.md)
- [Training protocol](/model/abcd-002-protocol.json)
- [Test manifest](/model/abcd-002-test-manifest.json)

The published predictions retain all 500 case IDs, reference labels, model choices, and original probability vectors. No reference label was sent to Jev. Recorded hashes identify the frozen request, adapter, raw-response, and scoring artifacts; private credentials and operator paths are excluded.

TypeSafe sources: [API](https://docs.typesafe.ai/api), [model and pricing](https://docs.typesafe.ai/models), [Choice](https://docs.typesafe.ai/primitives/choice), [confidence](https://docs.typesafe.ai/confidence).
