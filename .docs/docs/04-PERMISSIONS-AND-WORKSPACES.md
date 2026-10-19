# Workspaces, roles and authorization

## Identity and boundaries

1. **User** is one verified account holder; OAuth identities are bound to an internal immutable user ID.
2. Every user receives a **personal workspace** with a single owner and private content by default.
3. A **team workspace** has owner/admin/member/viewer roles, explicit memberships and optional project-level restrictions in a future phase.
4. **System admin** is a separate instance-level role and not the same as team admin. System admins manage infrastructure settings, user lifecycle, connectors and metadata; **do not automatically have content access**.
5. A session may have an active workspace for UX convenience, but the backend must resolve authorization from the requested object's workspace and DB membership — never only from an `activeWorkspaceId` header.

## Default permissions matrix

| Operation | Personal owner | Team owner | Team admin | Team member | Team viewer | System admin outside workspace |
| --- | --- | --- | --- | --- | --- | --- |
| View own/member-visible workspace content | Yes | Yes | Yes | Yes | Yes | No |
| Create/update permitted project tasks | Yes | Yes | Yes | Yes | No | No |
| Delete/archive others' tasks | Yes | Yes | Yes | Limited (own + policy) | No | No |
| Add comments | Yes | Yes | Yes | Yes | No | No |
| Manage sprints/workflow | Yes | Yes | Yes | No | No | No |
| Invite/remove members | N/A | Yes | Yes (except owner) | No | No | No |
| Change workspace AI policy | Yes | Yes | Optional delegated | No | No | No |
| Delete workspace | Yes | Yes | No | No | No | No |
| Change instance registration, auth, AI policy | No* | No* | No | No | No | Yes |
| Read provider keys in plaintext | No | No | No | No | No | No |

`*` A user who separately holds system-admin may administer the instance after reauthentication; do not conflate these roles.

## Policy granularity

For every operation evaluate: authentication → resource identity → resource workspace → active membership → role permissions → optional ownership/privacy flags → current record version → action policy. Deny by default. Team members might view workspace records unless the record is explicitly private; future project-scoped ACL can extend but not weaken default isolation.

## Implementation guidance

Use centralized domain authorization functions: `can(user, action, resource)` and query-scoping helpers that **join membership**. Do not fetch a record unscoped and merely hide fields later. Routes, exports, search, file storage, background worker, audit viewer, AI tools and API integrations must call shared policy methods.

Tests must include **IDOR**, cross-workspace task IDs, guessed slug, changing `workspaceId` in PATCH, cross-project reassignment, user revoked mid-session, invite escalation, role downgrade during open modal, search count leaks, file URL reuse, and an AI tool attempting the same forbidden call. Check workspace ID and user ID both in SQL WHERE and domain rules.

## Personal-to-team sharing

Do not “convert” a personal workspace into a team by adding members. To share a private task, use **explicit copy or move** with preview and destination validation; moved/copied subtasks, comments and attachments require special review. Moving should not silently expose private history or linked AI conversations. It may be safer to copy stripped content and let the user choose what to include.

## Membership and invitation lifecycle

Invite only by eligible role, signed opaque single-use code stored hashed in DB, bounded expiry and rate limits, checked against verified signed-in recipient identity. Owner cannot remove last owner without explicit ownership transfer. Revoking a member invalidates their team access immediately (including pending AI approvals); do not wait for session expiration. Soft-delete and audit membership changes.
