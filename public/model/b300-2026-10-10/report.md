# B300 ABCD follow-up experiments — 2026-10-10

Final aggregate report.

The task is to choose the next recorded support tool action from 30 actions. Each cohort contains 500 conversations with one case per conversation. Fresh official-test cases are reported separately from the reused historical 500. Training uses nested 1,024 and 4,096 examples, with the original 1,024 retained in their exact order.

Development froze Jev 4B LoRA, 4,096, epoch 2 and Jev 9B LoRA, 4,096, epoch 1 as the best LoRA checkpoints. Base models, the matched 1,024-example epoch-1 checkpoints, and the fixed full-weight 4B checkpoint remain in the comparison. Duplicate roles share one candidate. No test result selects a checkpoint.

## Fresh official-test cohort — 500 conversations

| Candidate | Correct | Accuracy | Macro F1 | Brier ↓ | Median ms | P95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| Jev 4B base | 263/500 | 52.6% | 0.453 | 0.6545 | 129.7 | 133.7 |
| Jev 4B LoRA, 4,096, epoch 2 | 412/500 | 82.4% | 0.809 | 0.3115 | 178.4 | 189.0 |
| Jev 4B LoRA, 1,024, epoch 1 | 375/500 | 75.0% | 0.724 | 0.4017 | 176.9 | 187.3 |
| Jev 9B base | 276/500 | 55.2% | 0.504 | 0.6269 | 137.2 | 157.1 |
| Jev 9B LoRA, 4,096, epoch 1 | 404/500 | 80.8% | 0.784 | 0.3197 | 197.3 | 226.4 |
| Jev 9B LoRA, 1,024, epoch 1 | 382/500 | 76.4% | 0.732 | 0.3794 | 197.0 | 226.7 |
| Jev 4B full weights, 1,024, epoch 1 | 329/500 | 65.8% | 0.660 | 0.5186 | 130.8 | 135.6 |

Jev 4B full weights, 1,024, epoch 1 minus Jev 4B LoRA, 1,024, epoch 1: -9.2 [-13.6, -5.0] percentage points (paired 95% CI).

Jev 9B LoRA, 4,096, epoch 1 minus Jev 4B LoRA, 4,096, epoch 2: -1.6 [-4.2, +0.8] percentage points (paired 95% CI).

| Prespecified comparison | Accuracy gain pp [95% CI] | Brier improvement [95% CI] |
| --- | --- | --- |
| Jev 4B full weights, 1,024, epoch 1 minus Jev 4B base | +13.2 [+7.6, +18.6] | +0.1359 [+0.0604, +0.2061] |
| Jev 4B full weights, 1,024, epoch 1 minus Jev 4B LoRA, 1,024, epoch 1 | -9.2 [-13.6, -5.0] | -0.1169 [-0.1844, -0.0529] |
| Jev 4B LoRA, 1,024, epoch 1 minus Jev 4B base | +22.4 [+18.2, +27.0] | +0.2529 [+0.1928, +0.3127] |
| Jev 4B LoRA, 4,096, epoch 2 minus Jev 4B base | +29.8 [+25.4, +34.4] | +0.3430 [+0.2804, +0.4070] |
| Jev 4B LoRA, 4,096, epoch 2 minus Jev 4B LoRA, 1,024, epoch 1 | +7.4 [+4.6, +10.4] | +0.0901 [+0.0458, +0.1354] |
| Jev 9B base minus Jev 4B base | +2.6 [-1.2, +6.2] | +0.0276 [-0.0089, +0.0638] |
| Jev 9B LoRA, 1,024, epoch 1 minus Jev 4B LoRA, 1,024, epoch 1 | +1.4 [-1.6, +4.4] | +0.0223 [-0.0184, +0.0645] |
| Jev 9B LoRA, 1,024, epoch 1 minus Jev 9B base | +21.2 [+16.8, +25.4] | +0.2475 [+0.1904, +0.3038] |
| Jev 9B LoRA, 4,096, epoch 1 minus Jev 4B LoRA, 4,096, epoch 2 | -1.6 [-4.2, +0.8] | -0.0082 [-0.0446, +0.0295] |
| Jev 9B LoRA, 4,096, epoch 1 minus Jev 9B base | +25.6 [+21.4, +29.8] | +0.3072 [+0.2503, +0.3650] |
| Jev 9B LoRA, 4,096, epoch 1 minus Jev 9B LoRA, 1,024, epoch 1 | +4.4 [+1.8, +7.0] | +0.0597 [+0.0244, +0.0932] |

## Historical test cohort — 500 conversations

This reused cohort provides retrospective continuity; it is not fresh evidence.

| Candidate | Correct | Accuracy | Macro F1 | Brier ↓ | Median ms | P95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| Jev 4B base | 286/500 | 57.2% | 0.488 | 0.6188 | 129.8 | 135.6 |
| Jev 4B LoRA, 4,096, epoch 2 | 424/500 | 84.8% | 0.825 | 0.2700 | 175.7 | 187.8 |
| Jev 4B LoRA, 1,024, epoch 1 | 398/500 | 79.6% | 0.767 | 0.3471 | 177.7 | 187.4 |
| Jev 9B base | 289/500 | 57.8% | 0.510 | 0.5955 | 137.0 | 157.8 |
| Jev 9B LoRA, 4,096, epoch 1 | 418/500 | 83.6% | 0.817 | 0.2681 | 197.7 | 227.9 |
| Jev 9B LoRA, 1,024, epoch 1 | 401/500 | 80.2% | 0.782 | 0.3168 | 197.3 | 227.7 |
| Jev 4B full weights, 1,024, epoch 1 | 327/500 | 65.4% | 0.604 | 0.5209 | 131.3 | 135.6 |

| Prespecified comparison | Accuracy gain pp [95% CI] | Brier improvement [95% CI] |
| --- | --- | --- |
| Jev 4B full weights, 1,024, epoch 1 minus Jev 4B base | +8.2 [+2.6, +13.8] | +0.0980 [+0.0272, +0.1698] |
| Jev 4B full weights, 1,024, epoch 1 minus Jev 4B LoRA, 1,024, epoch 1 | -14.2 [-18.4, -10.0] | -0.1738 [-0.2385, -0.1108] |
| Jev 4B LoRA, 1,024, epoch 1 minus Jev 4B base | +22.4 [+17.8, +26.8] | +0.2718 [+0.2121, +0.3335] |
| Jev 4B LoRA, 4,096, epoch 2 minus Jev 4B base | +27.6 [+23.4, +32.0] | +0.3488 [+0.2911, +0.4098] |
| Jev 4B LoRA, 4,096, epoch 2 minus Jev 4B LoRA, 1,024, epoch 1 | +5.2 [+2.4, +8.0] | +0.0771 [+0.0345, +0.1223] |
| Jev 9B base minus Jev 4B base | +0.6 [-3.0, +4.4] | +0.0233 [-0.0129, +0.0606] |
| Jev 9B LoRA, 1,024, epoch 1 minus Jev 4B LoRA, 1,024, epoch 1 | +0.6 [-2.2, +3.8] | +0.0302 [-0.0114, +0.0745] |
| Jev 9B LoRA, 1,024, epoch 1 minus Jev 9B base | +22.4 [+17.8, +27.4] | +0.2787 [+0.2186, +0.3397] |
| Jev 9B LoRA, 4,096, epoch 1 minus Jev 4B LoRA, 4,096, epoch 2 | -1.2 [-3.8, +1.6] | +0.0019 [-0.0371, +0.0427] |
| Jev 9B LoRA, 4,096, epoch 1 minus Jev 9B base | +25.8 [+21.4, +30.2] | +0.3274 [+0.2713, +0.3885] |
| Jev 9B LoRA, 4,096, epoch 1 minus Jev 9B LoRA, 1,024, epoch 1 | +3.4 [+0.6, +6.2] | +0.0488 [+0.0113, +0.0867] |

## Development training curves — 500 conversations

Highest development accuracy, then lower multiclass Brier, fewer training exposures, and smaller training dataset. The full-weight 4B checkpoint was fixed at one epoch and was not tuned against the LoRA checkpoints.

| Base | Dev accuracy | Dev Brier ↓ |
| --- | --- | --- |
| Jev 4B base | 53.6% | 0.6561 |
| Jev 9B base | 54.8% | 0.6393 |

| Training configuration | Examples seen | Dev accuracy | Dev Brier ↓ | Development selected |
| --- | --- | --- | --- | --- |
| Jev 4B full weights, 1,024, epoch 1 | 1,024 | 65.8% | 0.5157 |  |
| Jev 4B LoRA, 1,024, epoch 1 | 1,024 | 77.8% | 0.3683 |  |
| Jev 4B LoRA, 1,024, epoch 2 | 2,048 | 78.2% | 0.3807 |  |
| Jev 4B LoRA, 4,096, epoch 1 | 4,096 | 82.6% | 0.2957 |  |
| Jev 4B LoRA, 4,096, epoch 2 | 8,192 | 83.0% | 0.2921 | Yes |
| Jev 9B LoRA, 1,024, epoch 1 | 1,024 | 76.0% | 0.3672 |  |
| Jev 9B LoRA, 1,024, epoch 2 | 2,048 | 79.2% | 0.3380 |  |
| Jev 9B LoRA, 4,096, epoch 1 | 4,096 | 84.2% | 0.2658 | Yes |
| Jev 9B LoRA, 4,096, epoch 2 | 8,192 | 84.2% | 0.2674 |  |

## Teacher experiment canceled

The 27B development run was stopped at the user's request before any complete predictions were written. No development gate was evaluated and no test score or distillation benefit is claimed. The remaining budget was redirected to H2O 4B and JevK5 2B adapter trials; their test cohorts are retrospective because the earlier H2O/Jev scores were already observed.

## H2O-Lightning-4B comparison

H2O v1.2.3 base is compared with its existing 1,024-example adapter. The adapter uses the exact original training examples used by matched Jev 4B and is reused without new H2O training. It was trained at choice temperature 0.8 and is evaluated at the current native 0.75 calibration. The H2O adapter's earlier development selection makes its development results retrospective.

The ID-only holdout audit found 500 prior H2O test conversations, all outside the fresh 500 (overlap: 0). Comparators are current B300 Jev 4B base, matched 1,024/epoch 1, and development-selected LoRA; repeated roles are deduplicated.

### H2O — fresh 500

| Candidate | Correct | Accuracy | Macro F1 | Brier ↓ | Median ms | P95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| H2O 4B base | 270/500 | 54.0% | 0.469 | 0.6574 | 43.8 | 45.4 |
| H2O 4B reused 1,024 adapter | 399/500 | 79.8% | 0.765 | 0.3501 | 59.4 | 61.6 |
| Jev 4B base | 263/500 | 52.6% | 0.453 | 0.6545 | 129.7 | 133.7 |
| Jev 4B LoRA, 1,024, epoch 1 | 375/500 | 75.0% | 0.724 | 0.4017 | 176.9 | 187.3 |
| Jev 4B LoRA, 4,096, epoch 2 | 412/500 | 82.4% | 0.809 | 0.3115 | 178.4 | 189.0 |

| Prespecified comparison | Accuracy gain pp [95% CI] | Brier improvement [95% CI] |
| --- | --- | --- |
| H2O 4B reused 1,024 adapter minus Jev 4B base | +27.2 [+22.8, +31.8] | +0.3044 [+0.2440, +0.3668] |
| H2O 4B reused 1,024 adapter minus Jev 4B LoRA, 1,024, epoch 1 | +4.8 [+2.4, +7.4] | +0.0515 [+0.0143, +0.0907] |
| H2O 4B reused 1,024 adapter minus Jev 4B LoRA, 4,096, epoch 2 | -2.6 [-5.2, -0.2] | -0.0386 [-0.0817, +0.0010] |
| H2O 4B reused 1,024 adapter minus H2O 4B base | +25.8 [+21.8, +30.2] | +0.3072 [+0.2479, +0.3656] |
| H2O 4B base minus Jev 4B base | +1.4 [-2.2, +5.0] | -0.0029 [-0.0415, +0.0363] |
| H2O 4B base minus Jev 4B LoRA, 1,024, epoch 1 | -21.0 [-25.4, -16.6] | -0.2557 [-0.3165, -0.1943] |
| H2O 4B base minus Jev 4B LoRA, 4,096, epoch 2 | -28.4 [-32.6, -24.0] | -0.3458 [-0.4075, -0.2823] |

### H2O — historical 500

| Candidate | Correct | Accuracy | Macro F1 | Brier ↓ | Median ms | P95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| H2O 4B base | 281/500 | 56.2% | 0.482 | 0.6126 | 44.3 | 46.2 |
| H2O 4B reused 1,024 adapter | 400/500 | 80.0% | 0.785 | 0.3383 | 60.0 | 62.5 |
| Jev 4B base | 286/500 | 57.2% | 0.488 | 0.6188 | 129.8 | 135.6 |
| Jev 4B LoRA, 1,024, epoch 1 | 398/500 | 79.6% | 0.767 | 0.3471 | 177.7 | 187.4 |
| Jev 4B LoRA, 4,096, epoch 2 | 424/500 | 84.8% | 0.825 | 0.2700 | 175.7 | 187.8 |

| Prespecified comparison | Accuracy gain pp [95% CI] | Brier improvement [95% CI] |
| --- | --- | --- |
| H2O 4B reused 1,024 adapter minus Jev 4B base | +22.8 [+18.6, +27.2] | +0.2805 [+0.2228, +0.3412] |
| H2O 4B reused 1,024 adapter minus Jev 4B LoRA, 1,024, epoch 1 | +0.4 [-2.6, +3.4] | +0.0088 [-0.0345, +0.0537] |
| H2O 4B reused 1,024 adapter minus Jev 4B LoRA, 4,096, epoch 2 | -4.8 [-7.4, -2.2] | -0.0683 [-0.1087, -0.0272] |
| H2O 4B reused 1,024 adapter minus H2O 4B base | +23.8 [+19.6, +28.4] | +0.2743 [+0.2178, +0.3351] |
| H2O 4B base minus Jev 4B base | -1.0 [-4.4, +2.4] | +0.0062 [-0.0308, +0.0419] |
| H2O 4B base minus Jev 4B LoRA, 1,024, epoch 1 | -23.4 [-28.2, -19.0] | -0.2655 [-0.3322, -0.2024] |
| H2O 4B base minus Jev 4B LoRA, 4,096, epoch 2 | -28.6 [-33.4, -24.4] | -0.3426 [-0.4079, -0.2838] |

### H2O — reused development 500

| Candidate | Correct | Accuracy | Macro F1 | Brier ↓ | Median ms | P95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| H2O 4B base | 280/500 | 56.0% | 0.453 | 0.6513 | 43.6 | 45.0 |
| H2O 4B reused 1,024 adapter | 394/500 | 78.8% | 0.739 | 0.3383 | 58.9 | 61.5 |
| Jev 4B base | 268/500 | 53.6% | 0.442 | 0.6561 | 129.8 | 134.6 |
| Jev 4B LoRA, 1,024, epoch 1 | 389/500 | 77.8% | 0.729 | 0.3683 | 179.2 | 189.4 |
| Jev 4B LoRA, 4,096, epoch 2 | 415/500 | 83.0% | 0.794 | 0.2921 | 177.2 | 188.8 |

## Cost and cleanup

Compute resource deletion and local result retrieval are verified by the cleanup receipt.

This trial's estimated compute cost: **$33.78**. Cumulative estimated cost including the prior run: **$37.95** against the **$50.00** approved budget ($12.05 remaining). These are runtime-based estimates, not a provider invoice.

## Interpretation limits

One training seed (553) and fixed recipes; no seed-to-seed uncertainty estimate or exhaustive tuning search. Equal examples and epochs do not imply equal compute. Full-weight and LoRA runs use different fixed learning rates.

Fresh means previously unevaluated in identifiable local execution artifacts. External evaluation and pretrained-model exposure are unknown. The historical cohort and development cohort have been reused.

Paired 95% percentile intervals resample 500 conversations 2,000 times with seed 553. They measure cohort sampling uncertainty, not training-seed uncertainty; intervals are not adjusted for multiple comparisons.

Native probabilities use each system's own prompt, decision protocol and calibration. JevK5 uses its knockout protocol; H2O uses one 30-option native readout at choice temperature 0.75. These are complete-system comparisons.

The reused H2O adapter and matched Jev 4B checkpoint share the same ordered 1,024 examples, option views, rank, learning rate, update count and effective batch. Their original training kernels, optimizer dispatch, native prompts and head precision differ. H2O is one fixed checkpoint; comparing it with Jev's best of four configurations does not give equal tuning allowances.

Native latency includes prompt preparation/tokenization and synchronized single-case inference on B300; excludes model loading, warmup, transport and queue. Teacher timing is batched generation, not independent request latency. No vLLM, concurrency or production throughput equivalence is claimed.

Before training, Jev numerical validation was amended to compare against full FP32 controls with TF32 disabled. Four training runs passed the 0.03 probability-error bound on eight development inputs and their longest training input. The 9B/4,096 run failed on its longest input (fast BF16 error 0.04114; reference BF16 error 0.05380). BF16 cutoff ties changed knockout finalists, while all final actions agreed. Replaying identical 16-option prompts reduced fast-vs-FP32 error to 0.01468 and fast-vs-reference error to 0.00507, with exact repeatability. An explicitly recorded exception permits this native BF16 benchmark without claiming FP32 equivalence; the original failure remains preserved. Kernel forward/backward checks still apply. These controls are not exhaustive equivalence tests.

This B300 experiment did not validate production serving or deploy a miner. A separate October 9 RTX 4090 comparison recorded 257 ms H2O-adapter versus 874 ms Jev-adapter median latency on the historical cohort, using an older runtime configuration and H2O temperature 0.8. That supports feasibility and the direction of the speed advantage, not an exact guarantee for the current stack. Accuracy on the recorded next action is not a measure of live support success or safety.

Macro F1 averages classes present in each cohort. Multiclass Brier sums the 30 squared probability errors per case; lower is better. In paired tables, positive accuracy gain and positive Brier improvement favor the first candidate. All estimates and intervals are descriptive; no post-test checkpoint or calibration choice is made.

## Sources and portable aggregate evidence

Model revisions: [alibiserikbay/JevK5](https://huggingface.co/alibiserikbay/JevK5/tree/c4f7fdb3aeab5582336406e78d3bef11bf98833d); [alibiserikbay/JevK5-9B](https://huggingface.co/alibiserikbay/JevK5-9B/tree/d6521a18a86999190e9d775c915af3d6d6772fc4); [Qwen/Qwen3.6-27B](https://huggingface.co/Qwen/Qwen3.6-27B/tree/6a9e13bd6fc8f0983b9b99948120bc37f49c13e9); [h2oai/h2o-lightning-4b](https://huggingface.co/h2oai/h2o-lightning-4b/tree/acaf0d4ea251e54de928c75ef4352670d33192d3).

Aggregate files: [results.json](results.json), [development-results.json](development-results.json), [h2o-results.json](h2o-results.json). Source artifact SHA-256 digests are preserved in results.json. The exports omit conversations, labels, per-case predictions, private paths, infrastructure addresses and resource IDs.
