-- =============================================================================
-- Axelerate - Events 扩展字段 + event_applications
-- 依赖: 00009
-- =============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ;

COMMENT ON COLUMN public.events.location IS '活动地点';
COMMENT ON COLUMN public.events.event_date IS '活动时间';

CREATE TABLE public.event_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

COMMENT ON TABLE public.event_applications IS '活动申请记录';

CREATE INDEX idx_event_applications_user_id ON public.event_applications(user_id);
CREATE INDEX idx_event_applications_event_id ON public.event_applications(event_id);

ALTER TABLE public.event_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_applications_select_own"
  ON public.event_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "event_applications_insert_own"
  ON public.event_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);
