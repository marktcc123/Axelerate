-- Add platform and notes columns for UGC submission
ALTER TABLE public.user_gigs
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.user_gigs.platform IS 'Platform where UGC was posted: tiktok, instagram, youtube_shorts, other';
COMMENT ON COLUMN public.user_gigs.notes IS 'Optional creator notes when submitting UGC link';
