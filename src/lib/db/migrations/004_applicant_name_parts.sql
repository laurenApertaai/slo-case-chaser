-- 004 — first, middle and surname stored separately for both applicants
--
-- Lenders take names in parts, and the middle name matters: an application is
-- made in the applicant's full legal name, and a missing middle name is a
-- mismatch against their ID.
--
-- applicant_1_name and applicant_2_name stay, holding the full name as it
-- reads on the application. These columns hold the same name in its parts.
--
-- Nullable because cases created before this change only have the full name.
--
-- Run this in the Supabase SQL editor. Safe to run twice.

alter table cases
  add column if not exists applicant_1_first_name  text,
  add column if not exists applicant_1_middle_name text,
  add column if not exists applicant_1_surname     text,
  add column if not exists applicant_2_first_name  text,
  add column if not exists applicant_2_middle_name text,
  add column if not exists applicant_2_surname     text;
