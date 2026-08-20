-- Storage bucket for uploaded event/speaker photos and custom event banners.
-- The re-runnable staging/Lifestyle file is supabase/event_custom_banner.sql
-- (same bucket + policies, plus create_member_event / event_slug_exists).
-- Run once in the Supabase SQL editor if you only need the bucket.

-- 1) Public bucket so getPublicUrl() links render on posters and the invite page.
insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do update set public = true;

-- 2) Anyone can read objects in this bucket (public images).
create policy "event_photos_public_read"
on storage.objects for select
using (bucket_id = 'event-photos');

-- 3) Signed-in users (members) can upload.
create policy "event_photos_auth_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'event-photos');

-- 4) Uploaders can replace/remove their own objects.
create policy "event_photos_auth_update"
on storage.objects for update
to authenticated
using (bucket_id = 'event-photos' and owner = auth.uid());

create policy "event_photos_auth_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'event-photos' and owner = auth.uid());
