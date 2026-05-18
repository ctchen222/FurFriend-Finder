## Context

FurFriend Finder uses Better Auth for email/password accounts and custom Express controllers for the public EJS form flows. The reset-password request path calls `auth.api.requestPasswordReset()` and delegates email delivery to Better Auth, but the app needs a clearer browser flow and a database schema fix. The request form should live on its own page instead of inside the login page, and Better Auth cannot persist reset tokens while the `verification` columns exist only as lowercase PostgreSQL identifiers.

Better Auth's reset-email link flow is:

1. App calls `requestPasswordReset({ email, redirectTo })`.
2. Better Auth sends a link to `/api/auth/reset-password/:token?callbackURL=<redirectTo>`.
3. Better Auth validates the token and redirects to `<redirectTo>?token=<token>`.
4. The app submits `{ token, newPassword }` to Better Auth's `POST /api/auth/reset-password`.

The app was missing step 3's target page and previously blocked step 4. The remaining runtime blockers were the `verification` table column casing and split URL configuration: the initial SQL created unquoted `expiresAt`, `createdAt`, and `updatedAt`, which PostgreSQL stored as `expiresat`, `createdat`, and `updatedat`; Better Auth writes quoted camelCase columns. Separately, local `.env` had `BETTER_AUTH_URL=http://localhost:3000` while the app runs on `2486`, and `APP_BASE_URL` / `FRONTEND_URL` were absent, producing reset links with `callbackURL=undefined/reset-password`.

## Goals / Non-Goals

**Goals:**
- Provide a complete browser flow from "forgot password" request through setting a new password.
- Make "forgot password" a dedicated page linked from login, rather than an embedded form inside the login page.
- Keep Better Auth responsible for token validation, password hashing, account update, and token invalidation.
- Keep app-owned UI and redirect feedback consistent with the existing EJS/vanilla JS auth pages.
- Preserve reset-password email delivery through the existing `sendResetPassword` SMTP path.
- Align the `verification` table schema with Better Auth's expected column names.
- Generate reset-email URLs from one normalized app base URL so the Better Auth link and callback URL point to the same reachable host.

**Non-Goals:**
- Do not replace Better Auth with custom token storage or password hashing.
- Do not alter login, signup, email verification, or session cookie policy.
- Do not change SMTP provider configuration or lost-pet notification behavior.

## Decisions

### Decision 1: Move the app-owned reset-email request endpoint

The app-owned route will become `POST /api/auth/request-password-reset`. Better Auth keeps `POST /api/auth/reset-password` through the catch-all `toNodeHandler(auth)`.

Alternatives considered:
- Keep the existing route and proxy final reset manually to `auth.api.resetPassword()`. This preserves the public path but keeps an avoidable collision and makes future Better Auth endpoint changes harder to reason about.
- Use a separate non-`/api/auth` route for final reset. This duplicates Better Auth behavior and increases the chance of token handling mistakes.

### Decision 2: Add a server-rendered forgot-password page

`GET /forgot-password` will render a standalone EJS page with the reset-email request form. The login page will link to this page. `POST /api/auth/request-password-reset` will redirect back to `/forgot-password` with generic sent/failed feedback.

Alternatives considered:
- Keep an expandable form inside login. This keeps fewer pages, but makes the auth page do two jobs and hides the reset request workflow.
- Submit the request via browser-side fetch from the login page. This would keep the same page but still leaves unclear navigation and does not match the server-rendered auth forms.

### Decision 3: Add a server-rendered reset page with browser-side submit

`GET /reset-password` will render an EJS page. The page reads `token` from the URL and posts `{ token, newPassword }` to `/api/auth/reset-password`.

Alternatives considered:
- Make the page post to an app-owned controller. This would require another wrapper around Better Auth and more custom error mapping.
- Return JSON only. The existing app is server-rendered and needs a complete browser workflow.

### Decision 4: Keep generic user-facing responses for reset-email requests

The reset-email request will redirect to the forgot-password page with a generic success/failure message. Better Auth already returns success for unknown email addresses to avoid account enumeration, and the app should preserve that behavior.

### Decision 5: Fix Better Auth verification column casing with a migration

Add a migration that renames existing lowercase `verification.expiresat`, `verification.createdat`, and `verification.updatedat` columns to Better Auth's expected quoted camelCase names. Update the initial schema too so fresh databases are correct.

Alternatives considered:
- Change Better Auth adapter behavior. That would fork provider behavior and affect every auth table query.
- Leave the DB alone and catch the error. That only makes logs clearer; reset emails still cannot be generated because token persistence fails before SMTP runs.

### Decision 6: Centralize auth URL generation

Add a small URL helper that normalizes `APP_BASE_URL`, `FRONTEND_URL`, and `BETTER_AUTH_URL`, strips a trailing `/api/auth` when present, and falls back to the request host or local `PORT`. Better Auth receives the same normalized app base URL through `baseURL`, while reset-email requests pass `${appBaseUrl}/reset-password` as `redirectTo`.

Alternatives considered:
- Fix only `.env`. That repairs local development but leaves the code able to generate `undefined/reset-password` again if an environment misses `APP_BASE_URL`.
- Build callback URLs by string-concatenating different env vars at each call site. That is the failure mode we hit: Better Auth and the app-owned callback drifted apart.

### Decision 7: Make email verification state visible during login

Keep `requireEmailVerification: true`, but enable verification email delivery on sign-up and sign-in. When Better Auth returns `EMAIL_NOT_VERIFIED`, the app redirects back to login with a specific `email-not-verified` message instead of the generic `login-failed` message.

Alternatives considered:
- Disable `requireEmailVerification`. This would make reset-password users able to log in immediately, but weakens the current auth policy and makes email verification mostly decorative.
- Keep generic login failure. This hides the actual cause from the user and makes a successful password reset look broken.

## Risks / Trade-offs

- Reset links generated before deployment may point to the same callback URL but can fail if the token expires during rollout. Mitigation: token lifetime remains Better Auth's default and users can request a new email.
- Browser-side final reset depends on JavaScript. Mitigation: this matches the app's current vanilla JS pattern for interactive flows; the page can show a clear failure message if submission fails.
- Existing docs/tests may refer to `POST /api/auth/reset-password` for requesting email. Mitigation: update controller tests and keep Better Auth's endpoint name reserved for final reset.
- The DB migration renames columns in a live table. Mitigation: use conditional `DO` blocks so it is idempotent and only touches the known Better Auth `verification` columns.
- Existing reset emails generated with the old `localhost:3000` and `undefined/reset-password` URLs remain unusable. Mitigation: request a fresh reset email after deploying the URL fix.
- Users who reset a password before verifying email still cannot log in until verification completes. Mitigation: sign-in with the correct password re-sends a verification email and shows an explicit email-not-verified message.
