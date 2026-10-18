import type { Metadata } from 'next';
import { SignInPanel } from '@/components/site/sign-in-panel';

export const metadata: Metadata = {
  title: 'Sign in to Zils',
  description: 'Open your Zils workspace: training, models and usage.',
  alternates: { canonical: 'https://zils.ai/sign-in' },
};

export default function SignInPage() {
  return <SignInPanel />;
}
