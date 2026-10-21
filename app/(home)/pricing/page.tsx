import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import { DetailsRow } from '@/components/site/details-row';
import { SiteButton } from '@/components/site/site-button';
import { Reveal } from '@/components/site/reveal';
import { CreditEstimate } from '@/components/site/credit-estimate';
import { BETA_PRICING as PRICING } from '@/lib/pricing';
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
    <SiteFrame current="pricing">
      <SectionRow n="01" label="One plan" />
      <header className={s.hero}>
        <div>
          <p className={s.badge}>Beta launch pricing</p>
          <h1>Your model.<br />Pay as you go.</h1>
        </div>
        <p className={s.intro}>Train on your examples. Pay for the decisions you use. No subscriptions, tiers, or fees for model slots.</p>
      </header>

      <section className={s.plan} aria-labelledby="plan-heading">
        <div className={s.start}>
          <h2 id="plan-heading">One plan. Start with ${PRICING.startingCredit}.</h2>
          <Reveal>
            <p className={s.five}>${PRICING.startingCredit}</p>
          </Reveal>
          <p className={s.sub}>prepaid credit. Your first standard training run is included with your first top-up. The full ${PRICING.startingCredit} stays available for usage.</p>
          <div className={s.cta}><SiteButton href="/early-access" variant="primary">Request early access</SiteButton></div>
          <p className={s.soon}>Paid access is coming. Top-ups are not available yet.</p>
          <p className={s.soon}><Link href="/billing">View account billing</Link>{process.env.NEXT_PUBLIC_ZILS_BILLING_PREVIEW === 'test' && '. Test payments only.'}</p>
        </div>
        <div className={s.ratesCol}>
          <dl className={s.rates}>
            <div className={s.rate}>
              <dt>First custom model<span>One standard training run, with your first top-up</span></dt>
              <dd className={s.inc}>Included</dd>
            </div>
            <div className={s.rate}>
              <dt>More training<span>Per million training tokens, each additional run or retraining (${PRICING.trainingRun} minimum)</span></dt>
              <dd>${PRICING.millionTrainingTokens.toFixed(2)}</dd>
            </div>
            <div className={s.rate}>
              <dt>Model usage<span>Per million input tokens, including custom models</span></dt>
              <dd>${PRICING.millionInputTokens}</dd>
            </div>
            <div className={s.rate}>
              <dt>Output tokens<span>The model’s answers</span></dt>
              <dd className={s.free}>Free</dd>
            </div>
          </dl>
          <p className={s.fine}>All prices in USD. Shared context is counted once per request in the planned billing model.</p>
          <p id="training-heading" className={s.fine}><strong>What’s in a standard run?</strong> Train a model for your task, with automated evaluation included. We confirm what’s included before the run starts.</p>
          <p className={s.fine}>Larger datasets or custom training needs get an upfront estimate. Training pays for the work; it does not guarantee a model that passes your quality requirements.</p>
        </div>
      </section>

      <SectionRow n="02" label="Estimate" />
      <section aria-labelledby="estimate-heading"><CreditEstimate /></section>

      <SectionRow n="03" label="Details" />
      <section aria-labelledby="questions-heading">
        <div className={s.faqHead}>
          <h2 id="questions-heading">A few useful details.</h2>
          <p>Simple pricing, with the limits explained.</p>
        </div>
        <DetailsRow summary="What counts as an input token?"><p className={s.answer}>A token is a small piece of text. Input tokens are the context, questions, and answer choices you send for a decision. Under the planned billing model, shared context is counted once per request; repeated internal processing is not charged again.</p></DetailsRow>
        <DetailsRow summary="Can I train more than one model?"><p className={s.answer}>Yes. There are no model-count tiers or fees for model slots. Each additional training run costs ${PRICING.millionTrainingTokens.toFixed(2)} per million training tokens, with a ${PRICING.trainingRun} minimum, and you pay for inference when you use a model. Serving availability depends on capacity; this plan does not reserve dedicated hardware.</p></DetailsRow>
        <DetailsRow summary="Does my credit expire each month?"><p className={s.answer}>The launch plan has no monthly credit expiry and no recurring subscription. You’ll be able to set a spending cap. These billing controls will be available with paid access.</p></DetailsRow>
        <DetailsRow summary="What happens if training fails?"><p className={s.answer}>A run that fails because of our infrastructure receives a credit. A completed run is charged for its training and evaluation work, even if the resulting model does not meet the agreed quality requirements.</p></DetailsRow>
        <DetailsRow summary="Can I pay and start today?"><p className={s.answer}>These are planned beta launch prices. Checkout and usage billing are not open yet. <Link href="/early-access">Request early access</Link>, or, if you’ve already been invited, <Link href="/sign-in">sign in to your workspace</Link>.</p></DetailsRow>
      </section>

      <section className={s.closing} aria-labelledby="closing-heading">
        <h2 id="closing-heading">Bring a decision to improve.</h2>
        <p>Tell us what you want your model to learn.</p>
        <div className={s.cta}><SiteButton href="/early-access" variant="primary">Request early access</SiteButton></div>
      </section>
    </SiteFrame>
  );
}
