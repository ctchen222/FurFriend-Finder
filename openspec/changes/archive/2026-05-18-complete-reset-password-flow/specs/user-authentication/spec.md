## ADDED Requirements

### Requirement: Password Reset Flow
The system SHALL allow email/password users to request a reset link and complete password reset using the emailed token.

#### Scenario: User requests password reset email
- **WHEN** a visitor opens the forgot-password page
- **THEN** the system renders a dedicated reset-email request form

#### Scenario: User submits password reset email request
- **WHEN** a visitor submits an email address from the forgot-password page
- **THEN** the system requests a Better Auth password-reset email for that address
- **AND** redirects the visitor to the forgot-password page with generic reset-email feedback

#### Scenario: User opens valid reset callback
- **WHEN** a user follows a valid reset-password email link
- **THEN** Better Auth validates the reset token
- **AND** redirects the user to `/reset-password` with the token in the query string
- **AND** the system renders a reset-password form

#### Scenario: User submits new password
- **WHEN** a user submits a reset token and valid new password from the reset-password form
- **THEN** the system delegates password update to Better Auth's reset-password endpoint
- **AND** redirects the user to the login page with success feedback

#### Scenario: Unverified user logs in after password reset
- **WHEN** an email/password user has a valid password but has not verified their email
- **AND** the user submits login credentials
- **THEN** the system rejects login with email-not-verified feedback
- **AND** sends a verification email when Better Auth permits resending on sign-in

#### Scenario: Invalid or expired reset token
- **WHEN** a user opens or submits an invalid or expired reset token
- **THEN** the system rejects the reset
- **AND** shows failure feedback without changing the user's password
