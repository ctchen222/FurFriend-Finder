# data-sync-integrations Specification

## Purpose

Keep shelter and lost animal data current through Taiwan public open data, geocoding, and controlled administrative sync operations.

## Requirements

### Requirement: Daily Open Data Sync
The system SHALL synchronize external animal datasets on a daily schedule.

#### Scenario: Scheduled sync runs
- **WHEN** the daily cron job runs at midnight Asia/Taipei
- **THEN** the system fetches shelter animal data from the public open data API
- **AND** fetches lost animal data from the public open data API
- **AND** validates response records before inserting them

### Requirement: Duplicate Safe Inserts
The system SHALL avoid duplicating animal records during repeated syncs.

#### Scenario: Existing external animal appears again
- **WHEN** a synced record has an external identifier that already exists
- **THEN** the system avoids inserting a duplicate record
- **AND** continues processing the remaining batch

### Requirement: Admin Manual Sync
The system SHALL expose manual animal sync only to callers with the admin API key.

#### Scenario: Valid admin key
- **WHEN** a caller sends `POST /api/animals/manualUpdate` with a valid `X-Admin-API-Key`
- **THEN** the system starts the manual data update
- **AND** returns the update result

#### Scenario: Missing or invalid admin key
- **WHEN** a caller sends the manual update request without a valid admin key
- **THEN** the system rejects the request
- **AND** does not start data synchronization

### Requirement: Geocoding Integration
The system SHALL use Google Maps Geocoding for location-to-coordinate conversion.

#### Scenario: Address resolves
- **WHEN** Google Maps returns coordinates for an address
- **THEN** the system uses those coordinates for distance matching

#### Scenario: Address has zero results
- **WHEN** Google Maps returns zero results
- **THEN** the system treats the location as unavailable
- **AND** matching continues where possible

#### Scenario: API limit or authorization error
- **WHEN** Google Maps reports quota or authorization failure
- **THEN** the system surfaces an operational error for investigation
