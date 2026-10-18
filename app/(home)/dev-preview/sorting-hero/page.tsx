import { notFound } from 'next/navigation';
import { SiteFrame } from '@/components/site/site-frame';
import { SortingHero } from '@/components/site/sorting-hero';

// Dev-only fixture for tests/browser/sorting-hero.spec.ts. Kept after the rebrand; tests/dev-preview.test.cjs checks it 404s without ZILS_DEV_PREVIEW=1.
export default function Page() {
  if (process.env.ZILS_DEV_PREVIEW !== '1') notFound();
  return (
    <SiteFrame>
      <SortingHero
        title="Teach AI to make decisions your way."
        description="Show Zils examples with the right answers. It trains a small model your app can use to sort requests, flag problems, or score matches."
      />
    </SiteFrame>
  );
}
