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
    therapist_user_id text;
    therapist_id uuid;
    duration_minutes integer;
    result json;
BEGIN
    SELECT a.therapist_id, a.start_time, a.end_time, a.is_booked
    INTO availability_record
    FROM availability a
    WHERE a.id = availability_id_to_book
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
    
    SELECT up.user_id INTO therapist_user_id
    FROM user_profiles up
    WHERE up.id = availability_record.therapist_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Therapist profile not found'
        );
    END IF;
    
    SELECT t.id INTO therapist_id
    FROM therapists t
    WHERE t.user_id = therapist_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO therapists (user_id, name, specialization, bio, verified)
        VALUES (therapist_user_id, '治疗师', '心理咨询', '专业心理治疗师', true)
        RETURNING id INTO therapist_id;
    END IF;
    
    duration_minutes := EXTRACT(EPOCH FROM (availability_record.end_time - availability_record.start_time)) / 60;
    
    UPDATE availability a
    SET is_booked = true,
        updated_at = now()
    WHERE a.id = availability_id_to_book;
    
    INSERT INTO bookings (
        client_user_id,
        therapist_id,
        session_date,
        duration_minutes,
        status
    )
    VALUES (
        client_user_id_to_book::text,
        therapist_id,
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
