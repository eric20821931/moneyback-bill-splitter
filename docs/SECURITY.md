# Security Notes

## Secrets

Do not commit real values for:

- `.env.local`
- `.vercel`
- `playwright/.auth`
- Clerk secret keys
- Neon/Postgres connection strings
- Verification codes or personal test email addresses

Use `.env.example` as the only committed environment template.

## Authentication

Moneyback uses Clerk for authentication. API routes require a Clerk bearer token and reject unauthenticated requests.

## Data

User, group, friend, expense, and avatar data is stored in Neon Postgres. Uploaded avatars are currently stored as resized `data:image/*` strings in the app database.
