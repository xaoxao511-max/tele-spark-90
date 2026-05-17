-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Store service role key in vault so trigger can authenticate to edge function
-- (only insert if not present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'send_push_service_role') THEN
    PERFORM vault.create_secret(
      current_setting('app.settings.service_role_key', true),
      'send_push_service_role',
      'Service role key used by notify_new_message trigger'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Trigger function: posts message_id to send-push edge function
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  service_key TEXT;
  edge_url TEXT := 'https://fsboepgyotmjxfplybky.supabase.co/functions/v1/send-push';
BEGIN
  -- Skip system/deleted messages
  IF NEW.deleted = true THEN RETURN NEW; END IF;

  BEGIN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'send_push_service_role'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    service_key := NULL;
  END;

  IF service_key IS NULL THEN
    RAISE WARNING '[notify_new_message] service role key not in vault, skip push';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('message_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();