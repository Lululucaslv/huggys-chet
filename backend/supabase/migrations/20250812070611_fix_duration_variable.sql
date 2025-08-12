DROP FUNCTION IF EXISTS create_booking(bigint, uuid);

CREATE OR REPLACE FUNCTION create_booking(
    availability_id_to_book bigint,
    client_user_id_to_book uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    availability_record record;
    booking_record record;
    therapist_record record;
    duration_minutes integer;
    result json;
BEGIN
    SELECT therapist_id, start_time, end_time, is_booked
    INTO availability_record
    FROM availability
    WHERE id = availability_id_to_book
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Availability slot not found'
        );
    END IF;
    
    IF availability_record.is_booked = true THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This time slot has already been booked'
        );
    END IF;
    
    duration_minutes := EXTRACT(EPOCH FROM (availability_record.end_time - availability_record.start_time)) / 60;
    
    UPDATE availability
    SET is_booked = true,
        updated_at = now()
    WHERE id = availability_id_to_book;
    
    INSERT INTO bookings (
        client_user_id,
        therapist_id,
        session_date,
        duration_minutes,
        status
    )
    VALUES (
        client_user_id_to_book::text,
        availability_record.therapist_id,
        availability_record.start_time,
        duration_minutes,
        'confirmed'
    )
    RETURNING * INTO booking_record;
    
    RETURN json_build_object(
        'success', true,
        'booking_id', booking_record.id,
        'therapist_id', booking_record.therapist_id,
        'session_date', booking_record.session_date,
        'duration_minutes', booking_record.duration_minutes,
        'message', 'Booking created successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to create booking: ' || SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION create_booking(bigint, uuid) TO authenticated;
