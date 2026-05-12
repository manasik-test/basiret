# Basiret Design System

**Basiret (بصيرة)** — "insight" in Arabic — is an Arabic-first social-media intelligence and content-planning tool for creators and small brands in the GCC region. It helps users plan content, understand their audience, track competitors, read sentiment, ride trends, and ship posts with AI assistance.

The product is RTL-first, Arabic-primary, with English used only for numerals and brand sub-marks.

---

## Files in this system

```
README.md                 — this file
SKILL.md                  — agent skill manifest
colors_and_type.css       — CSS variables + semantic type classes
styles.css                — full app stylesheet (extends colors_and_type.css)
components/               — JSX building blocks used across screens
  ├ Sidebar.jsx           — primary navigation
  ├ shared.jsx            — TypePill, Thumb, Icon, WEEK_DATA
  ├ AskFab.jsx            — floating "اسأل بصيرة" assistant
  ├ HomeApp.jsx           — home dashboard
  ├ MyPostsApp.jsx        — posts grid / table
  ├ AudienceApp.jsx       — audience analytics
  ├ OptionCApp.jsx        — content plan (final pick)
  ├ CompetitorsApp.jsx    — competitor tracking
  ├ SentimentApp.jsx      — sentiment analysis
  └ TrendsApp.jsx         — trend radar
preview/                  — design-system review cards
ui_kits/basiret/          — interactive UI kit (index.html + components)
```

Open the **Design System** tab to browse all preview cards.

---

## Content fundamentals

**Language.** Arabic primary (RTL). Numerals and brand sub-marks use Latin. Dates can be either Arabic ("٢٦ أبريل") or Latin — pick one per surface and stay consistent.

**Voice.** Calm, expert, slightly poetic — never breathless. Basiret is a senior advisor, not a hype-bot. Examples from real screens:
- Section title: *"خطة المحتوى لهذا الأسبوع"* (your content plan for this week) — declarative, possessive.
- AI suggestion CTA: *"اقتراح بصيرة"* (Basiret suggests) — the product becomes the speaker; never "AI" or "ML."
- Empty/zero states use full sentences, not single-word labels.

**Casing & punctuation.** Arabic: no casing. Latin runs (numbers, brand "Basiret", "Pro", weekday abbreviations) follow normal English title case. Avoid ALL CAPS in Arabic; reserve uppercase for the eyebrow/Latin label style only.

**Emoji.** No. Emoji is not part of the brand. Use the icon library or content-type pills instead.

**Numbers.** Latin numerals in tabular-nums (`.bsr-num`) for all data, KPIs, and analytics. Arabic numerals are acceptable for editorial dates inside content cards.

---

## Visual foundations

**Color.** Single-accent system. **Purple** (`--purple-600` for actions, `--purple-500` for brand) is the only chromatic accent in the chrome. Everything else is a cool-leaning neutral (`--ink-*`). Three muted content-type hues (video coral / image teal / carousel violet) carry equal chroma in oklch so they read as siblings, not a rainbow. Status colors exist but appear sparingly.

**Backgrounds.** Soft lavender canvas (`--canvas: #f5f3f9`) under white surfaces (`--surface`). Never pure `#fff` page; never pure `#000` text. No full-bleed photography in chrome. No gradients in chrome — only inside content thumbnails (`Thumb` component) where they read as imagery, not decoration.

**Typography.** IBM Plex Sans Arabic (300/400/500/600/700) for everything Arabic. Inter for numbers, Latin labels, and the brand sub-mark. Display sizes have tight letter-spacing (-0.02em → -0.005em); body and below sit at 0. Tabular numerals are mandatory in any data context.

**Spacing.** 4px base. Cards use 20–24px internal padding. Sections sit 24–32px apart. Sidebar nav uses 10/12 padding with 2px row gaps for density.

**Corners.** Generous and consistent — `--radius` (12px) is the default for cards, inputs, buttons. `--radius-lg` (16px) for prominent surfaces. `--radius-pill` (999px) for badges and pills. Never sharp corners.

**Borders.** `1px solid var(--line)` is the default. `--line-strong` for emphasized dividers. We rely on borders + soft shadow together — never borderless cards on canvas.

**Shadows.** Three steps, all ink-tinted (`rgba(30, 20, 70, ...)`) — never gray. `--shadow-sm` for resting cards, `--shadow` for hover/raised, `--shadow-lg` for floating popovers and the AskFab.

**Animation.** Quick (100–200ms), eased, restrained. Hover transitions on color/background only (`transition: background 0.12s, color 0.12s`). No bounces, no spring. Press states darken or shift opacity slightly — they do not scale.

**Hover & press.**
- Buttons: bg shift one tier (e.g. `--purple-600 → --purple-700`).
- Nav items: bg → `--ink-100`, color → `--ink-900`.
- Active nav: bg `--purple-50`, text `--purple-700`, icon `--purple-600`.
- Press: no scale; brief darken via the next color tier.

**Transparency & blur.** Used sparingly — popover overlays and modal scrims only. Chrome itself is fully opaque.

**Cards.** White surface, 1px line border, 12–16px radius, `--shadow-sm` resting, 20–24px padding. Cards sit on the lavender canvas, never on white.

**Layout rules.** Sidebar is fixed 240px, sticky, RTL-aligned (border-inline-start). Content max-width is bounded by the screen container — full-bleed inside the content area is rare.

---

## Iconography

**Style.** Custom inline SVG, 1.6–1.8 stroke weight, round caps and joins, 24×24 viewBox, sized 16–20px in use. No filled icons in nav (the active dot is a separate idiom).

**Source.** Hand-rolled in `components/Sidebar.jsx` (`SBIcon`) and `components/shared.jsx` (`Icon` + `I` map). Reuse these — do not introduce a CDN icon library, do not mix stroke weights, do not introduce filled glyphs without flagging.

**Brand mark.** A purple gradient rounded square with a simple concentric-circle glyph (outer ring + inner dot) — sourced in `Sidebar.jsx`. The mark always pairs with the wordmark "بصيرة" (large) and "Basiret" (small, Inter, uppercase tracking).

**Emoji.** Not used.

**Unicode glyphs.** Avoid as icons. Use the SVG set.

---

## Index of related files

- **Tokens:** `colors_and_type.css`
- **Full chrome stylesheet:** `styles.css`
- **Navigation:** `components/Sidebar.jsx`
- **Shared primitives:** `components/shared.jsx` (TypePill, Thumb, Icon, I)
- **AI assistant:** `components/AskFab.jsx`
- **Per-screen apps:** see component list above
- **Preview cards:** `preview/*.html`
- **UI kit:** `ui_kits/basiret/index.html`

---

## Caveats

- Fonts are loaded from Google Fonts (IBM Plex Sans Arabic, Inter); no local font files are bundled.
- The icon set is hand-rolled and small. New screens may need new glyphs — match the existing 1.7-stroke style.
- Status colors (`--success`, `--warning`, `--danger`) are defined but appear in only a few places; expand cautiously.
