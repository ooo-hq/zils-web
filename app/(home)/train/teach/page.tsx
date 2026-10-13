import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TeachByExample } from '@/components/teach-by-example';

export const metadata: Metadata = {
  title: 'Teach a model · Zils',
  description: 'Describe a task, bring examples, and show Zils what a good answer looks like.',
  robots: { index: false, follow: false },
};

export default function TeachPage() {
  if (process.env.NODE_ENV !== 'development' && process.env.VERCEL_ENV !== 'preview') notFound();
  return <TeachByExample />;
}
