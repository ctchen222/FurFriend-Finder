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
