-- WebAuthn passkeys: credential public keys are non-secret. All challenges are single-use.
CREATE TABLE passkeys (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0 CHECK(counter>=0),
  transports jsonb NOT NULL DEFAULT '[]'::jsonb,
  device_type text NOT NULL DEFAULT 'singleDevice',
  backed_up boolean NOT NULL DEFAULT false,
  label varchar(120) NOT NULL DEFAULT 'Passkey',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX passkeys_user_idx ON passkeys(user_id);
CREATE TABLE passkey_challenges (
  flow_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK(purpose IN ('registration','authentication')),
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX passkey_challenges_expiry_idx ON passkey_challenges(expires_at);
