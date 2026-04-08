-- One-time referral code redemption for new users (signup bonus + referrer reward)
-- Validates code against profiles.referral_code; updates balances atomically.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.referred_by IS 'Profile id of the referrer whose code was redeemed once at signup; NULL if never redeemed';

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by)
  WHERE referred_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RPC: redeem a friend''s referral code (authenticated user = referee)
-- Referrer: +1000 credits, +100 XP | Referee: +2000 credits, referred_by set
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_referral_signup_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_norm text;
  v_referrer_id uuid;
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  v_norm := upper(trim(both from coalesce(p_code, '')));
  IF length(v_norm) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.referred_by IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  SELECT p.id
  INTO v_referrer_id
  FROM public.profiles p
  WHERE p.referral_code IS NOT NULL
    AND upper(trim(both from p.referral_code)) = v_norm
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_not_found');
  END IF;

  IF v_referrer_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  UPDATE public.profiles
  SET
    credit_balance = coalesce(credit_balance, 0) + 2000,
    referred_by = v_referrer_id,
    updated_at = now()
  WHERE id = v_uid
    AND referred_by IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  UPDATE public.profiles
  SET
    credit_balance = coalesce(credit_balance, 0) + 1000,
    xp = coalesce(xp, 0) + 100,
    updated_at = now()
  WHERE id = v_referrer_id;

  INSERT INTO public.referrals (referrer_id, referred_id, reward_amount, status)
  VALUES (v_referrer_id, v_uid, 1000, 'approved')
  ON CONFLICT (referrer_id, referred_id) DO NOTHING;

  INSERT INTO public.user_wallet_events (
    user_id, category, title, detail, credits_delta, xp_delta, ref_type
  ) VALUES
    (
      v_uid,
      'referral',
      'Welcome bonus',
      'Redeemed a friend''s referral code',
      2000,
      NULL,
      'referral_signup_referee'
    ),
    (
      v_referrer_id,
      'referral',
      'Referral reward',
      'Someone joined with your code',
      1000,
      100,
      'referral_signup_referrer'
    );

  RETURN jsonb_build_object(
    'ok', true,
    'referee_credits', 2000,
    'referrer_credits', 1000,
    'referrer_xp', 100
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_referral_signup_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_referral_signup_code(text) TO authenticated;

COMMENT ON FUNCTION public.redeem_referral_signup_code(text) IS
  'One-time redeem: referee +2000 credits; referrer +1000 credits and +100 XP; validates profiles.referral_code';
