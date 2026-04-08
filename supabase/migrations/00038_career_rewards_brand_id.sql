-- Optional FK from career_rewards to brands (mirrors UUID in reward_key for brand:* keys)

ALTER TABLE public.career_rewards
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_career_rewards_brand_id ON public.career_rewards (brand_id);

UPDATE public.career_rewards cr
SET
  brand_id = (
    regexp_match(
      cr.reward_key,
      '^brand:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(cert|referral)$',
      'i'
    )
  )[1]::uuid
WHERE
  cr.reward_key
  ~* '^brand:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(cert|referral)$'
  AND cr.brand_id IS NULL;

COMMENT ON COLUMN public.career_rewards.brand_id IS 'Brand for brand:{uuid}:cert|referral; NULL for general_cert';
