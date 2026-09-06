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

	it('tracks source identity and import runs for repeatable API ingestion', () => {
		const migration = fs.readFileSync(
			path.join(__dirname, '..', '..', '..', 'sql', 'V3__Source_identity_and_import_runs.sql'),
			'utf8',
		);
		expect(migration).toContain('CREATE TABLE import_runs');
		expect(migration).toContain('source_record_id TEXT');
		expect(migration).toContain('animal_source_identity_uidx');
		expect(migration).toContain('animal_lost_source_identity_uidx');
	});
});
