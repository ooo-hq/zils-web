import type { Metadata } from 'next';
import { TeachByExample } from '@/components/teach-by-example';
import { trainingConfig } from '@/lib/training-config';

export const metadata: Metadata = {
  title: 'Teach a model · Zils',
  description: 'Describe a task, bring examples, and show Zils what a good answer looks like.',
  robots: { index: false, follow: false },
};

export default function TeachPage() {
  return <TeachByExample config={trainingConfig()} />;
}
