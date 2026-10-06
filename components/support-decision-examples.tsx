import examples from '@/public/model/abcd-002-examples.json';

const action = (key: string) => examples.action_labels[key as keyof typeof examples.action_labels] ?? key;
const corrected = examples.examples.filter(example => example.trained.choice === example.expected_action);
const regression = examples.examples.find(example => example.trained.choice !== example.expected_action)!;

export function SupportDecisionExamples() {
  return (
    <section id="support-examples" aria-labelledby="support-examples-heading" className="scroll-mt-20 border-t border-edge py-16 sm:py-20">
      <p className="text-xs text-muted">ABCD support workflows · Recorded test examples</p>
      <h2 id="support-examples-heading" className="mt-4 max-w-[23ch] text-[clamp(2.1rem,4.4vw,3.3rem)] font-semibold leading-[1.04] tracking-[-0.055em]">The same conversation. A better next action.</h2>
      <p className="mt-5 max-w-[68ch] text-[15px] leading-7 text-muted">Three mistakes the adapter corrected in the 500-conversation test. These are paraphrased excerpts; both models saw the same full conversation, workflow catalog, and all 30 possible actions.</p>

      <div className="mt-10 divide-y divide-edge border-y border-edge">
        {corrected.map(example => (
          <article key={example.id} className="grid gap-6 py-8 md:grid-cols-[1.3fr_1fr] md:gap-10">
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.025em]">{example.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{example.context_summary}</p>
            </div>
            <dl className="grid gap-5 self-center sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Unchanged JevK5</dt>
                <dd className="mt-2 text-sm font-medium">{action(example.unchanged.choice)}</dd>
                <dd className="mt-1 text-xs text-subtle">Did not match the recorded action</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Trained JevK5</dt>
                <dd className="mt-2 text-sm font-semibold text-accent">{action(example.trained.choice)}</dd>
                <dd className="mt-1 text-xs text-muted">Matched the recorded action</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <details className="mt-6 rounded-md bg-surface px-5 py-4 sm:px-6">
        <summary className="cursor-pointer text-sm font-medium marker:text-accent hover:text-accent">A mistake training introduced</summary>
        <p className="mt-4 max-w-[68ch] text-sm leading-7 text-muted">{regression.context_summary}</p>
        <p className="mt-3 text-sm leading-7 text-muted">Unchanged JevK5 chose <strong className="font-medium text-ink">{action(regression.unchanged.choice).toLowerCase()}</strong>, matching the recorded action. The trained adapter chose <strong className="font-medium text-ink">{action(regression.trained.choice).toLowerCase()}</strong>. This was one of the 21 new mistakes it introduced, alongside 128 corrected mistakes.</p>
      </details>
      <p className="mt-5 text-xs leading-6 text-muted">Examples selected to explain the decisions. The 79.2% result above includes all 500 test cases. This measures action selection, not tool execution or a complete customer conversation.</p>
      <a href="/model/abcd-002-examples.json" className="mt-4 inline-block text-sm underline decoration-edge-strong underline-offset-4 hover:text-accent hover:decoration-accent">Recorded example predictions (JSON)</a>
    </section>
  );
}
