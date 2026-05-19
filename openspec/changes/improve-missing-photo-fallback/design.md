## Context

The current UI already expects animal imagery to be the primary visual element and requires quiet placeholders when photos are missing. The implementation does not fully satisfy that contract because `getAnimalImage()` returns a remote `placehold.co` URL containing `No photo`, and failed government-CDN image loads are not normalized into the same fallback state.

## Decisions

1. Render the fallback locally with HTML and CSS.
   - This removes the third-party placeholder request and keeps the copy localized as `照片暫缺`.
   - The fallback stays visually quiet: warm surface, subtle border, small icon-like mark, muted text.

2. Centralize photo markup in the shared browser helper.
   - Add a helper that returns either an `<img>` element or the missing-photo fallback markup.
   - Add a small image-error handler that replaces failed `<img>` elements with the same fallback.
   - Keep `getAnimalImage()` for compatibility, but stop using it to manufacture external placeholder URLs.

3. Preserve current layout dimensions.
   - Existing containers continue to own fixed dimensions or aspect ratios.
   - The fallback fills the same container as the image so cards, results, and the lightbox do not shift.

4. Keep this change frontend-only.
   - Do not alter animal API payloads, random animal selection, matching logic, database records, or sync behavior.
   - Do not add an image asset pipeline or frontend framework.

## Risks

- Inline `onerror` handling must avoid XSS-sensitive string interpolation. The generated handler will use only static class-name arguments from application code, while animal-specific values continue to pass through existing escaping helpers.
- Some tests stub `getAnimalImage()` directly. Tests should be updated to assert rendered fallback behavior instead of the old placeholder URL.
