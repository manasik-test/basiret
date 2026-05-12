# Button styling issues

_Started 2026-04-22 14:41 UTC_

---

## User

i sent this design to claude code but i dont get exact result. specialy buttons

## Assistant

I'll take a look at the current design and understand what you're seeing.

_[tool: list_files]_

_[tool: read_file]_

I want to look at the buttons specifically. Let me check the design system, styles, and the home/components for button definitions.

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

Let me look at the actual home page to find buttons and understand what you're trying to replicate.

_[tool: read_file]_

_[tool: read_file]_

Let me see the page rendered to understand what buttons look like, and verify what differences may be confusing Claude Code.

_[tool: show_html]_

I understand the issue now. Looking at your buttons in `HomeApp.jsx`, I can see exactly what's happening — there are several distinct button styles defined inline that Claude Code may be misinterpreting because they're embedded in a `<style>` block at the bottom of a JSX file rather than in a clean CSS spec.

Let me give Claude Code an exact, copy-pasteable button specification by extracting the button styles from your design.

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

I now have a clear picture. Let me create a clean button spec file Claude Code can follow exactly. The key buttons in your design are:

_[tool: snip]_

I'll create a clean, isolated button reference spec that Claude Code can follow precisely. Let me build a self-contained Buttons reference page.

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

I built a **Buttons Spec.html** handoff page that gives Claude Code exact, copy-pasteable specs for every button in the dashboard. Why your buttons probably came back wrong:

**The issue:** the button styles in `HomeApp.jsx` are buried inside a `<style>` template literal at the bottom of a 400-line JSX file, mixed with layout CSS. Claude Code likely couldn't isolate them cleanly — and there are **7 distinct button types** in the design (not one), each with different padding/radius/colors.

**The 7 button types:**
1. **Primary** (purple, with shadow) — `var(--purple-600)`, 10×16, radius 10
2. **Dark CTA** (ink, hovers purple) — `var(--ink-900)`, 9×14, radius 9
3. **Urgent CTA** (coral) — `oklch(0.55 0.17 30)`, 9×14, radius 9
4. **Ghost** (outline) — transparent + `var(--line-strong)` border
5. **Primary-fill dark** — slightly larger ink button (11×18)
6. **Segmented control** — track + active state with white pill + shadow
7. **Link button** — bare purple text

**Common mistakes Claude Code makes:**
- Uses `border-radius: 8px` everywhere instead of the specific 9/10/7px values
- Forgets `box-shadow: 0 6px 16px -6px rgba(99,65,224,.5)` on Primary (this is what gives it lift)
- Uses Primary purple where Dark ink should be (the urgent/dark CTAs are NOT purple by default — they hover purple)
- Doesn't use `font-family: inherit` so buttons get a different font than the body

**To get exact results:** attach `Buttons Spec.html` (or the source `colors_and_type.css` + this spec) to your Claude Code prompt, and tell it to match the named buttons exactly. Each button has its CSS isolated and labeled, plus a spec table with every value.

