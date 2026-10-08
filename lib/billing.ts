import { z } from 'zod';
import { serviceUrl } from './training';

export const TOPUP_AMOUNTS_CENTS = [500, 2000, 5000, 10000] as const;
const amount = z.number().int().refine(value => TOPUP_AMOUNTS_CENTS.some(allowed => allowed === value));
const nanos = z.string().max(40).regex(/^-?(0|[1-9]\d*)$/);
const timestamp = z.string().datetime({ offset: true });

function stripeUrl(value: string, hosts: string[]): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.includes(url.hostname) && !url.username && !url.password && !url.port;
  } catch { return false; }
}

const payment = z.object({
  id: z.string().uuid(), amount_cents: z.number().int().nonnegative(), status: z.enum(['pending', 'paid', 'refunded', 'expired']),
  created_at: timestamp,
  receipt_url: z.string().nullable().transform(value => value && stripeUrl(value, ['pay.stripe.com', 'receipts.stripe.com']) ? value : null),
});
const summarySchema = z.object({
  mode: z.enum(['off', 'test', 'live']), currency: z.literal('usd'),
  balance_nanos: nanos, reserved_nanos: z.string().max(40).regex(/^(0|[1-9]\d*)$/), available_nanos: nanos,
  free_training_runs: z.number().int().nonnegative(), topup_amounts_cents: z.array(amount),
  transactions: z.array(z.object({ id: z.string().min(1), kind: z.enum(['topup', 'inference', 'training', 'refund']), amount_nanos: nanos, created_at: timestamp, reference: z.string() })),
  payments: z.array(payment),
}).refine(value => {
  try { return BigInt(value.available_nanos) === BigInt(value.balance_nanos) - BigInt(value.reserved_nanos); }
  catch { return false; }
});
const checkoutSchema = z.object({ url: z.string().refine(value => stripeUrl(value, ['checkout.stripe.com'])), purchase_id: z.string().uuid() });
const intentSchema = z.object({ amount_cents: amount, idempotency_key: z.string().uuid(), purchase_id: z.string().uuid().optional() });
export type BillingSummary = z.infer<typeof summarySchema>;
export type CheckoutIntent = z.infer<typeof intentSchema>;

export class BillingError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: 'checkout_paid' | 'billing_unavailable') { super(message); this.name = 'BillingError'; }
}

export function billingApi(rawUrl: string, token: () => Promise<string>, request: typeof fetch = fetch) {
  const base = serviceUrl(rawUrl);
  async function send<T>(path: string, schema: z.ZodType<T>, body?: object, signal?: AbortSignal): Promise<T> {
    let accessToken: string;
    try { accessToken = await token(); }
    catch { throw new BillingError('Your sign-in session could not be checked. Please try again.', 0); }
    if (!accessToken) throw new BillingError('Your session has expired. Please sign in again.', 401);
    const timeout = AbortSignal.timeout(30_000);
    let response: Response;
    try {
      response = await request(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        cache: 'no-store', credentials: 'omit', redirect: 'error',
      });
    } catch { throw new BillingError('The billing service could not be reached. Check your connection and try again.', 0); }
    if (!response.ok) {
      const failure = z.object({ error: z.object({ code: z.enum(['checkout_paid', 'invalid_credentials']) }) }).safeParse(await response.json().catch(() => null));
      const serviceCode = failure.success ? failure.data.error.code : undefined;
      // Older gateways send unknown billing routes through API-key authentication.
      // That rejection does not mean the Supabase user session has expired.
      const code = response.status === 401 && serviceCode === 'invalid_credentials' ? 'billing_unavailable'
        : response.status === 409 && serviceCode === 'checkout_paid' ? 'checkout_paid' : undefined;
      const message = code === 'billing_unavailable' ? 'Billing is not connected on this site yet. Please try again later.'
        : response.status === 401 ? 'Your session has expired. Please sign in again.'
        : response.status === 403 ? 'Your account does not have permission to manage billing.'
        : response.status === 409 ? 'This checkout could not be continued. Refresh your billing details to check its status.'
        : response.status === 410 ? 'This checkout has expired. Choose an amount to start again.'
        : response.status === 429 ? 'Too many requests. Wait a moment before trying again.'
        : response.status === 503 ? 'Top-ups are not configured in this environment yet. Please try again later.'
        : 'The billing service could not complete this request. Please try again.';
      throw new BillingError(message, response.status, code);
    }
    const result = schema.safeParse(await response.json().catch(() => null));
    if (!result.success) throw new BillingError('The billing service returned an unexpected response.', 502);
    return result.data;
  }
  return {
    summary: (signal?: AbortSignal) => send('/v1/billing', summarySchema, undefined, signal),
    checkout: (amountCents: number, idempotencyKey: string, signal?: AbortSignal) => {
      const parsed = intentSchema.safeParse({ amount_cents: amountCents, idempotency_key: idempotencyKey });
      if (!parsed.success) return Promise.reject(new BillingError('Choose a valid top-up amount and try again.', 400));
      return send('/v1/billing/checkout', checkoutSchema, parsed.data, signal);
    },
  };
}

/** Exact dollars: retain small inference charges without floating-point rounding. */
export function formatCredit(value: string): string {
  const number = BigInt(value);
  const absolute = number < 0n ? -number : number;
  const whole = (absolute / 1_000_000_000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (absolute % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${number < 0n ? '−' : ''}$${whole}.${fraction}`;
}

type IntentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const storageKey = (scope: string) => `zils-billing-checkout:${scope}`;
const storageError = () => new BillingError('Allow browser storage to safely start or continue a top-up.', 0);

export function pendingCheckout(storage: IntentStorage, scope: string): CheckoutIntent | null {
  try {
    const raw = storage.getItem(storageKey(scope));
    if (!raw) return null;
    const result = intentSchema.safeParse(JSON.parse(raw));
    if (!result.success) throw storageError();
    return result.data;
  } catch { throw storageError(); }
}

export function checkoutIntent(storage: IntentStorage, scope: string, amountCents: number, makeId: () => string = () => crypto.randomUUID()): CheckoutIntent {
  const pending = pendingCheckout(storage, scope);
  if (pending) {
    if (pending.amount_cents !== amountCents) throw new BillingError('Continue your existing checkout before starting another top-up.', 409);
    return pending;
  }
  const intent = intentSchema.parse({ amount_cents: amountCents, idempotency_key: makeId() });
  try { storage.setItem(storageKey(scope), JSON.stringify(intent)); }
  catch { throw storageError(); }
  return intent;
}

export function attachCheckout(storage: IntentStorage, scope: string, purchaseId: string): void {
  const pending = pendingCheckout(storage, scope);
  if (!pending) throw new BillingError('Checkout could not be saved. Refresh and try again.', 0);
  const intent = intentSchema.parse({ ...pending, purchase_id: purchaseId });
  try { storage.setItem(storageKey(scope), JSON.stringify(intent)); }
  catch { throw storageError(); }
}

export function settleCheckout(storage: IntentStorage, scope: string, payments: BillingSummary['payments']): void {
  const pending = pendingCheckout(storage, scope);
  if (pending?.purchase_id && payments.some(payment => payment.id === pending.purchase_id && payment.status !== 'pending')) clearCheckout(storage, scope);
}

/** Call only after a verified terminal payment or a 410 from the checkout service. */
export function clearCheckout(storage: IntentStorage, scope: string): void {
  try { storage.removeItem(storageKey(scope)); }
  catch { throw storageError(); }
}
