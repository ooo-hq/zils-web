'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from '@/app/(home)/contact/contact.module.css';

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

  if (status === 'sent') return <div ref={result} className={styles.success} tabIndex={-1} role="status">
    <span className={styles.check}><Check size={24} aria-hidden="true" /></span>
    <h2>Message sent.</h2>
    <p>Thanks for reaching out. We’ll reply to <strong>{replyEmail}</strong>.</p>
    <Link href="/" className={styles.button}>Back to Zils</Link>
  </div>;

  return <form onSubmit={submit} className={styles.form} aria-label="Contact Zils">
    <div className={styles.pair}>
      <div><label htmlFor="contact-name">Name</label><input id="contact-name" name="name" autoComplete="name" maxLength={100} required disabled={status === 'sending'} /></div>
      <div><label htmlFor="contact-email">Email</label><input id="contact-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={status === 'sending'} /></div>
    </div>
    <div><label htmlFor="contact-company">Company <span>Optional</span></label><input id="contact-company" name="company" autoComplete="organization" maxLength={160} disabled={status === 'sending'} /></div>
    <div><label htmlFor="contact-message">How can we help?</label><p id="message-help" className={styles.hint}>A short overview of your project or question is enough.</p><textarea id="contact-message" name="message" rows={6} maxLength={3000} required aria-describedby="message-help" disabled={status === 'sending'} placeholder="What are you building, and where could Zils help?" /></div>
    <input name="website" type="text" autoComplete="off" tabIndex={-1} aria-hidden="true" className={styles.honeypot} />
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.submitRow}><button className={styles.button} type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send message'}</button><p>We’ll reply by email.</p></div>
    <p className={styles.note}>No datasets or private customer information needed.</p>
  </form>;
}
