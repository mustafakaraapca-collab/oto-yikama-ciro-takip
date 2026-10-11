-- RUVA Detailing v24 - Özel araç kabul fotoğrafları
-- Supabase SQL Editor'da proje sahibi/admin olarak BİR KEZ çalıştırın.
-- Mevcut tabloları veya eski kayıtları değiştirmez.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('ruva-job-photos','ruva-job-photos',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=8388608,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "ruva_job_photos_read_own" on storage.objects;
drop policy if exists "ruva_job_photos_insert_own" on storage.objects;
drop policy if exists "ruva_job_photos_delete_own" on storage.objects;

create policy "ruva_job_photos_read_own" on storage.objects
for select to authenticated
using (bucket_id='ruva-job-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ruva_job_photos_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id='ruva-job-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ruva_job_photos_delete_own" on storage.objects
for delete to authenticated
using (bucket_id='ruva-job-photos' and (storage.foldername(name))[1] = auth.uid()::text);
