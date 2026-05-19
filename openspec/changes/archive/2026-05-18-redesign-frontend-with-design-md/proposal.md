## Why

FurFriend Finder's core value is not "pet browsing" in isolation. The product helps people in Taiwan move from uncertainty to action when a pet is lost: browse public shelter data, run quick matching, register a lost pet report, and receive follow-up notifications when the system finds plausible matches.

The current EJS frontend already exposes these flows, but the visual system still reads like a friendly prototype:

- Emoji-heavy visual language competes with real shelter photos.
- Warm paw-pattern backgrounds and heavy card shadows make dense browsing pages feel less like a trusted search tool.
- The homepage explains many concepts, but the strongest actions are split across multiple sections instead of being anchored around "find / report / browse".
- Animal cards and match results do not yet use photography, distance, shelter, and trait metadata as the primary visual hierarchy.

This change defines a redesign direction using the local `awesome-design-md` collection as an AI-readable design reference. The selected template is `vendor/awesome-design-md/design-md/airbnb/DESIGN.md`, adapted into a FurFriend-specific "warm civic marketplace" design system.

## Selected DESIGN.md

**Primary reference:** Airbnb

Why it fits:

- It is a consumer marketplace pattern built around trust, photos, search, and conversion.
- It uses a mostly white canvas with one high-signal accent, which works well for urgent actions like "start matching" and "report lost pet".
- Its photo-first card model maps directly to shelter animal cards and match-result cards.
- Its pill search/filter surfaces map naturally to city, species, sex, and lost-location flows.
- Its restrained typography and shallow elevation make the app feel more reliable than decorative.

Rejected alternatives:

- **Pinterest:** strong for photo discovery, but masonry-first browsing would weaken task efficiency for filters, forms, and ranked match results.
- **Notion:** good for structured content, but too SaaS/workspace-oriented for an emotional public-service marketplace.
- **Apple:** too showroom-like; it would overemphasize brand polish and underemphasize searchable shelter records.

## What Changes

This is a design and implementation plan for the server-rendered frontend. It does not change matching algorithms, authentication behavior, data sync, email notification side effects, or API contracts.

The redesign direction:

- Replace the decorative pet-prototype visual language with a photo-first, white-canvas marketplace interface.
- Keep FurFriend's emotional mission, but express it through clear action hierarchy and real animal data.
- Make `/` a focused gateway into three jobs: quick match, report lost pet, and browse shelter animals.
- Make `/shelter-animals` feel like a trusted searchable catalog, with a prominent filter/search surface and stronger card metadata.
- Make `/quick-use` and `/report-lost` feel like guided, low-stress flows for anxious pet owners.
- Make match results scannable by rank, distance, shelter, photo, and trait match signals.
- Preserve EJS + vanilla JS architecture and progressive enhancement.

## Capabilities

### New Capabilities

- **frontend-experience** — Defines the visual system, page hierarchy, interaction expectations, and accessibility requirements for the public EJS frontend.

### Modified Capabilities

- **animal-discovery** — The shelter animal browser remains functionally the same, but gets stronger discovery UX requirements.
- **lost-pet-matching** — Quick match and report-lost flows remain functionally the same, but get clearer form and result presentation requirements.

## Impact

- **Views:** `views/home.ejs`, `views/shelter-animals.ejs`, `views/quick-use.ejs`, `views/lost-pet-form.ejs`, `views/profile.ejs`, `views/login.ejs`, `views/register.ejs`, shared partials under `views/partials/`.
- **Static assets:** `src/public/css/style.css`, `src/public/js/common.js`.
- **Tests:** Playwright coverage for navigation, quick-use, shelter browser, responsive menu, and basic accessibility states.
- **No database impact.**
- **No API behavior changes.**
- **No new frontend framework.**
- **No external font dependency required beyond current Google/system stack unless explicitly added during implementation.**

## Non-Goals

- Replacing EJS with React, Next.js, Vue, or a SPA.
- Changing matching behavior, ranking, email notification logic, or auth requirements.
- Introducing paid design assets or copying Airbnb branding.
- Shipping a pixel clone of Airbnb. The reference provides structure, spacing, component grammar, and photo-first marketplace principles; FurFriend keeps its own identity.
- Redesigning the LINE Bot experience.
