-- 1.0.0-rc.3: reminder re-delivery, hot-path indexes, custom AI endpoints and AI task triage. Additive only.

-- A reminder can fire more than once (snooze, reschedule); one notification per occurrence instead of per reminder.
ALTER TABLE notifications ADD COLUMN occurrence_at timestamptz;
UPDATE notifications n SET occurrence_at=r.remind_at FROM reminders r WHERE r.id=n.reminder_id AND n.occurrence_at IS NULL;
ALTER TABLE notifications DROP CONSTRAINT notifications_reminder_id_key;
CREATE UNIQUE INDEX notifications_reminder_occurrence ON notifications(reminder_id,occurrence_at) WHERE reminder_id IS NOT NULL;

-- The scheduled occurrence of a recurring series; snoozing moves remind_at but not the series.
ALTER TABLE reminders ADD COLUMN occurrence_at timestamptz;

-- Indexes for per-request queries.
CREATE INDEX notifications_user_recent ON notifications(user_id,created_at DESC);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX comments_task_idx ON comments(task_id,created_at);
CREATE INDEX reminders_owner_idx ON reminders(workspace_id,owner_id,remind_at);
CREATE INDEX todos_workspace_idx ON todos(workspace_id,created_at DESC);
CREATE INDEX tasks_workspace_position_idx ON tasks(workspace_id,position) WHERE archived=false;
CREATE INDEX focus_sessions_user_idx ON focus_sessions(user_id,started_at DESC);
CREATE INDEX audit_action_idx ON audit(action,created_at DESC);
CREATE INDEX oauth_states_expiry ON oauth_states(expires_at);
CREATE INDEX one_time_tokens_expiry ON one_time_tokens(expires_at);

-- User-supplied OpenAI-compatible and Anthropic-compatible endpoints (OpenRouter, vLLM, LiteLLM, gateways...).
INSERT INTO ai_provider_policy(provider) VALUES ('openai_compatible'),('anthropic_compatible') ON CONFLICT DO NOTHING;
ALTER TABLE ai_connections ADD COLUMN label varchar(80);

-- AI triage: a per-user opt-in model that sets priority/important for new tasks the user did not classify.
-- Connection tests are not tied to a workspace but still count toward the user's budget.
ALTER TABLE ai_usage ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE ai_usage DROP CONSTRAINT ai_usage_operation_check;
ALTER TABLE ai_usage ADD CONSTRAINT ai_usage_operation_check CHECK(operation IN ('ask','propose','test','triage','stream'));
CREATE TABLE ai_triage_settings (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 connection_id uuid REFERENCES ai_connections(id) ON DELETE SET NULL,
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tasks ADD COLUMN triage_source varchar(10) CHECK(triage_source IN ('ai','fallback'));
ALTER TABLE tasks ADD COLUMN triage_reason varchar(300);
