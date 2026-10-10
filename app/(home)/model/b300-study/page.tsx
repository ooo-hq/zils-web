import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import miner from '@/public/model/b300-2026-10-10/miner-results.json';
import original from '@/public/model/b300-2026-10-10/results.json';
import s from '@/components/research-guide.module.css';

export const metadata: Metadata = {
  title: 'zils — B300 study: practical models for miners',
  description: 'ABCD support-action experiments with H2O 4B, JevK5 2B, 4B and 9B. Accuracy, B300 latency, GPU memory, adapter training, uncertainty, and aggregate evidence.',
  alternates: { canonical: 'https://zils.ai/model/b300-study' },
};

const LINK = 'underline decoration-edge-strong underline-offset-4 hover:text-accent';
const CELL = 'border-t border-edge px-4 py-3 text-right tabular-nums';
const HEAD = 'border-t border-edge px-4 py-3 text-left font-normal';
const EVIDENCE = '/model/b300-2026-10-10';
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const ms = (value: number) => `${(value * 1000).toFixed(1)} ms`;
const gib = (value: number) => `${(value / 1024 ** 3).toFixed(2)} GiB`;
const test = miner.cohorts.test.metrics;
const historical = miner.cohorts.historical.metrics;
const h2o = test['h2o-lora-4096-epoch1'];
const jev4b = test['4b-lora-4096-epoch2'];
const jev2b = test['2b-lora-4096-epoch2'];
const candidates = [
  ['h2o-lora-4096-epoch1', 'H2O 4B + adapter', '4,096 examples · epoch 1'],
  ['4b-lora-4096-epoch2', 'JevK5 4B + adapter', '4,096 examples · epoch 2'],
  ['2b-lora-4096-epoch2', 'JevK5 2B + adapter', '4,096 examples · epoch 2'],
  ['h2o-adapter-1024', 'Earlier H2O 4B adapter', 'Reused 1,024-example adapter'],
  ['h2o-base', 'H2O 4B stock', 'No ABCD adapter'],
  ['4b-base', 'JevK5 4B stock', 'No ABCD adapter'],
  ['2b-base', 'JevK5 2B stock', 'No ABCD adapter'],
] as const;
const originalCandidates = [
  ['4b-base', 'JevK5 4B stock'],
  ['4b-full-1024-epoch1', '4B full weights · 1,024 × 1 epoch'],
  ['4b-lora-1024-epoch1', '4B adapter · 1,024 × 1 epoch'],
  ['4b-lora-4096-epoch2', '4B adapter · 4,096 × 2 epochs'],
  ['9b-base', 'JevK5 9B stock'],
  ['9b-lora-1024-epoch1', '9B adapter · 1,024 × 1 epoch'],
  ['9b-lora-4096-epoch1', '9B adapter · 4,096 × 1 epoch'],
] as const;

export default function B300StudyPage() {
  return (
    <div className={`${s.page} min-h-screen bg-page font-sans text-ink antialiased`}>
      <div className="mx-auto max-w-6xl px-6 sm:px-8"><SiteHeader tone="light" current="model" /></div>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-6 sm:px-8">
        <header className="pb-12 pt-8">
          <Link href="/model#findings" className={`text-sm ${LINK}`}>Back to model research</Link>
          <p className="mt-8 text-xs text-muted">Completed experiment · <time dateTime="2026-10-10">10 October 2026</time> · NVIDIA B300</p>
          <h1 className="mt-4 max-w-[20ch] text-balance text-[clamp(2.5rem,6vw,4rem)] font-semibold leading-[1.04] tracking-[-0.055em]">Practical models for miners.</h1>
          <p className="mt-6 max-w-[68ch] text-lg leading-8 text-muted">How much model does a support decision need? We tested task-specific adapters across 2B, 4B and 9B models. H2O 4B offered lower latency; JevK5 2B offered lower memory use. Neither established an accuracy advantage over our strongest JevK5 4B adapter.</p>
          <p className="mt-4 max-w-[75ch] text-sm leading-7 text-muted">B300 was temporary research hardware. These results guide miner experiments; they do not change the shared model or establish production performance. JevK5 here means locally run open weights, separate from the hosted TypeSafe Jev comparison.</p>
          <nav aria-label="B300 study sections" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="#miner-results" className={LINK}>Model comparison</a><a href="#larger-models" className={LINK}>9B and full training</a><a href="#method" className={LINK}>Method &amp; limits</a><a href="#evidence" className={LINK}>Download evidence</a>
          </nav>
        </header>

        <section aria-label="B300 findings" className="grid gap-6 rounded-md bg-surface p-6 sm:grid-cols-3 sm:p-8">
          <div><p className="text-xs text-muted">H2O vs JevK5 4B adapter</p><p className="mt-3 text-3xl font-semibold tracking-tight">{(jev4b.latency_median_seconds / h2o.latency_median_seconds).toFixed(2)}×</p><p className="mt-2 text-sm leading-6 text-muted">Lower median latency: {ms(h2o.latency_median_seconds)} vs {ms(jev4b.latency_median_seconds)}, on B300.</p></div>
          <div><p className="text-xs text-muted">JevK5 2B vs 4B adapter</p><p className="mt-3 text-3xl font-semibold tracking-tight">{((1 - jev2b.inference_memory.peak_cuda_bytes / jev4b.inference_memory.peak_cuda_bytes) * 100).toFixed(0)}% less</p><p className="mt-2 text-sm leading-6 text-muted">Peak CUDA allocation: {gib(jev2b.inference_memory.peak_cuda_bytes)} vs {gib(jev4b.inference_memory.peak_cuda_bytes)}. This is not total card capacity.</p></div>
          <div><p className="text-xs text-muted">Selected 9B vs 4B adapter</p><p className="mt-3 text-3xl font-semibold tracking-tight">No clear gain</p><p className="mt-2 text-sm leading-6 text-muted">80.8% vs 82.4% accuracy on the original test cohort. The paired interval includes zero.</p></div>
        </section>

        <section id="miner-results" aria-labelledby="miner-heading" className="scroll-mt-8 py-14">
          <p className="text-xs text-muted">Miner-sized follow-ups</p>
          <h2 id="miner-heading" className="mt-3 text-3xl font-semibold tracking-tight">Speed, memory, and accuracy.</h2>
          <p className="mb-6 mt-4 max-w-[78ch] text-sm leading-7 text-muted">Each cohort contains 500 ABCD conversations, one decision per conversation, with all 30 actions and full input context. Both cohorts were reused for the H2O and 2B follow-ups: earlier results were already known. Their checkpoints were selected using development data only.</p>
          <div role="region" aria-label="Miner model scores" tabIndex={0} className="overflow-x-auto rounded-md border border-edge">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <caption className="sr-only">Miner follow-ups: two reused 500-conversation cohorts; timing and memory measured on the test cohort on B300</caption>
              <thead className="bg-surface text-xs text-muted"><tr><th scope="col" className={HEAD}>Model / training</th><th scope="col" className={CELL}>Test accuracy</th><th scope="col" className={CELL}>Historical accuracy</th><th scope="col" className={CELL}>Test Brier ↓</th><th scope="col" className={CELL}>Test median</th><th scope="col" className={CELL}>CUDA peak</th></tr></thead>
              <tbody>{candidates.map(([id, name, note]) => <tr key={id}>
                <th scope="row" className={HEAD}>{name}<span className="mt-1 block text-xs text-muted">{note}</span></th>
                <td className={CELL}>{percent(test[id].accuracy)}<span className="block text-xs text-muted">{test[id].correct} / 500</span></td>
                <td className={CELL}>{percent(historical[id].accuracy)}<span className="block text-xs text-muted">{historical[id].correct} / 500</span></td>
                <td className={CELL}>{test[id].multiclass_brier.toFixed(4)}</td><td className={`${CELL} whitespace-nowrap`}>{ms(test[id].latency_median_seconds)}</td><td className={`${CELL} whitespace-nowrap`}>{gib(test[id].inference_memory.peak_cuda_bytes)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-6 text-muted">Brier measures probability error; lower is better. CUDA peaks come from isolated final inference processes. H2O resets its peak after loading and warmup; Jev includes loading allocations. These are different measurement scopes and exclude some driver/process overhead.</p>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <div><h3 className="font-semibold">H2O: a speed candidate</h3><p className="mt-3 text-sm leading-7 text-muted">Against the selected 4B adapter, H2O gained 0.6 percentage points on the test cohort (paired 95% interval −1.2 to +2.4), and lost 1.2 on the historical cohort (−3.6 to +1.4). The speed result is useful; the accuracy differences remain inconclusive.</p></div>
            <div><h3 className="font-semibold">2B: a memory candidate</h3><p className="mt-3 text-sm leading-7 text-muted">The 2B adapter trailed 4B by 1.6 points on the test cohort (−4.4 to +1.2), and 0.4 on the historical cohort (−3.2 to +2.2). Lower allocation makes it worth testing on smaller GPUs. This does not prove equivalent accuracy or that a 4 GB card is sufficient.</p></div>
          </div>
        </section>

        <section id="larger-models" aria-labelledby="larger-heading" className="scroll-mt-8 border-t border-edge py-14">
          <p className="text-xs text-muted">Original 4B / 9B matrix</p>
          <h2 id="larger-heading" className="mt-3 text-3xl font-semibold tracking-tight">More parameters did not settle it.</h2>
          <p className="mb-6 mt-4 max-w-[78ch] text-sm leading-7 text-muted">The 500-case test cohort was fresh in identifiable local records when this original matrix ran. It became retrospective when we chose the later H2O and 2B trials. The historical cohort was already reused. The selected 9B and 4B adapters were chosen on development accuracy, with Brier as a tie-breaker.</p>
          <div role="region" aria-label="Original 4B and 9B scores" tabIndex={0} className="overflow-x-auto rounded-md border border-edge">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">Original model and training comparison on test and historical cohorts</caption>
              <thead className="bg-surface text-xs text-muted"><tr><th scope="col" className={HEAD}>Model / training</th><th scope="col" className={CELL}>Test accuracy</th><th scope="col" className={CELL}>Historical accuracy</th></tr></thead>
              <tbody>{originalCandidates.map(([id, name]) => <tr key={id}><th scope="row" className={HEAD}>{name}</th><td className={CELL}>{percent(original.cohorts.test.metrics[id].accuracy)}</td><td className={CELL}>{percent(original.cohorts.historical.metrics[id].accuracy)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-6 max-w-[78ch] text-sm leading-7 text-muted">Selected 9B minus selected 4B was −1.6 points (95% interval −4.2 to +0.8). Full-weight 4B training trailed the matched 1,024-example LoRA adapter by 9.2 points (−13.6 to −5.0). These fixed recipes favor spending further experiments on adapters and smaller models; they do not establish that 9B or full-weight training cannot work.</p>
          <p className="mt-4 max-w-[78ch] text-sm leading-7 text-muted">The 27B teacher trial was canceled before any complete development predictions. Its gate was not evaluated, and there is no 27B accuracy or distillation result.</p>
        </section>

        <section id="method" aria-labelledby="method-heading" className="scroll-mt-8 border-t border-edge py-14">
          <h2 id="method-heading" className="text-3xl font-semibold tracking-tight">What this experiment can tell us.</h2>
          <div className="mt-6 space-y-5 text-sm leading-7 text-muted">
            <p>ABCD asks for the next recorded support tool action. Accuracy measures agreement with that action, not successful resolution of an entire customer issue. Public pretraining overlap is unknown.</p>
            <p>H2O 4B and JevK5 2B used the same ordered 4,096 examples and native 15/16-option training views as the 4B comparator. Each new model had two epoch candidates. Development accuracy, then lower Brier, then fewer exposures selected H2O epoch 1 and 2B epoch 2. Final evaluation retained all 30 choices. The original 4B/9B search also included 1,024-example runs; the full-weight checkpoint used one fixed epoch and a different learning rate.</p>
            <p>One training seed (553), fixed recipes, and different native prompts, calibration, and decision protocols limit generalization. Jev uses a knockout protocol; H2O reads all 30 choices in one pass. JevK5 2B is v0.2; the 4B comparator is v0.3. These are complete-system comparisons, not an isolated test of parameter count.</p>
            <p>Paired 95% intervals resample the same 500 conversations 2,000 times, seed 553. They quantify cohort sampling uncertainty, not variation between training seeds, and are not adjusted for multiple comparisons. An interval spanning zero proves neither superiority nor equivalence.</p>
          </div>
          <details className="mt-7 rounded-md border border-edge bg-surface px-5 py-4 text-sm">
            <summary className="cursor-pointer font-medium">Numerical checks, recovery, and calibration limits</summary>
            <div className="mt-5 space-y-4 leading-7 text-muted">
              <p>The 9B/4,096 numerical check exceeded the 0.03 probability-error bound on its longest training input: fast BF16 vs FP32 error was 0.04114, and reference BF16 vs FP32 was 0.05380. BF16 cutoff ties changed knockout finalists, although final actions agreed. Replaying identical 16-option prompts reduced fast-vs-FP32 error to 0.01468. The run proceeded under a recorded exception; FP32 equivalence was not established.</p>
              <p>H2O serialized both checkpoints before its training process failed a CUDA-memory release assertion. The unchanged weights were evaluated in fresh processes after correcting a PEFT layer-name validation mismatch. Training peak memory and uninterrupted total runtime are unavailable.</p>
              <p>New H2O training used native temperature 0.75; the reused 1,024-example adapter was trained at 0.8. Their comparison changes training calibration as well as data exposure. Full controls and original failures are described in the reports.</p>
            </div>
          </details>
        </section>

        <section id="hardware-context" aria-labelledby="hardware-heading" className="scroll-mt-8 border-t border-edge py-14">
          <h2 id="hardware-heading" className="text-3xl font-semibold tracking-tight">B300 is the test bench.</h2>
          <div className="mt-6 max-w-[78ch] space-y-5 text-sm leading-7 text-muted">
            <p>All new timing and memory results are B300 measurements. Latency includes prompt preparation, tokenization, and synchronized single-case inference. It excludes loading, warmup, network transport, and queues. There was no new RTX 4090, quantization, concurrent-serving, or production validation of these checkpoints.</p>
            <p>An earlier October 9 RTX 4090 ABCD test measured the older H2O adapter at 257 ms median versus 874 ms for Jev, using an older runtime and H2O temperature 0.8. That supports feasibility on the 4090 and the direction of the speed advantage, not exact performance for these new checkpoints.</p>
            <p>Other earlier tasks were mixed: H2O tied Jev on Bitcast accuracy and trailed slightly on reply reserve and chess. A support-action benchmark does not identify one default model for every miner job.</p>
            <p>The temporary GPU was deleted after verified local retrieval. Cumulative estimated compute cost was $37.95; this is a runtime estimate, not a provider invoice or a price for training a customer model.</p>
          </div>
        </section>

        <section id="evidence" aria-labelledby="evidence-heading" className="scroll-mt-8 border-t border-edge py-14">
          <h2 id="evidence-heading" className="text-3xl font-semibold tracking-tight">Inspect the evidence.</h2>
          <p className="mt-4 max-w-[78ch] text-sm leading-7 text-muted">Reports include full scores, paired intervals, development selection, pinned model revisions, and limitations. JSON files preserve aggregate results and source digests. Raw conversations, labels, per-case predictions, and trained weights are not distributed, so these downloads do not reproduce inference.</p>
          <nav aria-label="B300 study evidence" className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ['miner-report.md', 'H2O and 2B report'], ['miner-results.json', 'H2O and 2B results (JSON)'],
              ['report.md', 'Original 4B / 9B report'], ['results.json', 'Original 4B / 9B results (JSON)'],
              ['development-results.json', 'Development results (JSON)'], ['h2o-comparison.md', 'Earlier H2O comparison report'],
              ['h2o-results.json', 'Earlier H2O results (JSON)'], ['manifest.json', 'Publication manifest and hashes'],
            ].map(([file, label]) => <a key={file} href={`${EVIDENCE}/${file}`} className={`inline-flex min-h-11 items-center ${LINK}`}>{label}</a>)}
          </nav>
        </section>
      </main>
      <SiteFooter tone="light" />
    </div>
  );
}
