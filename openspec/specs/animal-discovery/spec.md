# animal-discovery Specification

## Purpose

Expose shelter animal discovery through web pages, JSON APIs, and LINE Bot interactions.

## Requirements

### Requirement: Shelter Animal Listing
The system SHALL provide a paginated list of shelter animals.

#### Scenario: Visitor requests shelter animals
- **WHEN** a visitor opens `/shelter-animals` or requests `GET /api/animals`
- **THEN** the system returns shelter animal records
- **AND** supports cursor-based pagination
- **AND** includes enough data for cards and detail views

### Requirement: Shelter Animal Filters
The system SHALL support filtering shelter animals by supported attributes.

#### Scenario: Visitor filters by city
- **WHEN** a visitor selects a city filter
- **THEN** the system returns animals associated with shelters or records in that city

#### Scenario: Visitor filters by species or sex
- **WHEN** a visitor selects species or sex filters in the UI
- **THEN** the displayed results reflect the selected filters

### Requirement: Animal Detail Lookup
The system SHALL allow a visitor to retrieve a single animal by ID.

#### Scenario: Visitor opens animal detail
- **WHEN** a visitor requests `GET /api/animals/:id`
- **THEN** the system returns the animal details
- **AND** includes shelter contact information when available

### Requirement: Random Animal Recommendation
The system SHALL support random shelter animal recommendations.

#### Scenario: LINE user draws an animal
- **WHEN** the LINE webhook receives a supported draw postback
- **THEN** the system selects a random shelter animal
- **AND** replies with animal information and image content when available

#### Scenario: Web visitor requests random animal
- **WHEN** a visitor requests `GET /api/animals/random`
- **THEN** the system returns one shelter animal record
