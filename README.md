# Moneyback

Moneyback is a web app for splitting group expenses with friends. It supports Google sign-in through Clerk, group expenses, settlements, percentage splits, avatars, reports, and multi-currency display.

Production URL: https://moneyback-bill-splitter.vercel.app

## Stack

- React + Vite
- TypeScript
- Tailwind CSS
- Clerk authentication
- Vercel serverless API
- Neon Postgres

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and fill in your own values:

   ```bash
   cp .env.example .env.local
   ```

3. Run the app:

   ```bash
   npm run dev
   ```

## Required Environment Variables

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `POSTGRES_URL`
- `DATABASE_URL` optional fallback

Never commit `.env.local`, `.vercel`, `node_modules`, or `dist`.

## Checks

```bash
npm run lint
npm run build
npm audit
npm run test:e2e:install
npm run test:e2e:auth
npm run test:e2e
```
