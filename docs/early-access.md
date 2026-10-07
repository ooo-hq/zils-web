# Early access

The public `/early-access` page collects applications without allocating accounts.
The private `/admin/access` page lets configured administrators review applicants,
invite an email directly, resend invitations, and pause access. The initial
capacity is 25 accounts. One account can own several Zils.

## Configure and deploy together

The backend repository supplies
`supabase/migrations/202610070001_early_access.sql`. It creates only Zils-specific
admission records and updates Zils training/key/inference authorization. It does
not disable Supabase signups or change unrelated applications in the project.
Review and apply it to the same Supabase project used by both hosted services.
Deploy the backend changes with it; a missing admission service fails closed.
Existing accounts, including any account used by the public playground, must be
explicitly approved. Do not apply this migration during active customer use
without preparing those approvals. Accounts are not automatically grandfathered.

Set these website server variables:

- `SUPABASE_SERVICE_ROLE_KEY`: same project's server credential.
- `ZILS_ADMIN_EMAILS`: comma-separated administrator emails. Each administrator
  must sign in with a verified email; client metadata never grants admin rights.
- `ZILS_SITE_URL`: exact website origin, for example `https://zils.ai`.
- `RESEND_API_KEY` and `ZILS_ACCESS_FROM`: Resend sending key and verified sender.
  The sender falls back to `ZILS_CONTACT_FROM`.

Keep the existing public Supabase URL/key and training/API URLs. Do not expose
service credentials through `NEXT_PUBLIC_*`. Add the actual `/train` and
`/admin/access` URLs to the Supabase Auth redirect allowlist. Existing workspace
login uses Supabase's magic-link email delivery; configure production SMTP and
its email template for Zils. Administrator invitations use Resend with a
Supabase-generated magic link, which supports new and existing accounts.

## Daily use

1. Sign in at `/admin/access` using a configured administrator email.
2. Review the applicant's intended decision and choose **Approve & invite**.
3. The invitation reserves one spot for seven days. Its recipient signs in with
   that verified email to activate access. An expired sign-in link can be renewed
   from `/train` while the seven-day reservation remains valid.
4. Use **Resend invite** if delivery failed. A delivery failure leaves the spot
   reserved, and the admin page reports it. Resends have a one-minute cooldown.
5. Use **Pause access** to release the spot and deny new training/API requests.
   To restore access, approve the account again; this requires available capacity.

The waiting list is paginated and has no customer-count cap. Duplicate emails
preserve the original application and approval state. The Vercel public form
allows ten submissions per hour per hashed source address; deployments outside
Vercel share a fallback bucket until a trusted ingress is configured. Source
hashes are pruned after two hours. No raw IP addresses are stored by this feature.

Invitations, active accounts, and pauses share a database lock for capacity
changes. Access is checked server-side for training and API-key management,
inside credential authentication, and again during inference usage admission,
including bulk processing. Pausing does not stop a request already admitted,
terminate a running training job, revoke already-issued short-lived storage
URLs, or retract previously downloaded data.

The public playground keeps its separate service credential and existing access
policy. Its owner must have approved access before rollout. No account receives
an automatic financial credit, training allowance, or billing exemption through
this invitation system. Confirm pilot allowances separately.

To change capacity, an operator can update the single
`public.zils_access_settings.capacity` value. Lowering it does not revoke existing
access, but prevents further allocations until usage falls below capacity.

## Verification

Run `npm test`, targeted lint, and `npm run build` in the website repository.
The backend's `make check-queue-db` creates a disposable local PostgreSQL cluster
and covers capacity races, expiry, account binding, revoked access, existing
keys, request limits, and database privileges. It never changes production.
Live rollout still requires a configured admin sign-in and a controlled test
invitation before accepting customers.
