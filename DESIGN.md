---
name: CashNudge
description: "Know the risk. Nudge the payment. Distinctive, credible fintech design system for invoice risk intelligence."
colors:
  canvas: "#FBFBFA"
  canvas-pure: "#FFFFFF"
  surface: "#FFFFFF"
  surface-muted: "#F7F6F3"
  text-primary: "#111111"
  text-secondary: "#555555"
  text-muted: "#787774"
  border-subtle: "#EAEAEA"
  border-strong: "#D4D4D2"
  brand-primary: "#111111"
  brand-primary-hover: "#2A2A2A"
  brand-primary-text: "#FFFFFF"
  risk-low-bg: "#EDF3EC"
  risk-low-text: "#346538"
  risk-medium-bg: "#FBF3DB"
  risk-medium-text: "#956400"
  risk-high-bg: "#FDEBEC"
  risk-high-text: "#9F2F2D"
  accent-blue-bg: "#E1F3FE"
  accent-blue-text: "#1F6C9F"
typography:
  display:
    fontFamily: "'Instrument Serif', 'Newsreader', 'Playfair Display', Georgia, serif"
    fontSize: "clamp(2.5rem, 6vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  heading-1:
    fontFamily: "'Geist Sans', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  heading-2:
    fontFamily: "'Geist Sans', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "'Geist Sans', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.005em"
  body-small:
    fontFamily: "'Geist Sans', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  mono:
    fontFamily: "'Geist Mono', 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.01em"
rounded:
  none: "0px"
  sm: "4px"
  md: "8px"
  lg: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  macro: "80px"
components:
  button-primary:
    backgroundColor: "{colors.brand-primary}"
    textColor: "{colors.brand-primary-text}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.brand-primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  card-bento:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "24px"
  badge-risk-low:
    backgroundColor: "{colors.risk-low-bg}"
    textColor: "{colors.risk-low-text}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  badge-risk-medium:
    backgroundColor: "{colors.risk-medium-bg}"
    textColor: "{colors.risk-medium-text}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  badge-risk-high:
    backgroundColor: "{colors.risk-high-bg}"
    textColor: "{colors.risk-high-text}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

# CashNudge Design System

## Overview

CashNudge unites financial risk intelligence and client relationship management for independent workers. The visual design establishes a distinctive, credible fintech identity grounded in high-craft editorial restraint rather than template SaaS formulas.

The system bifurcates intentionally by surface mode:
1. **Public Marketing & Landing Page (Persuade):** Governed by `design-taste-frontend`. Employs an editorial type voice (`Instrument Serif` display headers), generous macro-whitespace, real-world freelancing scenario vignettes, and asymmetrical bento compositions.
2. **Authenticated Application & Invoice Dashboard (Operate):** Governed by `minimalist-ui`. Ultra-refined, utilitarian, document-style workspace architecture. High-contrast typography, strict 1px light borders (`#EAEAEA`), tabular numeric scanning (`Geist Mono`), muted pastel risk indicators, and human-in-the-loop message drawers.

## Colors

Color is treated as an informative, scarce resource rather than decorative filler.

- **Canvas & Backgrounds:**
  - Base App Canvas: Warm Bone (`#FBFBFA`) providing subtle paper warmth.
  - Card & Table Surfaces: Pure White (`#FFFFFF`) or Crisp Warm Ivory (`#F9F9F8`).
  - Dark Theme: Intentionally reserved for specific code/debug modes; default experience remains pristine warm daylight.
- **Text & Foreground:**
  - Primary Text: Off-black Charcoal (`#111111`) to prevent harsh OLED black contrast while maintaining pristine legibility.
  - Secondary Slate: `#555555` for contextual captions and metadata.
  - Muted Gray: `#787774` for timestamps, table column guides, and helper hints.
- **Semantic Risk Spectrum (Muted Pastels):**
  - Low Risk: `#EDF3EC` surface with `#346538` deep forest text.
  - Moderate / In Review: `#FBF3DB` surface with `#956400` deep amber text.
  - High Risk / Overdue: `#FDEBEC` surface with `#9F2F2D` crimson text.
  - Informational / TabPFN Evaluation: `#E1F3FE` surface with `#1F6C9F` navy text.

## Typography

Typographic hierarchy creates instant structural hierarchy without requiring colored boxes or decorative icons.

- **Editorial Display Serif (`Instrument Serif`):**
  - Reserved for landing page value propositions and major conceptual section headers.
  - Tracking: Tight (`-0.03em`), line height: `1.1`.
- **Primary Interface Sans (`Geist Sans` / `SF Pro`):**
  - Clean, neutral, high-legibility geometric sans-serif for dashboard headings, buttons, form controls, and body copy.
  - Body copy is set at generous line height (`1.6`) with crisp letter spacing (`-0.005em`).
- **Data & Numeric Monospace (`Geist Mono` / `SF Mono`):**
  - Standard across all financial amounts, invoice IDs, due dates, confidence interval scores, and TabPFN probability metrics.
  - Guarantees vertical tabular alignment across numeric invoice rows.

## Layout

- **Macro-Whitespace:** Major landing sections breathe with 80px–120px vertical padding (`py-20` to `py-28`). Dashboard views utilize structured 32px padding for dense information accessibility.
- **Bento & Data Grid Architecture:**
  - Structured CSS grid layouts with explicit gap systems (`16px` or `24px`).
  - Cards feature `border: 1px solid #EAEAEA` with crisp, subtle corner radii (4px to 8px).
- **Responsive Adaptability:**
  - Desktop: Multi-column cash flow summary, full tabular invoice register with inline risk indicators, and side-by-side reminder preview.
  - Mobile: Condensed card-based invoice rows, sticky bottom action bar, and full-viewport drawer for reminder drafting.

## Elevation & Depth

- **Strict Ban on Heavy Drop Shadows:** No generic `0 10px 15px -3px rgba(0,0,0,0.1)` drop shadows.
- **Structural Separation via Borders:** Rely on 1px crisp borders (`#EAEAEA`) and tone shifts (`#FFFFFF` on `#FBFBFA`) for z-index layering.
- **Micro-Shadows on Interactive Elevate:** Floating drawers and dropdowns utilize ultra-diffuse micro-shadows: `box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04)`.

## Shapes

- Containers and panels: Clean, modest radiuses of `4px` to `8px`.
- Interactive Primary Buttons: Crisp `4px` radius; avoid `rounded-full` pill buttons for structural actions.
- Status and Risk Badges: Micro pill-shapes (`border-radius: 9999px`) with uppercase tracked typography (`text-xs`, `letter-spacing: 0.05em`).

## Components

1. **Invoice Risk Table:**
   - Strict horizontal 1px border dividers.
   - Fixed-width numeric columns with `Geist Mono` alignment.
   - Color-coded risk pills showing TabPFN score alongside primary risk driver (e.g., "72% · First invoice to client", "18% · Fast historical payer").
2. **Cash Flow Summary Metric Cards:**
   - Asymmetrical top banner showing "Total Outstanding", "At-Risk Cash Flow", and "Safe / Imminent".
   - Subtle sparklines or progression indicators with monochromatic strokes.
3. **Gemma Follow-Up Composer Drawer:**
   - Grounded context pill displaying invoice details, payment terms, and past correspondence count.
   - Tone selector: "Gentle nudge", "Professional inquiry", "Firm notice".
   - Editable message textarea with clear "Human Approval Required" badge and copy-to-clipboard / mailto dispatch buttons.
4. **Empty & Error States:**
   - Thoughtfully crafted, document-style empty state with direct CSV upload dropzone.
   - Clear failure recovery when ML evaluation encounters malformed input or server errors.

## Do's and Don'ts

### Do:
- Display uncertainty intervals and explanatory drivers alongside every TabPFN risk score.
- Ensure all text passes WCAG AA 4.5:1 contrast standards against background canvases.
- Provide immediate, editable human review before any payment communication is triggered.
- Use realistic invoice numbers, authentic client company archetypes, and believable freelance scenarios.
- Support smooth micro-interactions that respect `prefers-reduced-motion`.

### Don't:
- DO NOT use generic AI clichés: "unleash", "elevate", "game-changer", "delve".
- DO NOT use generic stock photos, purple neon gradients, or 3D glassmorphic cards.
- DO NOT use generic icon overload; prefer clear typographic labels and concise, uniform SVG strokes.
- DO NOT treat TabPFN outputs as deterministic guarantees.
- DO NOT trigger automated emails without an explicit user confirmation step.
