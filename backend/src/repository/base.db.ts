import { pool } from "../db";

class BaseRepository {
	protected tableName: string;
	constructor(tableName: string) {
		this.tableName = tableName;
	}

	async findAll<T>(
		pageSize: number = 10,
		cursor?: string | undefined,
		options?: string[],
		orderBy?: string[],
	): Promise<T[]> {
		const orderByStr = orderBy && orderBy.length > 0 ?
			`ORDER BY ( ${orderBy.join(", ")} ) DESC` : "ORDER BY id ASC";

		const query = `
			SELECT ${options ? options.join(", ") : "*"}
			FROM ${this.tableName}
			${cursor ? `WHERE id > ${cursor}` : ""}
			${orderByStr}
			LIMIT ${pageSize};
		`;

		const result = await pool.query(query)
		return result.rows;
	}

	async findById<T>(id: number | string, options?: string[]): Promise<T> {
		const query = `
			SELECT ${options ? options.join(", ") : "*"} 
			FROM ${this.tableName} 
			WHERE id = $1
		`;

		const values = [id];
		const result = await pool.query(query, values);

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
			WHERE ${conditionStr.join(" AND ")}
			${joinStr}
			LIMIT 1
		`;

		const values = Object.values(conditions);
		const result = await pool.query(query, values);

		return result.rows[0] || null;
	}
}

export default BaseRepository;
