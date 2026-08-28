-- Non-destructive migration: shared family photo albums.
--
-- Albums group photos; photo files live in the existing private media bucket
-- under the family's folder and are shown via short-lived signed URLs. Any
-- family member can create albums and add photos; deleting an album or photo
-- is limited to its creator/uploader or a parent/admin. Safe to re-run.

create table if not exists public.albums (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  title          text not null,
  description    text,
  cover_photo_id uuid,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists albums_family_idx on public.albums (family_id);

create table if not exists public.album_photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albums(id) on delete cascade,
  family_id    uuid not null references public.families(id) on delete cascade,
  storage_path text not null,
  caption      text,
  uploaded_by  uuid references public.profiles(id),
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists album_photos_album_idx on public.album_photos (album_id);

-- Cover references a photo in the album; clear it if that photo is deleted.
alter table public.albums drop constraint if exists albums_cover_fk;
alter table public.albums
  add constraint albums_cover_fk foreign key (cover_photo_id)
  references public.album_photos(id) on delete set null;

alter table public.albums       enable row level security;
alter table public.album_photos enable row level security;

-- Albums: family members read/create/edit; delete limited to creator or parent/admin.
drop policy if exists "albums read"   on public.albums;
create policy "albums read"   on public.albums for select using (public.is_family_member(family_id));
drop policy if exists "albums insert" on public.albums;
create policy "albums insert" on public.albums for insert with check (public.is_family_member(family_id));
drop policy if exists "albums update" on public.albums;
create policy "albums update" on public.albums for update using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
drop policy if exists "albums delete" on public.albums;
create policy "albums delete" on public.albums for delete using (public.is_parent_admin(family_id) or created_by = auth.uid());

-- Photos: family members read/add; delete limited to uploader or parent/admin.
drop policy if exists "album_photos read"   on public.album_photos;
create policy "album_photos read"   on public.album_photos for select using (public.is_family_member(family_id));
drop policy if exists "album_photos insert" on public.album_photos;
create policy "album_photos insert" on public.album_photos for insert with check (public.is_family_member(family_id));
drop policy if exists "album_photos update" on public.album_photos;
create policy "album_photos update" on public.album_photos for update using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
drop policy if exists "album_photos delete" on public.album_photos;
create policy "album_photos delete" on public.album_photos for delete using (public.is_parent_admin(family_id) or uploaded_by = auth.uid());
