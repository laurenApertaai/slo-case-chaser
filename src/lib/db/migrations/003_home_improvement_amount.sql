-- 003 — the home improvements figure, separate from the loan
--
-- The whole loan is not always for home improvements. The client is asked to
-- break down the improvements figure specifically, so the question has to quote
-- that amount rather than the loan total.
--
-- Nullable: where it is left blank the wording falls back to the loan amount,
-- which is right for the common case where the whole loan is for the works.
--
-- Run this in the Supabase SQL editor. Safe to run twice.

alter table cases
  add column if not exists home_improvement_amount numeric(12,2);
