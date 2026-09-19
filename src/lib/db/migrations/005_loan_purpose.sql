-- 005 - loan purpose, as words
--
-- What the loan is for, as the adviser writes it: "Consol & HI", "Home
-- improvements", "Debt consolidation". Free text, because it is.
--
-- Run this in the Supabase SQL editor. Safe to run twice.

alter table cases
  add column if not exists loan_purpose text;
