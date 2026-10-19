'use client';

import { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import s from './install-command.module.css';

/** A one-line shell command with a copy button; when the clipboard is blocked the text is selected instead. */
export function InstallCommand({ command, label }: { command: string; label: string }) {
  const field = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  function select() {
    if (!field.current) return;
    const range = document.createRange(); range.selectNodeContents(field.current);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  }
  async function copy() {
    setCopied(false); setFailed(false);
    try { await navigator.clipboard.writeText(command); setCopied(true); }
    catch { setFailed(true); select(); }
  }
  return <div className={s.box}>
    <pre className={s.line} aria-label={label}><span className={s.prompt} aria-hidden="true">$ </span><code ref={field} onClick={select}>{command}</code></pre>
    <button type="button" className={s.copy} onClick={copy}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
    <span className={s.status} role="status">{failed ? 'Copy was blocked. The command is selected: press ⌘C on Mac or Ctrl+C on Windows.' : copied ? 'Install command copied.' : ''}</span>
  </div>;
}
