---
name: basiret-design
description: Use this skill to generate well-branded interfaces and assets for Basiret (بصيرة), an Arabic-first social-media intelligence product, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files (colors_and_type.css, styles.css, components/, ui_kits/basiret/).

Basiret is **Arabic-first and RTL** — every artifact must set `dir="rtl"` and use IBM Plex Sans Arabic. Do not introduce English copy in chrome; English is reserved for numerals and the "Basiret" sub-mark. Do not use emoji. Use the existing custom SVG icon set (`SBIcon` in Sidebar.jsx, `I` map in shared.jsx) — do not pull in a CDN icon library.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Reuse `Sidebar`, `TypePill`, `Thumb`, and `AskFab` — they are the brand's signature elements.

If working on production code, copy `colors_and_type.css` and follow the token names exactly (`--purple-600`, `--ink-900`, `--canvas`, `--shadow-sm`, etc.). The semantic type classes (`.bsr-h1`, `.bsr-body`, `.bsr-num`) are stable.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
