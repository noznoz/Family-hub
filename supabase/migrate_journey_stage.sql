-- Non-destructive migration: per-student journey stage.
-- Adds a nullable `journey_stage` text column to student_profiles so each
-- student's current stage (Preparation → Graduation) can be set explicitly.
-- Null is treated as "Preparation" (still at home). Safe to run repeatedly.

alter table public.student_profiles
  add column if not exists journey_stage text;
