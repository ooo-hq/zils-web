import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyPage, PolicySection } from '@/components/policy-page';

export const metadata: Metadata = {
  title: 'zils — privacy',
  description: 'How Zils handles account information, training data, model requests, and contact messages.',
  alternates: { canonical: 'https://zils.ai/privacy' },
};

const link = 'underline decoration-edge-strong underline-offset-4 hover:text-accent';

export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy policy." updated="9 October 2026">
      <p>This notice describes information handled by the Zils website and its decision-model services, including sign-in, training, model requests, and support.</p>

      <PolicySection title="Accounts and browser storage">
        <p>Zils uses Supabase for sign-in. Your email address, account identifier, and authentication records are used to manage access to your workspace. Training jobs and API-key records are associated with your account.</p>
        <p>Your browser stores your sign-in session and light or dark theme preference. Choosing Save setup in the playground also stores your question setup on that browser, without its example text or conversation. Signing out removes the sign-in session; clearing browser storage also removes saved setups and preferences. Neither action deletes your account or uploaded data.</p>
      </PolicySection>

      <PolicySection title="Files you prepare and submit">
        <p>Spreadsheet review and preparation happen in your browser. Selecting a file for review does not upload it. When you submit a training run, the prepared datasets are uploaded to private storage, and the service records the job settings, progress, evaluation results, and model artifacts.</p>
        <p>The training service uses Supabase for account and job records. DigitalOcean Spaces stores newly uploaded datasets, photos, and model artifacts in private storage. Existing files may remain in Supabase Storage during migration. Authorized service operators process the data to validate your submission, coordinate training, evaluate candidates, and deliver available results.</p>
      </PolicySection>

      <PolicySection title="Training workers and retained copies">
        <p>Submitting a run requires permission to copy the learning dataset to assigned, approved training workers. Their operators can read and retain that data. Confidence-check and final-evaluation datasets remain with the evaluation service rather than being included in worker training exports.</p>
        <p>This training workflow is not confidential compute. Files, model artifacts, and local run records remain until operator cleanup; automatic deletion is not currently implemented. Canceling a job does not erase data already downloaded or immediately stop remote work. Expiring a download link does not remove a copy already obtained.</p>
      </PolicySection>

      <PolicySection title="Model requests">
        <p>Running the playground or calling the model API sends your supplied context and questions to the model service to produce predictions. These requests are processed on servers, rather than only in your browser. Use information you are authorized to send, and avoid sensitive data in public examples.</p>
        <p>When the setup assistant is connected, requesting suggestions sends your description, follow-up conversation, and any question draft being revised to its configured AI provider. This is separate from running a prediction or submitting training data. Choosing and editing a built-in starter does not call the assistant.</p>
        <p>Optional voice entry uses your browser’s speech recognition service, which may process audio remotely. It starts only when you choose Speak your goal. The transcript appears for you to review before requesting suggestions.</p>
      </PolicySection>

      <PolicySection title="Website analytics">
        <p>We use Plausible Analytics to understand page visits, referral sites, engagement, browser and device types, and approximate locations. Plausible does not use analytics cookies or store raw IP addresses. See <a href="https://plausible.io/data-policy" className={link}>Plausible’s data policy</a> for details.</p>
        <p>We remove URL query parameters and fragments before sending analytics events and send only the referring site’s origin. We do not send form contents, account identifiers, API keys, training files, or model inputs to Plausible. Internal administration pages, the pricing lab, and individual shared artifacts are excluded.</p>
      </PolicySection>

      <PolicySection title="Contact messages and service providers">
        <p>If you join the early-access email list, we store your email address in Supabase and use it for access updates. Joining the list does not create a workspace account. You can use the contact form to request removal.</p>
        <p>The contact form sends your name, email address, optional company name, and message through Resend to the Zils support inbox so we can respond.</p>
        <p>Vercel hosts the website; Supabase supports authentication and job records and retains existing file copies during migration; DigitalOcean Spaces provides private file storage; Resend delivers contact messages. Hosting, authentication, and delivery infrastructure may process technical records such as request details, IP addresses, and delivery events as part of operating those services.</p>
      </PolicySection>

      <PolicySection title="Questions and data requests">
        <p>Use the <Link href="/contact" className={link}>Zils contact form</Link> to ask about your information or request access, correction, or deletion. Include enough information to identify your account or job, but do not send passwords or API keys. We may need to verify the request. Copies retained by training-worker operators need to be considered separately from data held by the Zils service.</p>
        <p>Changes to this notice will appear on this page with an updated date. External websites linked from Zils have their own privacy notices.</p>
      </PolicySection>
    </PolicyPage>
  );
}
