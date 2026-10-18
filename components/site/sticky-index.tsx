'use client';
import { useEffect, useState } from 'react';
import css from './sticky-index.module.css';

/** Sticky section index: marks the section crossing a line near the top with aria-current="true". Hidden below 960px. */
export function StickyIndex({ items, label = 'On this page' }: { items: readonly { id: string; label: string }[]; label?: string }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin: '-25% 0px -70% 0px' });
    for (const { id } of items) { const el = document.getElementById(id); if (el) io.observe(el); }
    return () => io.disconnect();
  }, [items]);
  return (
    <nav aria-label={label} className={css.nav}>
      {items.map(it => (
        <a key={it.id} href={`#${it.id}`} aria-current={active === it.id ? 'true' : undefined}>{it.label}</a>
      ))}
    </nav>
  );
}
