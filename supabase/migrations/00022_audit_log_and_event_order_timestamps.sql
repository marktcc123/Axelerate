-- =============================================================================
-- 审计留痕：audit_log 表 + event_applications/orders 时间戳
-- 支持 UGC、Tasks、Events、Orders 的审批时间与审批人留痕
-- =============================================================================

-- 1. 通用审计日志表
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(64) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(64) NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

COMMENT ON TABLE public.audit_log IS '审批/操作审计留痕：记录谁在何时执行了何种操作';
COMMENT ON COLUMN public.audit_log.entity_type IS 'user_gig | event_application | order | withdrawal';
COMMENT ON COLUMN public.audit_log.entity_id IS '关联实体主键';
COMMENT ON COLUMN public.audit_log.action IS 'approved | rejected | completed | paid | shipped | attended 等';
COMMENT ON COLUMN public.audit_log.actor_id IS '执行操作的管理员/用户 ID';

CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 仅 Admin（通过 service_role）可读写，RLS 下普通用户不可见
CREATE POLICY "audit_log_admin_only"
  ON public.audit_log FOR ALL
  USING (false)
  WITH CHECK (false);

-- 2. event_applications 增加审批/签到时间戳（便于快速展示）
ALTER TABLE public.event_applications
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_applications.approved_at IS 'Admin 批准时间';
COMMENT ON COLUMN public.event_applications.attended_at IS 'Admin 签到时间';

-- 3. orders 增加发货时间戳
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.shipped_at IS 'Admin 标记发货时间';
