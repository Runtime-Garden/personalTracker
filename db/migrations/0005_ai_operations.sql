-- Phase D/E: AI usage reporting, durable admin events and job status.
CREATE TABLE ai_usage (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 connection_id uuid REFERENCES ai_connections(id) ON DELETE SET NULL,
 operation text NOT NULL CHECK(operation IN ('ask','propose','test')),
 model varchar(100) NOT NULL,
 provider varchar(80) NOT NULL,
 input_tokens integer,
 output_tokens integer,
 duration_ms integer NOT NULL,
 succeeded boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_account ON ai_usage(user_id,created_at DESC);
CREATE TABLE job_runs (
 id uuid PRIMARY KEY, kind text NOT NULL,
 state text NOT NULL CHECK(state IN ('running','succeeded','failed')),
 started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 processed_count integer NOT NULL DEFAULT 0,
 error_message varchar(500)
);
CREATE INDEX job_runs_recent ON job_runs(started_at DESC);
