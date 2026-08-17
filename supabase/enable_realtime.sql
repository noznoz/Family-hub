-- Optional: makes new chat messages appear instantly for everyone (realtime).
-- Chat works without it (messages appear on refresh); run this for live updates.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reactions;
