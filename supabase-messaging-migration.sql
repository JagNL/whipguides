-- ============================================================
-- WhipGuides — Chunk 3: Messaging Migration (FIXED)
-- Run this in the Supabase SQL Editor
-- ============================================================
-- NOTE: Migration 1 created a basic `messages` table with a
-- different schema. This migration drops it and replaces it
-- with the full conversations + messages system.
-- ============================================================

-- ── Drop old messages table (safe — no real data yet) ────────
DROP TABLE IF EXISTS public.messages CASCADE;

-- ── Conversations ────────────────────────────────────────────
-- A thread between two users, optionally tied to a listing
CREATE TABLE IF NOT EXISTS public.conversations (
  id                BIGSERIAL PRIMARY KEY,
  participant1_id   BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant2_id   BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  listing_id        BIGINT REFERENCES public.listings(id) ON DELETE SET NULL,
  last_message      TEXT,
  last_message_at   TIMESTAMPTZ DEFAULT NOW(),
  unread_count_1    INT DEFAULT 0,
  unread_count_2    INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_conversation UNIQUE (participant1_id, participant2_id)
);

-- ── Messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id               BIGSERIAL PRIMARY KEY,
  conversation_id  BIGINT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content          TEXT NOT NULL,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversations_p1      ON public.conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p2      ON public.conversations(participant2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv         ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON public.messages(sender_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — all access goes through our backend
-- which uses the service role key, so open policies are safe here
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE USING (true);

CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (true);

-- ── Realtime ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- ── Helper: get or create conversation ───────────────────────
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  user_a BIGINT,
  user_b BIGINT,
  p_listing_id BIGINT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  p1       BIGINT := LEAST(user_a, user_b);
  p2       BIGINT := GREATEST(user_a, user_b);
  conv_id  BIGINT;
BEGIN
  SELECT id INTO conv_id
    FROM public.conversations
   WHERE participant1_id = p1 AND participant2_id = p2;

  IF conv_id IS NULL THEN
    INSERT INTO public.conversations(participant1_id, participant2_id, listing_id)
    VALUES (p1, p2, p_listing_id)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DONE — tables: conversations, messages (replaced old messages)
-- ============================================================
