## 1. OpenSpec Artifacts

- [x] 1.1 Author proposal.md, design.md, tasks.md, and frontend-experience spec delta.
- [x] 1.2 Run `openspec validate redesign-frontend-with-design-md` and resolve schema errors.

## 2. Design Foundation

- [x] 2.1 Preserve the source reference at `vendor/awesome-design-md/design-md/airbnb/DESIGN.md` as the local design-md input.
- [x] 2.2 Create or update project-level `DESIGN.md` with the FurFriend-adapted design system, not a direct Airbnb copy.
- [x] 2.3 Refactor `src/public/css/style.css` design tokens to the new white-canvas, coral-accent, photo-first system.
- [x] 2.4 Update shared partials `_head.ejs`, `_header.ejs`, and `_footer.ejs` for the new typography, nav hierarchy, and reduced decorative chrome.

## 3. Page Redesign

- [x] 3.1 Redesign `views/home.ejs` around immediate user jobs: quick match, report lost pet, browse shelter animals.
- [x] 3.2 Redesign `views/shelter-animals.ejs` as a photo-first searchable catalog with active filter feedback.
- [x] 3.3 Redesign `views/quick-use.ejs` as a guided matching flow with ranked result cards.
- [x] 3.4 Redesign `views/lost-pet-form.ejs` as a calm multi-section report form.
- [x] 3.5 Align `views/profile.ejs`, `views/login.ejs`, `views/register.ejs`, and `views/404.ejs` with the same visual system.

## 4. Interaction and Rendering

- [x] 4.1 Update `src/public/js/common.js` only where needed for improved lightbox rendering, loading states, active filters, and accessible card actions.
- [x] 4.2 Ensure animal placeholders are quiet image placeholders rather than emoji-led visual elements.
- [x] 4.3 Ensure match result cards expose rank, distance, shelter, photo, species, breed, sex, and color in a scannable order.
- [x] 4.4 Keep existing API calls and side effects unchanged.

## 5. Verification

- [x] 5.1 Run `pnpm run type-check`.
- [x] 5.2 Run `pnpm run lint`.
- [x] 5.3 Run focused Playwright checks for `/`, `/shelter-animals`, `/quick-use`, `/login`, and mobile navigation.
- [x] 5.4 Manually verify responsive layouts at mobile, tablet, and desktop widths.
- [x] 5.5 Verify no text overlaps, buttons remain readable, and animal cards keep stable dimensions with missing images.
