import { notFound } from 'next/navigation';
import { handleTurn } from '../../../(home)/dev-preview/train-chat/setup-server';

// Dev-preview only, like the train-chat page it serves: absent unless ZILS_DEV_PREVIEW=1.
export const runtime = 'nodejs';
export const maxDuration = 45;
export async function POST(request: Request) {
  if (process.env.ZILS_DEV_PREVIEW !== '1') notFound();
  return handleTurn(request);
}
