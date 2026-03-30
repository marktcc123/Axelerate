-- =============================================================================
-- Axelerate 校园商业生态平台 - Schema V2 进阶版
-- 任务大厅 | 倒计时限购商城 | My Gigs 生命周期 | 钱包流水 | 裂变防作弊 | 后台审核
-- 依赖: 00001_initial_schema.sql
-- =============================================================================

-- =============================================================================
-- 1. 新增 ENUM 类型
-- =============================================================================

-- 用户等级（用于升级、特权解锁）
CREATE TYPE public.user_tier AS ENUM (
  'guest',         -- 访客/未注册
  'student',       -- 学生用户
  'staff',         -- 活动工作人员
  'city_manager',  -- 城市经理
  'partner'        -- 品牌合作伙伴
);

-- 交易类型
CREATE TYPE public.transaction_type AS ENUM (
  'gig_reward',      -- 任务赏金
  'withdrawal',      -- 提现
  'purchase',        -- 商城消费
  'referral_bonus'   -- 裂变奖励
);

-- 交易状态
CREATE TYPE public.transaction_status AS ENUM (
  'pending',   -- 待清算（显示 Clears in 3-5 days）
  'cleared',   -- 已清算
  'failed'     -- 失败
);

-- 用户任务状态机（My Gigs 生命周期）
CREATE TYPE public.user_gig_status AS ENUM (
  'applied',    -- 已申请
  'approved',   -- 已通过
  'completed',  -- 已完成
  'paid'        -- 已结算
);

-- 裂变状态
CREATE TYPE public.referral_status AS ENUM (
  'pending',   -- 待审核
  'approved',  -- 已通过
  'blocked'    -- 已拦截（风控）
);

-- =============================================================================
-- 2. 扩充 PROFILES (用户核心档案)
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  ADD COLUMN IF NOT EXISTS tier public.user_tier NOT NULL DEFAULT 'guest',
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32) UNIQUE;

-- 为已有用户生成 referral_code（若为空）
CREATE OR REPLACE FUNCTION public.ensure_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := 'AX' || UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', '') FROM 1 FOR 10));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 仅当不存在时创建触发器（避免重复）
DROP TRIGGER IF EXISTS ensure_profiles_referral_code ON public.profiles;
CREATE TRIGGER ensure_profiles_referral_code
  BEFORE INSERT OR UPDATE OF referral_code ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL OR NEW.referral_code = '')
  EXECUTE FUNCTION public.ensure_referral_code();

COMMENT ON COLUMN public.profiles.xp IS '经验值，用于升级';
COMMENT ON COLUMN public.profiles.tier IS '用户等级：guest/student/staff/city_manager/partner';
COMMENT ON COLUMN public.profiles.referral_code IS '唯一邀请码，如 JORDAN2026';

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(tier);

-- 为已有用户回填 referral_code（避免 UNIQUE 冲突，使用 id 前 10 位）
UPDATE public.profiles
SET referral_code = 'AX' || UPPER(SUBSTRING(REPLACE(id::TEXT, '-', '') FROM 1 FOR 10))
WHERE referral_code IS NULL;

-- =============================================================================
-- 3. 新增 TRANSACTIONS (财务账本与流水表 - 对应 Wallet 截图)
-- =============================================================================

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  type public.transaction_type NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'pending',
  clears_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transactions_clears_at_for_pending
    CHECK (
      (status != 'pending') OR (status = 'pending' AND clears_at IS NOT NULL)
    )
);

COMMENT ON TABLE public.transactions IS '财务账本与流水，支持 Pending / Clears in 3-5 days';
COMMENT ON COLUMN public.transactions.clears_at IS '清算时间，用于 UI 显示 Clears in X days';
COMMENT ON COLUMN public.transactions.metadata IS '扩展：如 gig_id, product_id, referral_id 等';

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_clears_at ON public.transactions(clears_at) WHERE clears_at IS NOT NULL;
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);

CREATE TRIGGER set_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. 新增 USER_GIGS (任务状态机 - 对应 My Gigs 截图)
-- =============================================================================

CREATE TABLE public.user_gigs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  status public.user_gig_status NOT NULL DEFAULT 'applied',
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, gig_id)
);

COMMENT ON TABLE public.user_gigs IS '用户任务关联，状态机：applied → approved → completed → paid';
COMMENT ON COLUMN public.user_gigs.progress_percent IS '任务进度 0-100';

CREATE INDEX idx_user_gigs_user_id ON public.user_gigs(user_id);
CREATE INDEX idx_user_gigs_gig_id ON public.user_gigs(gig_id);
CREATE INDEX idx_user_gigs_status ON public.user_gigs(status);

CREATE TRIGGER set_user_gigs_updated_at
  BEFORE UPDATE ON public.user_gigs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 5. 扩充 PRODUCTS (特权与限时抢购商城 - 对应 Perks Shop 截图)
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS original_price DECIMAL(12, 2) CHECK (original_price >= 0),
  ADD COLUMN IF NOT EXISTS discount_price DECIMAL(12, 2) CHECK (discount_price >= 0),
  ADD COLUMN IF NOT EXISTS drop_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS min_tier_required public.user_tier NOT NULL DEFAULT 'guest',
  ADD COLUMN IF NOT EXISTS max_per_user INTEGER CHECK (max_per_user > 0);

COMMENT ON COLUMN public.products.original_price IS '划线价';
COMMENT ON COLUMN public.products.discount_price IS '折扣价';
COMMENT ON COLUMN public.products.drop_time IS 'Friday Night Drop 开售时间';
COMMENT ON COLUMN public.products.min_tier_required IS '最低等级要求，用于 Tap to Unlock 锁定';
COMMENT ON COLUMN public.products.max_per_user IS '单用户限购数量，如 Max 3 per SKU';

CREATE INDEX IF NOT EXISTS idx_products_drop_time ON public.products(drop_time) WHERE drop_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_min_tier ON public.products(min_tier_required);

-- =============================================================================
-- 6. 新增 PRODUCT_PURCHASES (用户购买记录 - 用于 max_per_user 校验)
-- =============================================================================

CREATE TABLE public.product_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_purchases IS '用户购买记录，用于 max_per_user 校验：SUM(quantity) <= product.max_per_user';

CREATE INDEX idx_product_purchases_user_product ON public.product_purchases(user_id, product_id);

-- =============================================================================
-- 7. 新增 REFERRALS (裂变防作弊表 - 对应 Referrals 截图)
-- =============================================================================

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
  status public.referral_status NOT NULL DEFAULT 'pending',
  blocked_reason VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, referred_id),
  CONSTRAINT referrals_no_self CHECK (referrer_id != referred_id),
  CONSTRAINT referrals_blocked_reason CHECK (
    (status = 'blocked' AND blocked_reason IS NOT NULL) OR
    (status != 'blocked')
  )
);

COMMENT ON TABLE public.referrals IS '裂变邀请记录，防作弊风控';
COMMENT ON COLUMN public.referrals.blocked_reason IS '风控原因：Address matches ambassador, Buyer is not a new user 等';

CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referred_id ON public.referrals(referred_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);

CREATE TRIGGER set_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 8. RLS 策略
-- =============================================================================

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- --- TRANSACTIONS: 用户只能读写自己的流水 ---
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "transactions_insert_own"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_update_own"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- --- USER_GIGS: 用户只能读写自己的任务 ---
CREATE POLICY "user_gigs_select_own"
  ON public.user_gigs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_gigs_insert_own"
  ON public.user_gigs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_gigs_update_own"
  ON public.user_gigs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- --- PRODUCT_PURCHASES: 用户只能读写自己的购买 ---
CREATE POLICY "product_purchases_select_own"
  ON public.product_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "product_purchases_insert_own"
  ON public.product_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- --- REFERRALS: 用户可读自己作为 referrer 或 referred 的记录 ---
CREATE POLICY "referrals_select_own"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "referrals_insert_own"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "referrals_update_own"
  ON public.referrals FOR UPDATE
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "referrals_delete_own"
  ON public.referrals FOR DELETE
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
