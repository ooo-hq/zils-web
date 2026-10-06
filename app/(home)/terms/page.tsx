import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyPage, PolicySection } from '@/components/policy-page';

export const metadata: Metadata = {
  title: 'zils — terms',
  description: 'Terms for the Zils website, decision-model services, training submissions, and API access.',
  alternates: { canonical: 'https://zils.ai/terms' },
};

const link = 'underline decoration-edge-strong underline-offset-4 hover:text-accent';

export default function TermsPage() {
  return (
    <PolicyPage title="Terms of use.">
      <p>These terms apply to zils.ai and the Zils decision-model services. By using these services, you agree to these terms.</p>

      <PolicySection title="An experimental service">
        <p>Zils provides decision-model research, model access, and an early training workflow. Features and availability may change. A training run can fail or finish without a model that meets its acceptance criteria. Published experiment results describe the stated test conditions and do not guarantee results on your data.</p>
      </PolicySection>

      <PolicySection title="Your account and access">
        <p>Keep sign-in access and API keys secure. Use only accounts and credentials you are authorized to use, and revoke keys that are exposed or no longer needed. You are responsible for the requests and submissions you authorize through your account.</p>
      </PolicySection>

      <PolicySection title="Your training submissions">
        <p>Submit only information you have the right to use and share for training and evaluation. You authorize Zils to process your submitted data, job settings, and resulting artifacts to carry out the requested run and provide its results.</p>
        <p>Training submission separately requires your permission to export learning data to assigned, approved workers. Their operators can read and retain it. This is not confidential compute. Canceling a run cannot erase copies already downloaded or immediately terminate remote processing. The <Link href="/privacy" className={link}>privacy policy</Link> explains the current data-handling workflow.</p>
      </PolicySection>

      <PolicySection title="Using model outputs">
        <p>Predictions and confidence scores can be wrong. Evaluate a model for your intended use and review its outputs before relying on them. Acceptance of a trained model means it met the recorded evaluation criteria; it does not establish that it is suitable for every deployment.</p>
        <p>Open-source code, base models, and downloaded artifacts remain subject to their applicable licenses. These terms do not replace those licenses or grant rights that their owners have not provided.</p>
      </PolicySection>

      <PolicySection title="Acceptable use">
        <p>Do not use Zils unlawfully, infringe others’ rights, submit data without the necessary permission, attempt to access other customers’ information, or disrupt the service. Do not bypass authentication, access restrictions, or service limits. Access may be restricted to address abuse or security issues.</p>
      </PolicySection>

      <PolicySection title="Availability and responsibility">
        <p>The service is provided as is and as available, without warranties to the extent permitted by law. Zils does not guarantee uninterrupted access, error-free predictions, or a successful training outcome.</p>
        <p>To the extent permitted by law, Zils’s authors and contributors are not liable for damages arising from use of the service, including lost data, exposed credentials, or reliance on model outputs. Nothing in these terms excludes rights or liability that cannot lawfully be excluded.</p>
      </PolicySection>

      <PolicySection title="Changes and contact">
        <p>Updates to these terms will appear on this page with an updated date. If a provision cannot be enforced, the remaining provisions continue to apply. For questions about the service or these terms, use the <Link href="/contact" className={link}>Zils contact form</Link>.</p>
      </PolicySection>
    </PolicyPage>
  );
}
