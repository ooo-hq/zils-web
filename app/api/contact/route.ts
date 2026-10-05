import { handleContactRequest } from '@/lib/contact';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleContactRequest(request, {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.ZILS_CONTACT_FROM,
    to: process.env.ZILS_CONTACT_TO,
  });
}
