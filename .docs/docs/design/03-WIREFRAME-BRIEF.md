# Wireframe and design review brief for OpenCode

Before building UI, produce low-fidelity **app-specific** wireframes or written layout sketches for four core states: (1) mobile personal dashboard 390px, (2) desktop dashboard 1440px, (3) team Kanban tablet/desktop, (4) system settings inside same application shell; additionally login and mobile AI approval flows. If image generation/design tools are unavailable, use HTML/CSS prototypes in a local worktree instead of inventing image assets or claiming visual QA.

## Essential constraints

- Use exact v2 brand logo files from `references/brand/assets/`, not recreations or AI-generated variants.
- Layout must work at 320px and without hover. Keyboard navigation on boards and AI dialogs is non-negotiable.
- Separate Personal vs Team visually via workspace switcher and context labels; never imply one team's content is the user's private data.
- System admin menu is hidden for normal roles but server-only permission gates remain.
- Mark destructive and AI actions with review cards and confirmation affordances.
- Offer meaningful empty states, task density controls, and responsive data tables/cards.

## Review rubric (1–5 each)

Brand fidelity, visual hierarchy, quick capture, discoverability, personal/team clarity, mobile density, keyboard accessibility, form clarity, error handling, AI review safety, screen reader support, reduced motion support. Fix any blocker score <=2 before large implementation.

## Before screenshot reference

The existing screenshot under `references/legacy/dashboard.png` shows previous desktop UI with dashboard tabs, tasks/todo/reminder cards, focused tasks, a Pomodoro widget and sprint progress. Preserve core user value; do **not** carry over the dense one-line navbar or purple visual language.
