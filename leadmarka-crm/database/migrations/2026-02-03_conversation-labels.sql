-- Normalize / rename conversation tags (WhatsApp context labels)
-- Run this in Supabase SQL Editor

BEGIN;

UPDATE public.leads
SET conversation_label = 'Price enquiry'
WHERE conversation_label IS NOT NULL
  AND btrim(conversation_label) = 'Price asked';

UPDATE public.leads
SET conversation_label = 'Catalog sent'
WHERE conversation_label IS NOT NULL
  AND btrim(conversation_label) = 'Sent catalog';

UPDATE public.leads
SET conversation_label = 'Delivery pending'
WHERE conversation_label IS NOT NULL
  AND btrim(conversation_label) = 'Needs delivery fee';

UPDATE public.leads
SET conversation_label = 'Stock check in progress'
WHERE conversation_label IS NOT NULL
  AND btrim(conversation_label) = 'Checking stock';

-- "Follow-up tomorrow" is not a tag anymore; use scheduled follow-ups instead.
UPDATE public.leads
SET conversation_label = NULL
WHERE conversation_label IS NOT NULL
  AND btrim(conversation_label) = 'Follow-up tomorrow';

UPDATE public.leads
SET conversation_label = 'Waiting for payday'
WHERE conversation_label IS NOT NULL
  AND btrim(conversation_label) = 'Waiting payday';

UPDATE public.leads
SET conversation_label = 'Awaiting response'
WHERE conversation_label IS NOT NULL
  AND btrim(conversation_label) = 'No response';

UPDATE public.leads
SET conversation_label = 'Closed – Lost'
WHERE conversation_label IS NOT NULL
  AND btrim(conversation_label) = 'Not interested';

COMMIT;

