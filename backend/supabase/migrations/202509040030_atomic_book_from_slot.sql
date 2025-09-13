create or replace function public.book_from_slot(
  p_availability_id uuid,
  p_user_id text,
  p_therapist_code text
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_slot record;
  v_duration_mins int;
  v_booking record;
begin
  select id, therapist_id, start_time, end_time, coalesce(is_booked, false) as is_booked
    into v_slot
  from public.availability
  where id = p_availability_id
  for update;
  if not found then
    raise exception 'slot_unavailable';
  end if;
  if v_slot.is_booked then
    raise exception 'slot_unavailable';
  end if;

  update public.availability
     set is_booked = true
   where id = v_slot.id;

  select extract(epoch from (v_slot.end_time - v_slot.start_time)) / 60
    into v_duration_mins;

  insert into public.bookings(therapist_code, user_id, start_utc, duration_mins, status)
  values (p_therapist_code, p_user_id, v_slot.start_time, v_duration_mins::int, 'confirmed')
  returning * into v_booking;

  insert into public.chat_messages(booking_id, user_id, role, message)
  values (
    v_booking.id, p_user_id, 'system',
    json_build_object(
      'type','BOOKING_SUCCESS',
      'bookingId', v_booking.id,
      'therapistCode', v_booking.therapist_code,
      'startUTC', v_booking.start_utc,
      'durationMins', v_booking.duration_mins,
      'userId', v_booking.user_id
    )::text
  );

  return to_jsonb(v_booking);
end;
$$;

create index if not exists idx_availability_therapist_start
on public.availability(therapist_id, start_time);
