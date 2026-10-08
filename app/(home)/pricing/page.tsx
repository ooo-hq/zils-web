import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { PricingEstimate } from './pricing-estimate';
import { BETA_PRICING as PRICING } from '@/lib/pricing';
import home from '../home.module.css';
import s from './pricing.module.css';

const DESCRIPTION = 'Zils beta launch pricing: $5 prepaid credit, your first standard training run included, and pay-as-you-go inference. No subscriptions or model-slot fees.';

export const metadata: Metadata = {
  title: 'Zils pricing — pay as you go',
  description: DESCRIPTION,
  alternates: { canonical: 'https://zils.ai/pricing' },
  openGraph: {
    title: 'Zils pricing — pay as you go',
    description: DESCRIPTION,
    url: 'https://zils.ai/pricing',
    siteName: 'Zils',
    type: 'website',
  },
  twitter: { card: 'summary', title: 'Zils pricing — pay as you go', description: DESCRIPTION },
};

export default function PricingPage() {
  return (
    <div className={`${home.home} ${s.page}`}>
      <div className={s.container}>
        <SiteHeader tone="light" current="pricing" />
        <main id="main-content" tabIndex={-1}>
          <header className={s.hero}>
            <p className={s.status}>Beta launch pricing</p>
            <h1>Your model.<br />Pay as you go.</h1>
            <p className={s.intro}>Train on your examples. Pay for the decisions you use.<br className={s.desktopBreak} /> No subscriptions, tiers, or fees for model slots.</p>
          </header>

          <section className={s.plan} aria-labelledby="plan-heading">
            <div className={s.start}>
              <h2 id="plan-heading">One plan. Start with ${PRICING.startingCredit}.</h2>
              <p className={s.startAmount}>${PRICING.startingCredit}<span>prepaid credit</span></p>
              <p>Your first standard training run is included with your first top-up. The full ${PRICING.startingCredit} stays available for usage.</p>
              <Link href="/contact" className={s.button}>Ask about early access</Link>
              <p className={s.availability}>Paid access is coming. Top-ups are not available yet.</p>
              {process.env.NEXT_PUBLIC_ZILS_BILLING_PREVIEW === 'test' && <p className={s.availability}><Link href="/billing" className={s.previewLink}>Open the test billing preview</Link>. Test payments only.</p>}
            </div>
            <div className={s.rates}>
              <dl>
                <div className={s.rate}>
                  <dt>First custom model<span>One standard training run, with your first top-up</span></dt>
                  <dd>Included</dd>
                </div>
                <div className={s.rate}>
                  <dt>More training<span>Each additional standard run or retraining</span></dt>
                  <dd>${PRICING.trainingRun}<span> / run</span></dd>
                </div>
                <div className={s.rate}>
                  <dt>Model usage<span>Per million input tokens, including custom models</span></dt>
                  <dd>${PRICING.millionInputTokens}</dd>
                </div>
                <div className={s.rate}>
                  <dt>Output tokens<span>The model’s answers</span></dt>
                  <dd>Free</dd>
                </div>
              </dl>
              <p className={s.rateNote}>All prices in USD. Shared context is counted once per request in the planned billing model.</p>
            </div>
          </section>

          <section className={s.training} aria-labelledby="training-heading">
            <h2 id="training-heading">What’s in a standard run?</h2>
            <div>
              <p>Train a model for your task, with automated evaluation included. We confirm what’s included before the run starts.</p>
              <p>Larger datasets or custom training needs get an upfront estimate. Training pays for the work; it does not guarantee a model that passes your quality requirements.</p>
            </div>
          </section>

          <PricingEstimate {...PRICING} />

          <section className={s.questions} aria-labelledby="questions-heading">
            <div className={s.sectionIntro}>
              <h2 id="questions-heading">A few useful details.</h2>
              <p>Simple pricing, with the limits explained.</p>
            </div>
            <div className={s.answers}>
              <details>
                <summary>What counts as an input token?</summary>
                <p>A token is a small piece of text. Input tokens are the context, questions, and answer choices you send for a decision. Under the planned billing model, shared context is counted once per request; repeated internal processing is not charged again.</p>
              </details>
              <details>
                <summary>Can I train more than one model?</summary>
                <p>Yes. There are no model-count tiers or fees for model slots. Each additional standard training run costs ${PRICING.trainingRun}, and you pay for inference when you use a model. Serving availability depends on capacity; this plan does not reserve dedicated hardware.</p>
              </details>
              <details>
                <summary>Does my credit expire each month?</summary>
                <p>The launch plan has no monthly credit expiry and no recurring subscription. You’ll be able to set a spending cap. These billing controls will be available with paid access.</p>
              </details>
              <details>
                <summary>What happens if training fails?</summary>
                <p>A run that fails because of our infrastructure receives a credit. A completed run is charged for its training and evaluation work, even if the resulting model does not meet the agreed quality requirements.</p>
              </details>
              <details>
                <summary>Can I pay and start today?</summary>
                <p>These are planned beta launch prices. Checkout and usage billing are not open yet. <Link href="/contact">Contact us about early access</Link>, or <Link href="/train">open the experimental training workspace</Link>.</p>
              </details>
            </div>
          </section>

          <section className={s.closing} aria-labelledby="closing-heading">
            <div><h2 id="closing-heading">Bring a decision to improve.</h2><p>Tell us what you want your model to learn.</p></div>
            <Link href="/contact" className={s.button}>Ask about early access</Link>
          </section>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
