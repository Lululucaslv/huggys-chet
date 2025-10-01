create extension if not exists btree_gist;

alter table if exists public.therapist_availability
  add column if not exists tz text,
  add column if not exists start_local text,
  add column if not exists end_local text,
  add column if not exists created_by text;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'therapist_availability'
      and column_name = 'slot_range'
  ) then
    execute 'alter table public.therapist_availability add column slot_range tstzrange generated always as (tstzrange(start_utc, end_utc, ''[)'')) stored';
  end if;
end $$;

create index if not exists idx_avail_code_range
  on public.therapist_availability
  using gist (therapist_code, slot_range);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'no_overlap_per_therapist'
      and conrelid = 'public.therapist_availability'::regclass
  ) then
    alter table public.therapist_availability
      add constraint no_overlap_per_therapist
      exclude using gist (
        therapist_code with =,
        slot_range with &&
      );
  end if;
end $$;

create or replace function public.prevent_past_slots()
returns trigger
language plpgsql
as $$
begin
  if NEW.start_utc <= now() then
    raise exception 'slot must be in the future';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_prevent_past_av on public.therapist_availability;
create trigger trg_prevent_past_av
before insert on public.therapist_availability
for each row
execute procedure public.prevent_past_slots();
