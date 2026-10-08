'use client';

import { useState } from 'react';

export function EmailSignup({ earlyAccess = false }: { earlyAccess?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  return (
    <div className="w-full text-left">
      <form aria-label={earlyAccess ? 'Join Zils early access' : 'Email updates'} onSubmit={async event => {
        event.preventDefault();
        if (status === 'pending') return;
        const data = new FormData(event.currentTarget);
        setStatus('pending');
        try {
          const response = await fetch('/api/email-signups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: data.get('email'), website: data.get('website') }),
            signal: AbortSignal.timeout(15000),
          });
          setStatus(response.ok && (await response.json()).ok === true ? 'success' : 'error');
        } catch {
          setStatus('error');
        }
      }}>
        <label htmlFor="signup-email" className={`block text-xl font-medium tracking-tight ${earlyAccess ? 'text-ink' : 'text-neutral-100'}`}>{earlyAccess ? 'Email address' : 'Get Fez updates'}</label>
        <p id="signup-description" className={`mt-3 max-w-sm text-sm leading-6 ${earlyAccess ? 'text-muted' : 'text-neutral-400'}`}>
          {earlyAccess ? 'Get an email when early-access opportunities open. No account or payment needed.' : 'New releases and what changed in them. Occasional, and nothing else.'}
        </p>
        {status !== 'success' && (
          <>
            <div className={`mt-6 flex flex-wrap items-center gap-4 border-b ${earlyAccess ? 'border-edge-strong focus-within:border-accent' : 'border-neutral-600 focus-within:border-[#FF6A00]'}`}>
              <input
                id="signup-email" name="email" type="email" required maxLength={254}
                autoComplete="email" placeholder="Your email" aria-describedby="signup-description"
                disabled={status === 'pending'}
                className={`min-h-12 min-w-0 flex-1 bg-transparent py-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 ${earlyAccess ? 'text-ink placeholder:text-subtle focus-visible:outline-accent' : 'text-neutral-100 placeholder:text-neutral-500 focus-visible:outline-[#FF6A00]'}`}
              />
              <button type="submit" disabled={status === 'pending'}
                className={`min-h-12 shrink-0 py-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${earlyAccess ? 'text-accent hover:text-ink focus-visible:outline-accent' : 'text-[#FF6A00] hover:text-[#FF8533] focus-visible:outline-[#FF6A00]'}`}>
                {status === 'pending' ? 'Saving…' : earlyAccess ? 'Join early access' : 'Keep me posted'}
              </button>
            </div>
            <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          </>
        )}
        <div role="status" aria-live="polite" className={`mt-3 text-sm ${earlyAccess ? 'text-ink' : 'text-neutral-200'}`}>
          {status === 'success' && (earlyAccess ? "You're on the early-access list. We'll email you with access updates." : "You're on the list. We'll keep you posted.")}
        </div>
        {status === 'error' && <p role="alert" className={`mt-2 text-sm ${earlyAccess ? 'text-danger' : 'text-orange-300'}`}>Couldn&apos;t save your email. Please try again.</p>}
        <a href="/privacy" className={`mt-2 inline-block text-xs underline underline-offset-4 ${earlyAccess ? 'text-muted hover:text-ink' : 'text-neutral-400 hover:text-neutral-200'}`}>Privacy</a>
      </form>
    </div>
  );
}
