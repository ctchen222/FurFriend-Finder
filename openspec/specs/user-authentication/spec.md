# user-authentication Specification

## Purpose

Manage account creation, login sessions, route protection, and user notification preferences for FurFriend Finder.
## Requirements
### Requirement: Email Password Registration
The system SHALL allow a visitor to create an account with name, email, and password.

#### Scenario: Successful registration
- **WHEN** a visitor submits valid registration details
- **THEN** the system creates a user account
- **AND** initializes the related owner record for lost-pet workflows
- **AND** enables lost animal email notifications when the user has an email address

#### Scenario: Invalid registration input
- **WHEN** a visitor submits missing or invalid registration details
- **THEN** the system rejects the request
- **AND** returns validation feedback without creating a user account

### Requirement: Email Password Login
The system SHALL authenticate users with email and password and establish an HTTP-only session.

#### Scenario: Successful login
- **WHEN** a registered user submits valid credentials
- **THEN** the system signs the user in
- **AND** redirects to the requested return path when it is allowed
- **AND** falls back to the home page when no valid return path is present

#### Scenario: Failed login
- **WHEN** credentials are invalid
- **THEN** the system rejects the login
- **AND** does not create a session

### Requirement: Protected Pages
The system SHALL protect authenticated-only pages from anonymous access.

#### Scenario: Anonymous user opens report-lost
- **WHEN** an anonymous user requests `/report-lost`
- **THEN** the system redirects to `/login`
- **AND** includes a return path so the user can continue after login

#### Scenario: Authenticated user opens profile
- **WHEN** an authenticated user requests `/profile`
- **THEN** the system renders the profile page with the user session available to the view

### Requirement: Notification Preference
The system SHALL let authenticated users update whether they receive lost-animal match email notifications.

#### Scenario: User disables match email
- **WHEN** an authenticated user sets `isLostAnimalMailEnabled` to false
- **THEN** the system stores the preference
- **AND** subsequent match-notification flows respect the disabled state

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

