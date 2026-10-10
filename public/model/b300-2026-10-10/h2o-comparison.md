# H2O Lightning 4B vs JevK5 4B

H2O wins this matched-data comparison and has about three times lower median native inference latency on B300. The Jev adapter trained on more data has the highest accuracy among these five configurations.

| Configuration | Training examples × passes | Fresh 500 accuracy | Historical 500 accuracy | Fresh median / p95 |
|---|---:|---:|---:|---:|
| H2O stock | None | 54.0% | 56.2% | 43.8 / 45.4 ms |
| JevK5 4B stock | None | 52.6% | 57.2% | 129.7 / 133.7 ms |
| H2O + adapter | 1,024 × 1 pass | 79.8% | 80.0% | 59.4 / 61.6 ms |
| JevK5 4B + matched adapter | 1,024 × 1 pass | 75.0% | 79.6% | 176.9 / 187.3 ms |
| JevK5 4B + selected adapter | 4,096 × 2 passes | 82.4% | 84.8% | 178.4 / 189.0 ms |

With the same ordered 1,024 training examples and one pass, H2O improves fresh-test accuracy by **4.8 percentage points** (paired 95% bootstrap interval **+2.4 to +7.4**). It corrects 35 Jev errors and introduces 11 new errors. Its multiclass Brier score is 0.350, versus 0.402 for matched Jev; lower is better.

The selected 4,096-example Jev adapter leads H2O by 2.6 points on the fresh cohort (paired 95% interval +0.2 to +5.2). That comparison uses more Jev training data, more exposures and a larger checkpoint-selection allowance. H2O was not retrained on 4,096 examples.

The original 500-case historical cohort is reported separately. Its matched-adapter difference is only 0.4 points, with an interval spanning zero; the fresh-cohort result should not be read as a universal advantage.

The H2O adapter is a verified existing checkpoint. Its ordered examples, option views, rank, learning rate, update count and effective batch match the 1,024-example Jev comparator. The original optimizer dispatch, kernels, native prompts and head precision differ. H2O uses one native 30-option readout at temperature 0.75; Jev uses its native knockout protocol. These compare complete decision systems.

Each cohort contains 500 conversations. Fresh means not previously evaluated in identifiable local execution artifacts; pretrained-model exposure is unknown. Development selection was frozen before fresh-test scoring. Intervals use 2,000 paired resamples with seed 553 and are not adjusted for multiple comparisons.

Latency includes prompt preparation, tokenization and synchronized single-case inference. It excludes loading, transport and queueing. This experiment ran on B300 and did not test miner concurrency or vLLM. One training seed was used.

[H2O Lightning v1.2.3](https://huggingface.co/h2oai/h2o-lightning-4b/tree/acaf0d4ea251e54de928c75ef4352670d33192d3) · [JevK5 4B](https://huggingface.co/alibiserikbay/JevK5/tree/c4f7fdb3aeab5582336406e78d3bef11bf98833d)

A separate October 9 RTX 4090 benchmark measured H2O + adapter at 257 ms median versus Jev + adapter at 874 ms (3.40× lower median latency). Accuracy was 80.0% versus 79.2% on the reused historical cohort, with an accuracy interval spanning zero. That earlier run used an older runtime configuration and H2O temperature 0.8; it supports hardware feasibility and the direction of the speed advantage, not an exact latency guarantee for the current runtime.
