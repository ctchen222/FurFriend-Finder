# FurFriend Finder DESIGN.md

## Visual Theme

FurFriend Finder is a calm, photo-first public-service marketplace for Taiwan shelter animals and lost-pet matching. The interface should feel trustworthy, searchable, and warm without becoming playful or decorative. Real animal records carry the emotion; UI chrome stays quiet.

Primary reference: `vendor/awesome-design-md/design-md/airbnb/DESIGN.md`

Secondary references:

- Notion: warm minimalism, soft paper-like surfaces.
- Mastercard: warm cream canvas, premium rounded/pill warmth.
- Claude: terracotta accent and calm editorial restraint.

Adaptation rule: use Airbnb's consumer marketplace grammar, not Airbnb branding. Keep FurFriend's own Taiwan shelter-data mission and Traditional Chinese copy, but shift the action color from bright coral-red toward a warmer terracotta. The product should feel humane and grounded, not promotional or candy-like.

## Color Palette

| Role | Token | Value | Usage |
|---|---|---|---|
| Canvas | `--color-canvas` | `#fffaf3` | Warm page background |
| Soft surface | `--color-surface-soft` | `#f6efe5` | Filter bands, secondary sections |
| Raised surface | `--color-surface-card` | `#fffdf8` | Animal cards, forms, modals |
| Warm surface | `--color-surface-warm` | `#f1e1d0` | Guidance panels and subtle highlights |
| Ink | `--color-ink` | `#2a211c` | Headings and primary text |
| Body | `--color-body` | `#51443c` | Paragraph text |
| Muted | `--color-muted` | `#7b6a5f` | Metadata and helper copy |
| Hairline | `--color-hairline` | `#e3d5c8` | Borders and dividers |
| Primary | `--color-primary` | `#b85c38` | Main CTAs and active state |
| Primary active | `--color-primary-active` | `#96472a` | Hover/pressed primary |
| Primary tint | `--color-primary-tint` | `#f8e3d6` | Badges and subtle callouts |
| Accent | `--color-accent` | `#2f6f5e` | Trust, success-adjacent highlights |
| Success | `--color-success` | `#2f6f5e` | Saved/success state |
| Error | `--color-error` | `#b3261e` | Validation and failure |

Use primary sparingly. Most pages should read as warm paper, dark brown ink, real animal photos, and one terracotta action. Use muted green only as a supporting trust/status color.

## Typography

Use:

```css
font-family: Inter, "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
```

Hierarchy:

- Hero display: 48-64px desktop, 34-40px mobile, weight 700.
- Page title: 32-40px desktop, 28-32px mobile, weight 700.
- Section title: 22-28px, weight 700.
- Card title: 16-18px, weight 700.
- Body: 16px, line-height 1.55.
- Metadata: 13-14px, line-height 1.45.

Avoid emoji as headings or primary icons. Avoid negative letter spacing.

## Components

### Buttons

- Primary button: coral fill, white text, 9999px radius for high-emphasis CTAs.
- Secondary button: white or soft gray fill, ink text, 1px hairline border.
- Compact button: 44px minimum height for touch.
- Loading buttons keep width stable and expose a spinner plus text.

### Navigation

- Sticky white header with subtle hairline.
- Brand text is plain: "FurFriend Finder".
- Main routes: 收容所動物, 快速比對, 協尋登記, 登入/個人資料.
- Mobile menu uses the same route order and accessible expanded state.

### Animal Cards

- Photo is the load-bearing visual element.
- Use fixed aspect ratio so card layout does not jump.
- Metadata order: species/variety, shelter or city, sex/color, location.
- Missing photo fallback should be quiet: no large emoji, no loud illustration.

### Search and Filters

- Use pill-like or rounded filter containers.
- Labels stay visible.
- Active filter state must be understandable with text or chip state, not only color.

### Forms

- Group fields by user mental model: animal identity, appearance, location, contact.
- Required fields are marked and explained close to the field.
- Inputs are 44px or taller.
- Submit copy should describe the action outcome.

### Match Results

Ranked result cards prioritize:

1. Rank
2. Distance when available
3. Photo
4. Shelter
5. Species / variety
6. Sex / color
7. Found location

Empty states should give next steps: broaden criteria, browse shelter animals, or register a lost report.

## Layout

- Max content width: 1180-1280px for catalog pages.
- Forms: 720-960px with clear section panels.
- Cards: 14px radius, 1px border, shallow hover only.
- Major vertical sections: 56-72px.
- Catalog card gutters: 20-24px desktop, 16px mobile.

## Responsive Behavior

- Mobile pages should avoid horizontal scrolling.
- Touch targets must be at least 44px high.
- Animal grids collapse to one column on narrow phones, two columns on larger mobile/tablet where space allows.
- Header menu must stay reachable and not overlap content.

## Do

- Lead with real animal photos and useful record data.
- Keep actions clear and direct.
- Use calm Traditional Chinese copy.
- Preserve existing EJS and vanilla JavaScript architecture.

## Do Not

- Do not copy Airbnb brand elements verbatim.
- Do not use paw-print backgrounds on core task pages.
- Do not let emoji compete with animal photos.
- Do not add a frontend framework for this redesign.
- Do not change matching, auth, email, or API side effects.
