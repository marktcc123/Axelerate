-- Career incentives: claimed certificates / referral unlocks (Profile → Axelerate Career drawer)
CREATE TABLE public.career_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reward_key text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_rewards_user_key UNIQUE (user_id, reward_key)
);

CREATE INDEX idx_career_rewards_user_id ON public.career_rewards (user_id);

COMMENT ON TABLE public.career_rewards IS 'User-claimed career perks: general_cert, brand:{id}:cert, brand:{id}:referral';
COMMENT ON COLUMN public.career_rewards.reward_key IS 'general_cert | brand:{uuid}:cert | brand:{uuid}:referral';

ALTER TABLE public.career_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_rewards_select_own"
  ON public.career_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "career_rewards_insert_own"
  ON public.career_rewards FOR INSERT
  WITH CHECK (auth.uid() = user_id);
