import { accessConfig } from '@/lib/early-access-config';
import { handleAccessRequest } from '@/lib/early-access-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleAccessRequest(request, accessConfig());
}
