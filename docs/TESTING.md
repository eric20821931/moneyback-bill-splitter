# Testing Checklist

Use a private test account for manual authenticated testing. Do not commit personal email addresses, passwords, verification codes, `.env.local`, `.vercel`, or `playwright/.auth`.

Production URL: https://moneyback-bill-splitter.vercel.app

## Automated Checks

```bash
npm run lint
npm run build
npm audit
npm run test:e2e:install
npm run test:e2e:auth
npm run test:e2e
npm run test:e2e:advanced
curl -I https://moneyback-bill-splitter.vercel.app
curl -I https://moneyback-bill-splitter.vercel.app/favicon.svg
curl -i -X POST https://moneyback-bill-splitter.vercel.app/api/app \
  -H "Content-Type:application/json" \
  -d '{"action":"groups.list"}'
```

Expected:

- `npm run lint`: pass
- `npm run build`: pass
- `npm audit`: `found 0 vulnerabilities`
- Site: `HTTP 200`
- Favicon: `HTTP 200`
- Unauthenticated API: `HTTP 401` with `{"error":"unauthorized"}`

## Playwright Login Flow

1. Run `npm run test:e2e:install` once.
2. Run `npm run test:e2e:auth`.
3. A browser opens. Sign in manually with your private test account.
4. Do not share the email verification code.
5. After the dashboard loads, the test saves `playwright/.auth/user.json`.
6. Run `npm run test:e2e` to execute the authenticated smoke tests.
7. Run `npm run test:e2e:advanced` to test synthetic friends, multi-currency percentage splits, avatar upload, and invalid input handling.

## Authenticated Functional Tests

1. Sign in with your private test account.
2. Open Menu > Settings.
3. Change display name.
4. Upload a profile photo.
5. Toggle dark/light mode.
6. Toggle language.
7. Confirm exchange-rate card shows source, USD-based rates, date, and time.
8. Go to Groups.
9. Change the group creation currency near `Add Group`.
10. Create a test group.
11. Open the group.
12. Change group currency.
13. Invite/select a friend from the dropdown if available.
14. Add a normal expense with the group currency.
15. Add an expense using a different original currency.
16. Confirm expense detail shows original currency and converted group currency.
17. Confirm split details show each member percentage and amount.
18. Edit the expense.
19. Delete the expense.
20. Add a percentage split where members total exactly 100%.
21. Try an invalid percentage total and confirm save is blocked.
22. Settle up between two different members.
23. Confirm group balances update after settlement.
24. Return to Groups and confirm each group card shows only the amount, not `you owe` or `owes you`.
25. Switch group currency again and confirm group list amount does not become `0`.
26. Go to Friends and change display currency.
27. Go to Reports and change display currency.
28. Delete the test group.
29. Confirm the deleted group and related balances disappear.

## GitHub Release Checklist

- Do not upload `.env.local`.
- Do not upload `.vercel`.
- Do not upload `playwright/.auth`.
- Do not upload `node_modules`.
- Do not upload `dist`.
- Do not upload `.DS_Store`.
- Confirm `.env.example` contains placeholders only.
