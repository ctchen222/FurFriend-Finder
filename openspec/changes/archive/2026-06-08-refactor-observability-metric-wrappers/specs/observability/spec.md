## MODIFIED Requirements

### Requirement: Optimization Metric Label Safety
The system SHALL centralize repeated custom metric recording behind shared helpers or wrappers while preserving the existing low-cardinality metric label safety rules.

#### Scenario: metric recording helpers enforce bounded labels
- **WHEN** application services record custom optimization metrics
- **THEN** services SHALL use shared metric helpers or wrappers where a wrapper exists
- **AND** those helpers SHALL validate labels through the existing safe metric attribute path
- **AND** services SHALL NOT construct repeated raw metric attributes that bypass label safety

### Requirement: Matching Optimization Metrics
The system SHALL record matching request status and matching duration through shared matching metric wrappers without changing matching output or metric names.

#### Scenario: matching metrics use centralized wrappers
- **WHEN** pure matching or full match-flow work is timed
- **THEN** the duration and success/error metric recording SHALL be handled by shared matching metric wrappers
- **AND** matching business output SHALL remain unchanged

### Requirement: Geocoding Dependency Metrics
The system SHALL record geocoding request counts and durations through a shared geocoding metric wrapper while preserving bounded status classification.

#### Scenario: geocoding metrics use centralized wrappers
- **WHEN** geocoding requests complete or fail
- **THEN** the request counter and duration metric SHALL be handled by a shared geocoding metric wrapper
- **AND** the geocoding service SHALL still classify outcomes into bounded statuses

### Requirement: Email Delivery Optimization Metrics
The system SHALL record email send attempts, durations, and classified failures through shared email metric wrappers while keeping template failures distinct from mailer send attempts.

#### Scenario: email metrics use centralized wrappers
- **WHEN** an email send attempt reaches the mailer
- **THEN** send duration, sent/failed status, and failure reason metrics SHALL be handled by a shared email metric wrapper
- **AND** the wrapper SHALL rethrow the original send error

#### Scenario: template failures remain distinct from send attempts
- **WHEN** an email template cannot be rendered
- **THEN** the system SHALL increment `email_failures_total{reason="template"}`
- **AND** it SHALL NOT increment `email_sends_total` for a send attempt that never reached the mailer

### Requirement: Animal Data Sync Metrics
The system SHALL record animal data sync run status, duration, update volume, last success, and API failures through shared sync metric helpers without changing sync business behavior.

#### Scenario: sync metrics use centralized wrappers
- **WHEN** shelter-animal or lost-animal sync runs
- **THEN** run status, duration, update count, last success timestamp, and public API failure metrics SHALL be handled by shared sync metric helpers
- **AND** sync business behavior SHALL remain unchanged
