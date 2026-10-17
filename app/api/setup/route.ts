import { handleSetup } from '../../../lib/decision-setup-server';
import { signedIn, signInRequired } from '../../../lib/session-server';

export const runtime = 'nodejs';
export const maxDuration = 45;
export async function POST(request: Request) {
  return await signedIn(request) ? handleSetup(request) : signInRequired({ 'Cache-Control': 'no-store' });
}
