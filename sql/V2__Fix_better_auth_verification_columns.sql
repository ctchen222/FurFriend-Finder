DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'verification'
			AND column_name = 'expiresat'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'verification'
			AND column_name = 'expiresAt'
	) THEN
		ALTER TABLE verification RENAME COLUMN expiresat TO "expiresAt";
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'verification'
			AND column_name = 'createdat'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'verification'
			AND column_name = 'createdAt'
	) THEN
		ALTER TABLE verification RENAME COLUMN createdat TO "createdAt";
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'verification'
			AND column_name = 'updatedat'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'verification'
			AND column_name = 'updatedAt'
	) THEN
		ALTER TABLE verification RENAME COLUMN updatedat TO "updatedAt";
	END IF;
END $$;
