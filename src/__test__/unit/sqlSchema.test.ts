import fs from 'fs';
import path from 'path';

describe('SQL schema', () => {
	it('should define Better Auth verification timestamp columns with camelCase names', () => {
		const initialSchema = fs.readFileSync(
			path.join(__dirname, '..', '..', '..', 'sql', 'V1__Initial.sql'),
			'utf8'
		);

		expect(initialSchema).toContain('"expiresAt" TIMESTAMP NOT NULL');
		expect(initialSchema).toContain('"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
		expect(initialSchema).toContain('"updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
	});

	it('should migrate existing lowercase verification timestamp columns', () => {
		const migration = fs.readFileSync(
			path.join(
				__dirname,
				'..',
				'..',
				'..',
				'sql',
				'V2__Fix_better_auth_verification_columns.sql'
			),
			'utf8'
		);

		expect(migration).toContain('RENAME COLUMN expiresat TO "expiresAt"');
		expect(migration).toContain('RENAME COLUMN createdat TO "createdAt"');
		expect(migration).toContain('RENAME COLUMN updatedat TO "updatedAt"');
	});

	it('adds authenticated ownership to lost-pet reports without guessing legacy rows', () => {
		const migration = fs.readFileSync(
			path.join(__dirname, '..', '..', '..', 'sql', 'V4__Lost_report_ownership.sql'),
			'utf8',
		);

		expect(migration).toContain('ADD COLUMN user_id TEXT REFERENCES "user"(id)');
		expect(migration).toContain('ON DELETE CASCADE');
		expect(migration).toContain('Existing imported/legacy rows remain nullable');
	});

	it('adds source identity and import-run tracking for repeatable API imports', () => {
		const migration = fs.readFileSync(
			path.join(__dirname, '..', '..', '..', 'sql', 'V3__Source_identity_and_import_runs.sql'),
			'utf8',
		);

		expect(migration).toContain('CREATE TABLE IF NOT EXISTS import_runs');
		expect(migration).toContain('source_record_id TEXT');
		expect(migration).toContain('CREATE UNIQUE INDEX');
	});

	it('adds report lifecycle fields and durable match jobs', () => {
		const migration = fs.readFileSync(
			path.join(__dirname, '..', '..', '..', 'sql', 'V6__Lost_report_lifecycle_and_match_jobs.sql'),
			'utf8',
		);
		expect(migration).toContain("DEFAULT 'OPEN'");
		expect(migration).toContain('revision INTEGER NOT NULL DEFAULT 1');
		expect(migration).toContain('CREATE TABLE match_jobs');
		expect(migration).toContain('UNIQUE (report_id, report_revision, engine_version)');
	});

	it('defines a deduplicated notification outbox with retry state', () => {
		const migration = fs.readFileSync(
			path.join(__dirname, '..', '..', '..', 'sql', 'V7__Notification_outbox.sql'),
			'utf8',
		);
		expect(migration).toContain('CREATE TABLE notification_outbox');
		expect(migration).toContain('dedupe_key TEXT NOT NULL UNIQUE');
		expect(migration).toContain("'PENDING'");
		expect(migration).toContain("'SENT'");
	});

	it('enforces unique OAuth provider identities and links', () => {
		const migration = fs.readFileSync(
			path.join(__dirname, '..', '..', '..', 'sql', 'V5__Auth_account_identity.sql'),
			'utf8',
		);

		expect(migration).toContain('"providerId", "accountId"');
		expect(migration).toContain('"userId", "providerId"');
	});
});
