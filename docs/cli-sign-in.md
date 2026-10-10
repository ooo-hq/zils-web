# CLI browser sign-in

The `/cli/authorize` page uses the same Supabase project and shared account session
as `/train`. It accepts only the configured first-party CLI client, `email` scope,
and `http://127.0.0.1:43187/callback`. The account session grants the account's
existing permissions; OAuth identity scopes do not restrict Zils API routes.

Configure the Supabase OAuth 2.1 server with a public CLI client (PKCE S256, no
secret, dynamic registration disabled), that exact callback, and this site's
`/cli/authorize` as the authorization path. Set
`NEXT_PUBLIC_ZILS_CLI_OAUTH_CLIENT_ID` to its client UUID and set the matching
coordinator value described in
[platform setup](https://github.com/ooo-hq/zils-platform/blob/main/docs/cli-training.md).
Do not put a client secret or service-role key in public environment variables.

Add the production `/cli/authorize` return path (including its `authorization_id`
query parameter) to the project's Auth redirect allowlist for email/Google
sign-in. Use exact production origin/path matching, with the provider's documented
query-matching pattern if needed. Verify the actual email and Google returns in
an isolated project before release. Keep invitation-only sign-in settings.

Supabase's OAuth server is currently beta. Release requires an isolated hosted
check of approval, denial, an already-consented request, expiry, token rotation,
and email/Google return. The browser and CLI must run on the same computer.
The website never reads or forwards the CLI's access/refresh tokens.
