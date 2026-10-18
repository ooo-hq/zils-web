import type { Metadata } from 'next';
import Link from 'next/link';
import { ChessStudyDetails } from '@/components/chess-study';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import s from '@/components/research-guide.module.css';

export const metadata: Metadata = {
  title: 'zils — mate-in-one chess study',
  description: 'After chess training, the model reached 50.78% checkmate accuracy, compared with 42.97% before training and 43.55% for TypeSafe JEV, on 512 held-out positions.',
  alternates: { canonical: 'https://zils.ai/model/chess-study' },
};

export default function ChessStudyPage() {
  return (
    <SiteFrame current="model">
      <div className={`${s.res} ${s.page}`}>
        <SectionRow label="Research · Chess study" />
        <div className={s.studyBody}>
        <header className="pb-10 pt-8">
          <Link href="/model#chess-study" className="text-sm underline decoration-edge-strong underline-offset-4 hover:text-accent">Back to model research</Link>
          <p className="mt-8 text-xs text-muted">Completed experiment · 7 October 2026 UTC</p>
          <h1 className="mt-4 max-w-[20ch] text-[clamp(2.5rem,6vw,4rem)] font-semibold leading-[1.04] tracking-[-0.055em]">Mate-in-one chess study.</h1>
          <p className="mt-5 max-w-[66ch] text-base leading-8 text-muted">Training improved the model’s ability to select an immediate checkmate. On the same 512 held-out positions, it outperformed both the model before training and TypeSafe JEV.</p>
        </header>
        <ChessStudyDetails />
        </div>
      </div>
    </SiteFrame>
  );
}
