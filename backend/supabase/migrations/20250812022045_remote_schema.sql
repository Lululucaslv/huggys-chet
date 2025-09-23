create extension if not exists "pgjwt" with schema "extensions";


create table "public"."chat_messages" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" text not null,
    "role" text not null,
    "message" text not null,
    "created_at" timestamp without time zone not null default now(),
    "message_type" text not null,
    "audio_url" text not null
);


create table "public"."user_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" text not null,
    "interest" text,
    "language" text,
    "life_status" text,
    "created_at" timestamp without time zone default now()
);


CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id, user_id, role, message, created_at, message_type, audio_url);

CREATE UNIQUE INDEX unique_user_id ON public.user_profiles USING btree (user_id);

CREATE UNIQUE INDEX user_profiles_pkey ON public.user_profiles USING btree (id);

alter table "public"."chat_messages" add constraint "chat_messages_pkey" PRIMARY KEY using index "chat_messages_pkey";

alter table "public"."user_profiles" add constraint "user_profiles_pkey" PRIMARY KEY using index "user_profiles_pkey";

alter table "public"."user_profiles" add constraint "unique_user_id" UNIQUE using index "unique_user_id";

create policy "Enable insert for authenticated users only"
on "public"."chat_messages"
as permissive
for insert
to authenticated
with check (true);



