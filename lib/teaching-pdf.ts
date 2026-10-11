import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { MAX_DOCUMENT_TEXT } from './teaching-documents';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export async function readTeachingPdf(file: File): Promise<{text: string; note: string}> {
  const loading = getDocument({ data: new Uint8Array(await file.arrayBuffer()), useWorkerFetch: false, useSystemFonts: true, disableFontFace: true, stopAtErrors: true });
  loading.onPassword = () => { void loading.destroy(); };
  const timer = setTimeout(() => { void loading.destroy(); }, 30_000);
  try {
    const pdf = await loading.promise;
    if (pdf.numPages > 50) throw new Error('Use a PDF with at most 50 pages.');
    const pages: string[] = [], empty: number[] = [];
    let length = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
      if (!text) empty.push(number);
      length += text.length;
      if (length > MAX_DOCUMENT_TEXT) throw new Error('This PDF has too much text. Use a shorter document or an excerpt.');
      pages.push(`Page ${number}\n${text || '[No readable text on this page]'}`);
      page.cleanup();
    }
    if (empty.length === pdf.numPages) throw new Error('This PDF has no readable text. Scanned PDFs need OCR, which is not connected in this preview.');
    return { text: pages.join('\n\n'), note: empty.length ? `Pages ${empty.join(', ')} have no readable text and may need OCR. Their contents were not extracted.` : `${pdf.numPages} ${pdf.numPages === 1 ? 'page' : 'pages'} read. Check the text order, especially for tables and columns.` };
  } catch (error) {
    if (error instanceof Error && /at most|too much|no readable text/.test(error.message)) throw error;
    throw new Error('Could not read this PDF. It may be damaged, password-protected, or too complex. Try an unprotected PDF or paste its text.');
  } finally { clearTimeout(timer); await loading.destroy(); }
}
