## Context

FurFriend Finder is a Taiwan-focused pet adoption and lost-pet matching platform. The important product flows are:

1. A visitor browses shelter animals from public Taiwan animal shelter data.
2. A worried owner uses quick match without login to see likely candidates.
3. A registered owner submits a lost pet report and receives future email notifications.
4. A returning user manages notification preference and stored reports from profile.

The current frontend is server-rendered EJS with vanilla JavaScript:

- Shared layout: `views/partials/_head.ejs`, `_header.ejs`, `_footer.ejs`.
- Main public pages: `views/home.ejs`, `views/shelter-animals.ejs`, `views/quick-use.ejs`, `views/lost-pet-form.ejs`.
- CSS: `src/public/css/style.css`.
- Shared browser helpers and lightbox: `src/public/js/common.js`.

This architecture is appropriate for the project. The redesign should improve visual quality and task clarity without adding a frontend framework.

## Product Interpretation

The product's emotional promise is "help lost pets get home faster", but the operating value is "turn scattered shelter data into actionable search and notification workflows".

Design should therefore balance two modes:

- **Human reassurance:** soft copy, calm spacing, approachable forms.
- **Operational clarity:** searchable records, trustworthy metadata, obvious next actions, ranked results.

The UI should not feel like a generic pet blog, charity landing page, or playful toy app. It should feel like a clear public-service marketplace for animal records, with enough warmth to support anxious users.

## Design Reference Decision

Use `vendor/awesome-design-md/design-md/airbnb/DESIGN.md` as the primary design grammar.

Adapted principles:

- **White canvas first:** default page background becomes white or near-white. Avoid repeating paw backgrounds on core flows.
- **Single high-signal accent:** replace the current orange/brown system with a controlled coral-red primary for urgent actions, while keeping secondary warm neutrals for support.
- **Photo-first records:** animal photos become the strongest visual element on cards and match results.
- **Pill search/filter surface:** city, species, sex, and quick-match entry points use rounded search/filter treatments.
- **Shallow elevation:** remove heavy shadows as a default. Use borders, spacing, and image clipping for structure.
- **Marketplace density:** browsing pages should show more useful animal records per scroll than the current large decorative card system.

FurFriend-specific deviations:

- Keep Traditional Chinese content and Taiwan place names as first-class text.
- Use calmer copy than commercial travel CTAs.
- Keep accessibility and form clarity above decorative similarity.
- Use real animal photos when available; placeholders should be quiet and not emoji-led.

## Visual System

### Color

Recommended tokens:

| Role | Token | Value | Usage |
|---|---|---:|---|
| Canvas | `--color-canvas` | `#ffffff` | Page background and primary surfaces |
| Soft surface | `--color-surface-soft` | `#f7f7f5` | Filter bands, secondary sections |
| Card | `--color-surface-card` | `#ffffff` | Animal cards, forms, dialogs |
| Ink | `--color-ink` | `#222222` | Primary text |
| Body | `--color-body` | `#3f3f3f` | Paragraphs and metadata |
| Muted | `--color-muted` | `#6a6a6a` | Secondary metadata |
| Hairline | `--color-hairline` | `#dddddd` | Borders and dividers |
| Primary | `--color-primary` | `#e84b5f` | Primary CTAs, active filters, high-signal links |
| Primary active | `--color-primary-active` | `#cc3048` | Pressed/hover primary state |
| Success | `--color-success` | `#2e7d50` | Successful status |
| Error | `--color-error` | `#b3261e` | Validation and failure states |

The primary color is inspired by Airbnb Rausch but shifted away from exact brand copying. It should be used sparingly: main CTA, active filter, distance/rank highlight, and critical links.

### Typography

Use the current system stack unless implementation chooses to refine fonts later:

```css
font-family: Inter, "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
```

Rules:

- Avoid very large display type except homepage hero.
- Use compact 14-16px metadata on animal cards.
- Use clear 16px form labels and inputs.
- Avoid negative letter spacing.
- Do not use emoji as primary iconography or information hierarchy.

### Shape and Elevation

- Main card radius: 14px.
- Large panels and dialogs: 20px.
- Search/filter pills: 9999px.
- Buttons: 8px to 9999px depending on context.
- Default cards use 1px border, no heavy shadow.
- Hover states may use one shallow shadow tier only.

## Information Architecture

### Home

The first viewport should answer:

- What is this?
- What can I do right now?
- Why should I trust the results?

Recommended structure:

1. Hero with direct claim: "Find lost pets across Taiwan shelter records."
2. Pill-style action/search strip with three actions: quick match, report lost pet, browse shelter animals.
3. Short trust row: public shelter data, location-aware matching, email notifications.
4. Featured animal / recent shelter records using real photo cards.
5. How matching works in 3 concise steps.
6. Bottom CTA focused on quick match and report lost.

Remove or reduce:

- Decorative emoji rows.
- Repeated mission/CTA sections that do not add decision value.
- Heavy statistic claims unless sourced and visually restrained.

### Shelter Animals

The page should become the strongest "catalog" surface:

- Sticky or near-top pill filter/search bar with species, city, sex, reset.
- Result count and active filter chips.
- Photo-first animal cards with fixed image ratio.
- Card metadata order: species/breed, city or shelter, sex/color, intake/found details when available.
- Detail lightbox should feel like a record view, not a decorative modal.

### Quick Match

The quick-match page should feel like a guided search, not a plain form:

- Left/top explanatory compact panel: "No login required. We compare traits and location."
- Form grouped by animal identity, appearance, and lost location.
- Primary submit button stays visually dominant.
- Results appear as ranked cards with distance, shelter, photo, and trait metadata.
- Empty state should suggest practical next action: broaden traits, browse nearby shelter animals, or register a lost report.

### Report Lost

The report-lost flow should reduce user stress:

- Keep one page, but visually split into clear sections.
- Explain required fields inline, not with long copy.
- Make owner contact fields trustworthy and calm.
- Submit button should say what happens next: save report and run matching.

### Auth and Profile

Auth should be visually consistent with the rest of the redesign:

- Compact centered auth cards.
- No decorative background pattern.
- Clear return-to behavior messaging.

Profile should emphasize:

- Notification preference state.
- Existing lost reports.
- Manual match action availability.

## Data Flow and Side Effects

No backend side effects change.

- `/api/animals` and `/api/animals/city/:city` remain the data source for shelter listing.
- `/api/animals/random` remains the home featured-animal source.
- `/api/lost-animals/quick-match` remains the quick-use submit target.
- Existing auth and notification behavior remains unchanged.

Frontend JavaScript changes should only improve rendering, interaction states, and progressive enhancement.

## Accessibility and Responsive Requirements

- All cards that open lightboxes must be keyboard reachable and announce role/action.
- Filter controls must have visible labels.
- Form errors and loading states must be visible without relying only on color.
- Mobile navigation must preserve access to all primary flows.
- Touch targets should be at least 44px high for primary controls.
- Photos must have meaningful alt text derived from available animal metadata.

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Redesign becomes a brand clone | Medium | Medium | Use Airbnb as grammar only; define FurFriend tokens and Taiwan-specific copy. |
| Removing playful visuals makes the app feel cold | Medium | Medium | Keep warm copy, soft neutral surfaces, and animal photography. |
| Photo-first cards expose inconsistent government image quality | High | Medium | Use stable aspect ratios, quiet placeholders, and metadata hierarchy that still works without photos. |
| Large CSS rewrite breaks existing EJS pages | Medium | High | Refactor tokens first, then page-by-page with Playwright checks. |
| Forms become visually nicer but less clear | Low | High | Treat labels, required marks, loading, and validation as first-class design requirements. |

## Rollout Plan

1. Token and layout foundation in CSS and shared partials.
2. Home page redesign.
3. Shelter animals catalog redesign.
4. Quick match and match results redesign.
5. Report lost, auth, and profile polish.
6. Responsive and Playwright verification.
