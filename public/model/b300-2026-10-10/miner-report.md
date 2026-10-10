# Miner-sized model follow-ups — 2026-10-10

Final aggregate report.

The 27B teacher experiment was canceled before completing any development predictions. The remaining test budget trained fresh H2O 4B and JevK5 2B adapters on the same ordered 4,096 ABCD examples as the Jev 4B comparator. Each new model received two passes; development accuracy, then Brier score, then the earlier epoch selected its checkpoint. All final questions retain all 30 actions and full input context.

## Previously fresh cohort, now reused — 500 conversations

| Candidate | Correct | Accuracy | Macro F1 | Brier ↓ | B300 median ms | Isolated CUDA peak GiB |
| --- | --- | --- | --- | --- | --- | --- |
| Jev 4B stock | 263/500 | 52.6% | 0.453 | 0.6545 | 129.7 | 8.19 |
| H2O 4B stock | 270/500 | 54.0% | 0.469 | 0.6574 | 43.8 | 8.77 |
| Jev 2B stock | 112/500 | 22.4% | 0.229 | 0.8696 | 99.6 | 3.71 |
| H2O 4B, reused 1,024 adapter | 399/500 | 79.8% | 0.765 | 0.3501 | 59.4 | 8.82 |
| Jev 4B, 4,096, epoch 2 | 412/500 | 82.4% | 0.809 | 0.3115 | 178.4 | 8.24 |
| H2O 4B, 4,096, epoch 1 | 415/500 | 83.0% | 0.810 | 0.2883 | 59.7 | 8.82 |
| Jev 2B, 4,096, epoch 2 | 404/500 | 80.8% | 0.772 | 0.3370 | 135.9 | 3.76 |

| Comparison | Accuracy gain pp [paired 95% CI] |
| --- | --- |
| Jev 2B, 4,096, epoch 2 minus Jev 2B stock | +58.4 [+53.8, +63.0] |
| Jev 2B, 4,096, epoch 2 minus Jev 4B, 4,096, epoch 2 | -1.6 [-4.4, +1.2] |
| H2O 4B, 4,096, epoch 1 minus Jev 2B, 4,096, epoch 2 | +2.2 [-0.4, +4.8] |
| H2O 4B, 4,096, epoch 1 minus Jev 4B, 4,096, epoch 2 | +0.6 [-1.2, +2.4] |
| H2O 4B, 4,096, epoch 1 minus H2O 4B, reused 1,024 adapter | +3.2 [+1.2, +5.2] |
| H2O 4B, 4,096, epoch 1 minus H2O 4B stock | +29.0 [+24.8, +33.2] |

## Historical cohort — 500 conversations

| Candidate | Correct | Accuracy | Macro F1 | Brier ↓ | B300 median ms | Isolated CUDA peak GiB |
| --- | --- | --- | --- | --- | --- | --- |
| Jev 4B stock | 286/500 | 57.2% | 0.488 | 0.6188 | 129.8 | 8.21 |
| H2O 4B stock | 281/500 | 56.2% | 0.482 | 0.6126 | 44.3 | 8.79 |
| Jev 2B stock | 122/500 | 24.4% | 0.271 | 0.8591 | 98.4 | 3.73 |
| H2O 4B, reused 1,024 adapter | 400/500 | 80.0% | 0.785 | 0.3383 | 60.0 | 8.84 |
| Jev 4B, 4,096, epoch 2 | 424/500 | 84.8% | 0.825 | 0.2700 | 175.7 | 8.27 |
| H2O 4B, 4,096, epoch 1 | 418/500 | 83.6% | 0.815 | 0.2792 | 59.4 | 8.84 |
| Jev 2B, 4,096, epoch 2 | 422/500 | 84.4% | 0.812 | 0.2800 | 131.7 | 3.77 |

| Comparison | Accuracy gain pp [paired 95% CI] |
| --- | --- |
| Jev 2B, 4,096, epoch 2 minus Jev 2B stock | +60.0 [+55.0, +64.6] |
| Jev 2B, 4,096, epoch 2 minus Jev 4B, 4,096, epoch 2 | -0.4 [-3.2, +2.2] |
| H2O 4B, 4,096, epoch 1 minus Jev 2B, 4,096, epoch 2 | -0.8 [-3.6, +2.2] |
| H2O 4B, 4,096, epoch 1 minus Jev 4B, 4,096, epoch 2 | -1.2 [-3.6, +1.4] |
| H2O 4B, 4,096, epoch 1 minus H2O 4B, reused 1,024 adapter | +3.6 [+1.2, +6.2] |
| H2O 4B, 4,096, epoch 1 minus H2O 4B stock | +27.4 [+23.2, +32.0] |

## Development selection — 500 conversations

| Model | Epoch | Dev accuracy | Dev Brier ↓ | Selected |
| --- | --- | --- | --- | --- |
| H2O 4B | 1 | 84.6% | 0.2561 | Yes |
| H2O 4B | 2 | 84.6% | 0.2625 |  |
| JevK5 2B | 1 | 82.2% | 0.3100 |  |
| JevK5 2B | 2 | 83.8% | 0.2899 | Yes |

## Hardware context

These new runs use B300 as temporary test hardware. An earlier RTX 4090 ABCD comparison measured H2O-adapter median latency at 257 ms versus 874 ms for Jev-adapter, using an older runtime and H2O temperature 0.8. Those measurements support feasibility on that card; they do not establish exact speed for these new checkpoints. Earlier short-task results were mixed: Bitcast tied on accuracy, while H2O trailed slightly on reply reserve and chess. ABCD results alone do not establish a winner for every miner job.

## Cost and cleanup

The temporary GPU was deleted after verified local retrieval. Estimated cumulative compute cost: **$37.95**, within the **$50** budget. This is a runtime estimate, not a provider invoice.

## Limits

Both 500-case test cohorts are retrospective for these follow-ups: earlier Jev/H2O results had already been inspected. Checkpoint selection for these new runs uses development labels only. Public pretraining overlap is unknown.

One seed (553), a fixed recipe and two epoch candidates per new model. Selected checkpoints can have different update counts because the development rule may choose different epochs. Shared examples, option views and a two-checkpoint selection budget do not isolate architecture: prompts, decision protocols and native calibration differ. JevK5-2B is an older v0.2 checkpoint; the 4B comparator is v0.3.

H2O 4,096-example training uses native temperature 0.75; the reused 1,024-example H2O adapter was trained at 0.8. Its comparison therefore changes both data exposure and training calibration.

Paired intervals resample 500 conversations 2,000 times, seed 553. They describe cohort sampling uncertainty, not variation between training seeds, and are not adjusted for multiple comparisons.

H2O completed and serialized both training checkpoints, then its training process failed a CUDA-memory release assertion. The unchanged weights were evaluated in new processes after correcting a PEFT layer-name validation mismatch. Original failures are preserved; training peak memory and uninterrupted total runtime are unavailable.

All new latency and memory measurements are on B300. H2O resets peak allocation after loading and warmup; Jev peaks include loading allocations within isolated final processes. CUDA allocated/reserved memory excludes some driver and process overhead, and is not a guaranteed minimum GPU capacity. Only isolated final inference measurements are compared; no new 4090, quantization, concurrent-serving or production validation was performed.

## Evidence

Pinned models: [H2O Lightning 4B v1.2.3](https://huggingface.co/h2oai/h2o-lightning-4b/tree/acaf0d4ea251e54de928c75ef4352670d33192d3) and [JevK5-2B](https://huggingface.co/alibiserikbay/JevK5-2B/tree/7922d1f55df137b72ef763fced56fd09efc5e99d).

[Portable aggregate results](miner-results.json). [Earlier full-weight, 4B/9B, and matched 1,024-example H2O comparisons](report.md). No raw conversations, labels, per-case predictions or infrastructure details are included.
