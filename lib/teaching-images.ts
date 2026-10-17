import {mapImageExamples,prepareImageTraining, type ImageExample} from './image-training';
import {readSpreadsheet} from './training-spreadsheet';
import {imageQuestion} from './images';
import {SPLITS} from './training';

export type TeachingImage = ImageExample & {sha256:string; url:string};
export async function readImageTeachingLabels(files:File[], labels:File) {
  if(labels.size>1024*1024)throw new Error('Choose image labels up to 1 MiB.');
  const sheets=await readSpreadsheet(labels);
  const matches=sheets.filter(sheet=>sheet.data?.headers.includes('filename') && sheet.data.headers.includes('answer'));
  if(matches.length!==1)throw new Error(sheets.find(sheet=>sheet.error)?.error || 'Use one sheet or record list with filename, answer, and optional group fields.');
  return mapImageExamples(files,matches[0].data!);
}
export function checkTeachingImage(file:File) {
  if (!['image/jpeg','image/png'].includes(file.type) || !file.size || file.size > 10*1024*1024) throw new Error('Choose a non-empty JPEG or PNG up to 10 MiB.');
}
export async function openTeachingImage(file:File) {
  checkTeachingImage(file);
  let image:ImageBitmap;
  try { image=await createImageBitmap(file); } catch { throw new Error('This image cannot be read. Export it as JPEG or PNG and try again.'); }
  if (image.width>8192 || image.height>8192 || image.width*image.height>24_000_000) { image.close(); throw new Error('Use an image up to 24 megapixels and 8,192 pixels on either side.'); }
  return image;
}
export function prepareImageTeachingDraft(rows:TeachingImage[], instructions:string, answers:string, reviewed:boolean) {
  if (!reviewed) throw new Error('Review the image labels and item groups first.');
  if (!instructions.trim() || instructions.length>3000) throw new Error('Describe the image decision in 1–3,000 characters.');
  if (new Set(rows.map(row=>row.sha256)).size!==rows.length) throw new Error('The same image is included more than once. Keep one copy before preparing the draft.');
  const question=imageQuestion(instructions,answers);
  const prepared=prepareImageTraining(rows,question,Object.keys(question.criteria),'image-split-v1');
  return {version:1,previewOnly:true,imagesIncluded:false,question,
    counts:{total:rows.length,...prepared.counts}, distribution:prepared.distribution,
    splits:Object.fromEntries(SPLITS.map(split=>[split,prepared.splits[split].map(row=>({id:row.id,filename:row.filename,group_id:row.groupId,label:row.label,state:row.state,sha256:rows.find(photo=>photo.id===row.id)!.sha256}))]))};
}
