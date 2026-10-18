import { notFound } from 'next/navigation';
import { SiteFrame } from '@/components/site/site-frame';
import { SectionRow } from '@/components/site/section-row';
import { Reveal } from '@/components/site/reveal';
import { CountUp } from '@/components/site/count-up';
import { DetailsRow } from '@/components/site/details-row';
import { ScoreBars } from '@/components/site/score-bars';
import { SiteButton } from '@/components/site/site-button';

// Dev-only fixture for tests/browser/site-primitives.spec.ts. Kept after the rebrand; tests/dev-preview.test.cjs checks it 404s without ZILS_DEV_PREVIEW=1.
export default function Page() {
  if (process.env.ZILS_DEV_PREVIEW !== '1') notFound();
  return (
    <SiteFrame current="model">
      <SectionRow n="01" label="Primitives" note="System 01" />
      <Reveal>
        <h1 style={{ fontWeight: 300, fontSize: 'clamp(44px, 6vw, 84px)', letterSpacing: '-0.03em', lineHeight: 0.98, padding: '64px 0 24px' }}>
          <CountUp value={79.2} decimals={1} suffix="%" start />
        </h1>
        <SiteButton href="/model" variant="primary">Primary</SiteButton>{' '}
        <SiteButton href="/model" variant="secondary">Secondary</SiteButton>
      </Reveal>
      <div style={{ height: 1400 }} aria-hidden="true" />
      <SectionRow n="02" label="Scores" />
      <div id="bars-fixture" style={{ padding: '24px 0' }}>
        <ScoreBars rows={[
          { label: 'After training', value: 50.78, max: 100, display: '50.78%', kind: 'zils', note: 'fresh adapter' },
          { label: 'TypeSafe JEV', value: 43.55, max: 100, display: '43.55%', kind: 'jev' },
          { label: 'Before training', value: 42.97, max: 100, display: '42.97%', kind: 'base' },
        ]} />
      </div>
      <DetailsRow summary="More detail">Collapsed detail.</DetailsRow>
    </SiteFrame>
  );
}
