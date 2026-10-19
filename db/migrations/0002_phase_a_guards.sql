-- Prevent overlapping running timers for a user, even with concurrent requests.
CREATE UNIQUE INDEX focus_one_running_per_user ON focus_sessions(user_id) WHERE state='running';
-- Optional invite carried through the OAuth state, never through redirects.
ALTER TABLE oauth_states ADD COLUMN invite_token_hash char(64);
