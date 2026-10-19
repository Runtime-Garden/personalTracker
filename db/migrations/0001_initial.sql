-- Personal Tracker Phase A · PostgreSQL 17 · 2026-10-19
-- Forward-only, transactional, checksum-verified migration.
CREATE TABLE app_settings (name text PRIMARY KEY, value text NOT NULL);
INSERT INTO app_settings(name,value) VALUES ('app_name','Personal Tracker'),('signup_mode','invite_only');
CREATE TABLE users (
 id uuid PRIMARY KEY, email text NOT NULL, name varchar(160) NOT NULL,
 pass_hash text, system_role text NOT NULL DEFAULT 'user' CHECK (system_role IN ('user','admin')),
 disabled boolean NOT NULL DEFAULT false, timezone text NOT NULL DEFAULT 'UTC', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_ci ON users (lower(email));
CREATE TABLE identities (
 provider text NOT NULL, subject text NOT NULL, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY (provider,subject)
);
CREATE TABLE sessions (
 token_hash char(64) PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE oauth_states (
 state_hash text PRIMARY KEY, nonce text NOT NULL, verifier text NOT NULL, return_to text NOT NULL,
 link_user_id uuid REFERENCES users(id), expires_at timestamptz NOT NULL
);
CREATE TABLE workspaces (
 id uuid PRIMARY KEY, name varchar(160) NOT NULL, kind text NOT NULL CHECK(kind IN ('personal','team')),
 owner_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE members (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
 joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,user_id)
);
CREATE INDEX members_user_idx ON members(user_id);
CREATE TABLE invites (
 token_hash char(64) PRIMARY KEY, email text NOT NULL, workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('admin','member','viewer')) DEFAULT 'member',
 created_by uuid REFERENCES users(id), expires_at timestamptz NOT NULL, used_at timestamptz
);
CREATE TABLE projects (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name varchar(220) NOT NULL, description text NOT NULL DEFAULT '', archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,workspace_id)
);
CREATE INDEX projects_workspace_idx ON projects(workspace_id,archived);
CREATE TABLE tasks (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 project_id uuid, title varchar(220) NOT NULL CHECK(length(trim(title)) > 0), description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'todo' CHECK(status IN ('backlog','todo','in_progress','review','done')),
 priority text NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
 important boolean NOT NULL DEFAULT false, assignee_id uuid REFERENCES users(id), due_date date,
 creator_id uuid NOT NULL REFERENCES users(id), position double precision NOT NULL DEFAULT 0,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), completed_at timestamptz,
 archived boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,workspace_id), FOREIGN KEY(project_id,workspace_id) REFERENCES projects(id,workspace_id)
);
CREATE INDEX tasks_scope_idx ON tasks(workspace_id,status,due_date) WHERE archived=false;
CREATE INDEX tasks_project_idx ON tasks(project_id,position);
CREATE TABLE comments (
 id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id), body varchar(5000) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE todo_lists (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name varchar(160) NOT NULL, owner_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,workspace_id)
);
CREATE TABLE todos (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 list_id uuid,task_id uuid,title varchar(220) NOT NULL,done boolean NOT NULL DEFAULT false,
 important boolean NOT NULL DEFAULT false,due_date date,creator_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(list_id,workspace_id) REFERENCES todo_lists(id,workspace_id),
 FOREIGN KEY(task_id,workspace_id) REFERENCES tasks(id,workspace_id)
);
CREATE TABLE reminders (
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL REFERENCES users(id),title varchar(220) NOT NULL,remind_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','delivered','done','dismissed')),
 important boolean NOT NULL DEFAULT false,task_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(task_id,workspace_id) REFERENCES tasks(id,workspace_id)
);
CREATE INDEX reminders_due_idx ON reminders(remind_at) WHERE state='pending';
CREATE TABLE notifications (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 reminder_id uuid UNIQUE REFERENCES reminders(id) ON DELETE CASCADE,
 message text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz
);
CREATE TABLE sprints (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 name varchar(220) NOT NULL,start_date date NOT NULL,end_date date NOT NULL,
 state text NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','active','closed')),
 created_at timestamptz NOT NULL DEFAULT now(),CHECK(end_date>=start_date)
);
CREATE TABLE sprint_tasks (
 sprint_id uuid NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
 task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,PRIMARY KEY(sprint_id,task_id)
);
CREATE TABLE my_day (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 plan_date date NOT NULL,PRIMARY KEY(user_id,task_id,plan_date)
);
CREATE TABLE focus_sessions (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 task_id uuid REFERENCES tasks(id),kind text NOT NULL CHECK(kind IN ('work','short_break','long_break')),
 planned_sec integer NOT NULL CHECK(planned_sec BETWEEN 60 AND 14400),started_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,ended_at timestamptz,
 state text NOT NULL DEFAULT 'running' CHECK(state IN ('running','completed','cancelled'))
);
CREATE TABLE ai_connections (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 provider text NOT NULL,model text NOT NULL,base_url text NOT NULL,secret_blob text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai_proposals (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),workspace_id uuid NOT NULL REFERENCES workspaces(id),
 connection_id uuid REFERENCES ai_connections(id),summary text NOT NULL,action_json jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit (
 id uuid PRIMARY KEY,actor_id uuid REFERENCES users(id),workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
 action text NOT NULL,target_id text,meta jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_time_idx ON audit(created_at DESC);
CREATE TABLE auth_limits (key text PRIMARY KEY,attempts integer NOT NULL,blocked_until timestamptz NOT NULL);
CREATE TABLE worker_state (name text PRIMARY KEY,value text NOT NULL);
