import { pool } from "../db";
import { formatDate } from "../libs/animal.utils";
import { Animal, AnimalLostData } from "../libs/zod/animals";
import BaseRepository from "./base.db";

class AnimalLostRepository extends BaseRepository {

	constructor() {
		super("animal_lost");
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
			values.push("%" + variety + "%");
		}

		const whereClause = filters.length ? "WHERE " + filters.join(" AND ") : "";
		const query = `
			SELECT * FROM animal
			INNER JOIN animal_shelter
			ON animal.animal_shelter_id = animal_shelter.id
			${whereClause};
		`;

		const { rows } = await pool.query<Animal>(query, values);
		return rows;
	}

	async findByOwnerId(ownerId: number): Promise<AnimalLostData[]> {
		const query = `
			SELECT *
			FROM ${this.tableName}
			WHERE owner_id = $1
		`;
		const values = [ownerId];
		const result = await pool.query(query, values);
		return result.rows;
	}

	async bulkInsertAnimalLosts(animalLosts: AnimalLostData[]): Promise<number> {
		let insertedRowCount = 0;
		const batchSize = 100;

		await pool.query("START TRANSACTION");

		// First, ensure the global "Unknown" owner exists
		const unknownOwnerQuery = `
			INSERT INTO owner(name, phone, email)
			VALUES('Unknown', 'Unknown', 'Unknown')
			ON CONFLICT(phone, email) DO UPDATE SET
				name = EXCLUDED.name
			RETURNING id;
			`;
		const unknownOwnerResult = await pool.query(unknownOwnerQuery);
		const unknownOwnerId = unknownOwnerResult.rows[0].id;

		for (let i = 0; i < animalLosts.length; i += batchSize) {
			const batch = animalLosts.slice(i, i + batchSize);

			// Separate animals with known vs unknown owners
			const knownOwnerAnimals = batch.filter(animal =>
				(animal.owner_phone && animal.owner_phone.trim() !== "") ||
				(animal.owner_email && animal.owner_email.trim() !== "")
			);

			const ownerMap = new Map<string, number>();
			// Insert known owners if any
			if (knownOwnerAnimals.length > 0) {
				const ownerValues: any[] = [];
				const ownerPlaceholders = knownOwnerAnimals.map((animal, idx) => {
					const baseIdx = idx * 3;
					ownerValues.push(
						animal.owner_name && animal.owner_name.trim() !== "" ? animal.owner_name.trim() : 'Unknown',
						animal.owner_phone && animal.owner_phone.trim() !== "" ? animal.owner_phone.trim() : 'Unknown',
						animal.owner_email && animal.owner_email.trim() !== "" ? animal.owner_email.trim() : 'Unknown'
					);
					return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3})`;
				}).join(", ");

				const insertOwnerQuery = `
					INSERT INTO owner(name, phone, email)
					VALUES ${ownerPlaceholders}
					ON CONFLICT(phone, email) DO NOTHING
					RETURNING id, phone, email;
				`;
				const ownerResult = await pool.query(insertOwnerQuery, ownerValues);

				// Map known owners
				ownerResult.rows.forEach(row => {
					const key = `${row.phone}_${row.email} `;
					// console.log('Mapping owner:', key, 'to ID:', row.id);
					ownerMap.set(key, row.id);
				});
			}

			// Insert lost animals
			const animalValues: any[] = [];
			const animalPlaceholders = batch.map((animal, idx) => {
				const baseIdx = idx * 12;

				let ownerId: number;
				if ((animal.owner_phone && animal.owner_phone.trim() !== "") ||
					(animal.owner_email && animal.owner_email.trim() !== "")) {
					const ownerKey = `
						${animal.owner_phone && animal.owner_phone.trim() !== "" ?
							animal.owner_phone.trim() : 'Unknown'}_${animal.owner_email && animal.owner_email.trim() !== "" ? animal.owner_email.trim() : 'Unknown'} `;
					ownerId = ownerMap.get(ownerKey) || unknownOwnerId
				} else {
					ownerId = unknownOwnerId
				}

				animalValues.push(
					animal.chipid ?? null,
					animal.name ?? null,
					animal.kind ?? null,
					animal.variety ?? null,
					animal.sex ?? null,
					animal.colour ?? null,
					animal.outlook ?? null,
					animal.feature ?? null,
					animal.lost_time ? formatDate(animal.lost_time) : '1970-01-01',
					animal.lost_place ?? null,
					animal.picture ?? null,
					ownerId
				);
				return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, $${baseIdx + 8}, $${baseIdx + 9}, $${baseIdx + 10}, $${baseIdx + 11}, $${baseIdx + 12})`;
			}).join(", ");

			const insertAnimalQuery = `
				INSERT INTO animal_lost(
				chip_id, name, kind, variety, sex, colour, outlook, feature, lost_time, lost_place, picture, owner_id)
				VALUES ${animalPlaceholders}
				ON CONFLICT(chip_id) DO NOTHING;
			`;
			const result = await pool.query(insertAnimalQuery, animalValues);
			insertedRowCount += result.rowCount ?? 0;
		}

		await pool.query("COMMIT");

		return insertedRowCount;
	}
}

export default AnimalLostRepository;
