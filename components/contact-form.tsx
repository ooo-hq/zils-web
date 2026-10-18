'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from '@/components/site/form-page.module.css';

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [replyEmail, setReplyEmail] = useState('');
  const pending = useRef(false);
  const requestId = useRef('');
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => { if (status === 'sent') result.current?.focus(); }, [status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    const body = {
      name: String(data.get('name') || '').trim(), email: String(data.get('email') || '').trim(),
      company: String(data.get('company') || '').trim(), message: String(data.get('message') || '').trim(),
      website: String(data.get('website') || ''),
    };
    if (!body.name || !body.message) { setStatus('error'); setError('Add your name and a message before sending.'); return; }
    pending.current = true; setStatus('sending'); setError('');
    try {
      requestId.current ||= crypto.randomUUID();
      const response = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, requestId: requestId.current }),
        signal: AbortSignal.timeout(15_000), credentials: 'omit', redirect: 'error',
      });
      const reply = await response.json().catch(() => null);
      if (response.status === 400 || response.status === 413) {
        setStatus('error'); setError('Check your name, email, and message. Keep your message to 3,000 characters.'); return;
      }
      if (response.status === 429) {
        setStatus('error'); setError('Please wait a minute before trying again. Your details are still here.'); return;
      }
      if (!response.ok || reply?.ok !== true) throw new Error('send_failed');
      setReplyEmail(body.email); setStatus('sent');
    } catch {
      setStatus('error'); setError('Your message could not be sent. Your details are still here; please try again in a moment.');
    } finally { pending.current = false; }
  }

  if (status === 'sent') return <div ref={result} className={styles.fpDone} tabIndex={-1} role="status">
    <h2>Message sent.</h2>
    <p>Thanks for reaching out. We’ll reply to <strong>{replyEmail}</strong>.</p>
    <Link href="/" className={styles.fpBtn}>Back to Zils</Link>
  </div>;

  const off = status === 'sending';
  const Label = ({ id, children, optional }: { id: string; children: string; optional?: boolean }) => <div className={styles.fpTop}><label htmlFor={id} className={styles.fpLabel}>{children}</label>{optional && <span className={styles.fpLabel}>Optional</span>}</div>;
  return <form onSubmit={submit} className={styles.fpForm} aria-label="Contact Zils">
    <div className={styles.fpPair}>
      <div className={styles.fpField}><Label id="contact-name">Name</Label><input id="contact-name" name="name" autoComplete="name" maxLength={100} required disabled={off} /></div>
      <div className={styles.fpField}><Label id="contact-email">Email</Label><input id="contact-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={off} /></div>
    </div>
    <div className={styles.fpField}><Label id="contact-company" optional>Company</Label><input id="contact-company" name="company" autoComplete="organization" maxLength={160} disabled={off} /></div>
    <div className={styles.fpField}><Label id="contact-message">How can we help?</Label><textarea id="contact-message" name="message" rows={6} maxLength={3000} required aria-describedby="message-help" disabled={off} placeholder="What are you building, and where could Zils help?" /><span id="message-help" className={styles.fpHint}>A short overview of your project or question is enough. No datasets or private customer information needed.</span></div>
    <input name="website" type="text" autoComplete="off" tabIndex={-1} aria-hidden="true" className={styles.fpHp} />
    {error && <p className={styles.fpError} role="alert">{error}</p>}
    <div className={styles.fpFoot}><button className={styles.fpBtn} type="submit" disabled={off}>{off ? 'Sending…' : 'Send message'}</button><p>We’ll reply by email.</p></div>
  </form>;
}
