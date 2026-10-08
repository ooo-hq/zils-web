import { imageDigest, imageQuestionSchema, type ImageQuestion, type imageApi } from './images';
import { parseCsv, splitGroups } from './training-csv';
import { SPLITS, type Split, type ImageSubmission, type Job, type trainingApi } from './training';

export type ImageExample = { id: string; filename: string; file: File; label: string; groupId: string; state: Record<string, unknown> };
export type PreparedImageTraining = { splits: Record<Split, ImageExample[]>; counts: Record<Split, number>; distribution: {outcome: string; train: number; calibration: number; test: number}[]; seed: string; proportions: Record<Split, number> };
export type ImageDraft = { job?: Job; assets: Record<string, string> };
// This seed only orders groups; it is not used for cryptography or image identity.
function orderKey(value: string) { let n=2166136261; for(const c of value) {n ^= c.charCodeAt(0); n=Math.imul(n,16777619);} return (n>>>0).toString(16).padStart(8,'0'); }
export function mapImageExamples(files: File[], csv?: string): ImageExample[] {
  files = [...files].sort((a,b)=>(a.webkitRelativePath||a.name).localeCompare(b.webkitRelativePath||b.name));
  const paths = files.map(file => file.webkitRelativePath || file.name);
  if (new Set(paths).size !== paths.length) throw new Error('Duplicate filenames are ambiguous. Choose folders with relative paths or rename the files.');
  const rows = files.map((file, i) => ({ id: `image-${i}`, filename: paths[i], file, label: paths[i].split('/').at(-2) || '', groupId: paths[i], state: {} }));
  if (!csv) return rows;
  const table=parseCsv(csv), filename=table.headers.indexOf('filename'), answer=table.headers.indexOf('answer'), group=table.headers.indexOf('group');
  if(filename<0 || answer<0) throw new Error('The label CSV needs filename and answer columns; group is optional.');
  rows.forEach(row=>{ row.label=''; });
  const mapped=new Set<number>();
  for(const cells of table.rows) {
    const name=cells[filename], matches=paths.flatMap((path,i)=>path===name || !name.includes('/') && path.split('/').at(-1)===name ? [i] : []);
    if(matches.length!==1) throw new Error(`“${name}” is ${matches.length ? 'ambiguous; use its full relative path' : 'not among the selected photos'}.`);
    const index=matches[0];if(mapped.has(index)) throw new Error(`“${name}” has more than one CSV label.`);mapped.add(index);
    rows[index].label=cells[answer];rows[index].groupId=group>=0 && cells[group] ? cells[group] : paths[index];
  }
  return rows;
}
export function prepareImageTraining(examples: ImageExample[], question: object, outcomes: string[], seed: string): PreparedImageTraining {
  const parsed=imageQuestionSchema.safeParse(question);
  if(!parsed.success || JSON.stringify(Object.keys(parsed.data.criteria))!==JSON.stringify(outcomes)) throw new Error('Use one image question with 2–16 different answers.');
  if(!seed || seed.length>100 || !examples.length || examples.length>1792) throw new Error('Choose up to 1,792 reviewed photos.');
  const ids=new Set<string>(), groups=new Map<string,{id:string;rows:ImageExample[];labels:Set<string>}>();
  for(const row of examples) {
    if(!outcomes.includes(row.label)) throw new Error(`Choose an answer for “${row.filename}”, or leave that photo out.`);
    if(!row.groupId.trim()) throw new Error('Every photo needs an item reference.');
    if(ids.has(row.id)) throw new Error('Photo IDs must be unique.');ids.add(row.id);
    if(!['image/jpeg','image/png'].includes(row.file.type) || !row.file.size || row.file.size>10*1024*1024) throw new Error(`“${row.filename}” must be a JPEG or PNG up to 10 MB.`);
    const key=orderKey(seed+'\0'+row.groupId)+'-'+row.groupId, group=groups.get(key)||{id:key,rows:[],labels:new Set<string>()};group.rows.push(row);group.labels.add(row.label);groups.set(key,group);
  }
  const splits=splitGroups([...groups.values()],outcomes), limits={train:1024,calibration:256,test:512};
  const counts=Object.fromEntries(SPLITS.map(split=>[split,splits[split].length])) as Record<Split,number>;
  for(const split of SPLITS) if(counts[split]>limits[split]) throw new Error(`${split} exceeds its ${limits[split]}-photo limit. Use fewer photos.`);
  return {splits,counts,seed,proportions:Object.fromEntries(SPLITS.map(s=>[s,counts[s]/examples.length])) as Record<Split,number>,distribution:outcomes.map(outcome=>({outcome,train:splits.train.filter(r=>r.label===outcome).length,calibration:splits.calibration.filter(r=>r.label===outcome).length,test:splits.test.filter(r=>r.label===outcome).length}))};
}
async function twoAtATime<T>(rows: T[], operation: (row:T)=>Promise<void>, signal?:AbortSignal) {
  let next=0; let failure:unknown;
  await Promise.all(Array.from({length:2},async()=>{while(next<rows.length && !failure){const row=rows[next++];try{signal?.throwIfAborted();await operation(row);}catch(error){failure=error;}}}));
  if(failure) throw failure;
}
async function hashes(prepared:PreparedImageTraining, signal?:AbortSignal) {
  const result:Record<string,string>={};await twoAtATime(SPLITS.flatMap(s=>prepared.splits[s]),async row=>{result[row.id]=await imageDigest(row.file);},signal);return result;
}
async function fingerprint(prepared:PreparedImageTraining, question:ImageQuestion, digests:Record<string,string>) {
  return imageDigest(new Blob([JSON.stringify({question,seed:prepared.seed,splits:Object.fromEntries(SPLITS.map(s=>[s,prepared.splits[s].map(row=>({id:row.id,filename:row.filename,label:row.label,group:row.groupId,state:row.state,sha256:digests[row.id]}))]))})]));
}
export async function imageDraftFingerprint(prepared:PreparedImageTraining, question:ImageQuestion) {return fingerprint(prepared,question,await hashes(prepared));}
export async function uploadImageTraining(prepared:PreparedImageTraining, question:ImageQuestion, input:Omit<ImageSubmission,'model'|'image_intake'>, training:ReturnType<typeof trainingApi>, images:ReturnType<typeof imageApi>, draft:ImageDraft, signal?:AbortSignal, progress:(text:string)=>void=()=>{}):Promise<Job> {
  const digests=await hashes(prepared,signal), snapshot=await fingerprint(prepared,question,digests);signal?.throwIfAborted();
  if(draft.job && draft.job.image_intake?.snapshot_sha256!==snapshot) throw new Error('These photos, labels or settings changed. Start a new run.');
  if(draft.job?.acceptance && JSON.stringify(Object.entries(draft.job.acceptance).sort()) !== JSON.stringify(Object.entries(input.acceptance || {}).sort())) throw new Error('Quality targets changed. Restore the saved targets or start a new run.');
  if(!draft.job) {progress('Saving your reviewed training plan…');const created=await training.createImage({...input,model:'imajev-4b-v1',image_intake:{version:'zils-image-intake/v1',seed:prepared.seed,snapshot_sha256:snapshot}},signal);draft.job=created.job;}
  const job=draft.job;
  const previous=await training.imageAssets(job.id,signal);
  const rows=SPLITS.flatMap(s=>prepared.splits[s]);
  for(const row of rows) {const old=previous.assets.find(a=>a.filename===row.filename && a.source_sha256===digests[row.id]);if(old) draft.assets[row.id]=old.id;}
  let done=0;
  await twoAtATime(rows,async row=>{
    let assetId=draft.assets[row.id];
    if(!assetId) {const slot=await images.createAsset({purpose:'training',job_id:job.id,filename:row.filename,source_bytes:row.file.size,source_sha256:digests[row.id]},signal);assetId=slot.asset.id;draft.assets[row.id]=assetId;await images.upload(slot.upload,row.file,signal);}
    else {const slot=await images.resumeAsset(assetId,signal);if(!slot.uploaded) {if(!slot.upload) throw new Error('Photo is still being checked. Retry shortly.');await images.upload(slot.upload,row.file,signal);}}
    const verified=await images.completeAsset(assetId,signal);if(verified.state!=='ready') throw new Error('Photo is still being checked. Retry shortly.');
    progress(`Checked ${++done} of ${rows.length} photos…`);
  },signal);
  const {uploads}=await training.resume(job.id,signal);
  for(const split of SPLITS) {
    const slot=uploads[split];if('uploaded' in slot) continue;
    const data=prepared.splits[split].map(row=>({id:row.id,group_id:row.groupId,family:'image-classification',state:row.state,question,label:row.label,image:{asset_id:draft.assets[row.id]}}));
    await training.upload(split,slot,new Blob([data.map(row=>JSON.stringify(row)).join('\n')+'\n'],{type:'application/x-ndjson'}),signal);
  }
  progress('Submitting for validation…');const submitted=(await training.submit(job.id,signal)).job;draft.job=submitted;return submitted;
}
