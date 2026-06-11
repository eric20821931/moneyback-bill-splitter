# Moneyback

Moneyback is a full-stack bill splitting app for groups, friends, and multi-currency expenses. It is designed for trips, shared housing, meals, and recurring group costs where people need a clear view of who paid, who owes, and how balances settle over time.

Production: https://moneyback-bill-splitter.vercel.app

## Features

- Clerk authentication with Google and email sign-in support.
- Group creation, deletion, member management, and friend invitations.
- Expense creation, editing, deletion, and settlement tracking.
- Percentage-based splits with validation that totals equal 100%.
- Multi-currency expenses with original amount and converted group amount.
- Group, friends, and reports views with selectable display currency.
- Profile settings, display name updates, and avatar upload.
- Light/dark mode and English/Chinese language switching.
- PWA metadata, high-resolution app icons, and service worker app-shell caching.
- Authenticated Playwright coverage for core app flows and edge cases.

## Tech Stack

- React 19 + Vite
- TypeScript
- Tailwind CSS
- Clerk for authentication
- Neon Postgres for persistent data
- Vercel serverless API
- Playwright for end-to-end testing

## Project Structure

```text
api/                 Vercel serverless API
docs/                Design, testing, and security notes
public/              Icons, manifest, and service worker
src/                 React application source
src/components/      Layout and reusable UI components
src/contexts/        Auth and API context
src/hooks/           Shared data hooks
src/pages/           Application pages
tests/e2e/           Playwright tests
```

Root-level configuration files are kept at the project root because Vite, TypeScript, Vercel, Playwright, npm, and shadcn expect them there.

## Local Development

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Fill in:

```text
VITE_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
POSTGRES_URL
DATABASE_URL
```

Run the app:

```bash
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run build
npm run test:e2e:all
```

For the first authenticated E2E run, save a local Playwright session:

```bash
npm run test:e2e:install
npm run test:e2e:auth
```

More details are in [docs/TESTING.md](docs/TESTING.md).

## Deployment

The app is deployed on Vercel. Production environment variables are managed in Vercel and should not be committed.

Deploy:

```bash
npx vercel --prod --yes
```

## Security

Do not commit secrets or generated local state:

- `.env.local`
- `.vercel`
- `playwright/.auth`
- `test-results`
- `dist`
- `node_modules`

The API verifies Clerk bearer tokens before accessing user data. Group and expense operations validate membership, ownership, currency, split totals, percentage totals, and input length limits.

See [docs/SECURITY.md](docs/SECURITY.md) for project security notes.
