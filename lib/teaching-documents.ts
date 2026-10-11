import { unzipSync } from 'fflate';
import { Parser } from 'saxen';
import type { TeachingExample } from './teach-by-example';

export type TeachingDocument = { name: string; text: string; group: string };
export type DocumentField = { name: string; value: string; status: 'found' | 'missing' | 'ambiguous' | 'edited'; evidence: string[] };
export const MAX_DOCUMENT_TEXT = 200_000;

export function checkDocumentFile(file: File) {
  if (!file.size) throw new Error('This document is empty. Choose a document with text.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a document smaller than 10 MiB.');
  if (!/\.(pdf|docx|txt|md)$/i.test(file.name)) throw new Error('Choose PDF, Word (.docx), plain text, or Markdown.');
}

export async function readTextDocument(file: File): Promise<string> {
  checkDocumentFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  if (/\.docx$/i.test(file.name)) {
    try {
      let expanded = 0, entries = 0;
      unzipSync(bytes, { filter: entry => {
        expanded += entry.originalSize;
        if (++entries > 512 || !Number.isSafeInteger(expanded) || expanded > 32 * 1024 * 1024) throw new Error('Expanded Word document is too large.');
        return false;
      } });
      const xmlBytes = unzipSync(bytes, { filter: entry => entry.name === 'word/document.xml' })['word/document.xml'];
      if (!xmlBytes) throw new Error('Word document text is missing.');
      const xml = new TextDecoder('utf-8', { fatal: true }).decode(xmlBytes);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsupported XML document.');
      const parser = new Parser();
      let inText = false, hasBody = false, tableCell = false;
      const chunks: string[] = [];
      parser.on('error', error => { throw error; });
      parser.on('warn', error => { throw error; });
      parser.on('openTag', name => {
        const tag = name.split(':').at(-1);
        if (tag === 'body') hasBody = true;
        if (tag === 't') inText = true;
        if (tag === 'tc') tableCell = true;
        if (tag === 'tab') chunks.push('\t');
        if (tag === 'br') chunks.push('\n');
      });
      parser.on('text', (value, decode) => { if (inText) chunks.push(decode(value)); });
      parser.on('closeTag', name => {
        const tag = name.split(':').at(-1);
        if (tag === 't') inText = false;
        if (tag === 'p') chunks.push(tableCell ? ' ' : '\n');
        if (tag === 'tc') { chunks.push('\t'); tableCell = false; }
        if (tag === 'tr') chunks.push('\n');
      });
      parser.parse(xml);
      if (!hasBody) throw new Error('Word document body is missing.');
      text = chunks.join('');
    } catch { throw new Error('Could not read this Word document. Save an unprotected .docx or export its text.'); }
  } else {
    if (/\.pdf$/i.test(file.name)) throw new Error('PDFs must be opened with the PDF reader.');
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('Save this text document with UTF-8 encoding.'); }
  }
  text = text.replace(/^\uFEFF/, '').trim();
  if (!text) throw new Error('No readable text was found. Scanned documents need OCR, which is not connected in this preview.');
  if (text.length > MAX_DOCUMENT_TEXT) throw new Error('This document has too much text. Use a shorter document or an excerpt.');
  return text;
}

export function suggestDocumentFields(text: string, requested: string): DocumentField[] {
  const names = requested.split('\n').map(name => name.trim()).filter(Boolean);
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  if (!names.length || names.length > 16 || names.some(name => name.length > 100) || new Set(names.map(normalize)).size !== names.length) throw new Error('Choose 1–16 different field names, up to 100 characters each.');
  // shortcut: local label matching, not semantic extraction; replace suggestions with a reviewed extraction service when connected.
  const lines = text.split(/\r\n|\n|\r/).map(line => line.trim()).filter(Boolean);
  return names.map(name => {
    const matches = lines.map(line => ({line, pair:line.split(/:\s*|\t+|\s+=\s+/)})).filter(({pair}) => pair.length > 1 && normalize(pair[0]) === normalize(name));
    const values = [...new Set(matches.map(({pair}) => pair.slice(1).join(':').trim()).filter(Boolean))];
    return { name, value: values.length === 1 ? values[0] : '', status: values.length === 1 ? 'found' : values.length > 1 ? 'ambiguous' : 'missing', evidence: matches.map(({line}) => line) };
  });
}

export function documentTeachingExample(document: TeachingDocument, fields: {name: string; value: string}[]): TeachingExample {
  const input = document.text.trim();
  if (!input || input.length > 16_000) throw new Error('Use a document excerpt of 1–16,000 characters for a teaching example.');
  const output = fields.map(field => `${field.name}: ${field.value.trim() || 'Not provided'}`).join('\n');
  if (output.length > 16_000) throw new Error('Keep the combined answers under 16,000 characters.');
  return { id: crypto.randomUUID(), input, output, group: document.group, source: document.name, reviewed: false, excluded: false };
}
