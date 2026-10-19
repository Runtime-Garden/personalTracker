-- Phase B-E extensions, forward-only. Review in staging first.
CREATE TABLE task_attachments (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  uploader_id uuid NOT NULL REFERENCES users(id),
  original_name varchar(200) NOT NULL,
  storage_key uuid NOT NULL UNIQUE,
  media_type varchar(60) NOT NULL,
  byte_size integer NOT NULL CHECK(byte_size>0 AND byte_size<=5242880),
  sha256 char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(task_id,workspace_id) REFERENCES tasks(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX task_attachments_task ON task_attachments(task_id,created_at DESC);
CREATE TABLE task_mentions (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(task_id,user_id)
);
CREATE TABLE sprint_snapshots (
  sprint_id uuid NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  total_tasks integer NOT NULL CHECK(total_tasks>=0),
  remaining_tasks integer NOT NULL CHECK(remaining_tasks>=0),
  completed_tasks integer NOT NULL CHECK(completed_tasks>=0),
  remaining_minutes bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(sprint_id,snapshot_date)
);
ALTER TABLE reminders ADD COLUMN timezone varchar(80) NOT NULL DEFAULT 'UTC';
ALTER TABLE reminders ADD COLUMN snoozed_until timestamptz;
CREATE TABLE system_alerts (
  id uuid PRIMARY KEY, severity varchar(12) NOT NULL CHECK(severity IN ('warning','critical')),
  event varchar(100) NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES users(id)
);
CREATE INDEX system_alerts_open ON system_alerts(created_at DESC) WHERE acknowledged_at IS NULL;
CREATE TABLE security_rate_limits (
  bucket varchar(150) PRIMARY KEY,
  attempts integer NOT NULL CHECK(attempts>=0),
  reset_at timestamptz NOT NULL
);
CREATE TABLE ai_provider_policy (
 provider varchar(80) PRIMARY KEY,
 enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ai_provider_policy(provider) VALUES
 ('openai'),('openrouter'),('deepseek'),('groq'),('mistral'),('xai'),('together'),('anthropic'),('google');
CREATE TABLE ai_model_pricing (
 provider varchar(80) NOT NULL,
 model varchar(100) NOT NULL,
 input_per_million_usd numeric(14,6) NOT NULL CHECK(input_per_million_usd>=0),
 output_per_million_usd numeric(14,6) NOT NULL CHECK(output_per_million_usd>=0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,model)
);
CREATE TABLE ai_user_limits (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 monthly_requests integer CHECK(monthly_requests BETWEEN 1 AND 1000000)
);
