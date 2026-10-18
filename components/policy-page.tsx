import { Children, isValidElement, type ReactNode } from 'react';
import { SectionRow } from '@/components/site/section-row';
import { SiteFrame } from '@/components/site/site-frame';
import { StickyIndex } from '@/components/site/sticky-index';
import css from './policy-page.module.css';

export const policySlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function PolicyPage({ title, children, updated = '6 October 2026' }: { title: string; children: ReactNode; updated?: string }) {
  const items = Children.toArray(children).flatMap(c =>
    isValidElement<{ title: string }>(c) && c.type === PolicySection
      ? [{ id: policySlug(c.props.title), label: c.props.title, n: '' }]
      : []);
  items.forEach((it, i) => { it.n = String(i + 1).padStart(2, '0'); });
  return (
    <SiteFrame>
      <SectionRow n="01" label={`Legal · ${title.replace(/\.$/, '').replace(/ (policy|of use)$/i, '')}`} />
      <div className={css.legal}>
        <aside className={css.aside}><StickyIndex items={items} /></aside>
        <article className={css.article}>
          <h1 className={css.h1}>{title}</h1>
          <p className={css.meta}>Updated {updated} · Zils at zils.ai</p>
          <div className={css.body}>{children}</div>
        </article>
      </div>
    </SiteFrame>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id={policySlug(title)} className={css.section}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
