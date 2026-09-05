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
});
