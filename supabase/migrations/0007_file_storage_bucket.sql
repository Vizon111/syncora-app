-- =============================================================================
-- Syncora — Migration 0007: File Storage bucket + access policies
--
-- MANUAL STEP REQUIRED FIRST (cannot be done via SQL — buckets are created
-- through the Supabase Dashboard or Storage API, not a SQL statement):
--
--   1. Go to Supabase Dashboard → Storage → "New bucket"
--   2. Name it exactly:  project-files
--   3. Leave it PRIVATE (do NOT toggle "Public bucket" on) — files are
--      served through signed URLs from app/api/files/download-url, which
--      checks workspace membership first. A public bucket would let anyone
--      with a guessed path read any tenant's files, bypassing that check.
--   4. Click "Create bucket"
--
-- Once the bucket exists, run the SQL below in the SQL Editor. It grants
-- authenticated users permission to upload/read/delete objects — the actual
-- tenant-boundary enforcement still happens in application code (workspace
-- membership checks in the API routes), these policies just gate "signed-in
-- vs anonymous", which is the right level for Storage's own RLS.
-- =============================================================================

-- Allow any authenticated user to upload into the bucket. The app scopes
-- the object path to "<workspaceId>/<uuid>-<filename>" client-side, but
-- Storage itself has no concept of "workspace" — the real tenant check
-- happens when files metadata is written to public.files (via addFile,
-- which runs through supabaseAdmin and records workspace_id there).
create policy if not exists "authenticated users can upload files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'project-files');

-- Allow authenticated users to read objects — needed for createSignedUrl()
-- to succeed server-side (it runs with the service role, but this policy
-- also covers any future client-side reads).
create policy if not exists "authenticated users can read files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'project-files');

-- Allow authenticated users to delete objects (used if/when a future
-- cleanup job removes orphaned or fully-deleted files from Storage).
create policy if not exists "authenticated users can delete files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'project-files');
