import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeDecisionStory } from '@/components/home-decision-story';
import { SupportStudySummary } from '@/components/support-study';
import { Reveal } from '@/components/site/reveal';
import { SectionRow } from '@/components/site/section-row';
import { SiteButton } from '@/components/site/site-button';
import { SiteFrame } from '@/components/site/site-frame';
import { SortingHero } from '@/components/site/sorting-hero';
import s from './home.module.css';

const TITLE = 'Teach AI to make decisions your way.';
const DESCRIPTION = 'Show Zils examples with the right answers. It trains a small model your app can use to sort requests, flag problems, or score matches.';

export const metadata: Metadata = {
  title: `zils — ${TITLE}`,
  description: DESCRIPTION,
  alternates: { canonical: 'https://zils.ai' },
  openGraph: {
    title: `zils — ${TITLE}`,
    description: DESCRIPTION,
    url: 'https://zils.ai',
    siteName: 'Zils',
    type: 'website',
  },
  twitter: { card: 'summary', title: `zils — ${TITLE}`, description: DESCRIPTION },
};

const ICON = { fill: 'none', stroke: '#18191e', strokeWidth: 1.6 } as const;

const USE_CASES = [
  { title: 'Sort requests.', body: 'Teach it which team, topic, or queue a request belongs in. Your app uses the answer to send it to the right place.', question: '“Which team should handle this?”', grad: '#ef8d5a, #d9a08c', icon: <path d="M3 5h8M3 10h12M3 15h6M14 3l3 2-3 2" /> },
  { title: 'Flag problems.', body: 'Show it examples that need attention and examples that can wait. Your app can use the result to ask someone to review.', question: '“Does this need a closer look?”', grad: '#d9a08c, #cfa2e4', icon: <path d="M5 17V3M5 4h10l-2 3 2 3H5" /> },
  { title: 'Score matches.', body: 'Provide pairs with scores you have checked. Teach it how well a product, article, or result fits a request.', question: '“How well does this fit?”', grad: '#cfa2e4, #c3b4f6', icon: <><circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="3" /></> },
] as const;

const DELIVERABLES = [
  { title: 'A model for your task.', body: 'Trained on your examples, with the training run and model version saved in your workspace.' },
  { title: 'Results you can check.', body: 'See how it performs on examples kept out of training, including the mistakes. Review the results before relying on it.' },
  { title: 'A way to use it in your app.', body: 'Once your model passes evaluation, Zils hosts it. Your app sends a request through the API and gets an answer back.' },
] as const;

// Section 04 readout cards. Every value is a stand-in until the owner supplies real ones (spec section 8).
const HOME_READOUTS = {
  model: [
    ['name', 'support-router'], // placeholder: owner to supply
    ['version', 'v3'], // placeholder: owner to supply
    ['training run', 'run_0418'], // placeholder: owner to supply
    ['examples', '1,024'], // placeholder: owner to supply
  ],
  heldOut: [
    { label: 'Billing', pct: 92, show: '92%', color: 'var(--zs-lane-billing)' }, // placeholder: owner to supply
    { label: 'Account changes', pct: 88, show: '88%', color: 'var(--zs-lane-account)' }, // placeholder: owner to supply
    { label: 'Tech support', pct: 84, show: '84%', color: 'var(--zs-lane-tech)' }, // placeholder: owner to supply
    { label: 'Mistakes to review', pct: 14, show: '31', color: 'var(--zs-bad)' }, // placeholder: owner to supply
  ],
  request: {
    comment: '# ask your model (illustrative)', // placeholder: owner to supply
    model: 'support-router', // placeholder: owner to supply
    input: 'My invoice page keeps crashing.', // placeholder: owner to supply
    question: 'Which team?', // placeholder: owner to supply
    answer: '# → a decision for your app to use', // placeholder: owner to supply
  },
} as const;

// Column heights (%) and gradient offsets for the closing skyline; the 3rd and last columns are faint.
const SKY = [[40, 0, 1], [62, 11, 1], [30, 22, .35], [55, 33, 1], [80, 44, 1], [100, 55, 1], [70, 66, 1], [85, 77, 1], [48, 88, 1], [26, 100, .4]] as const;

export default function HomePage() {
  return (
    <SiteFrame>
      <SortingHero title={TITLE} description={DESCRIPTION} />

      <section className="border-b border-edge px-6 py-8 sm:px-10" aria-label="The z3 model line">
        <p className="text-sm text-muted">Meet z3, the Zils decision-model line. Start with the mini founding baseline and follow new releases from the miner competition.</p>
        <Link href="/z3" className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Explore z3 models</Link>
      </section>

      <SectionRow n="02" label="How it works" />
      <Reveal><HomeDecisionStory /></Reveal>

      <SectionRow n="03" label="Jobs" />
      <section id="cases" aria-labelledby="jobs-h">
        <Reveal>
          <div className={`${s.head} ${s.center}`}>
            <h2 id="jobs-h">Same idea, different jobs.</h2>
            <p>Choose a team. Flag a problem. Score a match. Pick one repeatable task where you can show what a good answer looks like. Start there, then test how well the model learns it.</p>
          </div>
        </Reveal>
        <div className={`${s.cells} ${s.c4}`}>
          {USE_CASES.map(({ title, body, question, grad, icon }, i) => (
            <Reveal key={title} delay={i * 0.11}>
              <article className={s.job}>
                <div className={s.tile} style={{ '--g': `linear-gradient(135deg, ${grad})` } as React.CSSProperties}>
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" {...ICON}>{icon}</svg>
                </div>
                <h3>{title}</h3>
                <p className={s.d}>{body}</p>
                <p className={s.q}><span>&gt; </span>{question}</p>
              </article>
            </Reveal>
          ))}
          <Reveal delay={USE_CASES.length * 0.11}>
            <article className={s.job} aria-labelledby="rank-options">
              <span className={s.badge}>New in SDK 0.3.0 · Experimental</span>
              <div className={s.tile} style={{ '--g': 'linear-gradient(135deg, #c3b4f6, #8ea6ff)' } as React.CSSProperties}>
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" {...ICON}><path d="M4 5h12M4 10h8M4 15h4" /></svg>
              </div>
              <h3 id="rank-options">Rank options.</h3>
              <p className={s.d}>Give Zils 2–10 options and a criterion, such as which support action best addresses a customer’s issue. The SDK returns an ordered list with relative scores.</p>
              <p className={s.fine}>Optional grouped ranking compares several options together: ten options use 10 judgments instead of 90. Pairwise ranking stays the default.</p>
              <p className={s.fine}>Fewer comparisons can produce a worse order. Test later choices as well as the first. Relative scores are not confidence percentages.</p>
              <div className={s.jobLinks}>
                <a href="https://docs.zils.ai/sdks/ranking" className={s.link}>Use ranking in your app</a>
                <a href="https://docs.zils.ai/changelog#sdk-0-3-0" className={s.link}>What’s new in 0.3.0</a>
              </div>
              <p className={s.q}><span>&gt; </span>“Which action best addresses this issue?”</p>
            </article>
          </Reveal>
        </div>
        <div className={s.ctaRow}>
          <SiteButton href="/early-access" variant="primary">Request early access</SiteButton>
          <SiteButton href="/examples" variant="secondary">See examples</SiteButton>
        </div>
      </section>

      <SectionRow n="04" label="What you get" />
      <section id="deliver" aria-labelledby="deliver-h">
        <Reveal>
          <div className={s.head}>
            <h2 id="deliver-h">What you get.</h2>
            <p>You bring the examples. Zils handles training, evaluation, and hosting for accepted models.</p>
          </div>
        </Reveal>
        <div className={`${s.cells} ${s.c3}`}>
          {DELIVERABLES.map(({ title, body }, i) => (
            <Reveal key={title} delay={i * 0.11}>
              <article className={s.deliver}>
                <h3>{title}</h3>
                <p className={s.d}>{body}</p>
                <div className={s.art}>
                  {i === 0 && (
                    <div className={s.card} data-readout data-placeholder="true">
                      <div className={s.hd}><span>Model</span><span>illustrative</span></div>
                      <div className={s.bd}>
                        {HOME_READOUTS.model.map(([k, v]) => <div key={k} className={s.kv}><span>{k}</span><span>{v}</span></div>)}
                      </div>
                    </div>
                  )}
                  {i === 1 && (
                    <div className={s.card} data-readout data-placeholder="true">
                      <div className={s.hd}><span>Held-out examples</span><span>illustrative</span></div>
                      <div className={`${s.bd} ${s.mini}`}>
                        {HOME_READOUTS.heldOut.map(r => (
                          <div key={r.label} className={s.mr}>
                            <span>{r.label}</span>
                            <span className={s.bar}><i style={{ width: `${r.pct}%`, '--c': r.color } as React.CSSProperties} /></span>
                            <span>{r.show}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {i === 2 && (
                    <div className={`${s.card} ${s.code}`} data-readout data-placeholder="true">
                      <div className={s.hd}><span>Request</span><span>illustrative</span></div>
                      <pre className={s.bd}>
                        <span className={s.cm}>{HOME_READOUTS.request.comment}</span>{'\n'}curl $ZILS_API_URL/v1/systemone \{'\n'}  -H <span className={s.str}>"Authorization: Bearer $ZILS_API_KEY"</span> \{'\n'}  -d <span className={s.str}>{`'{"model": "${HOME_READOUTS.request.model}",`}</span>{'\n'}     <span className={s.str}>{`"state": "${HOME_READOUTS.request.input}",`}</span>{'\n'}     <span className={s.str}>{`"questions": {"decision": "${HOME_READOUTS.request.question}"}}'`}</span>{'\n'}<span className={s.cm}>{HOME_READOUTS.request.answer}</span>
                      </pre>
                    </div>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className={s.notice}>
            <h3>Before you upload.</h3>
            <p>Training examples are copied to approved workers, whose operators can read and retain them. This is not confidential computing. Use only data you are authorized to share.</p>
            <Link href="/privacy" className={s.link}>Read how data is handled</Link>
          </div>
        </Reveal>
      </section>

      <SectionRow n="05" label="Research" />
      <SupportStudySummary />

      <SectionRow n="06" label="Start" />
      <section aria-labelledby="cta" className={s.final}>
        <Reveal>
          <h2 id="cta">Start with a decision<br />you know how to make.</h2>
          <p>Bring examples and their right answers. The training workspace helps you prepare your data and start a run.</p>
          <div className={s.ctaRow}>
            <SiteButton href="/early-access" variant="primary">Request early access</SiteButton>
            <SiteButton href="/examples" variant="secondary">See examples</SiteButton>
          </div>
        </Reveal>
        <Reveal>
          <div className={s.sky} aria-hidden="true">
            {SKY.map(([h, x, o], i) => <i key={i} style={{ '--h': `${h}%`, '--i': i, backgroundPosition: `${x}% 0`, opacity: o } as React.CSSProperties} />)}
          </div>
        </Reveal>
      </section>
    </SiteFrame>
  );
}
