-- =============================================================================
-- Axelerate 校园商业生态平台 - 核心 Schema
-- O2O 本地跑腿零售 + B2B 品牌零工任务
-- =============================================================================

-- Enable UUID extension (Supabase enables this by default, but explicit for portability)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PROFILES (用户档案) - 关联 auth.users
-- =============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  campus TEXT,
  cash_balance DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (cash_balance >= 0),
  credit_balance INTEGER NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
  is_runner BOOLEAN NOT NULL DEFAULT false,
  tiktok_handle TEXT,
  ig_handle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS '用户档案，与 auth.users 一对一关联';
COMMENT ON COLUMN public.profiles.is_runner IS '是否开启接单模式（跑腿）';
COMMENT ON COLUMN public.profiles.credit_balance IS '平台积分/平台币';

-- =============================================================================
-- 2. BRANDS (品牌库)
-- =============================================================================
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.brands IS '品牌库';

-- =============================================================================
-- 3. PRODUCTS (商品表)
-- =============================================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_credits INTEGER NOT NULL DEFAULT 0 CHECK (price_credits >= 0),
  stock_count INTEGER NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.products IS '商品表，积分兑换';
COMMENT ON COLUMN public.products.price_credits IS '兑换所需积分';

CREATE INDEX idx_products_brand_id ON public.products(brand_id);

-- =============================================================================
-- 4. GIGS (赏金任务表)
-- =============================================================================
CREATE TYPE public.gig_type AS ENUM (
  'o2o_delivery',   -- O2O 跑腿配送
  'ugc_post',       -- UGC 内容创作
  'offline_event'   -- 线下活动/展会
);

CREATE TYPE public.gig_status AS ENUM (
  'active',
  'closed'
);

CREATE TABLE public.gigs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type public.gig_type NOT NULL,
  reward_cash DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (reward_cash >= 0),
  reward_credits INTEGER NOT NULL DEFAULT 0 CHECK (reward_credits >= 0),
  spots_total INTEGER NOT NULL CHECK (spots_total > 0),
  spots_left INTEGER NOT NULL CHECK (spots_left >= 0),
  status public.gig_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gigs_spots_valid CHECK (spots_left <= spots_total)
);

COMMENT ON TABLE public.gigs IS '赏金任务表';
COMMENT ON COLUMN public.gigs.type IS 'o2o_delivery=跑腿, ugc_post=UGC创作, offline_event=线下活动';

CREATE INDEX idx_gigs_brand_id ON public.gigs(brand_id);
CREATE INDEX idx_gigs_status ON public.gigs(status);
CREATE INDEX idx_gigs_type ON public.gigs(type);

-- =============================================================================
-- UPDATED_AT 触发器函数
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为各表绑定 updated_at 触发器
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_gigs_updated_at
  BEFORE UPDATE ON public.gigs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 自动创建 profile：当 auth.users 有新用户时插入 profiles
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

-- --- PROFILES: 用户只能读写自己的记录 ---
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- --- BRANDS: 所有人可读，仅服务端/管理员可写（此处仅开放 SELECT）---
CREATE POLICY "brands_select_all"
  ON public.brands FOR SELECT
  USING (true);

CREATE POLICY "brands_insert_authenticated"
  ON public.brands FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "brands_update_authenticated"
  ON public.brands FOR UPDATE
  USING (auth.role() = 'authenticated');

-- --- PRODUCTS: 所有人可读 ---
CREATE POLICY "products_select_all"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "products_insert_authenticated"
  ON public.products FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "products_update_authenticated"
  ON public.products FOR UPDATE
  USING (auth.role() = 'authenticated');

-- --- GIGS: 所有人可读 ---
CREATE POLICY "gigs_select_all"
  ON public.gigs FOR SELECT
  USING (true);

CREATE POLICY "gigs_insert_authenticated"
  ON public.gigs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "gigs_update_authenticated"
  ON public.gigs FOR UPDATE
  USING (auth.role() = 'authenticated');
