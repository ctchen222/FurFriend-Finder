import { pool } from "../db";
import type { DbExecutor } from "../libs/transaction";

class BaseRepository {
	protected tableName: string;
	protected db: DbExecutor;
	constructor(tableName: string, db: DbExecutor = pool) {
		this.tableName = tableName;
		this.db = db;
	}

	async start(): Promise<void> {
		const queryStartTransaction = 'START TRANSACTION;'

		await this.db.query(queryStartTransaction)
	}

	async commit(): Promise<void> {
		const queryCommit = 'COMMIT;'

		await this.db.query(queryCommit)
	}

	async rollback(): Promise<void> {
		const queryRollback = 'ROLLBACK;'

		await this.db.query(queryRollback)
	}

	async findAll<T>(
		pageSize: number = 10,
		cursor?: string | undefined,
		options?: string[],
		orderBy?: string[],
	): Promise<T[]> {
		const orderByStr = orderBy && orderBy.length > 0 ?
			`ORDER BY ${orderBy.join(" DESC, ")} DESC` : "ORDER BY id ASC";

		const values: any[] = [];
		let cursorClause = "";
		if (cursor !== undefined) {
			values.push(cursor);
			cursorClause = `WHERE id > $${values.length}`;
		}
		values.push(pageSize);
		const pageSizePlaceholder = `$${values.length}`;

		const query = `
			SELECT ${options ? options.join(", ") : "*"}
			FROM ${this.tableName}
			${cursorClause}
			${orderByStr}
			LIMIT ${pageSizePlaceholder};
		`;

		const result = await this.db.query(query, values)
		return result.rows;
	}

	async findById<T>(id: number | string, options?: string[]): Promise<T> {
		const query = `
			SELECT ${options ? options.join(", ") : "*"} 
			FROM ${this.tableName} 
			WHERE id = $1
		`;

		const values = [id];
		const result = await this.db.query(query, values);

		return result.rows[0];
	}

	async findOne<T>(
		conditions: { [key: string]: any },
		options?: string[],
		joinOptions?: { table: string; on: string }[]
	): Promise<T | null> {
		const conditionStr = Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`);
		const joinStr = joinOptions && joinOptions.length > 0
			? joinOptions.map(join => `JOIN ${join.table} ON ${join.on}`).join(" ")
			: "";

		const query = `
			SELECT ${options ? options.join(", ") : "*"}
			FROM ${this.tableName}
			${joinStr}
			WHERE ${conditionStr.join(" AND ")}
			LIMIT 1
		`;

		const values = Object.values(conditions);
		const result = await this.db.query(query, values);

		return result.rows[0] || null;
	}

	async create<T>(data: { [key: string]: any }, options?: string[]): Promise<T> {
		const keys = Object.keys(data);
		const values = Object.values(data);
		const placeholders = keys.map((_, index) => `$${index + 1}`);

		const query = `
			INSERT INTO ${this.tableName} (${keys.join(", ")})
			VALUES (${placeholders.join(", ")})
			RETURNING ${options ? options.join(", ") : "*"};
		`;

		const result = await this.db.query(query, values);
		return result.rows[0];
	}

	async update<T>(id: number | string, data: { [key: string]: any }, options?: string[]): Promise<T | null> {
		const keys = Object.keys(data);
		if (keys.length === 0) {
			throw new Error("No data provided for update.");
		}
		const setString = keys.map((key, index) => `"${key}" = $${index + 2}`).join(", ");

		const query = `
			UPDATE ${this.tableName}
			SET ${setString}
			WHERE id = $1
			RETURNING ${options ? options.join(", ") : "*"};
		`;

		const values = [id, ...Object.values(data)];
		const result = await this.db.query(query, values);

		return result.rows[0] || null;
	}
}

export default BaseRepository;
