-- Storage bucket for landing-page carousel media (video + poster frames).
-- Separate from 'event-photos' so video carries its own size cap and MIME
-- allowlist: those are enforced by Storage itself, not just by the browser,
-- so a crafted request cannot push a 2 GB file into a public bucket.
-- Apply to STAGING (fxdsnacuonfvutdquogb) first, then Production (rvwseybgimmewuoccecu).

-- 1) Public bucket so getPublicUrl() links play on the public landing pages.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-media',
  'event-media',
  true,
  52428800, -- 50 MB. Landing clips are short; this is the egress guard.
  array[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) Anyone can read (public landing pages are unauthenticated).
drop policy if exists "event_media_public_read" on storage.objects;
create policy "event_media_public_read"
on storage.objects for select
using (bucket_id = 'event-media');

-- 3) Signed-in users (hosts/admins editing a landing) can upload.
drop policy if exists "event_media_auth_insert" on storage.objects;
create policy "event_media_auth_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'event-media');

-- 4) Uploaders can replace/remove their own objects.
drop policy if exists "event_media_auth_update" on storage.objects;
create policy "event_media_auth_update"
on storage.objects for update
to authenticated
using (bucket_id = 'event-media' and owner = auth.uid());

drop policy if exists "event_media_auth_delete" on storage.objects;
create policy "event_media_auth_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'event-media' and owner = auth.uid());
