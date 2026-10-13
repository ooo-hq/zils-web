import type {Worker as OcrWorker} from 'tesseract.js';
import {openTeachingImage} from './teaching-images';
import {MAX_DOCUMENT_TEXT} from './teaching-documents';

export type OcrProgress = (message:string) => void;
export async function withTeachingOcr<T>(task:(recognize:(canvas:HTMLCanvasElement)=>Promise<string>)=>Promise<T>, signal:AbortSignal, progress:OcrProgress):Promise<T> {
  let worker:OcrWorker|undefined;
  let stop:(error:unknown)=>void=()=>{};
  const stopped=new Promise<never>((_,reject)=>{stop=reject;});
  const abort=()=>{stop(signal.reason);void worker?.terminate();};
  signal.throwIfAborted(); signal.addEventListener('abort',abort,{once:true});
  try {
    return await Promise.race([task(async canvas=>{
      signal.throwIfAborted();
      if(!worker) {
        progress('Loading English OCR locally…');
        const {createWorker}=await import('tesseract.js');
        signal.throwIfAborted();
        // Keep the worker, engine, and language data on this origin; documents never go to an OCR service.
        worker=await createWorker('eng',1,{workerPath:'/_ocr/worker.min.js',corePath:'/_ocr',langPath:'/_ocr',workerBlobURL:false,
          logger:message=>{if(!signal.aborted && message.status==='recognizing text')progress(`Reading text… ${Math.round(message.progress*100)}%`);},
          errorHandler:()=>stop(new Error('OCR could not read this image. Try a clearer scan or paste its text.'))});
        if(signal.aborted){await worker.terminate();signal.throwIfAborted();}
      }
      const result=await worker.recognize(canvas,{rotateAuto:true});
      signal.throwIfAborted();
      const text=result.data.text.trim();
      if(text.length>MAX_DOCUMENT_TEXT)throw new Error('This scan has too much text. Use a shorter document.');
      return text;
    }),stopped]);
  } finally {signal.removeEventListener('abort',abort);await worker?.terminate();}
}

export async function readTeachingScan(file:File,signal:AbortSignal,progress:OcrProgress) {
  const bitmap=await openTeachingImage(file);
  const canvas=document.createElement('canvas');
  try {
    const scale=Math.min(1,3000/Math.max(bitmap.width,bitmap.height));
    canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const context=canvas.getContext('2d');if(!context)throw new Error('Your browser cannot read this image.');
    context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const text=await withTeachingOcr(recognize=>recognize(canvas),signal,progress);
    if(!text)throw new Error('No text was found in this image. Try a sharper scan or paste the text.');
    return {text,note:'English OCR from an image. Check every value against the original; OCR can misread letters and numbers.'};
  } finally {bitmap.close();canvas.width=canvas.height=0;}
}
