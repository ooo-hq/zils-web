'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Check, FileText, Upload } from 'lucide-react';
import { checkDocumentFile, documentTeachingExample, readTextDocument, suggestDocumentFields, type DocumentField, type TeachingDocument } from '@/lib/teaching-documents';
import type { TeachingExample } from '@/lib/teach-by-example';
import s from './teach-by-example.module.css';

const sampleText = 'Alder Supply Lab\nInvoice number: INV-1042\nVendor: Alder Supply Lab\nDue date: 2026-11-10\nSubtotal: USD 390.00\nTax: USD 30.00\nTotal: USD 420.00';
const defaultFields = 'Invoice number\nVendor\nTotal\nDue date';

export function TeachingDocuments({ extractionTask, onAdd }: { extractionTask: boolean; onAdd: (example: TeachingExample) => void }) {
  const [document, setDocument] = useState<TeachingDocument | null>(null);
  const [requested, setRequested] = useState(defaultFields);
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [checked, setChecked] = useState(false), [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  function resetReview() { setFields([]); setChecked(false); setAdded(false); setError(''); setNotice(''); }
  async function read(file?: File) {
    if (!file || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      checkDocumentFile(file);
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      let text: string, description: string;
      if (/\.pdf$/i.test(file.name)) {
        const result = await (await import('@/lib/teaching-pdf')).readTeachingPdf(file);
        text = result.text; description = result.note;
      } else {
        text = await readTextDocument(file);
        description = /\.docx$/i.test(file.name) ? 'Word body text and tables only. Images, headers, footers, and comments are not extracted.' : 'Text read locally. Check it before extracting fields.';
      }
      setDocument({name:file.name, text, group:`document-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`});
      setNote(description); resetReview();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not read this document.'); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  function extract() {
    if (!document) return;
    try { setFields(suggestDocumentFields(document.text, requested)); setChecked(false); setAdded(false); setError(''); setNotice('Matching fields are ready for your review.'); }
    catch (error) { setError((error as Error).message); }
  }
  function useExample() {
    if (!document) return;
    try { onAdd(documentTeachingExample(document, extractionTask ? fields : [])); setAdded(true); setNotice('Document added. Continue to review your teaching examples.'); }
    catch (error) { setError((error as Error).message); }
  }
  function download() {
    if (!document) return;
    const data = {source:document.name, fields:Object.fromEntries(fields.map(field => [field.name, field.value.trim() || null]))};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}));
    const link = window.document.createElement('a'); link.href = url; link.download = 'zils-document-fields.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Download requested. Your document has not been submitted for training.');
  }
  return <section aria-label="Document workspace" aria-busy={busy}>
    <div className={s.dropzone} data-loaded={Boolean(document)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (event.dataTransfer.files.length !== 1) { setError('Choose one document at a time.'); return; } void read(event.dataTransfer.files[0]); }}>
      <FileText size={26} strokeWidth={1.5} /><strong>{document ? 'Read another document' : 'Start with a document'}</strong><p>PDF, Word (.docx), text, or Markdown. Read it here, then decide what to keep.</p>
      <label className={s.secondary} htmlFor="teaching-document"><Upload size={15} /> Choose a document</label><input ref={fileInput} id="teaching-document" type="file" className={s.fileInput} accept=".pdf,.docx,.txt,.md" disabled={busy} onChange={event => void read(event.target.files?.[0])} />
      <small>10 MiB maximum · PDFs up to 50 pages · Text extraction only; no OCR</small>
    </div>
    {!document && <button type="button" className={s.textButton} disabled={busy} onClick={() => { setDocument({name:'Sample invoice.txt',text:sampleText,group:'sample-invoice-1042'}); setNote('Sample document. Try changing a field or removing a value.'); resetReview(); }}>Try a sample invoice</button>}
    {busy && <p role="status" className={s.hint}>Reading the document locally…</p>}
    {error && <p role="alert" className={s.error}>{error}</p>}
    <p role="status" className={s.hint}>{notice}</p>
    {document && <fieldset disabled={busy}>
      <div className={s.documentHeading}><h2>{document.name}</h2><span>Stays in this tab</span></div>
      <p className={s.hint}>{note}</p>
      <div className={s.documentColumns}>
        <div><label htmlFor="document-text">Text from your document</label><textarea id="document-text" rows={15} maxLength={200000} value={document.text} onChange={event => { setDocument({...document,text:event.target.value}); resetReview(); }} /><p className={s.hint}>Correct reading errors here. For teaching, use an excerpt up to 16,000 characters. Related excerpts keep the same document reference.</p></div>
        <div><label htmlFor="document-fields">What information do you want?</label><textarea id="document-fields" rows={4} maxLength={1616} value={requested} onChange={event => { setRequested(event.target.value); resetReview(); }} /><p className={s.hint}>One field per line. This local preview finds values beside matching labels; it does not infer meaning or read images.</p><button type="button" className={s.secondary} onClick={extract}>Find matching fields</button>
          {fields.length > 0 && <div className={s.documentFields}>{fields.map((field,index) => <div key={field.name}><label htmlFor={`document-value-${index}`}>{field.name}{' '}<span className={s.optional}>{field.status === 'edited' ? 'Edited by you' : field.status === 'found' ? 'Match found' : field.status === 'ambiguous' ? 'Conflicting values' : 'Not found'}</span></label><input id={`document-value-${index}`} value={field.value} maxLength={4000} placeholder="Leave blank if not provided" onChange={event => { setFields(rows => rows.map((row,i) => i === index ? {...row,value:event.target.value,status:'edited'} : row)); setChecked(false); setAdded(false); setNotice(''); }} />{field.evidence.length > 0 && <details className={s.fieldEvidence}><summary>Show source</summary><p>{field.evidence.join('\n')}</p></details>}</div>)}</div>}
        </div>
      </div>
      {fields.length > 0 && <><label className={s.checkLabel}><input type="checkbox" checked={checked} onChange={event => { setChecked(event.target.checked); setNotice(''); }} /><span>I checked these values against the document. Blank fields mean the value was not provided.</span></label>
        <div className={s.actions}><button type="button" className={s.secondary} disabled={!checked} onClick={download}>Download fields</button><button type="button" className={s.primary} disabled={!checked || added} onClick={useExample}>{added ? <><Check size={16} /> Added to examples</> : <>Use as teaching example <ArrowRight size={16} /></>}</button></div>
        {!extractionTask && <p className={s.hint}>For your current task, the document becomes the input. You’ll provide its correct answer during teaching review.</p>}
        <details className={s.details}><summary>View or copy the fields</summary><label htmlFor="document-json">Extracted field data</label><textarea id="document-json" rows={5} readOnly value={JSON.stringify(Object.fromEntries(fields.map(field => [field.name, field.value.trim() || null])),null,2)} /></details>
      </>}
    </fieldset>}
  </section>;
}
