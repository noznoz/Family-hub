-- Non-destructive migration: profile pictures for family members.
-- Adds a nullable `avatar_path` column to family_members holding the object
-- path (within the private media bucket) of the member's photo. Displayed via
-- short-lived signed URLs. Safe to run repeatedly.

alter table public.family_members
  add column if not exists avatar_path text;
