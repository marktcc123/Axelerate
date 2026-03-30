-- =============================================================================
-- Axelerate - Events 活动表（等级门槛）
-- 依赖: 00001, 00002 (user_tier)
-- =============================================================================

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  min_tier_required public.user_tier NOT NULL DEFAULT 'guest',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.events IS '活动/事件，按 min_tier_required 控制可见性';
COMMENT ON COLUMN public.events.min_tier_required IS '最低等级要求';

CREATE INDEX idx_events_min_tier ON public.events(min_tier_required);
CREATE INDEX idx_events_created_at ON public.events(created_at DESC);

CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_all"
  ON public.events FOR SELECT
  USING (true);
