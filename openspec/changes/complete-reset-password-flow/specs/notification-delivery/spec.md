## ADDED Requirements

### Requirement: Password Reset Email
The system SHALL send password-reset emails through the configured SMTP mail service when requested through the authentication flow.

#### Scenario: Reset email requested for existing account
- **WHEN** Better Auth triggers a password-reset email for an existing email/password account
- **THEN** the system sends an email containing the Better Auth reset URL
- **AND** uses the configured SMTP sender and credentials

#### Scenario: Reset token is persisted before email delivery
- **WHEN** Better Auth creates a password-reset token for an existing account
- **THEN** the system stores the token in the `verification` table using Better Auth's expected camelCase timestamp columns

#### Scenario: Verification email sent for unverified account
- **WHEN** an unverified email/password user signs up or attempts login with a valid password
- **THEN** the system sends an email containing the Better Auth verification URL
- **AND** uses the configured SMTP sender and credentials

#### Scenario: Reset email delivery fails
- **WHEN** SMTP delivery fails while requesting a password reset
- **THEN** the system reports reset request failure to the caller
- **AND** does not report that a reset email was sent
