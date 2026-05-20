## MODIFIED Requirements

### Requirement: Shelter Animal Listing

The system SHALL provide a paginated list of shelter animals through a photo-first catalog experience.

#### Scenario: Visitor requests shelter animals

- **WHEN** a visitor opens `/shelter-animals` or requests `GET /api/animals`
- **THEN** the system returns shelter animal records
- **AND** supports cursor-based pagination
- **AND** includes enough data for cards and detail views
- **AND** the page presents those records in stable photo-first cards with scannable animal and shelter metadata

### Requirement: Shelter Animal Filters

The system SHALL support filtering shelter animals by supported attributes through visible, accessible filter controls.

#### Scenario: Visitor filters by city

- **WHEN** a visitor selects a city filter
- **THEN** the system returns animals associated with shelters or records in that city
- **AND** the active city filter is visible in the UI

#### Scenario: Visitor filters by species or sex

- **WHEN** a visitor selects species or sex filters in the UI
- **THEN** the displayed results reflect the selected filters
- **AND** the result-count or empty-state feedback updates after the filter is applied
