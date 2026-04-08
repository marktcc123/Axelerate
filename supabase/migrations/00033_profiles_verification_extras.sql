-- Optional profile fields for verification drawer (phone, brands, interview answers)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS followed_brands_list TEXT,
  ADD COLUMN IF NOT EXISTS interview_answers TEXT;

COMMENT ON COLUMN public.profiles.phone IS 'User-provided phone for phone_verified step (SMS/OAuth can replace later)';
COMMENT ON COLUMN public.profiles.followed_brands_list IS 'Comma-separated brand names for followed_brands step';
COMMENT ON COLUMN public.profiles.interview_answers IS 'Free-text answers for answered_questions step';
