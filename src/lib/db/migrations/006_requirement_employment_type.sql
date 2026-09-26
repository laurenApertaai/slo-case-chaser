-- 006 — how each applicant is paid, answered per item
--
-- The client picks this on their own page and their income evidence item
-- retitles itself: three payslips or twelve, or the SA302s for somebody self
-- employed.
--
-- It sits on the requirement rather than on the case because a joint
-- application can have one applicant employed and the other self employed.
-- cases.employment_type stays as what the adviser set for the case; this is
-- the answer that governs one applicant's item.
--
-- Run this in the Supabase SQL editor. Safe to run twice.

alter table requirements
  add column if not exists employment_type employment_type;
