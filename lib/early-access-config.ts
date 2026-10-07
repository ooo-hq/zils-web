import 'server-only';

export function accessConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    adminEmails: process.env.ZILS_ADMIN_EMAILS,
    siteUrl: process.env.ZILS_SITE_URL,
    mailKey: process.env.RESEND_API_KEY,
    mailFrom: process.env.ZILS_ACCESS_FROM || process.env.ZILS_CONTACT_FROM,
  };
}

export function accessAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return url && key && !key.startsWith('sb_secret_') ? { url, key } : null;
}
