-- Phase B: account recovery, TOTP, verified email and provider linking metadata.
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN totp_secret_encrypted text;
ALTER TABLE users ADD COLUMN totp_enabled_at timestamptz;
CREATE TABLE one_time_tokens (
 token_hash char(64) PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK (purpose IN ('password_reset','email_verify','login_second_factor')),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 attempts smallint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX one_time_tokens_user ON one_time_tokens(user_id,purpose);
CREATE TABLE recovery_codes (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 code_hash char(64) NOT NULL,
 consumed_at timestamptz,
 PRIMARY KEY(user_id,code_hash)
);
CREATE TABLE security_events (
 id uuid PRIMARY KEY, user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 event text NOT NULL, ip_hash char(64), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX security_events_by_user ON security_events(user_id,created_at DESC);
