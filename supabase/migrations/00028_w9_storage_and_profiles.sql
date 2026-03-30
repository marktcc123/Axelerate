-- W-9 文件存储 + profiles 路径/提交时间
-- 依赖: 00008 (is_w9_verified)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS w9_document_path TEXT,
  ADD COLUMN IF NOT EXISTS w9_submitted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.w9_document_path IS 'Storage 对象路径，如 {user_id}/w9.pdf';
COMMENT ON COLUMN public.profiles.w9_submitted_at IS '用户上次提交 W-9 的时间，待运营核验 is_w9_verified';

INSERT INTO storage.buckets (id, name, public)
VALUES ('w9-forms', 'w9-forms', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS：仅本人可读写自己目录（首段路径 = auth.uid）
DROP POLICY IF EXISTS "w9_forms_select_own" ON storage.objects;
DROP POLICY IF EXISTS "w9_forms_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "w9_forms_update_own" ON storage.objects;
DROP POLICY IF EXISTS "w9_forms_delete_own" ON storage.objects;

CREATE POLICY "w9_forms_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'w9-forms'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "w9_forms_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'w9-forms'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "w9_forms_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'w9-forms'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'w9-forms'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "w9_forms_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'w9-forms'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
