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
