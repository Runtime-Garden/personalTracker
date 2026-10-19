# HTTP/API contract

## Conventions

Same-origin `/api/v1` REST-style JSON for core app; auth routes delegated to Better Auth under `/api/auth/*` (verify integration/version). Typed Zod/TypeBox schemas validated at transport and domain boundaries. OpenAPI generated from contracts where feasible. HTTP-only session cookies with CSRF/origin checks; no browser-stored bearer auth token. File downloads via authorized controller/signed short-lived URL. IDs opaque UUID/ULID (choose consistently, document).

- `GET` never mutates. `POST` creates or executes, `PATCH` changes typed fields, `DELETE` archives/removes with documented lifecycle.
- Pagination via cursor with stable ordering; `limit <= 100`, bounded filters and sorts.
- Idempotency keys required for high-impact actions, bulk edits, AI execution, exports and worker webhooks.
- Optimistic concurrency: `version` and/or `If-Match`; return `409 conflict` on stale plans.
- Standard error `{ "error": {"code":"FORBIDDEN", "message":"...", "requestId":"...", "details": []}}`; do not leak SQL/stack, secret or hidden-resource existence.
- Auth: `401` unauthenticated, `403` unauthorized (404 where existence masking is necessary), `409` conflicting state, `422` validation, `429` rate limits, `503` provider unavailable.

## Representative endpoints (implement selected phase only)

| Method | Route | Scope |
| --- | --- | --- |
| `GET` | `/api/v1/me` | Self identity + effective workspace role summaries |
| `GET` | `/api/v1/workspaces` | Membership-only listing |
| `POST` | `/api/v1/workspaces` | Create team space if instance allows |
| `GET` | `/api/v1/workspaces/:wid/projects` | Workspace member |
| `POST` | `/api/v1/workspaces/:wid/projects` | `project.create` |
| `GET` | `/api/v1/workspaces/:wid/tasks` | `task.read` + DB scoped query |
| `POST` | `/api/v1/workspaces/:wid/tasks` | `task.create` |
| `GET/PATCH/DELETE` | `/api/v1/workspaces/:wid/tasks/:tid` | Object and workspace policy |
| `GET/POST` | `/api/v1/workspaces/:wid/todo-lists` | List-level authorization |
| `PATCH` | `/api/v1/workspaces/:wid/todos/:id` | Item authorization |
| `GET/POST` | `/api/v1/workspaces/:wid/reminders` | Private/team reminder policy |
| `GET/POST` | `/api/v1/workspaces/:wid/sprints` | Sprint permissions |
| `POST` | `/api/v1/workspaces/:wid/sprints/:sid/items` | Explicit task-sprint association |
| `GET` | `/api/v1/search?workspaceId=...&q=...` | Row-level search + rate limit |
| `GET/POST` | `/api/v1/me/focus-sessions` | Personal only |
| `POST` | `/api/v1/ai/runs` | Auth, opt-in, capabilities, budget |
| `GET` | `/api/v1/ai/runs/:rid/events` | Owner scoped stream (SSE if appropriate) |
| `POST` | `/api/v1/ai/proposals/:id/approve` | Owner/approver + CSRF + fresh policy |
| `POST` | `/api/v1/ai/proposals/:id/reject` | Owner/approver |
| `GET/PATCH` | `/api/v1/system/settings` | `system_admin` only |
| `GET` | `/api/v1/system/health-summary` | `system_admin` only |

## Example create task

```http
POST /api/v1/workspaces/01.../tasks
Content-Type: application/json
Idempotency-Key: random-value

{"title":"Design invitation flow","projectId":"01...","status":"todo","priority":"high","dueDate":"2026-10-25"}
```

Response `201` includes opaque task ID, authoritative `workspaceId`, `version` and links. Membership and target project workspace are verified server-side. User may not inject `createdById`, `systemAdmin`, `completedBy` or `workspaceId` into an object patch.

## Example AI proposal lifecycle

`POST /api/v1/ai/runs {workspaceId, message, mode:'propose'}` → stream plan and tool results; backend persists proposal `{id, authorId, workspaceId, baseVersions, proposedChanges, expiresAt}` → user reviews diff → `POST /api/v1/ai/proposals/:id/approve` with CSRF/idempotency key → revalidate permissions and versions → apply with transaction → audit and outcome. A plain text response is never equivalent to a persisted change.

## Never expose

Raw DB queries, secret/API key values, unrestricted bulk user export, internal health endpoints, hidden workspace names, task text from another workspace, environment dumps, stack traces, file system paths or LLM provider debug bodies that contain private data.
