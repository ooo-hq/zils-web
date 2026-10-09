import { decisionApiUrl } from './api-keys';
import { storageLocations } from './storage';
import { serviceUrl } from './training';

export function trainingConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const apiUrl = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL ?? '';
  if (!url || !key || !apiUrl || key.startsWith('sb_secret_')) return null;
  try {
    serviceUrl(url); serviceUrl(apiUrl);
    const storage = storageLocations(url, process.env.NEXT_PUBLIC_ZILS_SPACES_URL);
    let keysApiUrl: string | null = null;
    try { keysApiUrl = decisionApiUrl(apiUrl, process.env.NEXT_PUBLIC_ZILS_API_URL); } catch { /* Training remains available without the optional decision service. */ }
    return { url, key, apiUrl, decisionApiUrl: keysApiUrl, storage };
  } catch { return null; }
}

export type TrainingConfig = NonNullable<ReturnType<typeof trainingConfig>>;
