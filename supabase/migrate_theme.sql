-- Non-destructive migration: per-member look-and-feel theme.
-- Adds a nullable `theme` column to family_members so each member's chosen
-- appearance follows their account across devices. Safe to run repeatedly.

alter table public.family_members
  add column if not exists theme text;
