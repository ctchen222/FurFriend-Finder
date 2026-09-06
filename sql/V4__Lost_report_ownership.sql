-- Link a lost-pet report to the authenticated Better Auth user.
-- Existing imported/legacy rows remain nullable and are not guessed from email.
ALTER TABLE animal_lost
    ADD COLUMN user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE;

CREATE INDEX animal_lost_user_id_id_idx
    ON animal_lost (user_id, id);
