## Why

The current backend can request a password-reset email, but the full user flow is incomplete: there is no reset-password page, and the custom `POST /api/auth/reset-password` route conflicts with Better Auth's password-reset submission endpoint. Users can receive a reset link but cannot reliably set a new password through the app.

## What Changes

- Add a user-facing forgot-password page for requesting reset emails.
- Add a user-facing reset-password page that accepts the Better Auth reset token from the email callback.
- Move the app-owned reset-email request endpoint away from Better Auth's `POST /api/auth/reset-password` endpoint so Better Auth can handle the final password update.
- Add a reset form flow that submits `token` and `newPassword` to Better Auth's reset endpoint.
- Keep reset-email delivery on the existing Nodemailer/Brevo SMTP path through Better Auth `sendResetPassword`.
- Fix the Better Auth `verification` table column casing so reset tokens can be persisted.
- Add success and failure feedback for reset-email request and final password reset.
- Non-goal: do not change registration, login, session cookie behavior, or lost-pet notification delivery.

## Capabilities

### New Capabilities

### Modified Capabilities
- `user-authentication`: complete the password-reset request and final reset flow for email/password users.
- `notification-delivery`: clarify password-reset email delivery through configured SMTP infrastructure.

## Impact

- Routes:
  - Add or adjust auth routes so reset-email request no longer shadows Better Auth's `POST /api/auth/reset-password`.
  - Add `GET /forgot-password` view route.
  - Add `GET /reset-password` view route.
- Controllers:
  - Update `AuthController.requestPasswordReset` to represent requesting a reset email only.
- Views and browser JS:
  - Add `views/forgot-password.ejs`.
  - Add `views/reset-password.ejs`.
  - Add form handling for submitting the new password with token.
  - Add user-facing success/failure toast messages.
- Database:
  - Add a migration for existing lowercase `verification.expiresat`, `createdat`, and `updatedat` columns.
- Tests:
  - Update auth controller tests for the new request-reset route.
  - Add view route/rendering and reset flow coverage where practical.
