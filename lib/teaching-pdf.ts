import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import {MAX_DOCUMENT_TEXT,checkDocumentFile} from './teaching-documents';
import {withTeachingOcr,type OcrProgress} from './teaching-ocr';

GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();

export async function readTeachingPdf(file:File, signal:AbortSignal, progress:OcrProgress, forceOcr=false):Promise<{text:string;note:string}> {
  checkDocumentFile(file);signal.throwIfAborted();
  const loading=getDocument({data:new Uint8Array(await file.arrayBuffer()),useWorkerFetch:false,useSystemFonts:true,disableFontFace:true,stopAtErrors:true});
  loading.onPassword=()=>{void loading.destroy();};
  const abort=()=>{void loading.destroy();};signal.addEventListener('abort',abort,{once:true});
  try {
    return await withTeachingOcr(async recognize=>{
      const pdf=await loading.promise;
      if(pdf.numPages>50 || forceOcr && pdf.numPages>10)throw new Error(forceOcr?'Use a PDF with at most 10 pages for full-page OCR.':'Use a PDF with at most 50 pages.');
      const pages:string[]=[],empty:number[]=[],scanned:number[]=[];let length=0;
      for(let number=1;number<=pdf.numPages;number++) {
        signal.throwIfAborted();progress(`Reading page ${number} of ${pdf.numPages}…`);
        const page=await pdf.getPage(number);
        try {
          const content=await page.getTextContent();
          let text=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('').trim();
          if(!text || forceOcr) {
            if(scanned.length>=10)throw new Error('Use a PDF with at most 10 scanned pages for OCR.');
            scanned.push(number);
            const original=page.getViewport({scale:1}),scale=Math.min(2,3000/Math.max(original.width,original.height));
            const viewport=page.getViewport({scale}),canvas=document.createElement('canvas');
            canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
            const context=canvas.getContext('2d');if(!context)throw new Error('Your browser cannot read scanned PDFs.');
            try {
              await page.render({canvas,canvasContext:context,viewport,background:'white'}).promise;
              text=await recognize(canvas);
            } finally {canvas.width=canvas.height=0;}
          }
          if(!text)empty.push(number);
          length+=text.length;if(length>MAX_DOCUMENT_TEXT)throw new Error('This PDF has too much text. Use a shorter document or an excerpt.');
          pages.push(`Page ${number}\n${text||'[No readable text on this page]'}`);
        } finally {page.cleanup();}
      }
      if(empty.length===pdf.numPages)throw new Error('No text was found, even with OCR. Try a sharper scan or paste the text.');
      return {text:pages.join('\n\n'),note:[`${pdf.numPages} ${pdf.numPages===1?'page':'pages'} read.`,scanned.length?`English OCR used on pages ${scanned.join(', ')}. Check every value against the original.`:'Check text order, especially tables and columns. Use full-page OCR if scanned content is missing.',empty.length?`No text found on pages ${empty.join(', ')}.`:''].filter(Boolean).join(' ')};
    },signal,progress);
  } catch(error) {
    signal.throwIfAborted();
    if(error instanceof Error && /at most|too much|No text|OCR|browser/.test(error.message))throw error;
    throw new Error('Could not read this PDF. It may be damaged or password-protected. Try an unprotected PDF or paste its text.');
  } finally {signal.removeEventListener('abort',abort);await loading.destroy();}
}
