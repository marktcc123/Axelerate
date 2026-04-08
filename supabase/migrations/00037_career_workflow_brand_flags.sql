-- Axelerate Career: approval workflow, certificate storage, brand toggles, LinkedIn on profile

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linkedin_url text;

COMMENT ON COLUMN public.profiles.linkedin_url IS 'Optional public LinkedIn profile URL for career share / verify';

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS career_internship_proof_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS career_referral_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.brands.career_internship_proof_enabled IS 'When true, eligible users see brand internship proof card in Axelerate Career';
COMMENT ON COLUMN public.brands.career_referral_enabled IS 'When true, eligible users see brand referral lane card in Axelerate Career';

ALTER TABLE public.career_rewards
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS certificate_pdf_path text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

-- Normalize status values
ALTER TABLE public.career_rewards DROP CONSTRAINT IF EXISTS career_rewards_status_check;
ALTER TABLE public.career_rewards
  ADD CONSTRAINT career_rewards_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

COMMENT ON COLUMN public.career_rewards.status IS 'pending until admin approves and attaches PDF (where required)';
COMMENT ON COLUMN public.career_rewards.certificate_pdf_path IS 'Storage path in career-certificates bucket';

-- Historical claims (before approval workflow): mark approved
UPDATE public.career_rewards
SET status = 'approved', reviewed_at = COALESCE(reviewed_at, claimed_at);

INSERT INTO storage.buckets (id, name, public)
VALUES ('career-certificates', 'career-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Users read only their own certificate objects (path prefix = user_id)
DROP POLICY IF EXISTS "career_certs_select_own" ON storage.objects;
CREATE POLICY "career_certs_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'career-certificates'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Service role / admin uploads bypass RLS; optional: no INSERT for authenticated on this bucket
