-- Mission 6 hitlist brand + Syndicate Intel Bounty questionnaire (consumer_intel jsonb).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hitlist_brand TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consumer_intel JSONB;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS intel_bounty_skipped_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS intel_bounty_claimed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.hitlist_brand IS 'Mission 6 The Hitlist: one brand/product to unlock';
COMMENT ON COLUMN public.profiles.consumer_intel IS 'Intel Bounty Q1-Q4 responses (optional survey)';
COMMENT ON COLUMN public.profiles.intel_bounty_skipped_at IS 'User dismissed Intel Bounty without claiming';
COMMENT ON COLUMN public.profiles.intel_bounty_claimed_at IS 'User claimed 500 credits + 100 XP from Intel Bounty';
