# lost-pet-matching Specification

## Purpose

Register lost pets and match them against shelter animals using animal traits and geographic distance.

## Requirements

### Requirement: Lost Pet Registration
The system SHALL let users submit lost pet and owner information.

#### Scenario: Valid lost pet report
- **WHEN** a user submits required lost pet details and owner contact information
- **THEN** the system validates the request
- **AND** creates or reuses the owner record
- **AND** stores the lost pet report

#### Scenario: Invalid lost pet report
- **WHEN** required fields are missing or invalid
- **THEN** the system rejects the request
- **AND** does not create a lost pet report

### Requirement: Trait-Based Candidate Search
The system SHALL narrow matching candidates by animal traits before calculating distance.

#### Scenario: Candidate search
- **WHEN** matching starts for a lost pet
- **THEN** the system searches shelter animals by kind, colour, sex, and variety where provided
- **AND** supports multi-colour matching and variety fuzzy matching

### Requirement: Distance Ranking
The system SHALL rank matching candidates by geographic distance from the lost place.

#### Scenario: Geocoding succeeds
- **WHEN** the lost place and shelter locations can be geocoded
- **THEN** the system calculates Haversine distance in kilometers
- **AND** returns the closest matches first
- **AND** limits the result set to the configured top matches

#### Scenario: Geocoding fails for a candidate
- **WHEN** a shelter location cannot be geocoded
- **THEN** the system skips that candidate
- **AND** continues ranking other candidates

### Requirement: Quick Match
The system SHALL provide anonymous quick matching without creating a lost pet report or sending email.

#### Scenario: Visitor submits quick match form
- **WHEN** a visitor submits animal traits and lost location through quick-use
- **THEN** the system returns nearby candidate matches
- **AND** does not persist a lost pet report
- **AND** does not send notification email

### Requirement: Registered Report Match
The system SHALL support running matching for a stored lost pet report.

#### Scenario: Match by lost report ID
- **WHEN** a caller requests matching for an existing lost pet report
- **THEN** the system loads the report
- **AND** returns ranked shelter animal matches
- **AND** triggers email notification only when the flow and user preference allow it
