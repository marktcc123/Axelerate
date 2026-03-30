-- 评论展示用快照：避免 profiles RLS（仅本人可读）导致看不到其他买家姓名/学校
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS reviewer_badge text;

COMMENT ON COLUMN public.product_reviews.reviewer_badge IS '展示用，如 Mark@UCLA；写入时由客户端根据 profiles 生成';

-- 可选：历史评论回填（在 SQL Editor 手动执行，按需在应用内规则生成首名+@后缀）
-- UPDATE public.product_reviews pr
-- SET reviewer_badge = trim(split_part(coalesce(p.full_name,'Student'), ' ', 1)) || '@UCLA'
-- FROM public.profiles p
-- WHERE pr.user_id = p.id AND pr.reviewer_badge IS NULL AND p.campus = 'UCLA';
