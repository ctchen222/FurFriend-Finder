# frontend-experience Specification

## Purpose
TBD - created by archiving change redesign-frontend-with-design-md. Update Purpose after archive.
## Requirements
### Requirement: Design Reference Selection

The frontend redesign SHALL use a local `DESIGN.md` reference as the source design grammar while preserving FurFriend Finder's own product identity.

#### Scenario: Agent starts the redesign

- **WHEN** an implementation agent begins frontend redesign work
- **THEN** it SHALL read the selected `awesome-design-md` reference before editing UI files
- **AND** it SHALL use `vendor/awesome-design-md/design-md/airbnb/DESIGN.md` as the primary design reference
- **AND** it SHALL adapt the system into FurFriend-specific tokens instead of copying Airbnb branding verbatim

#### Scenario: Design tokens are applied

- **WHEN** the shared stylesheet is updated
- **THEN** it SHALL define a white-canvas, photo-first visual system
- **AND** it SHALL use a single primary coral accent for high-priority actions
- **AND** it SHALL reduce decorative paw-pattern and emoji-led hierarchy on core flows

### Requirement: Home Page Action Gateway

The homepage SHALL guide visitors into the three primary jobs: quick match, report lost pet, and browse shelter animals.

#### Scenario: Visitor opens the homepage

- **WHEN** a visitor opens `/`
- **THEN** the first viewport SHALL explain the service in plain language
- **AND** it SHALL expose clear actions for quick match, lost-pet report, and shelter browsing
- **AND** it SHALL include trust signals for public shelter data, location-aware matching, and email notification

#### Scenario: Homepage renders animal content

- **WHEN** the homepage displays featured or recommended animals
- **THEN** real animal photos SHALL be the primary visual element when available
- **AND** placeholders SHALL remain visually quiet when photos are missing
- **AND** cards SHALL include enough metadata to understand species, breed or variety, sex, color, and shelter when available

### Requirement: Shelter Animal Catalog Experience

The shelter animal browser SHALL present shelter records as a searchable, photo-first catalog.

#### Scenario: Visitor browses shelter animals

- **WHEN** a visitor opens `/shelter-animals`
- **THEN** the page SHALL show filters for species, city, and sex near the top
- **AND** animal cards SHALL use stable image dimensions
- **AND** animal cards SHALL prioritize photo, species or variety, shelter or city, sex, and color metadata

#### Scenario: Visitor applies filters

- **WHEN** a visitor applies or resets filters
- **THEN** the page SHALL provide visible loading and result-count feedback
- **AND** active filter state SHALL be understandable without relying only on color
- **AND** pagination controls SHALL remain reachable and readable on mobile

#### Scenario: Visitor opens animal details

- **WHEN** a visitor activates an animal card by pointer or keyboard
- **THEN** the system SHALL open a detail view or lightbox
- **AND** the detail view SHALL include shelter contact/location information when available
- **AND** the interaction SHALL remain keyboard accessible

### Requirement: Quick Match Guidance and Results

The quick-match flow SHALL help anonymous visitors submit matching criteria and understand ranked results.

#### Scenario: Visitor opens quick match

- **WHEN** a visitor opens `/quick-use`
- **THEN** the form SHALL visually group animal identity, appearance, and lost-location fields
- **AND** required fields SHALL be clear
- **AND** the page SHALL state that login is not required for quick matching

#### Scenario: Visitor submits quick match

- **WHEN** a visitor submits valid quick-match criteria
- **THEN** the page SHALL show a loading state on the submit action
- **AND** it SHALL render ranked result cards when matches are returned
- **AND** each result card SHALL prioritize rank, distance when available, photo, shelter, species, variety, sex, and color

#### Scenario: Quick match has no results

- **WHEN** quick match returns no candidates
- **THEN** the page SHALL show an empty state with practical next actions
- **AND** it SHALL suggest broadening criteria, browsing shelter animals, or registering a lost report

### Requirement: Lost Pet Report Form Clarity

The lost-pet report flow SHALL reduce user stress while preserving all required data capture.

#### Scenario: Authenticated user opens report form

- **WHEN** an authenticated user opens `/report-lost`
- **THEN** the form SHALL be split into visually clear sections
- **AND** required fields SHALL be easy to identify
- **AND** the submit action SHALL communicate that the report will be saved and matching will run

#### Scenario: Report form is used on mobile

- **WHEN** the report form is displayed on a mobile viewport
- **THEN** labels, inputs, and primary actions SHALL remain readable
- **AND** touch targets SHALL be at least 44px high for primary controls
- **AND** form sections SHALL not overlap or require horizontal scrolling

### Requirement: Shared Responsive and Accessible UI

The redesigned frontend SHALL preserve the existing EJS + vanilla JavaScript architecture while improving responsive and accessible behavior.

#### Scenario: Visitor uses mobile navigation

- **WHEN** a visitor opens the site on a mobile viewport
- **THEN** the navigation SHALL expose all primary routes
- **AND** menu state SHALL be communicated through accessible attributes
- **AND** links and buttons SHALL remain large enough for touch use

#### Scenario: User navigates by keyboard

- **WHEN** a user navigates interactive UI with the keyboard
- **THEN** focus state SHALL be visible
- **AND** animal cards, buttons, form controls, and modal close controls SHALL be reachable
- **AND** visual focus SHALL not rely only on color

#### Scenario: Images are missing

- **WHEN** an animal record has no photo or a photo fails to load
- **THEN** the UI SHALL keep stable card dimensions
- **AND** it SHALL show a quiet fallback surface
- **AND** it SHALL still present the animal metadata needed for discovery or matching

