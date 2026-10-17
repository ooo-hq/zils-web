'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuthSession } from '@/components/auth-session';
import { WorkspaceLoading } from '@/components/workspace-loading';
import training from '@/app/(home)/train/train.module.css';

/** Shows the playground only to signed-in accounts; its API routes check the session too. */
export function SignedInOnly({ auth, children }: { auth?: { url: string; key: string }; children: ReactNode }) {
  const { session } = useAuthSession(auth);
  if (session === undefined) return <WorkspaceLoading label="Opening the playground" />;
  if (!session) return <SignInPrompt title="Sign in to use the playground">The playground runs your questions on Zils models from your account. To see what Zils can do first, browse the examples.</SignInPrompt>;
  return <>{children}</>;
}

export function SignInPrompt({ title, children }: { title: string; children: ReactNode }) {
  return <section className={training.panel}>
    <h2>{title}</h2>
    <p>{children}</p>
    <div className={training.actions}><Link href="/train" className={training.button}>Sign in to Zils</Link><Link href="/examples" className={training.secondary}>See examples</Link></div>
  </section>;
}
