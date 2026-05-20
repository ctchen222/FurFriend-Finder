## Why

Animal cards currently use an external `placehold.co` image with the English text `No photo` when a shelter record has no picture. That feels unfinished in the Traditional Chinese, photo-first interface and adds an unnecessary external image request for a state the app can render locally.

## What Changes

- Replace the external `No photo` placeholder with a local, quiet missing-photo surface.
- Use the same fallback for shelter cards, homepage featured animals, quick-match results, and animal lightboxes.
- Treat broken image URLs the same as missing `picture` values.
- Preserve stable image dimensions and existing metadata so discovery and matching remain useful.
- Keep API responses, database schema, matching logic, auth, email, and data sync behavior unchanged.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `frontend-experience`: Missing or failed animal photos should render a local quiet fallback surface instead of an English external placeholder image.

## Impact

- Affected frontend code: `src/public/js/common.js`, `src/public/css/style.css`, `views/home.ejs`, `views/shelter-animals.ejs`, `views/quick-use.ejs`.
- Affected tests: focused Playwright coverage for shelter animal pagination and quick-match result rendering.
- No backend routes, services, repositories, database migrations, or npm dependencies are required.
