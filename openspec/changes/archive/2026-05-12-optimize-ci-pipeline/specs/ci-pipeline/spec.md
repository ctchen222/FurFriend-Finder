## MODIFIED Requirements

### Requirement: CI workflow triggers on PR and branch push
The system SHALL run the CI workflow on every pull request targeting any branch, and on every push to `main` or `dev`. The workflow SHALL use `concurrency` to cancel in-progress runs for the same ref when a newer commit is pushed.

#### Scenario: PR opened or updated
- **WHEN** a pull request is opened, synchronized, or reopened
- **THEN** the CI workflow is triggered and all jobs run

#### Scenario: Push to main or dev
- **WHEN** a commit is pushed to `main` or `dev`
- **THEN** the CI workflow is triggered and all jobs run

#### Scenario: Concurrent runs cancelled
- **WHEN** a second push to the same ref arrives while CI is running
- **THEN** the in-progress run is cancelled and the new run starts

---

### Requirement: helm-validate job validates Helm chart correctness
The system SHALL provide a `helm-validate` job that runs `helm lint`, `helm template`, and `helm unittest` against `deploy/furfriend-finder/`. This job SHALL have NO upstream `needs` dependencies and SHALL start at t=0. The job SHALL install the `helm-unittest` plugin before running tests.

#### Scenario: Helm chart passes all checks
- **WHEN** `helm lint`, `helm template --values deploy/furfriend-finder/values-production.yaml`, and `helm unittest` all succeed
- **THEN** the `helm-validate` job exits with code 0

#### Scenario: Helm template render failure
- **WHEN** a change to a Helm template causes `helm template` to produce invalid YAML
- **THEN** the `helm-validate` job fails

#### Scenario: Helm unit test failure
- **WHEN** an assertion in `deploy/furfriend-finder/tests/*.yaml` does not match the rendered template
- **THEN** the `helm-validate` job fails

#### Scenario: helm-validate starts without waiting for lint or type-check
- **WHEN** the CI workflow is triggered
- **THEN** `helm-validate` begins executing at the same time as `lint` and `type-check`
