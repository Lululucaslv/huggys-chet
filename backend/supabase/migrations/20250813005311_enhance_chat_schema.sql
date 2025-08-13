ALTER TABLE "public"."chat_messages" 
ADD COLUMN IF NOT EXISTS "conversation_id" uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS "image_url" text,
ADD COLUMN IF NOT EXISTS "tokens_used" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "model_used" text DEFAULT 'gpt-4-turbo';

ALTER TABLE "public"."user_profiles" 
ADD COLUMN IF NOT EXISTS "total_messages" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "personality_type" text DEFAULT '新用户',
ADD COLUMN IF NOT EXISTS "preferences" text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "last_chat_at" timestamp without time zone;

CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_idx ON public.chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx ON public.chat_messages (user_id, created_at);

DROP POLICY IF EXISTS "Users can view their own conversations" ON "public"."chat_messages";
CREATE POLICY "Users can view their own conversations"
ON "public"."chat_messages"
AS PERMISSIVE FOR SELECT TO authenticated
USING (auth.uid()::text = user_id);
