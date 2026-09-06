-- =============================================================================
-- Syncora — Migration 0009: Project hourly rate (Time-to-Invoice)
--
-- Adds hourly_rate to projects: a numeric per-hour billing rate, set once
-- per project (a freelancer typically bills one client/project at a
-- consistent rate, not a different one per invoice). Used by
-- app/api/projects/invoice to convert logged worklog hours into a PDF
-- invoice. Nullable — projects created before this feature, or ones a
-- freelancer never intends to invoice, simply have no rate and the
-- invoice UI prompts for one before generating.
-- =============================================================================

alter table public.projects
  add column if not exists hourly_rate numeric(10, 2);
