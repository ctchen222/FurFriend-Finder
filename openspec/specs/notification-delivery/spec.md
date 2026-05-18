# notification-delivery Specification

## Purpose

Deliver transactional and lost-pet match emails through configured SMTP infrastructure.
## Requirements
### Requirement: SMTP Configuration
The system SHALL require SMTP configuration before sending email.

#### Scenario: SMTP settings are configured
- **WHEN** the application sends an email
- **THEN** it uses the configured SMTP host, port, credentials, security mode, and sender address

#### Scenario: Required SMTP sender is missing
- **WHEN** email delivery is attempted without a sender address
- **THEN** the system fails explicitly instead of silently dropping the message

### Requirement: Welcome Email
The system SHALL support sending welcome email using the welcome Mustache template.

#### Scenario: New user welcome email
- **WHEN** the registration flow triggers a welcome email
- **THEN** the system renders `views/mailtemplates/welcome.mt.html`
- **AND** sends it to the registered email address

### Requirement: Match Notification Email
The system SHALL support sending lost-pet match results by email.

#### Scenario: Matches are found
- **WHEN** matching completes and notification is enabled
- **THEN** the system renders `views/mailtemplates/animalMatchNotice.mt.html`
- **AND** includes the matched animal list
- **AND** sends the email to the owner address

#### Scenario: Notification preference disabled
- **WHEN** matching completes for a user who disabled lost animal email
- **THEN** the system does not send a match notification email

### Requirement: SMTP Smoke Test
The system SHALL provide a manual SMTP smoke test for operators with real SMTP credentials.

#### Scenario: Operator runs smoke test
- **WHEN** an operator runs `npm run smtp:smoke` with valid SMTP test environment variables
- **THEN** the script sends a test email
- **AND** reports success only after the SMTP provider accepts the message

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

