import type { Metadata } from 'next';
import { PolicyPage, PolicySection } from '@/components/policy-page';

export const metadata: Metadata = {
  title: 'zils — free tier terms (draft)',
  description: 'Draft terms for the Zils free tier.',
  robots: { index: false, follow: false },
};

export default function FreeTierTermsPage() {
  return (
    <PolicyPage title="Free tier terms." updated="28 October 2026">
      <p><strong>DRAFT.</strong> These terms are a draft for owner and legal review. They are not final. Version: draft-2026-10-28.</p>

      <PolicySection title="What the free tier is">
        <p>Requests and answers on the free tier may be served by independent network miners.</p>
      </PolicySection>

      <PolicySection title="What we keep">
        <p>We store free tier requests and answers for up to 180 days to train models. Your account is replaced by a one-way hash in the stored copy.</p>
      </PolicySection>

      <PolicySection title="Limits">
        <p>60 requests per minute and 200,000 input tokens per day. Base models only.</p>
      </PolicySection>

      <PolicySection title="Switching to Paid">
        <p>You can switch to Paid any time. Switching does not delete past free records; they expire after 180 days.</p>
      </PolicySection>
    </PolicyPage>
  );
}
