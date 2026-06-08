## MODIFIED Requirements

### Requirement: Shared Responsive and Accessible UI

The redesigned frontend SHALL preserve the existing EJS + vanilla JavaScript architecture while improving responsive and accessible behavior.

#### Scenario: Images are missing

- **WHEN** an animal record has no photo or a photo fails to load
- **THEN** the UI SHALL keep stable card dimensions
- **AND** it SHALL show a quiet local fallback surface
- **AND** it SHALL NOT render an external placeholder image containing `No photo`
- **AND** it SHALL still present the animal metadata needed for discovery or matching
