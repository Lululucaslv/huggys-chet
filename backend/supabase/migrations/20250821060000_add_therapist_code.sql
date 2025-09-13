alter table public.therapists
add column if not exists code text;

create unique index if not exists therapists_code_key on public.therapists (code) where code is not null;

create or replace function public.gen_therapist_code(len int default 8)
returns text language plpgsql as $$
declare
  chars constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i int := 0;
begin
  if len < 4 then len := 6; end if;
  for i in 1..len loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end $$;

do $$
declare
  r record;
  attempt int;
  new_code text;
begin
  for r in select id from public.therapists where code is null loop
    attempt := 0;
    loop
      attempt := attempt + 1;
      new_code := public.gen_therapist_code(8);
      begin
        update public.therapists set code = new_code where id = r.id;
        exit;
      exception when unique_violation then
        if attempt > 5 then
          update public.therapists set code = public.gen_therapist_code(10) where id = r.id;
          exit;
        end if;
      end;
    end loop;
  end loop;
end $$;
