'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuthSession } from '@/components/auth-session';
import { AuthFrame, GoogleMark } from '@/components/site/auth-frame';
import form from '@/components/site/form-page.module.css';
import css from '@/components/site/sign-in-panel.module.css';
import { authorizationDetails, authorizationReturnUrl, cliCallbackUrl, isAuthorizationId, isOAuthClientId } from '@/lib/cli-authorization';
import { signInWithGoogle } from '@/lib/training-auth';
import term from './cli-authorization.module.css';

const restart = 'This sign-in request is invalid or expired. Start again with zils login in your terminal.';
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_ZILS_GOOGLE_AUTH_ENABLED === 'true';

type Tone = 'wait' | 'ok' | 'bad';
type Line = { tone: Tone; text: string };
const LINES = {
  checking: { tone: 'wait', text: 'Checking your Zils account…' },
  signIn: { tone: 'wait', text: 'Waiting for you to sign in…' },
  emailSent: { tone: 'wait', text: 'Waiting for you to open the email link…' },
  request: { tone: 'wait', text: 'Checking the sign-in request…' },
  approval: { tone: 'wait', text: 'Waiting for your approval…' },
  returning: { tone: 'ok', text: 'Returning to your terminal…' },
  restart: { tone: 'bad', text: 'Request expired. Run zils login again.' },
  unconfigured: { tone: 'bad', text: 'CLI sign-in is not set up on this site.' },
} satisfies Record<string, Line>;

export function CliAuthorization({ authorizationId }: { authorizationId: string | null }) {
  const { client, session, error } = useAuthSession();
  // A line belongs to the signed-in or signed-out step that set it; a new step starts from its own first line.
  const signedIn = Boolean(session);
  const [step, setStep] = useState<{ signedIn: boolean; line: Line } | null>(null);
  const setLine = useCallback((line: Line) => setStep({ signedIn, line }), [signedIn]);
  const line = step?.signedIn === signedIn ? step.line : null;
  const clientId = process.env.NEXT_PUBLIC_ZILS_CLI_OAUTH_CLIENT_ID;
  let body, fallback: Line;
  if (!isAuthorizationId(authorizationId)) {
    fallback = LINES.restart;
    body = <Problem title="Start again.">{restart}</Problem>;
  } else if (session === undefined) {
    fallback = LINES.checking;
    body = <p role="status" className={css.sub}>Checking your Zils account…</p>;
  } else if (!isOAuthClientId(clientId) || !client) {
    fallback = LINES.unconfigured;
    body = <Problem title="Not available here.">CLI sign-in is not configured here yet. Contact the Zils operator.</Problem>;
  } else if (session) {
    fallback = LINES.request;
    body = <Consent key={`${session.user.id}:${authorizationId}`} client={client} clientId={clientId} userId={session.user.id} authorizationId={authorizationId} onStep={setLine} />;
  } else {
    fallback = LINES.signIn;
    body = <SignIn client={client} authorizationId={authorizationId} sessionError={error} onStep={setLine} />;
  }
  return <AuthFrame label="Zils CLI" art={<Terminal line={line ?? fallback} />}>{body}</AuthFrame>;
}

/** Echoes the terminal that ran `zils login`; its last line follows the step on the right. */
function Terminal({ line }: { line: Line }) {
  return <div className={term.stage}>
    <figure aria-label="Your terminal" className={term.term}>
      <figcaption className={css.label}>Terminal</figcaption>
      <pre><span className={term.prompt}>$</span> zils login{'\n'}<span className={term.dim}>Opening your browser for Zils sign-in. Keep this terminal open.</span>{'\n'}<span className={term.state} data-tone={line.tone}>{line.text}</span>{line.tone === 'wait' && <span className={term.cursor} aria-hidden="true" />}</pre>
    </figure>
  </div>;
}

function Problem({ title, children }: { title: string; children: string }) {
  return <><h1>{title}</h1><p role="alert" className={form.fpError} style={{ marginTop: 18 }}>{children}</p></>;
}

function SignIn({ client, authorizationId, sessionError, onStep }: { client: SupabaseClient; authorizationId: string; sessionError: string | null; onStep: (line: Line) => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sent) result.current?.focus(); }, [sent]);

  async function signIn(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    setBusy(event ? 'email' : 'google'); setError('');
    try {
      const returnUrl = authorizationReturnUrl(window.location.origin, authorizationId);
      const result = event
        ? await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: returnUrl } })
        : await signInWithGoogle(client, window.location.origin, new URL(returnUrl).pathname + new URL(returnUrl).search);
      if (result.error) throw result.error;
      if (event) { setSent(true); onStep(LINES.emailSent); }
    } catch {
      setError('Sign-in could not start. Please try again.');
    } finally { setBusy(null); }
  }

  return <>
    <div role="status" ref={result} tabIndex={-1} className={css.done}>
      {sent && <><h1>Check your email.</h1><p>Open the sign-in link on this computer, then approve the CLI. Keep the terminal open.</p></>}
    </div>
    {!sent && <form onSubmit={signIn} aria-label="Sign in to connect the Zils CLI">
      <h1>Connect your terminal.</h1>
      <p className={css.sub}>Sign in to link <code>zils</code> on this computer to your workspace.</p>
      {(error || sessionError) && <p role="alert" className={form.fpError} style={{ marginTop: 20 }}>{error || sessionError}</p>}
      {GOOGLE_ENABLED && <>
        <button type="button" className={css.google} disabled={busy !== null} onClick={() => signIn()}><GoogleMark />Continue with Google</button>
        <div className={css.or}><span className={form.fpLabel}>or</span></div>
      </>}
      <div className={form.fpField} style={GOOGLE_ENABLED ? undefined : { marginTop: 32 }}>
        <div className={form.fpTop}><label htmlFor="cli-email" className={form.fpLabel}>Email</label></div>
        <input id="cli-email" type="email" required autoComplete="email" placeholder="you@company.com" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy !== null} />
      </div>
      <button type="submit" className={`${form.fpBtn} ${css.submit}`} disabled={busy !== null}>{busy === 'email' ? 'Sending…' : 'Email me a sign-in link'}</button>
      <p className={css.fine}>New here? Signing in creates your workspace.</p>
    </form>}
  </>;
}

function Consent({ client, clientId, userId, authorizationId, onStep }: { client: SupabaseClient; clientId: string; userId: string; authorizationId: string; onStep: (line: Line) => void }) {
  const [details, setDetails] = useState<ReturnType<typeof authorizationDetails> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    let current = true;
    client.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (!current) return;
      if (error || !data) throw new Error('Invalid request');
      if ('redirect_url' in data) { onStep(LINES.returning); window.location.assign(cliCallbackUrl(data.redirect_url)); }
      else { setDetails(authorizationDetails(data, clientId, authorizationId, userId)); onStep(LINES.approval); }
    }).catch(() => { if (current) { setError(restart); onStep(LINES.restart); } });
    return () => { current = false; active.current = false; };
  }, [client, clientId, authorizationId, userId, onStep]);

  async function decide(approve: boolean) {
    if (!details || busy) return;
    setBusy(true);
    try {
      const session = await client.auth.getSession();
      if (session.error || session.data.session?.user.id !== userId || !active.current) throw new Error('Account changed');
      const result = approve
        ? await client.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await client.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (result.error || !result.data) throw new Error('Consent failed');
      if (active.current) { onStep(LINES.returning); window.location.assign(cliCallbackUrl(result.data.redirect_url)); }
    } catch { if (active.current) { setError(restart); onStep(LINES.restart); } }
    finally { if (active.current) setBusy(false); }
  }
  if (error) return <Problem title="Start again.">{error}</Problem>;
  if (!details) return <p role="status" className={css.sub}>Checking the CLI request…</p>;
  return <section aria-labelledby="cli-consent-title">
    <h1 id="cli-consent-title">Allow the Zils CLI?</h1>
    <p className={css.sub}>Signed in as <strong className={term.who}>{details.user.email}</strong>.</p>
    <p className={term.what}>The CLI will save a session on this computer so it can submit datasets, follow training, cancel runs and download accepted models.</p>
    <div className={term.actions}>
      <button className={form.fpBtn} onClick={() => decide(true)} disabled={busy}>Approve</button>
      <button className={term.deny} onClick={() => decide(false)} disabled={busy}>Deny</button>
    </div>
    {busy && <p role="status" className={css.fine}>Returning to your terminal…</p>}
    <p className={css.fine}>Approve only if you started <code>zils login</code> in your own terminal. The CLI gets your account&apos;s existing access, not only training. It does not create an inference API key, and signing in does not start a training run.</p>
  </section>;
}
