# Zils versus JEV: recorded ViZDoom comparison

13 October 2026 · Research demonstration · Same-map, structured-observation test

**Trained Zils succeeded on 97 of 100 test starts; JEV succeeded on 0.** This measures a task-trained adapter against a generic JEV model in this specific setup. It does not establish broad model superiority, visual perception, or general game-playing ability.

[Play the recorded comparison](zils-vs-jev-doom.mp4). The clip uses test seed **100001**, the lowest eligible seed where trained Zils collected the armor and JEV died. It is a **selected highlight**, not a randomly chosen representative game. There were 96 eligible highlights and 0 reverse success/death cases.

[JEV-only MP4](jev-seed-100001.mp4) · [Zils-only MP4](candidate-seed-100001.mp4)

## Complete results

Each contender was assigned the same 100 test seeds. Success means collecting the green armor and reaching the map's native exit. Technical failures are separate from gameplay deaths.

| Controller | Success | Death | Timeout | Technical failure | Success / 100, Wilson 95% interval |
| --- | ---: | ---: | ---: | ---: | --- |
| Trained Zils H2O | 97 | 1 | 2 | 0 | 97% (91.5%–99.0%) |
| Untrained H2O | 0 | 100 | 0 | 0 | 0% (0.0%–3.7%) |
| JEV 1.13.0 | 0 | 99 | 0 | 1 | 0% (0.0%–3.7%) |
| Scripted reference | 100 | 0 | 0 | 0 | 100% (96.3%–100.0%) |

[All 100 paired seeds](all-100-seeds.csv) · [Machine-readable results](results.json)

The paired success-rate difference between trained Zils and JEV is +97.0 percentage points. A 10,000-resample seed bootstrap gives a descriptive 95% interval of [+93.0, +100.0] percentage points. There are 97 trained-only successes and 0 JEV-only successes. The JSON also reports the 99 pairs without technical failures. Intervals describe variation across seeds in one scenario; they do not cover uncertainty across maps or training runs. A bootstrap interval at an all-identical outcome boundary can collapse and should be read alongside the Wilson intervals.

## What the models actually did

This uses ViZDoom 1.3.0's native Deadly Corridor scenario with bundled Freedoom graphics, difficulty 5 and a 2,100-tic limit. The map and success rule were not edited. All contenders use the same observation function: health, visible enemy/armor names and screen-space boxes, the previous observation and last action. They do not receive pixels, world coordinates, unseen objects, test seeds or future frames.

The shared action interface includes movement, shooting, waiting, coarse turns and half-degree fine aiming. Turns last one tic; other actions last four. This custom interface and the game-provided object labels make it **different from standard pixel-based ViZDoom benchmarks**. Each model chooses its own actions in a closed game loop; training-label agreement is not used as a success score.

Model thinking pauses simulation. Video plays at 35 game tics per second and omits inference waits. Audio was disabled during the test, so exports are silent. Native recordings preserve the scored action sequence. Replay checks verified 399 completed episodes, and the audit confirmed matched starting frames and observations for all 100 seeds. The selected footage is rendered from those native recordings, with outcome labels added; it is not a recreated victory.

## Training and comparison controls

Zils uses **h2o-lightning-4b-v1.2.3**, base revision `acaf0d4ea251e54de928c75ef4352670d33192d3`. Its adapter was trained with the unmodified pinned Zils trainer from `68870036e5b2dd71c56461336d61f625c5f9fea1`: one epoch, rank-16 LoRA, learning rate 0.00002, accumulation 4, seed 20261013. The only evaluated adapter is the final checkpoint from that fixed recipe, reloaded in a fresh process. The untrained H2O base provides a same-model control. JEV uses the live pinned `jev-1.13.0` API without task-specific training.

The training set contains 2,048 evenly sampled decisions from 32 reference-controller games, with 1,904 distinct state inputs. Full prompts span 453–589 tokens, with no truncation. The scripted teacher succeeded on 10 development games and is included in the final table. It is a transparent game-specific program, not another learned Zils model or human expert labeling.

Training, development and test **seed lists** are disjoint. The map and many visual situations are shared. This measures robustness to the scenario's stochastic behavior, not generalization to unseen levels. Test seeds are 100000–100099; no test episode was used to change prompts, examples, thresholds or checkpoint selection. Frozen protocol SHA-256: `4ba4a0ffb62eb21ba01988373ce71e5d01a6bed5dfaa9e7daabcd5e7e4b02bed`.

Training on the dedicated NVIDIA B300 took **11.98 minutes**, including the trainer's first-use work but excluding installation and model loading. No B300 speedup over another GPU is established by this interrupted migration.

The B300 training and H2O evaluation pipeline took 38.67 minutes. The full rental, including setup, replay checks and backup, lasted 50.90 minutes. Its model, results and recordings were saved locally and checksummed before the rental, dedicated firewall and tag were deleted. Estimated compute cost is **$5.23**, calculated from elapsed rental time and the verified $6.17/hour rate with [DigitalOcean's per-second spot billing](https://docs.digitalocean.com/products/droplets/details/pricing/). The invoice, taxes, API charges and any transfer overage were not verified.

## Failures and migration

The initial shared-4090 training attempt was stopped when the user raised customer-capacity concerns. It saved no completed adapter. Its capacity reservation was released and image service returned active. Training restarted from the same frozen data and seed on the separately rented B300.

JEV seed **100085** was interrupted by the operator during migration and remains a technical failure, not a death. Fourteen B300 launcher attempts failed before a game observation or model call because of an inaccessible working directory. Those empty starts were preserved separately, the launcher was corrected, and those previously unstarted games were run once. Earlier completed games were retained. The report uses all 100 assigned seeds as its primary denominator and separately exposes completed-pair results.

The scored JEV attempts report 1867 API requests and 0 retries, with 1,776,354 input and 181,099 output tokens in returned usage fields. Development requests are additional. Interrupted requests without a returned usage record may not be represented. Actual API billing was not verified. Up to three requests per decision were allowed on transport or validation failure; all returned bodies were retained. Rounded API probabilities were checked using the frozen rounding tolerance and were never renormalized to change a choice.

## Sources and scope

- [ViZDoom research paper](https://arxiv.org/abs/1605.02097).
- [Official Deadly Corridor scenario](https://vizdoom.farama.org/environments/default/#deadly-corridor).
- [ViZDoom 1.3.0 scenario configuration](https://github.com/Farama-Foundation/ViZDoom/blob/1.3.0/scenarios/deadly_corridor.cfg).
- [JEV model documentation](https://docs.typesafe.ai/models).

This is a recorded research result. It is not a production deployment, a visual-agent leaderboard score, a latency comparison, or a benchmark across games.
