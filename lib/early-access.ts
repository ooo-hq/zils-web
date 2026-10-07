export type AccessStatus = 'waiting' | 'invited' | 'active' | 'paused' | 'expired';
export type Application = {
  id: string; email: string; use_case: string; status: AccessStatus; display_status?: AccessStatus;
  created_at: string; expires_at: string | null; delivery_status: 'pending' | 'sent' | 'failed' | null;
};
export type AccessOverview = { capacity: number; allocated: number; waiting: number; total: number; applications: Application[] };
export type AuthConfig = { url: string; key: string };

export type AccessVerdict = { owner: string; token: string; status?: AccessStatus; error?: string };

/** A routine token rotation must not discard the same account's training draft. */
export function workspaceAccess(verdict: AccessVerdict | null, owner: string, token: string): AccessStatus | 'checking' | 'error' {
  if (!verdict || verdict.owner !== owner) return 'checking';
  if (verdict.status === 'active') return 'active';
  if (verdict.token !== token) return 'checking';
  return verdict.error ? 'error' : verdict.status || 'waiting';
}
