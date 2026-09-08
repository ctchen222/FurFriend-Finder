import fs from 'fs';
import path from 'path';

describe('SQL schema', () => {
    it('migrates worker timestamps using the database session timezone', () => {
        const migration = fs.readFileSync(
            path.join(__dirname, '..', '..', '..', 'sql', 'V13__Worker_lease_timestamps.sql'),
            'utf8',
        );
        expect(migration).toContain('ALTER TABLE match_jobs');
        expect(migration).toContain('ALTER TABLE notification_outbox');
        for (const column of ['available_at', 'lease_until', 'created_at', 'sent_at']) {
            expect(migration).toContain(`ALTER COLUMN ${column} TYPE TIMESTAMPTZ`);
            expect(migration).toContain(`USING ${column} AT TIME ZONE current_setting('TimeZone')`);
        }
        expect(migration).not.toContain('ALTER TABLE organization_mail_outbox');
    });

    it('should define Better Auth verification timestamp columns with camelCase names', () => {
        const initialSchema = fs.readFileSync(
            path.join(__dirname, '..', '..', '..', 'sql', 'V1__Initial.sql'),
            'utf8',
        );

        expect(initialSchema).toContain('"expiresAt" TIMESTAMP NOT NULL');
        expect(initialSchema).toContain(
            '"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        );
        expect(initialSchema).toContain(
            '"updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        );
    });

    it('should migrate existing lowercase verification timestamp columns', () => {
        const migration = fs.readFileSync(
            path.join(
                __dirname,
                '..',
                '..',
                '..',
                'sql',
                'V2__Fix_better_auth_verification_columns.sql',
            ),
            'utf8',
        );

        expect(migration).toContain('RENAME COLUMN expiresat TO "expiresAt"');
        expect(migration).toContain('RENAME COLUMN createdat TO "createdAt"');
        expect(migration).toContain('RENAME COLUMN updatedat TO "updatedAt"');
    });

    it('adds authenticated ownership to lost-pet reports without guessing legacy rows', () => {
        const migration = fs.readFileSync(
            path.join(
                __dirname,
                '..',
                '..',
                '..',
                'sql',
                'V4__Lost_report_ownership.sql',
            ),
            'utf8',
        );

        expect(migration).toContain(
            'ADD COLUMN user_id TEXT REFERENCES "user"(id)',
        );
        expect(migration).toContain('ON DELETE CASCADE');
        expect(migration).toContain(
            'Existing imported/legacy rows remain nullable',
        );
    });

    it('adds source identity and import-run tracking for repeatable API imports', () => {
        const migration = fs.readFileSync(
            path.join(
                __dirname,
                '..',
                '..',
                '..',
                'sql',
                'V3__Source_identity_and_import_runs.sql',
            ),
            'utf8',
        );

        expect(migration).toContain('CREATE TABLE import_runs');
        expect(migration).toContain('source_record_id TEXT');
        expect(migration).toContain('CREATE UNIQUE INDEX');
    });

    it('adds report lifecycle fields and durable match jobs', () => {
        const migration = fs.readFileSync(
            path.join(
                __dirname,
                '..',
                '..',
                '..',
                'sql',
                'V6__Lost_report_lifecycle_and_match_jobs.sql',
            ),
            'utf8',
        );
        expect(migration).toContain("DEFAULT 'OPEN'");
        expect(migration).toContain('revision INTEGER NOT NULL DEFAULT 1');
        expect(migration).toContain('CREATE TABLE match_jobs');
        expect(migration).toContain(
            'UNIQUE (report_id, report_revision, engine_version)',
        );
    });

    it('defines a deduplicated notification outbox with retry state', () => {
        const migration = fs.readFileSync(
            path.join(
                __dirname,
                '..',
                '..',
                '..',
                'sql',
                'V7__Notification_outbox.sql',
            ),
            'utf8',
        );
        expect(migration).toContain('CREATE TABLE notification_outbox');
        expect(migration).toContain('dedupe_key TEXT NOT NULL UNIQUE');
        expect(migration).toContain("'PENDING'");
        expect(migration).toContain("'SENT'");
    });

    it('enforces unique OAuth provider identities and links', () => {
        const migration = fs.readFileSync(
            path.join(
                __dirname,
                '..',
                '..',
                '..',
                'sql',
                'V5__Auth_account_identity.sql',
            ),
            'utf8',
        );

        expect(migration).toContain('"providerId", "accountId"');
        expect(migration).toContain('"userId", "providerId"');
    });

    it('adds single-use organization invitations, ownership transfers, and durable mail', () => {
        const migration = fs.readFileSync(
            path.join(
                __dirname,
                '..',
                '..',
                '..',
                'sql',
                'V9__Organization_membership_management.sql',
            ),
            'utf8',
        );

        expect(migration).toContain('CREATE TABLE organization_invitations');
        expect(migration).toContain(
            'CREATE UNIQUE INDEX organization_one_pending_invitation',
        );
        expect(migration).toContain(
            'CREATE TABLE organization_ownership_transfers',
        );
        expect(migration).toContain(
            'CREATE UNIQUE INDEX organization_one_pending_transfer',
        );
        expect(migration).toContain('CREATE TABLE organization_mail_outbox');
        expect(migration).toContain('dedupe_key TEXT NOT NULL UNIQUE');
        expect(migration).toContain('token_hash CHAR(64) NOT NULL UNIQUE');
    });

    it('separates platform reviewers, review decisions, and moderation history', () => {
        const migration = fs.readFileSync(
            path.join(
                __dirname,
                '..',
                '..',
                '..',
                'sql',
                'V10__Organization_review_and_publication.sql',
            ),
            'utf8',
        );
        expect(migration).toContain('CREATE TABLE platform_roles');
        expect(migration).toContain('CREATE TABLE platform_role_events');
        expect(migration).toContain('CREATE TABLE organization_reviews');
        expect(migration).toContain(
            'UNIQUE (organization_id, organization_version)',
        );
        expect(migration).toContain(
            'CREATE TABLE organization_moderation_events',
        );
        expect(migration).toContain("created_at + INTERVAL '24 hours'");
        expect(
            fs.readFileSync(
                path.join(
                    process.cwd(),
                    'src/Service/organizations/membershipRepository.ts',
                ),
                'utf8',
            ),
        ).toContain(
            "organization_invitations (id,organization_id,email,role,token_hash,invited_by,expires_at)\n             VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP + INTERVAL '7 days')",
        );
    });
});
