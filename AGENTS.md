# CashNudge — Agent Operational Directives & Persistent Instructions

## 1. Project Context
CashNudge is an AI-powered invoice risk estimation and payment follow-up assistant for freelancers, independent consultants, and micro-agencies.
Tagline: "Know the risk. Nudge the payment."

## 2. Skill Activation Directives

### Automatic Activation
- **Task Pre-flight Inspection:** Before implementing any task, silently inspect available skill descriptions (`.agents/skills/`) and determine which installed skills and workflows are relevant.
- **Frontend, UX, and Visual Design Work:**
  - Read and apply `.agents/skills/impeccable/SKILL.md` and the appropriate Taste Skill workflow.
  - Apply `design-taste-frontend` (`.agents/skills/design-taste-frontend/SKILL.md`) for public-facing landing pages and marketing surfaces.
  - Apply `minimalist-ui` (`.agents/skills/minimalist-ui/SKILL.md`) for authenticated product dashboards, invoice risk tables, follow-up composers, data visualizations, and application layouts.
- **Engineering, Architecture, & Quality Work:**
  - For planning, architectural decisions, backend implementation, debugging, or testing, apply relevant ECC skills and workflows (e.g., `architecture-decision-records`, `error-handling`, `tdd-workflow`, `verification-loop`, `browser-qa`).
- **Procedure Adherence:** Always read the actual `SKILL.md` instructions and referenced playbooks before executing rather than relying on skill names alone.
- **Visual & Browser Verification:** For substantial UI changes, perform real browser reviews at both desktop and mobile viewports when browser tooling is available. Inspect screenshots, identify rendering/contrast/layout defects, and remediate them before marking work complete.
- **Continuity:** Maintain and enforce these directives across all future development sessions and implementation tasks in this workspace.

### Silent Operation
- **Zero Narration:** Do not announce skill activations, list the skills being loaded, or narrate routine workflow steps to the user.
- **Autonomous Execution:** Do not ask the user to manually trigger or invoke a skill when it can be executed autonomously. Apply relevant skill instructions silently and natively.
- **Outcome-Oriented Reporting:** Report meaningful implementation decisions, test outcomes, technical blockers, or required user decisions—never internal workflow orchestration.
- **Strict Grounding & Honesty:** Never claim a skill was executed, a test passed, or a visual inspection was completed unless it truly occurred.
- **Pragmatic Judgment:** Request user input only when requirements or architectural trade-offs are genuinely ambiguous; exercise disciplined engineering judgment otherwise.
- **Safety Priority:** Higher-priority system and security instructions always govern. Automatic skill activation must never authorize destructive file modifications or unsafe shell commands.
