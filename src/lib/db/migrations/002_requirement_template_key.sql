-- 002 — remember which template item a requirement came from
--
-- Requirements are generated from the standard pack, and several later steps
-- need to find a particular one again afterwards:
--
--   * the client picking their employment type retitles the income evidence
--     item and sets its file count
--   * the expected-count check needs to know it is looking at the signed pack
--   * the end-of-case record groups items by what was asked for
--
-- Matching on the label cannot do this, because the label is client-facing
-- wording that changes: "Proof of your income" becomes "Your 12 most recent
-- weekly payslips" the moment the client says how they are paid.
--
-- Null is allowed, because an adviser can add a one-off item to a live case
-- that came from no template at all.
--
-- Run this in the Supabase SQL editor. Safe to run twice.

alter table requirements
  add column if not exists template_key text;

create index if not exists requirements_case_template_key_idx
  on requirements (case_id, template_key);
