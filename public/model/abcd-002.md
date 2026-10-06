# Trained JevK5 on ABCD: experiment 002

The frozen adapter scored **79.2%** against **57.8%** for unchanged JevK5 on 500 previously unused test conversations: **+21.4 percentage points**.
The predeclared final success gate **passed**. This is a research result; the live model is unchanged.

## Final test

| Model | Correct / 500 | Accuracy | Macro F1 | Multiclass Brier ↓ |
|---|---:|---:|---:|---:|
| Unchanged JevK5 | 289 | 57.8% | 0.4964 | 0.616934 |
| Trained JevK5 (1,024 examples) | 396 | 79.2% | 0.7583 | 0.337545 |
| previous action frequency | 224 | 44.8% | 0.1930 | 0.707464 |
| training action frequency | 99 | 19.8% | 0.0110 | 0.926030 |

Accuracy gain 95% paired-bootstrap interval: **+16.8 to +25.8 percentage points**. Relative Brier improvement: **45.29%**; absolute improvement 95% interval: 0.221387 to 0.335847.
The adapter corrected 128 base-model mistakes and introduced 21 new mistakes. Both models received the same 500 inputs. These test cases were prepared only after checkpoint and adapter hashes were frozen.

The number of mistakes fell from 211 to 104, a **50.7% reduction**.

Confidence remains too high: average top-choice confidence was 88.9% at 79.2% accuracy. Of 381 predictions made with at least 90% confidence, 44 were wrong. The 10-bin calibration error was 0.0967, versus 0.1018 for the base. Better Brier scores do not mean the probabilities are fully calibrated.

## Every development checkpoint

| Training examples | Correct / 500 | Accuracy | Macro F1 | Multiclass Brier ↓ | Qualifies |
|---|---:|---:|---:|---:|---|
| 0: unchanged | 270 | 54.0% | 0.4462 | 0.656521 | reference |
| 256 | 315 | 63.0% | 0.5524 | 0.498994 | yes |
| 512 | 371 | 74.2% | 0.6694 | 0.381126 | yes |
| 1024 | 387 | 77.4% | 0.7287 | 0.366084 | yes |

Development selection required accuracy ≥59%, Brier below 0.6565208812860769 and macro F1 ≥0.4461993240772881. Highest accuracy wins among qualifying checkpoints, then lower Brier, then earlier checkpoint. All three checkpoints are retained. Development gains are exploratory because this split selected the checkpoint.

## What was trained and measured

One 1,024-conversation training run from the official training split; no conversations shared with development. Fresh attention-only LoRA, rank 16, alpha 32, dropout 0.05, learning rate 1e-5, effective batch 4, one shuffled epoch, seed 553, gradient clipping 1, cross entropy with 0.05 label smoothing on native logits divided by 1.22. Training used 512 native 15-option gold-containing groups and 512 shuffled 16-option groups with sampled negatives; this accommodates the native 16-slot readout. Evaluation always supplied all 30 actions through native knockout inference.

Inputs contain only the prior delexicalized conversation, previous executed tools/arguments/results, and the compact catalog of all workflow sequences. Current answer, future turns, scenario and gold workflow metadata are excluded. The task is exact recorded next tool action, conditional on an action being due. Full prose policies are not provided.

The base weights, tokenizer and native JevK5 code are pinned to the same versions as experiment 001. Temperatures remain 1.22 and 0.93. All 500 development inputs and labels are byte-identical to experiment 001. Every training prefix, label and token hash was reconstructed against its source. The first 8 unchanged probability vectors matched exactly before both smoke and main training. Checkpoints were serialized to BF16 and reloaded before evaluation; no development calibration was fitted.

Main training plus three development evaluations took 60.8 minutes. Peak allocated GPU memory was 10.06 GiB. The eight-example capacity check was discarded. Its measured timing justified extending only the execution allowance from 60 to 75 minutes before the main run, with an 80-minute hard service cap; the recipe and selection rules were unchanged. Original protocol and amendment are preserved.

## Limits and interpretation

ABCD is public human-roleplay support dialogue data. Recorded next-action agreement is not proof of unique policy correctness, real customer outcomes, full dialogue success or flight-domain improvement. Public-data pretraining exposure cannot be ruled out. This study uses one recipe and one training seed, with fewer than 10 examples for three training action classes. Bootstrap intervals, when reported, reflect variation across test conversations, not across training seeds.

The adapter was trained through the isolated research runner using the existing JevK5 LoRA helper. This study did not test the complete customer-facing queued training service. Its longer contexts and sampled training choices are specific to this frozen experiment.

Data source: [ASAPP ABCD](https://github.com/asappresearch/abcd), frozen commit 6b8700ce67c6b37b062dd7a60abc76d7ef832a97, MIT license. The source archive includes all official splits; final-test records are accessed for inference only if development selection qualifies.

## Evidence

- [Recorded results and provenance](https://zils.ai/model/abcd-002.json)
- [Untouched test scores](https://zils.ai/model/abcd-002-test-results.json)
- [All development checkpoints](https://zils.ai/model/abcd-002-development-results.json)
- [Frozen protocol](https://zils.ai/model/abcd-002-protocol.json)
- [Test data manifest](https://zils.ai/model/abcd-002-test-manifest.json)
- [Training data manifest](https://zils.ai/model/abcd-002-training-manifest.json)

The published record includes the selected adapter fingerprint and SHA-256 fingerprints of the evidence files. Individual conversation records and operational host details are not included in this publication. No adapter was deployed.
