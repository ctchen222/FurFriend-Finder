## 1. Route and Controller Flow

- [x] 1.1 Move reset-email request handling to `POST /api/auth/request-password-reset`.
- [x] 1.2 Leave `POST /api/auth/reset-password` available for Better Auth's final password reset endpoint.
- [x] 1.3 Preserve generic reset-email success/failure redirects and existing SMTP delivery integration.

## 2. Reset Password Page

- [x] 2.1 Add `GET /reset-password` route that renders a reset-password view.
- [x] 2.2 Add `views/reset-password.ejs` with token-aware new-password form behavior.
- [x] 2.3 Add shared toast messages for reset-email and final reset success/failure states.

## 3. Tests and Verification

- [x] 3.1 Update auth controller integration tests for `POST /api/auth/request-password-reset`.
- [x] 3.2 Add tests that the reset-password page renders and that Better Auth keeps the final reset route.
- [x] 3.3 Run focused auth tests and TypeScript checks.

## 4. Dedicated Forgot Password Page

- [x] 4.1 Add `GET /forgot-password` route and `views/forgot-password.ejs`.
- [x] 4.2 Replace the embedded login-page reset form with a link to `/forgot-password`.
- [x] 4.3 Redirect reset-email request results back to `/forgot-password` with generic feedback.

## 5. Better Auth Verification Schema

- [x] 5.1 Fix fresh schema column casing for `verification."expiresAt"`, `"createdAt"`, and `"updatedAt"`.
- [x] 5.2 Add an idempotent migration that renames existing lowercase verification timestamp columns.
- [x] 5.3 Log reset-email request failures with actionable server-side error details.

## 6. Regression Tests and Verification

- [x] 6.1 Update auth and view integration tests for the dedicated forgot-password page.
- [x] 6.2 Add a schema regression test for the Better Auth verification column names.
- [x] 6.3 Run focused tests, full Jest, type-check, and OpenSpec validation.

## 7. Reset Link URL Configuration

- [x] 7.1 Add a normalized app base URL helper for Better Auth and reset callbacks.
- [x] 7.2 Configure Better Auth `baseURL` and reset `redirectTo` from the same normalized source.
- [x] 7.3 Update local and example env values so development links target port `2486`, not `3000`.
- [x] 7.4 Add regression tests for missing `APP_BASE_URL` fallback and `/api/auth` path stripping.
- [x] 7.5 Verify a generated reset URL no longer contains `undefined` or port `3000`.

## 8. Email Verification Login Feedback

- [x] 8.1 Enable verification email delivery on sign-up and sign-in.
- [x] 8.2 Pass a valid login callback URL into Better Auth email/password sign-in.
- [x] 8.3 Redirect `EMAIL_NOT_VERIFIED` login responses to a specific login message.
- [x] 8.4 Add toast messages for verification email sent, email verified, and email-not-verified states.
- [x] 8.5 Add tests for unverified login feedback and verification email configuration.
