# Cloudflare D1 setup

The project uses Cloudflare D1 as its primary database.

## Database

- Name: `wgi-ai-virtual-office-db`
- Database ID: `de6aa397-a115-4c52-865a-12dcc7b56888`
- Region hint: APAC
- Worker binding: `DB`

The database ID is an identifier, not a credential. Never commit API tokens, secrets, or `.dev.vars`.

## Migrations

The initial schema is in `migrations/0001_initial_schema.sql`. Apply migrations through Wrangler after authenticating the local CLI:

```powershell
npx wrangler login
npx wrangler d1 migrations apply wgi-ai-virtual-office-db --remote
```

Because the schema has already been applied to the connected D1 database during project initialization, verify migration history before applying it again. If Wrangler reports the schema already exists but the migration is not recorded, reconcile migration history carefully instead of blindly re-running the migration.

## Local development

Create a local `.dev.vars` file only when needed. Do not commit it. The D1 binding in `wrangler.toml` is configured for the remote database; use Wrangler's local D1 options when developing against a disposable local database.

## Security gate before public deployment

The current API is a foundation only. The health endpoint is read-only, but the agents and tasks endpoints do not yet verify identity or organization membership. Do not deploy these business-data endpoints publicly until authentication, authorization, input limits, rate limits, and audit logging are implemented and tested.
