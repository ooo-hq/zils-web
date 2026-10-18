'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuthSession } from '@/components/auth-session';
import css from '@/components/site-header.module.css';

/** Below 960px the centered nav is hidden; this disclosure replaces it. */
export function MobileMenu({ links, current }: { links: readonly { href: string; label: string; id: string }[]; current?: string }) {
  const { session } = useAuthSession();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return (
    <div ref={box} className={css.menu}>
      <button ref={trigger} type="button" className={css.menuBtn} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>Menu</button>
      {open && (
        <div id={panelId} role="group" aria-label="Site menu" className={css.menuPanel}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={css.menuLink} aria-current={current === l.id ? 'page' : undefined} onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          {session === null && <Link href="/sign-in" className={css.menuLink} onClick={() => setOpen(false)}>Sign in</Link>}
        </div>
      )}
    </div>
  );
}
