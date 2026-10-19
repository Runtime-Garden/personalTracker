# Screen map, responsive UX and interaction spec

## App navigation and routes

| Surface | Route idea | Key UI requirements |
| --- | --- | --- |
| Home/Dashboard | `/app` | Workspace context, My Day, active projects, focused priorities, reminders, start focus |
| Inbox | `/inbox` | Quick capture with unassigned project, keyboard and mobile convenience |
| My Day | `/my-day` | User-chosen plan, due suggestions, ordering, daily review |
| Tasks | `/tasks` | List/filter/sort/search, details in drawer on desktop/full route mobile |
| Projects | `/projects` | Project list and status, recent boards |
| Project detail | `/projects/:id` | Overview, tasks, backlog, members if authorized |
| Board | `/projects/:id/board` | Columns/cards, touch-safe and keyboard-safe move alternatives |
| Sprints | `/projects/:id/sprints` | Backlog, current sprint, planning and completion |
| Todos | `/todos` | Lightweight list + lists, optional task link |
| Reminders | `/reminders` | Upcoming/today/snoozed/history, status + timezone |
| Important | `/important` | Flagged tasks, todos and reminders with source labels |
| Focus | `/focus` | Accessible timer and sessions history, task link |
| Search | `/search` | Scoped result sections and filters |
| AI Assistant | right rail / mobile `/ai` | Scoped thread, model, plan preview, approvals |
| User/workspace/system settings | `/settings/*`, `/w/:id/settings` | Progressive role-specific navigation |

## Dashboard redesign goals

Top bar: workspace switcher + page title + global search + quick-create + notification + avatar. Desktop sidebar: Home, My Day, Inbox, Tasks, Projects, Board (contextual), Todos, Reminders, Focus, AI, Settings; hide board/sprint shortcuts when no selected project. At-a-glance sections prioritize next action over raw metrics: **Today**, **My focus**, **Overdue**, **Upcoming**, **Project health**. Avoid three giant cards dominating above-the-fold on mobile.

## Task detail

Title editable; status, priority, dates, assignee, project, sprint, labels; description and checklist/subtasks; activity/comments; attachments when enabled. Changes must show pending/saved/error and stale version conflict; no autosave that silently loses text. Support deep linking. On mobile task detail is an accessible page/sheet with save/cancel and bottom action bar; avoid narrow right drawer.

## Kanban

Desktop supports pointer drag-and-drop with graceful feedback; mobile supports tap “Move to...” sheet and optionally touch drag; keyboard users move via accessible menu/buttons and live announcements. Board can scroll horizontally with sticky column headers, but does not swallow vertical page scrolling. Preserve order server-side, detect version conflicts, never rely on optimistic appearance alone.

## AI interaction

Use command palette `Ask AI` and tabbed rail: Ask / Plan / Proposed Actions / History (if opted in). Render proposed changes as compact diff cards with explicit confirmation; ensure provider selection is not distracting. During provider failure present task actions manually, not blank app.

## Small screen design checks

320/360/390/428px widths, device safe areas, portrait/landscape; 768px tablet and 1024/1280/1440 desktop. No clipped settings menu or fixed-width dashboard. Keyboard visible on mobile doesn't cover submit, and dialogs prevent background scroll. Test dark theme, reduced motion, 200% text zoom and no pointer/hover.

## Content design

Use authentic compact English labels: “My Day”, “Plan your day”, “Add a task”, “No reminders yet”, “Choose a workspace”, “Review AI changes”, “Something didn’t save — retry”. Distinguish an empty list from inaccessible data; avoid scary 404 for permissions. Provide small descriptions and onboarding with no fake example data that could be mistaken for real tasks.
