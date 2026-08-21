-- Confirmed live: messages.conversation_id has a NOT NULL constraint that
-- VirtueCore's own insert code never sets (client_id/sender_id/content is
-- its whole model — no concept of conversations). This is more evidence
-- messages is shared with a different, conversation-threaded messaging
-- product on this Supabase project. Relaxing NOT NULL is safe either way:
-- it can't break any existing valid row (those already have a value), and
-- it only stops blocking inserts that legitimately don't set it.
alter table messages alter column conversation_id drop not null;
