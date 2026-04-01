# FurFriend Finder — Claude Working Guidelines

## Project Overview

A Taiwan stray animal adoption notification system. Pet owners register lost pet details (species, breed, color, location), and the system finds the 10 closest potential matches from shelter databases, then notifies the owner by email.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Template engine**: EJS
- **Database**: PostgreSQL (direct queries via `pg`)
- **External APIs**: Google Maps Geocoding API, Taiwan MOA Open Data
- **Notifications**: LINE Bot, Nodemailer (Brevo SMTP)
- **Testing**: Jest (unit/integration), Playwright (E2E)
- **Process manager**: PM2

## Project Structure

```
src/
  Service/         # Business logic (animalLost.ts, geo.ts, mail.ts)
  Controller/      # HTTP entry points
  repository/      # SQL queries
  libs/            # Utilities, Zod schemas, custom errors
  router/          # Express routes
  __test__/        # Tests (unit / integration / e2e)
views/             # EJS templates
docs/              # Technical documentation
scripts/           # Local utility scripts
```

## Working Rules

### File Access
- **Only read files directly related to the current task** (typically 1–3 files)
- Do not glob-scan the entire `src/` directory looking for inspiration
- When you need to understand an interface, prefer reading `.ts` type definitions over full implementations
- State "I'm reading X because Y" before reading a file

### Scope of Changes
- **Hard limit: modify at most 3 files per task**
- If you estimate the task requires more than 3 files, **stop and comment** explaining what's needed — wait for human confirmation before continuing
- Do not refactor, clean up, or "improve" code that wasn't asked to be changed
- Do not add unrequested features or error handling

### When Receiving a Task via Issue
1. First state your understanding of the scope (target file, expected behavior)
2. If the issue description is unclear (no file path, no expected behavior), **post a comment asking for clarification** — do not guess
3. List your modification plan before making any changes

## Testing Rules

- Run `npm test` after making changes to verify
- All existing tests must pass (current baseline: 183 tests)
- New functionality requires corresponding unit tests
- **Never change business logic just to make a test pass**
- Test file locations: `src/__test__/unit/` (unit), `src/__test__/integration/` (integration)

## Common Commands

```bash
npm run build    # TypeScript compilation
npm test         # Run all unit/integration tests
npm run dev      # Development mode (ts-node-dev)
```

## Key Configuration

- **Environment variables**: `.env` (not in version control)
- **Database connection**: `src/db.ts`
- **Logger**: `src/config/logger.ts` (Winston)
- **GEOCODING_API_KEY**: Required for Google Maps Geocoding (lost location + shelter coordinates)

## Important Table Distinction

- `animal` table: shelter animals (the search targets)
- `animal_lost` table: owner-registered lost animals (the search criteria source)
- Core matching logic lives in `src/Service/animalLost.ts` — see `docs/matching-system.md` for details
