## 1. Shared Missing Photo Helper

- [x] 1.1 Update `src/public/js/common.js` so missing animal pictures no longer resolve to a `placehold.co` URL.
- [x] 1.2 Add a shared helper that renders either a real animal `<img>` or a local missing-photo fallback.
- [x] 1.3 Add a shared failed-image handler that swaps broken image URLs to the same fallback.

## 2. UI Integration

- [x] 2.1 Update homepage featured animal rendering to use the shared photo helper.
- [x] 2.2 Update shelter animal cards to use the shared photo helper.
- [x] 2.3 Update quick-match result cards to use the shared photo helper.
- [x] 2.4 Update the lightbox image area to use the shared photo helper.

## 3. Styling

- [x] 3.1 Add CSS for the quiet missing-photo surface, icon mark, and Traditional Chinese label.
- [x] 3.2 Ensure the fallback fills existing image containers without changing card, result, featured, or lightbox dimensions.

## 4. Tests and Verification

- [x] 4.1 Update focused Playwright coverage so missing pictures render `照片暫缺`, not `No photo`.
- [x] 4.2 Cover failed image loads replacing the image with the same fallback.
- [x] 4.3 Run `openspec validate improve-missing-photo-fallback`.
- [x] 4.4 Run `pnpm run lint`, `pnpm run type-check`, `pnpm run build`, and focused E2E tests.
