/** Name of the Supabase Storage bucket that holds uploaded project files.
 *  Must match the bucket created manually in the Supabase Dashboard (see
 *  supabase/migrations/0007_file_storage_bucket.sql for setup steps) — the
 *  bucket itself can't be created via SQL/migration, only its RLS policies. */
export const STORAGE_BUCKET = 'project-files';
