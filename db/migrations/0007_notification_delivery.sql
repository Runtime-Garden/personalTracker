-- Deliverable notification queue. No automatic deletion of existing notifications.
CREATE TABLE notification_email_outbox (
 notification_id uuid PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 state varchar(12) NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','delivered','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 100),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 leased_at timestamptz,
 delivered_at timestamptz,
 last_error varchar(160),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_email_due ON notification_email_outbox(next_attempt_at) WHERE state IN ('pending','failed','sending');
CREATE OR REPLACE FUNCTION queue_verified_notification_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO notification_email_outbox(notification_id,user_id)
  SELECT NEW.id, NEW.user_id FROM users u
  JOIN notification_preferences p ON p.user_id=u.id
  WHERE u.id=NEW.user_id AND u.email_verified_at IS NOT NULL AND p.email=true AND u.disabled=false
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;$$;
CREATE TRIGGER notification_email_enqueue AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION queue_verified_notification_email();
