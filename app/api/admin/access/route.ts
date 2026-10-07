import { accessConfig } from '@/lib/early-access-config';
import { handleAccessRequest } from '@/lib/early-access-server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleAccessRequest(request, accessConfig());
}
