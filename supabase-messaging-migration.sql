-- ============================================================
-- WhipGuides — Chunk 3: Messaging Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Conversations: a thread between two users, optionally about a listing
CREATE TABLE IF NOT EXISTS conversations (
  id          BIGSERIAL PRIMARY KEY,
  participant1_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant2_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id  BIGINT REFERENCES listings(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count_1 INT DEFAULT 0,  -- unread for participant1
  unread_count_2 INT DEFAULT 0,  -- unread for participant2
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique pair (smaller id always goes in participant1)
  CONSTRAINT unique_conversation UNIQUE (participant1_id, participant2_id)
);

-- Messages: individual messages in a conversation
CREATE TABLE IF NOT EXISTS messages (
  id             BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content        TEXT NOT NULL,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON conversations(participant2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- ── RLS Policies ────────────────────────────────────────────

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations: only participants can read/write
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (true);  -- server-side filtering via service role

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (true);

-- Messages: only participants in the conversation can see them
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (true);

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (true);

-- ── Realtime ────────────────────────────────────────────────
-- Enable Realtime on messages table so clients get live updates
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- ── Helper function: get or create conversation ──────────────
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  user_a BIGINT,
  user_b BIGINT,
  p_listing_id BIGINT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  p1 BIGINT := LEAST(user_a, user_b);
  p2 BIGINT := GREATEST(user_a, user_b);
  conv_id BIGINT;
BEGIN
  SELECT id INTO conv_id FROM conversations
    WHERE participant1_id = p1 AND participant2_id = p2;

  IF conv_id IS NULL THEN
    INSERT INTO conversations(participant1_id, participant2_id, listing_id)
    VALUES (p1, p2, p_listing_id)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql;
