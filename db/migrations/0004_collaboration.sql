-- Phase C: task hierarchy, dependencies, labels and repeat rules.
ALTER TABLE tasks ADD COLUMN parent_task_id uuid;
ALTER TABLE tasks ADD COLUMN start_date date;
ALTER TABLE tasks ADD COLUMN estimate_minutes integer CHECK (estimate_minutes IS NULL OR estimate_minutes BETWEEN 1 AND 100000);
ALTER TABLE tasks ADD COLUMN recurrence text CHECK (recurrence IN ('daily','weekly','monthly'));
ALTER TABLE tasks ADD CONSTRAINT task_parent_scope FOREIGN KEY(parent_task_id,workspace_id) REFERENCES tasks(id,workspace_id);
ALTER TABLE tasks ADD CONSTRAINT task_not_own_parent CHECK (parent_task_id IS NULL OR parent_task_id <> id);
CREATE INDEX tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE TABLE task_dependencies (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 task_id uuid NOT NULL,
 depends_on_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(task_id,depends_on_id),
 FOREIGN KEY(task_id,workspace_id) REFERENCES tasks(id,workspace_id) ON DELETE CASCADE,
 FOREIGN KEY(depends_on_id,workspace_id) REFERENCES tasks(id,workspace_id) ON DELETE CASCADE,
 CHECK(task_id <> depends_on_id)
);
CREATE TABLE labels (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name varchar(80) NOT NULL, color char(7) NOT NULL DEFAULT '#386647',
 UNIQUE(id,workspace_id), UNIQUE(workspace_id,name)
);
CREATE TABLE task_labels (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 task_id uuid NOT NULL, label_id uuid NOT NULL,
 PRIMARY KEY(task_id,label_id),
 FOREIGN KEY(task_id,workspace_id) REFERENCES tasks(id,workspace_id) ON DELETE CASCADE,
 FOREIGN KEY(label_id,workspace_id) REFERENCES labels(id,workspace_id) ON DELETE CASCADE
);
CREATE TABLE task_watchers (
 task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(task_id,user_id)
);
CREATE TABLE notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 in_app boolean NOT NULL DEFAULT true,
 email boolean NOT NULL DEFAULT false,
 quiet_start time,
 quiet_end time
);
CREATE TABLE task_events (
 id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 event text NOT NULL, detail jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_events_recent ON task_events(task_id,created_at DESC);
-- Each completed recurring item may generate at most one successor.
ALTER TABLE tasks ADD COLUMN recurred_from_id uuid UNIQUE REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE reminders ADD COLUMN recurrence text CHECK(recurrence IN ('daily','weekly','monthly'));
ALTER TABLE reminders ADD COLUMN recurred_from_id uuid UNIQUE REFERENCES reminders(id) ON DELETE SET NULL;
