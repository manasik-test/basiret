# Basiret UI Kit

A self-contained interactive demo of the Basiret chrome — sidebar, top bar, tabs, KPI row, content-plan grid, and posts list — all built with vanilla HTML and the design-system tokens from `colors_and_type.css`.

## What's here
- **Sidebar** — brand mark + wordmark, nav with active/hover states, Pro upgrade CTA, user block
- **Top bar** — greeting, primary + secondary actions
- **Tabs** — 3-screen click-through (Home / Content Plan / Posts)
- **Home** — 4 KPI cards + recent-posts list with stats
- **Content Plan** — 7-day grid with thumbnail, type pill, topic, time
- **Posts** — full row table with stats columns
- **AskFab** — floating "اسأل بصيرة" assistant in the bottom-left

## Open
`ui_kits/basiret/index.html` — fully RTL, no build step.

## Notes
- This is a **visual recreation**, not production code. No state management beyond the tab toggle. Data is mocked in the inline `<script>`.
- For real React components, see `components/` at the project root (Sidebar.jsx, MyPostsApp.jsx, OptionCApp.jsx, etc.).
