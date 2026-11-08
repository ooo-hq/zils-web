import { notFound } from 'next/navigation';
import { SiteFrame } from '@/components/site/site-frame';
import { TrainBox } from './train-box';

// Dev-only prototype of a one-screen training page ("it sees" → "it decides"). Nothing is uploaded or trained.
export default function Page() {
  if (process.env.ZILS_DEV_PREVIEW !== '1') notFound();
  return <SiteFrame><TrainBox /></SiteFrame>;
}
