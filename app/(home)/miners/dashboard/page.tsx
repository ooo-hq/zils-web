import type { Metadata } from 'next';
import { SiteFrame } from '@/components/site/site-frame';
import { MinerDashboardView } from './view';

export const metadata: Metadata = {
  title: 'Zils — your miner',
  description: 'A miner’s private page: where its body stands, its round report, its seats and its customer jobs.',
  robots: { index: false, follow: false },
};

export default function MinerDashboardPage() {
  return <SiteFrame current="miners"><MinerDashboardView /></SiteFrame>;
}
