-- Non-destructive migration: indexes for hot query paths that were missing one.
-- All are `if not exists`, so this is safe to run repeatedly. Tables here are
-- small, so plain (non-concurrent) index builds are effectively instant.

-- Money page lists expenses by family, newest first.
create index if not exists expenses_family_spent_idx
  on public.expenses (family_id, spent_on desc);

-- Accommodation page lists by family, newest first.
create index if not exists accommodations_family_start_idx
  on public.accommodations (family_id, start_date desc);

-- The unread badge resolves a member's conversations on EVERY page load; the
-- primary key is (conversation_id, member_id), so member-only lookups had no index.
create index if not exists conversation_members_member_idx
  on public.conversation_members (member_id);

-- Documents page embeds every document's versions.
create index if not exists document_versions_document_idx
  on public.document_versions (document_id);

-- Chat embeds reactions per message.
create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

-- Funding is read per family on the journey/scholarship screens.
create index if not exists funding_sources_family_idx
  on public.funding_sources (family_id);
