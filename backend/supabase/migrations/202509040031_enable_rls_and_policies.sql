alter table if exists public.bookings enable row level security;
alter table if exists public.chat_messages enable row level security;
alter table if exists public.availability enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bookings' and policyname='deny_all_bookings') then
    create policy deny_all_bookings on public.bookings for select using (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_messages' and policyname='deny_all_chat_messages') then
    create policy deny_all_chat_messages on public.chat_messages for select using (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='availability' and policyname='deny_all_availability') then
    create policy deny_all_availability on public.availability for select using (false);
  end if;
end $$;
