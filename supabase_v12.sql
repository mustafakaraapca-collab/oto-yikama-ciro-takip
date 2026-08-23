-- Oto Yıkama Pro V12: kayıt bazlı bulut senkron tablosu
create table if not exists public.sync_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('row','package','settings')),
  item_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default (floor(extract(epoch from clock_timestamp()) * 1000))::bigint,
  deleted boolean not null default false,
  primary key (user_id, item_type, item_id)
);

alter table public.sync_items enable row level security;

drop policy if exists "sync_items_select_own" on public.sync_items;
create policy "sync_items_select_own" on public.sync_items for select to authenticated using (auth.uid() = user_id);

drop policy if exists "sync_items_insert_own" on public.sync_items;
create policy "sync_items_insert_own" on public.sync_items for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "sync_items_update_own" on public.sync_items;
create policy "sync_items_update_own" on public.sync_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sync_items_delete_own" on public.sync_items;
create policy "sync_items_delete_own" on public.sync_items for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.sync_items to authenticated;

create index if not exists sync_items_user_updated_idx on public.sync_items(user_id, updated_at);
