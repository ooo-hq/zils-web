'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,CheckCheck,Images,Upload} from 'lucide-react';
import {mapImageExamples,prepareImageTraining} from '@/lib/image-training';
import {imageDigest,imageQuestion} from '@/lib/images';
import {TeachingSubmission} from '@/components/teaching-submission';
import type {TrainingConfig} from '@/lib/training-config';
import {openTeachingImage,prepareImageTeachingDraft,readImageTeachingLabels,type TeachingImage} from '@/lib/teaching-images';
import s from './teach-by-example.module.css';

export function TeachingImages({onDocuments,config,locked=false,onLock}:{onDocuments:()=>void;config?:TrainingConfig|null;locked?:boolean;onLock:(locked:boolean)=>void}) {
  const [question,setQuestion]=useState(''),[answers,setAnswers]=useState('Normal\nDamaged');
  const [rows,setRows]=useState<TeachingImage[]>([]),[excluded,setExcluded]=useState<Record<string,boolean>>({});
  const [reviewed,setReviewed]=useState(false),[page,setPage]=useState(0);
  const [draft,setDraft]=useState<ReturnType<typeof prepareImageTeachingDraft>|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const urls=useRef<string[]>([]),operation=useRef<AbortController|null>(null);
  useEffect(()=>{const localUrls=urls.current;return()=>{operation.current?.abort();localUrls.forEach(url=>URL.revokeObjectURL(url));};},[]);
  const outcomes=answers.split('\n').map(answer=>answer.trim()).filter(Boolean);
  const included=rows.filter(row=>!excluded[row.id]);
  function changed(){setDraft(null);setReviewed(false);setError('');setNotice('');}
  async function choose(files:File[]) {
    if(operation.current || locked || !files.length)return;
    const controller=new AbortController();operation.current=controller;setBusy(true);setError('');setNotice('Reading photos locally…');
    const nextUrls:string[]=[];
    try {
      const photos=files.filter(file=>!file.webkitRelativePath || /\.(jpe?g|png)$/i.test(file.name));
      if(!photos.length || photos.length>120)throw new Error('Choose 1–120 JPEG or PNG photos for this local preview.');
      if(photos.reduce((sum,file)=>sum+file.size,0)>100*1024*1024)throw new Error('Keep the selected photos under 100 MiB in total.');
      const next:TeachingImage[]=[];
      for(const row of mapImageExamples(photos)) {
        controller.signal.throwIfAborted();
        const bitmap=await openTeachingImage(row.file);bitmap.close();
        const sha256=await imageDigest(row.file);controller.signal.throwIfAborted();
        if(next.some(photo=>photo.sha256===sha256))throw new Error(`“${row.filename}” repeats the same image. Keep one copy.`);
        const url=URL.createObjectURL(row.file);nextUrls.push(url);next.push({...row,sha256,url});
      }
      urls.current.splice(0).forEach(url=>URL.revokeObjectURL(url));urls.current.push(...nextUrls);
      setRows(next);setExcluded({});setPage(0);changed();setNotice(`${next.length} photos ready. Check their answers and item references.`);
    } catch(error) {nextUrls.forEach(url=>URL.revokeObjectURL(url));if(!controller.signal.aborted){setError(error instanceof Error?error.message:'Could not read these photos.');setNotice(rows.length?'Your previously selected photos are unchanged.':'No photos were added.');}}
    finally {if(!controller.signal.aborted){setBusy(false);operation.current=null;}}
  }
  async function labels(file?:File) {
    if(!file || operation.current || locked)return;
    const controller=new AbortController();operation.current=controller;setBusy(true);setError('');
    try {
      const mapped=await readImageTeachingLabels(rows.map(row=>row.file),file);controller.signal.throwIfAborted();
      setRows(previous=>previous.map(row=>({...row,...mapped.find(item=>item.filename===row.filename)})));changed();
      setNotice('Labels imported. Review them against the photos.');
    } catch(error) {if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Could not read these labels.');}
    finally {if(!controller.signal.aborted){setBusy(false);operation.current=null;}}
  }
  function prepare() {
    try {setDraft(prepareImageTeachingDraft(included,question,answers,reviewed));setError('');setNotice('Image draft prepared. No training job has started.');}
    catch(error){setError(error instanceof Error?error.message:'Check the photos and answers.');}
  }
  function download() {
    if(!draft)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='zils-image-teaching-draft.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice('Draft download requested. Keep your original photos; the draft contains references, not image files.');
  }
  return <section aria-label="Image teaching" aria-busy={busy}>
    <div className={s.progressLine}><span>Image training</span><span>Imajev · Review before uploading</span></div>
    <h1>Show the model what to look for.</h1>
    <p className={s.intro}>Bring photos and their correct answers. Teach a visual decision, such as whether an item is normal or damaged.</p>
    {config && !locked && <p className={s.intro}><Link href="/train?setup=bulk" className={s.textButton}>Import labeled photos</Link> for larger batches with a labels CSV.</p>}
    <fieldset disabled={busy||locked}>
      <div className={s.pairFields}><div><label htmlFor="image-teaching-question">What should the model decide?</label><textarea id="image-teaching-question" rows={3} maxLength={3000} placeholder="Is this package normal or damaged?" value={question} onChange={event=>{setQuestion(event.target.value);changed();}} /></div><div><label htmlFor="image-teaching-answers">Possible answers</label><textarea id="image-teaching-answers" rows={3} maxLength={1616} value={answers} onChange={event=>{setAnswers(event.target.value);changed();}} /><p className={s.hint}>One answer per line. Use 2–16 different answers.</p></div></div>
      <div className={s.dropzone} data-loaded={Boolean(rows.length)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();void choose(Array.from(event.dataTransfer.files));}}>
        <Images size={26}/><strong>{rows.length?'Replace selected photos':'Bring your photos'}</strong><p>Choose multiple JPEG/PNG images, or a folder named after each answer.</p>
        <div className={s.photoPickers}><label className={s.secondary} htmlFor="teaching-photos"><Upload size={15}/>Choose photos</label><input id="teaching-photos" className={s.fileInput} type="file" accept="image/jpeg,image/png" multiple onChange={event=>{void choose(Array.from(event.target.files||[]));event.target.value='';}} /><label className={s.secondary} htmlFor="teaching-photo-folder">Choose folders</label><input id="teaching-photo-folder" className={s.fileInput} type="file" multiple {...{webkitdirectory:''}} onChange={event=>{void choose(Array.from(event.target.files||[]));event.target.value='';}} /></div>
        <small>120 photos · 10 MiB each · 100 MiB total · Up to 24 megapixels / 8,192px per side</small>
      </div>
      <button type="button" className={s.documentEntry} onClick={onDocuments}><Images size={19}/><span><strong>Need the text inside an image?</strong><small>Read a photographed document or scanned PDF with OCR.</small></span><ArrowRight size={17}/></button>
      {rows.length>0 && <>
        <details className={s.details}><summary>Already have image labels?</summary><label htmlFor="teaching-image-labels">Import image labels</label><input id="teaching-image-labels" type="file" accept=".csv,.xlsx,.json,.jsonl,.ndjson" onChange={event=>{void labels(event.target.files?.[0]);event.target.value='';}}/><p className={s.hint}>CSV, Excel, JSON, or JSONL up to 1 MiB. Use filename, answer, and an optional group field. Folder names can also supply labels. Filenames and labels are never model inputs.</p><pre className={s.formatExample}>filename,answer,group{'\n'}photo-01.jpg,Normal,item-01{'\n'}photo-02.jpg,Damaged,item-02</pre></details>
        <div className={s.documentHeading}><h2>Review your photos</h2><span>{included.length} of {rows.length} included</span></div>
        <p className={s.hint}>Check each answer. Give different photos of the same item the same reference so they stay together during testing.</p>
        <div className={s.photoGrid}>{rows.slice(page*12,page*12+12).map(row=><article className={s.photoCard} key={row.id}>
          <div className={s.photoPreview}><Image src={row.url} alt={`Review ${row.filename}`} fill sizes="(max-width: 540px) 100vw, 420px" unoptimized /></div><strong>{row.filename}</strong>
          <label htmlFor={`label-${row.id}`}>Correct answer</label><select id={`label-${row.id}`} aria-label={`Answer for ${row.filename}`} value={row.label} onChange={event=>{setRows(previous=>previous.map(photo=>photo.id===row.id?{...photo,label:event.target.value}:photo));changed();}}><option value="">Choose an answer</option>{row.label&&!outcomes.includes(row.label)&&<option value={row.label}>Update: {row.label}</option>}{[...new Set(outcomes)].map(answer=><option key={answer}>{answer}</option>)}</select>
          <label htmlFor={`group-${row.id}`}>Item reference</label><input id={`group-${row.id}`} aria-label={`Item reference for ${row.filename}`} maxLength={200} value={row.groupId} onChange={event=>{setRows(previous=>previous.map(photo=>photo.id===row.id?{...photo,groupId:event.target.value}:photo));changed();}}/>
          <label className={s.checkLabel}><input type="checkbox" checked={!excluded[row.id]} onChange={event=>{setExcluded(previous=>({...previous,[row.id]:!event.target.checked}));changed();}}/>Include {row.filename}</label>
        </article>)}</div>
        {rows.length>12&&<div className={s.actions}><button type="button" className={s.secondary} disabled={!page} onClick={()=>setPage(page-1)}>Previous photos</button><span className={s.hint}>Page {page+1} of {Math.ceil(rows.length/12)}</span><button type="button" className={s.secondary} disabled={(page+1)*12>=rows.length} onClick={()=>setPage(page+1)}>Next photos</button></div>}
        <label className={s.checkLabel}><input type="checkbox" checked={reviewed} onChange={event=>{setReviewed(event.target.checked);setDraft(null);}}/>I checked the included photos, answers, and item references.</label>
        <div className={s.actions}><span className={s.hint}>All photos stay in this tab.</span><button type="button" className={s.primary} onClick={prepare}>Preview image splits<ArrowRight size={16}/></button></div>
      </>}
    </fieldset>
    {error&&<p role="alert" className={s.error}>{error}</p>}<p role="status" className={s.hint}>{notice}</p>
    {draft&&<section className={s.preparedReview} aria-label="Image draft review"><div className={s.ready}><CheckCheck size={21}/><div><strong>Your image draft is ready.</strong><p>Photos of the same item stay together. Each split includes every answer.</p></div></div><div className={s.splitOverview}>{(['train','calibration','test'] as const).map(split=><div key={split}><strong>{draft.counts[split]}</strong><span>{split==='train'?'Training':split==='test'?'Evaluation':'Calibration'} photos</span></div>)}</div>
      <TeachingSubmission config={config} onLock={onLock} imageAnswers={outcomes} prepare={async()=>{
        prepareImageTeachingDraft(included,question,answers,reviewed);
        const decision=imageQuestion(question,answers);
        return {kind:'image',question:decision,prepared:prepareImageTraining(included,decision,outcomes,'image-split-v1')};
      }}/>
      <p className={s.hint}>Keep your original photos for upload recovery. Downloaded drafts contain labels and references, not image bytes.</p>
      <button type="button" className={s.secondary} onClick={download}>Download image draft</button><details className={s.details}><summary>View or copy the image draft</summary><label htmlFor="image-draft-json">Image draft JSON</label><textarea id="image-draft-json" rows={10} readOnly value={JSON.stringify(draft,null,2)}/></details>
    </section>}
  </section>;
}
