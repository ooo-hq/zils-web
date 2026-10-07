'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { modelQuickstart, type ExampleLanguage } from '@/lib/model-quickstart';
import training from '@/app/(home)/train/train.module.css';
import styles from './trained-model-quickstart.module.css';

function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    setCopied(false); setFailed(false);
    try { await navigator.clipboard.writeText(value); setCopied(true); }
    catch { setFailed(true); field.current?.focus(); field.current?.select(); }
  }
  return <div className={styles.copyField}>
    <div className={styles.fieldHeading}>
      <label htmlFor={id}>{label}</label>
      <button type="button" className={training.secondary} onClick={copy}>
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        {copied ? 'Copied' : `Copy ${label === 'API model ID' ? 'model ID' : label === 'Example code' ? 'code' : 'command'}`}
      </button>
    </div>
    <textarea id={id} ref={field} readOnly spellCheck={false} value={value} rows={multiline ? 14 : 3} wrap={multiline ? 'off' : 'soft'} className={`${styles.field} ${multiline ? styles.code : ''}`} onClick={() => { if (!multiline) field.current?.select(); }} />
    <span className={styles.copyStatus} role="status">{failed ? 'Copy was blocked. The text is selected: press ⌘C on Mac or Ctrl+C on Windows.' : copied ? `${label} copied.` : ''}</span>
  </div>;
}

export function TrainedModelQuickstart({ modelId, apiUrl, apiKeys }: { modelId: string; apiUrl: string | null; apiKeys: ReactNode }) {
  const [language, setLanguage] = useState<ExampleLanguage>('Python');
  const example = apiUrl ? modelQuickstart(modelId, apiUrl, language) : null;
  function download() {
    if (!example) return;
    const url = URL.createObjectURL(new Blob([`${example.code}\n`], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = example.filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className={styles.quickstart} aria-label="Use your model">
    <h3>Use your model</h3>
    <p className={styles.intro}>Your model is hosted by Zils. Copy its ID into your app, or make your first request with the example below.</p>
    <CopyField key={modelId} label="API model ID" value={modelId} />
    {example ? <ol className={styles.steps}>
      <li>
        <h4>Get your API key</h4>
        <p>Use an existing key from this account, or create one here.</p>
        {apiKeys}
      </li>
      <li>
        <h4>Try one of your examples</h4>
        <p>Save a prepared JSONL file from this run as <code>train.jsonl</code>. Save this code in the same folder as <code>{example.filename}</code>.</p>
        <div className={styles.languages} role="group" aria-label="Code language">
          {(['Python', 'JavaScript'] as const).map(item => <button type="button" key={item} aria-pressed={language === item} onClick={() => setLanguage(item)}>{item}</button>)}
          <span>{language === 'Python' ? 'Python 3 · No packages to install' : 'Node.js 20+ · Run on your server'}</span>
        </div>
        <CopyField key={`${modelId}-${apiUrl}-${language}`} label="Example code" value={example.code} multiline />
        <button type="button" className={training.textButton} onClick={download}><Download size={14} aria-hidden="true" />Download {example.filename}</button>
        <p>The code sends one example’s input and question to your model. Its expected answer stays in your file.</p>
      </li>
      <li>
        <h4>Run your first request</h4>
        <p>In a Mac or Linux terminal, open that folder. Replace <code>YOUR_API_KEY</code> below with your key, then run the command.</p>
        <CopyField key={language} label="Run command" value={example.command} />
        <p>A successful call prints a JSON response with your model ID and decision probabilities. To use new inputs, replace <code>{language === 'Python' ? 'example["state"]' : 'example.state'}</code> in the code and keep your question.</p>
      </li>
    </ol> : <p className={styles.intro}>The API address is not configured on this website. You can still copy your model ID; contact Zils for connection details.</p>}
  </section>;
}
