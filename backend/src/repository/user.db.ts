import { pool } from "../db";
import { User } from "./type/users";
import BaseRepository from "./base.db";

class UserRepository extends BaseRepository {
	constructor() {
		super("users");
	}

	async createUser(data: User) {
		const query = `
			INSERT INTO users (name, email, city, isRegisteredViaLine)
			VALUES ($1, $2, $3, $4)
			RETURNING *;
		`

		const values = [data.name, data.email, data.city, data.isRegisteredViaLine]

		const { rows } = await pool.query(query, values)

		return rows[0]
	}

	async updateUser(email: string, data: any) {
		const query = `
			UPDATE users
			SET name = $1, age = $2, city = $3
			WHERE email = $4;
		`

		const values = [data.name, data.age, data.city, email]

		const { rows } = await pool.query(query, values)

		return rows
	}
}

export default UserRepository;
