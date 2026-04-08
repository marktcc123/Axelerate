-- XP earned per referral row (mirrors wallet event xp_delta for referrer)
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS reward_xp integer NOT NULL DEFAULT 0 CHECK (reward_xp >= 0);

COMMENT ON COLUMN public.referrals.reward_xp IS 'XP granted to referrer for this referral (e.g. signup redeem +100)';

-- Let referrers read basic profile of users they referred (for in-app referral history UI)
CREATE POLICY "profiles_select_referred_from_own_referrals"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.referrals r
      WHERE r.referrer_id = auth.uid()
        AND r.referred_id = id
    )
  );

-- Existing signup-style rows (only flow in app before this column) — adjust if you add other +1000 credit rules
UPDATE public.referrals
SET reward_xp = 100
WHERE status = 'approved'
  AND reward_amount = 1000
  AND reward_xp = 0;

-- Keep RPC in sync when projects call redeem_referral_signup_code from DB
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

  INSERT INTO public.referrals (referrer_id, referred_id, reward_amount, status, reward_xp)
  VALUES (v_referrer_id, v_uid, 1000, 'approved', 100)
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
