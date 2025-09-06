import { pool } from "../db";
import { Animal } from "../utils/zod/animals";
import BaseRepository from "./base.db";

class AnimalLostRepository extends BaseRepository {

	constructor() {
		super("animal_losts");
	}

	async findMatchingAnimals(colour?: string[], kind?: string, sex?: string, variety?: string) {
		const filters: string[] = [];
		const values: any[] = [];

		if (colour) {
			const colorFilters = colour.map((_, index) => {
				values.push(`%${colour[index]}%`);
				return `colour LIKE $${values.length}`;
			});
			filters.push(`(${colorFilters.join(" OR ")})`);
		}

		if (kind) {
			filters.push("kind = $" + (values.length + 1));
			values.push(kind);
		}
		if (sex) {
			filters.push("sex = $" + (values.length + 1));
			values.push(sex);
		}
		if (variety) {
			filters.push("variety LIKE $" + (values.length + 1));
			values.push(variety + "%");
		}

		const whereClause = filters.length ? "WHERE " + filters.join(" AND ") : "";
		const query = `
			SELECT * FROM animals ${whereClause};
		`;


		const { rows } = await pool.query<Animal>(query, values);
		return rows;
	}
}

export default AnimalLostRepository;
