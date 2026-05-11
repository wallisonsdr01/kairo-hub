-- ============================================================================
-- FIX: Kairo Hub — Criação de todos os buckets de Storage
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================================
-- CAUSA DO ERRO "Bucket not found":
--   As migrations com os CREATE de buckets (003, 002, 006, 007, 008, 010)
--   não foram executadas no projeto Supabase. Os buckets não existem.
--   O código do frontend está CORRETO — é o banco que está sem os buckets.
-- ============================================================================

-- ============================================================================
-- 1. BUCKET: client-logos  (usado em ClientForm.tsx)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-logos',
  'client-logos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "logos_upload_own"    ON storage.objects;
DROP POLICY IF EXISTS "logos_read_public"   ON storage.objects;
DROP POLICY IF EXISTS "logos_update_own"    ON storage.objects;
DROP POLICY IF EXISTS "logos_delete_own"    ON storage.objects;

CREATE POLICY "logos_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'client-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "logos_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'client-logos');

CREATE POLICY "logos_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'client-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "logos_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'client-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 2. BUCKET: planner-attachments  (usado em Planner.tsx)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'planner-attachments',
  'planner-attachments',
  true,
  52428800, -- 50 MB
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
    'video/mp4','video/quicktime','video/webm',
    'audio/mpeg','audio/mp4','audio/wav','audio/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain','text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_upload_own"   ON storage.objects;
DROP POLICY IF EXISTS "storage_read_public"  ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_own"   ON storage.objects;

CREATE POLICY "storage_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'planner-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'planner-attachments');

CREATE POLICY "storage_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'planner-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 3. BUCKET: content-assets  (usado em Library.tsx e useContentAssets.ts)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-assets', 'content-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "content_assets_upload"       ON storage.objects;
DROP POLICY IF EXISTS "content_assets_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "content_assets_owner_delete" ON storage.objects;

CREATE POLICY "content_assets_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'content-assets'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "content_assets_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'content-assets');

CREATE POLICY "content_assets_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'content-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- 4. BUCKET: client-documents  (usado em OnboardingTab.tsx e useOnboarding.ts)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "docs_upload_own"   ON storage.objects;
DROP POLICY IF EXISTS "docs_read_public"  ON storage.objects;
DROP POLICY IF EXISTS "docs_delete_own"   ON storage.objects;

CREATE POLICY "docs_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'client-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "docs_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'client-documents');

CREATE POLICY "docs_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'client-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 5. BUCKET: client-materials  (usado em MaterialsTab.tsx e Library.tsx)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-materials', 'client-materials', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "materials_upload_own"   ON storage.objects;
DROP POLICY IF EXISTS "materials_read_public"  ON storage.objects;
DROP POLICY IF EXISTS "materials_delete_own"   ON storage.objects;

CREATE POLICY "materials_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'client-materials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "materials_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'client-materials');

CREATE POLICY "materials_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'client-materials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 6. BUCKET: report-attachments  (usado em ReportsTab.tsx e useReports.ts)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-attachments', 'report-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "reports_upload_own"   ON storage.objects;
DROP POLICY IF EXISTS "reports_read_public"  ON storage.objects;
DROP POLICY IF EXISTS "reports_delete_own"   ON storage.objects;

CREATE POLICY "reports_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'report-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "reports_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'report-attachments');

CREATE POLICY "reports_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'report-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- VERIFICAÇÃO FINAL — rode após executar o script
-- Deve retornar 6 linhas com os buckets criados
-- ============================================================================
-- SELECT id, name, public, file_size_limit
-- FROM storage.buckets
-- WHERE id IN (
--   'client-logos',
--   'planner-attachments',
--   'content-assets',
--   'client-documents',
--   'client-materials',
--   'report-attachments'
-- )
-- ORDER BY id;
