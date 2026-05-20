## MODIFIED Requirements

### Requirement: Quick Match

The system SHALL provide anonymous quick matching without creating a lost pet report or sending email, and SHALL present the flow as a guided form with ranked, scannable results.

#### Scenario: Visitor submits quick match form

- **WHEN** a visitor submits animal traits and lost location through quick-use
- **THEN** the system returns nearby candidate matches
- **AND** does not persist a lost pet report
- **AND** does not send notification email
- **AND** the page presents returned matches as ranked cards with distance, shelter, photo, and trait metadata when available

### Requirement: Lost Pet Registration

The system SHALL let users submit lost pet and owner information through a clear multi-section report form.

#### Scenario: Valid lost pet report

- **WHEN** a user submits required lost pet details and owner contact information
- **THEN** the system validates the request
- **AND** creates or reuses the owner record
- **AND** stores the lost pet report
- **AND** the UI communicates the save-and-match action clearly before submission

#### Scenario: Invalid lost pet report

- **WHEN** required fields are missing or invalid
- **THEN** the system rejects the request
- **AND** does not create a lost pet report
- **AND** the UI preserves readable validation feedback near the relevant fields
