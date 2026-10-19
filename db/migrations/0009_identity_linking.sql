-- A linked provider must be explicitly attached to an authenticated browser session.
ALTER TABLE oauth_states ADD COLUMN link_session_hash char(64);
ALTER TABLE identities ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX identities_account_idx ON identities(user_id);
