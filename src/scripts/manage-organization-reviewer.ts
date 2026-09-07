import 'dotenv/config';
import { Pool } from 'pg';

async function run() {
    const [action, identity, operatorLabel] = process.argv.slice(2);
    if (!['grant', 'revoke'].includes(action) || !identity || !operatorLabel) {
        throw new Error(
            'Usage: pnpm reviewer:role -- <grant|revoke> <user-id-or-email> <operator-label>',
        );
    }
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const users = await client.query<{ id: string }>(
            `SELECT id FROM "user" WHERE id=$1 OR lower(email)=lower($1) FOR UPDATE`,
            [identity],
        );
        if (users.rowCount !== 1) throw new Error('找不到唯一符合的使用者');
        const userId = users.rows[0].id;
        if (action === 'grant') {
            await client.query(
                `INSERT INTO platform_roles (user_id,role,active,granted_by,granted_at,revoked_at)
                 VALUES ($1,'ORGANIZATION_REVIEWER',true,$2,CURRENT_TIMESTAMP,NULL)
                 ON CONFLICT (user_id,role) DO UPDATE SET active=true,granted_by=$2,
                    granted_at=CURRENT_TIMESTAMP,revoked_at=NULL`,
                [userId, operatorLabel],
            );
        } else {
            const result = await client.query(
                `UPDATE platform_roles SET active=false,revoked_at=CURRENT_TIMESTAMP
                 WHERE user_id=$1 AND role='ORGANIZATION_REVIEWER' AND active=true`,
                [userId],
            );
            if (result.rowCount !== 1)
                throw new Error('此使用者目前沒有啟用中的審核權限');
        }
        await client.query(
            `INSERT INTO platform_role_events (target_user_id,role,action,operator_label)
             VALUES ($1,'ORGANIZATION_REVIEWER',$2,$3)`,
            [userId, action === 'grant' ? 'GRANTED' : 'REVOKED', operatorLabel],
        );
        await client.query('COMMIT');
        console.log(
            `Reviewer role ${action === 'grant' ? 'granted' : 'revoked'} for ${userId}.`,
        );
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await db.end();
    }
}

run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
