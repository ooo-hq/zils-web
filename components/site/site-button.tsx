import Link from 'next/link';
import type { ReactNode } from 'react';
import css from './site-button.module.css';

export function SiteButton({ href, variant, children }: { href: string; variant: 'primary' | 'secondary'; children: ReactNode }) {
  return <Link href={href} className={`${css.b} ${css[variant]}`}>{children}</Link>;
}
