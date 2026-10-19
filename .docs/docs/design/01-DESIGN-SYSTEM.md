# Product UI design system — Runtime Garden v2

## Source and adaptation

Approved brand kit is in `references/brand/`, including v2 logos/marks, SVG icons, design tokens and visual board. **Reuse identity**, but adapt to a **productivity application**, not an editorial website. Current Personal Tracker screenshot is a before-state: dense desktop header, colored/purple primary pills, flat task list and small cards. New design should be a quieter, more legible workspace app with appropriate information hierarchy.

## Visual direction

*Calm engineering workspace.* Light-first warm off-white backgrounds, dark forest ink, moss/forest green action accents, clear subtle dividers, strategic whitespace, restrained iconography, intentional density. No neon AI startup aesthetic, fake glassmorphism, large purple gradients or gratuitous decorative motion. On dark mode use the supplied dark token set, not simple color inversion.

### Approved initial token values

| Token | Light | Dark |
| --- | --- | --- |
| Background | `#F6F8F3` | `#0D1713` |
| Surface | `#FFFFFF` | `#15231B` |
| Muted surface | `#EDF2E9` | `#1B2C22` |
| Ink | `#16271E` | `#EDF4ED` |
| Muted text | `#506459` | `#AFBEB1` |
| Accent | `#286A47` | `#8DD5A3` |
| Accent soft | `#DCEDE0` | `#243E2C` |
| Border | `#D8E1D6` | `#304337` |
| Warm/Warning | `#AD7742` | `#D6AD77` |
| Danger | `#A43B3B` | `#F3A3A3` |

Apply semantic tokens in component library: surface, elevated, border, text-muted, disabled, success, danger, warning, interactive-focus, selected. Validate AA contrast, especially green buttons and muted text on pale surfaces. Avoid relying on color alone for status.

### Typography and assets

Font stack from kit: Inter/Geist (sans), Newsreader (serif in limited editorial touches only), IBM Plex Mono/JetBrains Mono (monospace). Fallback to system fonts without remote font blocking. Use v2 SVG wordmark for login/expanded sidebar, compact mark for narrow sidebar/mobile; minimum horizontal logo ~180px; favicon below ~24px; preserve whitespace and no recoloring/distortion. Reference `references/brand/LOGO_V2_README_TR.md`.

## Component foundation

Buttons primary (forest green), secondary outlined, quiet ghost, danger with confirm; text inputs, selects, date/time picker, accessible combobox, command palette, tabs, menus, dropdowns, toast, skeleton, badges, avatar, charts, activity timeline, tags, breadcrumb, dialogs, focus timer, draggable board cards with keyboard alternate. shadcn/ui primitives are implementation starting points, **not** an excuse to use generic unstyled defaults; apply brand tokens and accessible states globally.

## Layout

- Desktop 1280+: fixed/collapsible side rail (~240px), top contextual title/search/actions, main content max-width adaptable, optional AI rail. Prefer sidebar over the legacy long top navigation.
- Tablet 768–1279: slim/overlay sidebar; responsive page gutters and adaptable columns.
- Mobile 320–767: compact top bar with active workspace, bottom navigation for frequent pages or accessible nav drawer; create action easy to reach; AI opens dedicated sheet. Avoid nested horizontal scrolling except intentional Kanban boards.
- Content density preference normal/compact on desktop; mobile never cram tables into unreadable widths; cards or wrapped rows.
- Use stable 8px spacing rhythm, 16px card radius and 10px button radius as starting tokens, not immutable law; layout based on usability.

## States and motion

Every page specifies loading, empty, error, conflict, success and limited-permission states. Motion limited to modest transforms/fades <= 200ms, respects `prefers-reduced-motion`. All clickable elements show visible focus, accessible labels and keyboard support. Non-hover access to every meaningful control.

## Product branding

Primary wordmark: **Personal Tracker**. Small product attribution: **by Runtime Garden** where suitable (login/footer/about). Do not relabel primary site Journal/Lab/Projects as product navigation. User's actual workspace names override dummy placeholder data. Avoid claimed built/shipped badges before implementation evidence.
