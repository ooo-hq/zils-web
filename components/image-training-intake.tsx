'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { mapImageExamples, prepareImageTraining, uploadImageTraining, type ImageExample, type ImageDraft, type PreparedImageTraining } from '@/lib/image-training';
import { imageQuestion, type imageApi, type ImageModels } from '@/lib/images';
import { type trainingApi, type Job } from '@/lib/training';
import styles from '@/app/(home)/train/train.module.css';
import photoStyles from './image-training-intake.module.css';

type Props={owner:string;token:()=>Promise<string>;trainingApi:ReturnType<typeof trainingApi>;imageApi:ReturnType<typeof imageApi>;profile:NonNullable<ImageModels['training_profile']>;resumeJob?:Job;onSubmitted:(job:Job)=>void};
export function ImageTrainingIntake(props:Props){return <Intake key={props.owner} {...props}/>;}
function Intake({trainingApi:training,imageApi:images,profile,resumeJob,onSubmitted}:Props){
  const [open,setOpen]=useState(false),[rows,setRows]=useState<ImageExample[]>([]),[excluded,setExcluded]=useState<Record<string,boolean>>({});
  const [previews,setPreviews]=useState<Record<string,string>>({}),[problems,setProblems]=useState<Record<string,string>>({}),[page,setPage]=useState(0);
  const [question,setQuestion]=useState(''),[answers,setAnswers]=useState('Normal\nDamaged'),[name,setName]=useState('inspection');
  const [reviewed,setReviewed]=useState(false),[consent,setConsent]=useState(false),[prepared,setPrepared]=useState<PreparedImageTraining|null>(null);
  const [positive,setPositive]=useState(''),[recall,setRecall]=useState('95'),[alarms,setAlarms]=useState('20'),[accuracy,setAccuracy]=useState('80'),[improvement,setImprovement]=useState('0.01');
  const [savedJob,setSavedJob]=useState<Job>();
  const [busy,setBusy]=useState(false),[frozen,setFrozen]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(''),[submitted,setSubmitted]=useState(false);
  const draft=useRef<ImageDraft>({assets:{}}),operation=useRef<AbortController|null>(null),urls=useRef<string[]>([]),life=useRef({active:true});
  const locked=busy||frozen;
  const outcomes=answers.split('\n').map(s=>s.trim()).filter(Boolean);
  useEffect(()=>{const state=life.current;state.active=true;const localUrls=urls.current;return()=>{state.active=false;operation.current?.abort();localUrls.forEach(url=>URL.revokeObjectURL(url));};},[]);
  function changed(){setPrepared(null);setReviewed(false);setConsent(false);setError('');}
  async function choose(files:FileList|null){
    if(!files||locked)return;changed();setBusy(true);setPage(0);setRows([]);setExcluded({});
    urls.current.splice(0).forEach(url=>URL.revokeObjectURL(url));setPreviews({});setProblems({});
    try{
      if(files.length>profile.max_train+profile.max_calibration+profile.max_test)throw new Error('Choose fewer photos for this run.');
      const next=mapImageExamples(Array.from(files)),bad:Record<string,string>={},thumbs:Record<string,string>={};
      for(const row of next){
        if(!life.current.active)return;
        if(!['image/jpeg','image/png'].includes(row.file.type)||row.file.size>profile.max_source_bytes){bad[row.id]='Use a JPEG or PNG up to 10 MB.';continue;}
        try{const bitmap=await createImageBitmap(row.file);const valid=bitmap.width<=profile.max_edge&&bitmap.height<=profile.max_edge&&bitmap.width*bitmap.height<=profile.max_pixels;bitmap.close();if(!valid)throw new Error('Photo exceeds the pixel limit.');}
        catch{bad[row.id]='This photo cannot be read or exceeds the pixel limit.';continue;}
        if(!life.current.active)return;
        const url=URL.createObjectURL(row.file);urls.current.push(url);thumbs[row.id]=url;
      }
      if(life.current.active){setRows(next);setPreviews(thumbs);setProblems(bad);}
    }catch(error){if(life.current.active)setError(error instanceof Error?error.message:'Photos could not be read.');}
    finally{if(life.current.active)setBusy(false);}
  }
  async function labels(file:File|undefined){
    if(!file||locked)return;changed();setBusy(true);
    try{if(file.size>1024*1024)throw new Error('Use a labels CSV up to 1 MB.');const next=mapImageExamples(rows.map(r=>r.file),await file.text());if(life.current.active)setRows(next);}
    catch(error){if(life.current.active)setError(error instanceof Error?error.message:'Labels could not be read.');}
    finally{if(life.current.active)setBusy(false);}
  }
  function review(){
    setError('');
    try{
      if(!reviewed)throw new Error('Review the answers and confirm which photos show the same item.');
      const included=rows.filter(row=>!excluded[row.id]);
      if(included.some(row=>problems[row.id]))throw new Error('Replace or leave out unreadable photos before continuing.');
      const decision=imageQuestion(question,answers);if(!question.trim())throw new Error('Describe the image decision.');
      const data=prepareImageTraining(included,decision,outcomes,resumeJob?.image_intake?.seed||'image-split-v1');
      for(const split of ['train','calibration','test'] as const)if(data.counts[split]>profile[`max_${split}`])throw new Error(`${split} exceeds the available photo limit.`);
      setPrepared(data);setConsent(false);
    }catch(error){setError(error instanceof Error?error.message:'Check the photos and answers.');}
  }
  async function submit(){
    if(!prepared||busy)return;setError('');setSubmitted(false);
    if(!consent){setError('Confirm permission to share the training photos.');return;}
    if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)){setError('Use a run name with 1–64 lowercase letters, numbers or hyphens.');return;}
    if([accuracy,improvement,...(outcomes.length===2?[recall,alarms]:[])].some(value=>!value.trim())){setError('Enter each required quality target.');return;}
    const decision=imageQuestion(question,answers),binary=outcomes.length===2;
    if(binary&&!outcomes.includes(positive)){setError('Choose the positive class for your quality targets.');return;}
    const acceptance={min_accuracy:Number(accuracy)/100,min_brier_improvement:Number(improvement),...(binary?{positive_class:positive,min_positive_recall:Number(recall)/100,max_false_positive_rate:Number(alarms)/100}:{})};
    if(Object.entries(acceptance).some(([k,v])=>typeof v==='number'&&(!Number.isFinite(v)||v<0||v>(k==='min_brier_improvement'?2:1)))){setError('Use percentages between 0 and 100, and a Brier improvement from 0 to 2.');return;}
    const controller=new AbortController();operation.current=controller;setBusy(true);
    if(!draft.current.job&&resumeJob)draft.current.job=resumeJob;
    try{
      const job=await uploadImageTraining(prepared,decision,{name,acceptance,allow_training_data_export:true},training,images,draft.current,controller.signal,text=>{if(!controller.signal.aborted){setProgress(text);setFrozen(Boolean(draft.current.job));setSavedJob(draft.current.job);}});
      if(!controller.signal.aborted){onSubmitted(job);setSubmitted(true);setProgress('');setFrozen(true);}
    }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Upload interrupted. Retry to resume missing photos.');}
    finally{if(life.current.active){setBusy(false);setFrozen(Boolean(draft.current.job));setSavedJob(draft.current.job);}operation.current=null;}
  }
  async function reset(){
    setBusy(true);setError('');try{const job=draft.current.job||resumeJob;if(job?.status==='uploading'){const result=await training.cancel(job.id);onSubmitted(result.job);}draft.current={assets:{}};setSavedJob(undefined);setFrozen(false);setSubmitted(false);setPrepared(null);setReviewed(false);setConsent(false);setProgress('');}catch(error){setError(error instanceof Error?error.message:'Could not cancel the previous draft.');}finally{if(life.current.active)setBusy(false);}
  }
  return <section className={photoStyles.intake}>
    <button className={styles.button} onClick={()=>setOpen(value=>!value)} aria-expanded={open}>Train on my images</button>
    <div hidden={!open} className={photoStyles.body}>
      <h2>Teach an image decision.</h2><p>Review photos and answers. Related views of one item must use the same item reference.</p>
      {resumeJob&&!savedJob&&<p>A saved image draft is available. Choose its original photos, labels and settings to resume it.</p>}
      <fieldset disabled={locked} className={photoStyles.fields}>
        <label>Run name<input value={name} onChange={e=>{setName(e.target.value);changed();}} pattern="[a-z0-9][a-z0-9-]{0,63}"/></label>
        <label>Image training decision<textarea aria-label="Image training decision" value={question} onChange={e=>{setQuestion(e.target.value);changed();}} rows={2}/></label>
        <label>Image training answers<textarea aria-label="Image training answers" value={answers} onChange={e=>{setAnswers(e.target.value);changed();}} rows={2}/></label>
        <label>Training photos<input type="file" multiple accept="image/jpeg,image/png" onChange={e=>void choose(e.target.files)}/></label>
        <label>Labelled folders<input type="file" multiple {...{webkitdirectory:''}} onChange={e=>void choose(e.target.files)}/></label>
        <label>Image labels CSV<input type="file" accept=".csv,text/csv" disabled={!rows.length} onChange={e=>void labels(e.target.files?.[0])}/></label>
      </fieldset>
      <p>CSV columns: filename, answer, and optional group. Folder names can suggest answers. They are never given to the model.</p>
      {rows.length>0&&<><p>{rows.filter(row=>!excluded[row.id]).length} included photos. Each photo is private.</p>
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Image label review"><table className={photoStyles.reviewTable}><thead><tr><th>Photo</th><th>Answer</th><th>Item reference</th><th>Include</th></tr></thead><tbody>{rows.slice(page*20,page*20+20).map(row=><tr key={row.id}><th>{previews[row.id]&&<Image src={previews[row.id]} alt="" width={56} height={56} unoptimized/>}<span>{row.filename}</span>{problems[row.id]&&<p>{problems[row.id]}</p>}</th><td><select aria-label={`Answer for ${row.filename}`} value={row.label} disabled={locked} onChange={e=>{setRows(old=>old.map(r=>r.id===row.id?{...r,label:e.target.value}:r));changed();}}><option value="">Choose answer</option>{outcomes.map(value=><option key={value}>{value}</option>)}</select></td><td><input aria-label={`Item reference for ${row.filename}`} value={row.groupId} disabled={locked} onChange={e=>{setRows(old=>old.map(r=>r.id===row.id?{...r,groupId:e.target.value}:r));changed();}}/></td><td><input type="checkbox" aria-label={`Include ${row.filename}`} checked={!excluded[row.id]} disabled={locked} onChange={e=>{setExcluded(old=>({...old,[row.id]:!e.target.checked}));changed();}}/></td></tr>)}</tbody></table></div>
        {rows.length>20&&<div className={styles.actions}><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous photos</button><span>Page {page+1} of {Math.ceil(rows.length/20)}</span><button disabled={(page+1)*20>=rows.length} onClick={()=>setPage(p=>p+1)}>Next photos</button></div>}
        <label className={photoStyles.check}><input type="checkbox" checked={reviewed} disabled={locked} onChange={e=>setReviewed(e.target.checked)}/>I have reviewed the labels and item groups</label>
        <button className={styles.secondary} disabled={locked} onClick={review}>Review image splits</button></>}
      {prepared&&<div className={photoStyles.ready}><h3>Review the experiment.</h3><p>{prepared.counts.train} training · {prepared.counts.calibration} calibration · {prepared.counts.test} evaluation photos. Whole items stay together.</p>
        <div className={styles.tableWrap}><table><thead><tr><th>Answer</th><th>Training</th><th>Calibration</th><th>Evaluation</th></tr></thead><tbody>{prepared.distribution.map(row=><tr key={row.outcome}><th>{row.outcome}</th><td>{row.train}</td><td>{row.calibration}</td><td>{row.test}</td></tr>)}</tbody></table></div>
        <fieldset disabled={locked} className={photoStyles.fields}>{outcomes.length===2&&<><label>Positive class<select aria-label="Positive class" value={positive} onChange={e=>setPositive(e.target.value)}><option value="">Choose the outcome you need to detect</option>{outcomes.map(v=><option key={v}>{v}</option>)}</select></label><label>Minimum positive recall (%)<input type="number" min="0" max="100" value={recall} onChange={e=>setRecall(e.target.value)}/></label><label>Maximum false alarms (%)<input type="number" min="0" max="100" value={alarms} onChange={e=>setAlarms(e.target.value)}/></label></>}
          <label>Minimum accuracy (%)<input type="number" min="0" max="100" value={accuracy} onChange={e=>setAccuracy(e.target.value)}/></label><label>Minimum Brier improvement<input type="number" min="0" max="2" step="0.01" value={improvement} onChange={e=>setImprovement(e.target.value)}/></label></fieldset>
        <p>Only training photos go to approved workers. Calibration and evaluation photos stay private to evaluation. Draft uploads expire after 24 hours; submitted photos are retained until 30 days after the run finishes.</p>
        {(savedJob?.data_expires_at||resumeJob?.data_expires_at)&&<p>Current draft expires: {new Date((savedJob?.data_expires_at||resumeJob?.data_expires_at)!).toLocaleString()}.</p>}
        <label className={photoStyles.check}><input type="checkbox" checked={consent} disabled={busy||submitted} onChange={e=>setConsent(e.target.checked)}/>I have permission to share training images with approved workers</label>
        {!submitted&&<button className={styles.button} disabled={busy||!consent} onClick={()=>void submit()}>{busy?'Uploading…':frozen?'Resume missing image uploads':'Start image training'}</button>}
      </div>}
      {busy&&<button className={styles.secondary} onClick={()=>{operation.current?.abort();setProgress('Upload stopped. Completed photos remain saved.');}}>Stop image upload</button>}
      {frozen&&<button className={styles.secondary} disabled={busy} onClick={()=>void reset()}>Start a new run</button>}
      {progress&&<p role="status">{progress}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}{submitted&&<p role="status">Image run submitted for validation.</p>}
    </div>
  </section>;
}
