create table "public"."therapists" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" text not null,
    "name" text not null,
    "specialization" text not null,
    "bio" text,
    "experience_years" integer,
    "hourly_rate" decimal(10,2),
    "availability" jsonb,
    "languages" text[],
    "verified" boolean not null default false,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
);

create table "public"."bookings" (
    "id" uuid not null default gen_random_uuid(),
    "client_user_id" text not null,
    "therapist_id" uuid not null,
    "session_date" timestamp without time zone not null,
    "duration_minutes" integer not null default 60,
    "status" text not null default 'pending',
    "notes" text,
    "session_type" text not null default 'video',
    "payment_status" text not null default 'pending',
    "amount" decimal(10,2),
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
);

CREATE UNIQUE INDEX therapists_pkey ON public.therapists USING btree (id);
CREATE UNIQUE INDEX therapists_user_id_unique ON public.therapists USING btree (user_id);
CREATE INDEX therapists_specialization_idx ON public.therapists USING btree (specialization);
CREATE INDEX therapists_verified_idx ON public.therapists USING btree (verified);

CREATE UNIQUE INDEX bookings_pkey ON public.bookings USING btree (id);
CREATE INDEX bookings_client_user_id_idx ON public.bookings USING btree (client_user_id);
CREATE INDEX bookings_therapist_id_idx ON public.bookings USING btree (therapist_id);
CREATE INDEX bookings_session_date_idx ON public.bookings USING btree (session_date);
CREATE INDEX bookings_status_idx ON public.bookings USING btree (status);

alter table "public"."therapists" add constraint "therapists_pkey" PRIMARY KEY using index "therapists_pkey";
alter table "public"."bookings" add constraint "bookings_pkey" PRIMARY KEY using index "bookings_pkey";

alter table "public"."therapists" add constraint "therapists_user_id_unique" UNIQUE using index "therapists_user_id_unique";

alter table "public"."bookings" add constraint "bookings_therapist_id_fkey" FOREIGN KEY (therapist_id) REFERENCES public.therapists(id) ON DELETE CASCADE;

alter table "public"."bookings" add constraint "bookings_status_check" CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'));
alter table "public"."bookings" add constraint "bookings_session_type_check" CHECK (session_type IN ('video', 'audio', 'chat'));
alter table "public"."bookings" add constraint "bookings_payment_status_check" CHECK (payment_status IN ('pending', 'paid', 'refunded'));
alter table "public"."therapists" add constraint "therapists_experience_years_check" CHECK (experience_years >= 0);
alter table "public"."therapists" add constraint "therapists_hourly_rate_check" CHECK (hourly_rate >= 0);

ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."therapists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON "public"."user_profiles"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own profile"
ON "public"."user_profiles"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own profile"
ON "public"."user_profiles"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own profile"
ON "public"."user_profiles"
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."chat_messages";

CREATE POLICY "Users can view their own chat messages"
ON "public"."chat_messages"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own chat messages"
ON "public"."chat_messages"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own chat messages"
ON "public"."chat_messages"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own chat messages"
ON "public"."chat_messages"
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY "Anyone can view verified therapists"
ON "public"."therapists"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (verified = true);

CREATE POLICY "Therapists can view their own profile"
ON "public"."therapists"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their therapist profile"
ON "public"."therapists"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Therapists can update their own profile"
ON "public"."therapists"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Therapists can delete their own profile"
ON "public"."therapists"
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY "Clients can view their own bookings"
ON "public"."bookings"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid()::text = client_user_id);

CREATE POLICY "Therapists can view bookings for their sessions"
ON "public"."bookings"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.therapists 
        WHERE therapists.id = bookings.therapist_id 
        AND therapists.user_id = auth.uid()::text
    )
);

CREATE POLICY "Clients can create bookings"
ON "public"."bookings"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = client_user_id);

CREATE POLICY "Clients can update their own bookings"
ON "public"."bookings"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (auth.uid()::text = client_user_id)
WITH CHECK (auth.uid()::text = client_user_id);

CREATE POLICY "Therapists can update bookings for their sessions"
ON "public"."bookings"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.therapists 
        WHERE therapists.id = bookings.therapist_id 
        AND therapists.user_id = auth.uid()::text
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.therapists 
        WHERE therapists.id = bookings.therapist_id 
        AND therapists.user_id = auth.uid()::text
    )
);

CREATE POLICY "Clients can delete their own bookings"
ON "public"."bookings"
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (auth.uid()::text = client_user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_therapists_updated_at BEFORE UPDATE ON public.therapists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
