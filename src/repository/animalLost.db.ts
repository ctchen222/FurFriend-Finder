import { pool } from "../db";
import {
	extractCityCountyMetricLabel,
	recordDbOperation,
	type CountyInventoryCounts,
} from "../config/metrics";
import { normalizeSourceDate } from "../libs/animal.utils";
import { AnimalCandidate, AnimalLostData } from "../libs/zod/animals";
import BaseRepository from "./base.db";
import type { DbExecutor } from '../libs/transaction';
import { withTransaction } from '../libs/transaction';
import type { QueryResultRow } from 'pg';

const OPEN_STATUS_FILTER = "status = 'OPEN'";

class AnimalLostRepository extends BaseRepository {

	constructor(db?: DbExecutor) {
		super("animal_lost", db);
	}

	async findMatchingAnimals(colour?: string[], kind?: string, sex?: string, variety?: string) {
		return recordDbOperation('find_match_candidates', async () => {
			const filters: string[] = [OPEN_STATUS_FILTER];
		const values: any[] = [];

		if (colour && colour.length > 0) {
			const colorFilters = colour.map((c) => {
				values.push(`%${c}%`);
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

		const whereClause = "WHERE " + filters.join(" AND ");
		const query = `
			SELECT
				animal.*,
				animal_shelter.name  AS shelter_name,
				animal_shelter.address AS shelter_address,
				animal_shelter.tel   AS shelter_tel
			FROM animal
			INNER JOIN animal_shelter
				ON animal.animal_shelter_id = animal_shelter.id
			${whereClause};
		`;

		const { rows } = await this.db.query<AnimalCandidate>(query, values);
		return rows;
		});
	}

	async findById<T>(id: number | string, options?: string[]): Promise<T> {
		return recordDbOperation('find_lost_animal', () =>
			super.findById<T>(id, options),
		);
	}

	async findByOwnerId(ownerId: number): Promise<AnimalLostData[]> {
		return recordDbOperation('find_lost_animal', async () => {
			const query = `
			SELECT *
			FROM ${this.tableName}
			WHERE owner_id = $1
		`;
			const values = [ownerId];
			const result = await this.db.query(query, values);
			return result.rows;
		});
	}

	async findByUserId<T extends QueryResultRow = AnimalLostData>(
		userId: string,
		pageSize: number = 10,
		cursor?: string,
	): Promise<T[]> {
		return recordDbOperation('find_lost_animal', async () => {
			const values: Array<string | number> = [userId];
			let cursorClause = '';
			if (cursor !== undefined) {
				values.push(cursor);
				cursorClause = `AND id > $${values.length}`;
			}
			values.push(pageSize);
			const result = await this.db.query<T>(
				`SELECT * FROM ${this.tableName}
				 WHERE user_id = $1 ${cursorClause}
				 ORDER BY id ASC LIMIT $${values.length}`,
				values,
			);
			return result.rows;
		});
	}

	async findByIdForUser<T extends QueryResultRow = AnimalLostData>(id: number | string, userId: string): Promise<T | undefined> {
		return recordDbOperation('find_lost_animal', async () => {
			const result = await this.db.query<T>(
				`SELECT * FROM ${this.tableName} WHERE id = $1 AND user_id = $2`,
				[id, userId],
			);
			return result.rows[0];
		});
	}

	async closeForUser(
		id: number | string,
		userId: string,
		expectedRevision: number,
		status: 'REUNITED' | 'CLOSED',
	): Promise<{ id: number; status: string; revision: number } | undefined> {
		return recordDbOperation('find_lost_animal', async () => {
			const result = await this.db.query<{ id: number; status: string; revision: number }>(
				`UPDATE ${this.tableName}
				 SET status = $1, revision = revision + 1,
				     updated_at = CURRENT_TIMESTAMP, closed_at = CURRENT_TIMESTAMP
				 WHERE id = $2 AND user_id = $3 AND revision = $4 AND status = 'OPEN'
				 RETURNING id, status, revision`,
				[status, id, userId, expectedRevision],
			);
			return result.rows[0];
		});
	}

	async countLostAnimalsByCounty(): Promise<CountyInventoryCounts> {
		return recordDbOperation('find_lost_animal', async () => {
			const query = `
				SELECT lost_place
				FROM ${this.tableName}
				WHERE lost_place IS NOT NULL;
			`;
			const { rows } = await pool.query<{ lost_place: string }>(query);
			const counts: CountyInventoryCounts = {};

			for (const row of rows) {
				const cityCounty = extractCityCountyMetricLabel(row.lost_place);
				if (cityCounty === null) {
					continue;
				}

				counts[cityCounty] = (counts[cityCounty] ?? 0) + 1;
			}

			return counts;
		});
	}

	async bulkInsertAnimalLosts(animalLosts: AnimalLostData[]): Promise<number> {
		if (this.db === pool) {
			return withTransaction(pool, (client) =>
				new AnimalLostRepository(client).bulkInsertAnimalLostsInTransaction(animalLosts),
			);
		}
		return this.bulkInsertAnimalLostsInTransaction(animalLosts);
	}

	private async bulkInsertAnimalLostsInTransaction(animalLosts: AnimalLostData[]): Promise<number> {
		return recordDbOperation('bulk_insert_lost_animals', async () => {
			let insertedRowCount = 0;
		const batchSize = 100;

		// First, ensure the global "Unknown" owner exists
		const unknownOwnerQuery = `
			INSERT INTO owner(name, phone, email)
			VALUES('Unknown', 'Unknown', 'Unknown')
			ON CONFLICT(phone, email) DO UPDATE SET
				name = EXCLUDED.name
			RETURNING id;
			`;
			const unknownOwnerResult = await this.db.query(unknownOwnerQuery);
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
				const ownerResult = await this.db.query(insertOwnerQuery, ownerValues);

				// Map known owners
				ownerResult.rows.forEach(row => {
					const key = `${row.phone}_${row.email}`;
					ownerMap.set(key, row.id);
				});

				// ON CONFLICT DO NOTHING does not return existing rows. Load those
				// owners before assigning animal_lost.owner_id, otherwise a repeat
				// import silently attaches the animal to the Unknown owner.
				const ownerLookupValues: string[] = [];
				const ownerLookupPairs = knownOwnerAnimals.map((animal, idx) => {
					const phone = animal.owner_phone && animal.owner_phone.trim() !== '' ? animal.owner_phone.trim() : 'Unknown';
					const email = animal.owner_email && animal.owner_email.trim() !== '' ? animal.owner_email.trim() : 'Unknown';
					ownerLookupValues.push(phone, email);
					const baseIdx = idx * 2;
					return `(phone = $${baseIdx + 1} AND email = $${baseIdx + 2})`;
				}).join(' OR ');
				if (ownerLookupPairs) {
					const existingOwners = await this.db.query<{ id: number; phone: string; email: string }>(
						`SELECT id, phone, email FROM owner WHERE ${ownerLookupPairs}`,
						ownerLookupValues,
					);
					existingOwners.rows.forEach(row => ownerMap.set(`${row.phone}_${row.email}`, row.id));
				}
			}

			// Insert lost animals
			const animalValues: any[] = [];
			const animalPlaceholders = batch.map((animal, idx) => {
				const baseIdx = idx * 14;

				let ownerId: number;
				if ((animal.owner_phone && animal.owner_phone.trim() !== "") ||
					(animal.owner_email && animal.owner_email.trim() !== "")) {
					const ownerKey = `${animal.owner_phone && animal.owner_phone.trim() !== "" ? animal.owner_phone.trim() : 'Unknown'}_${animal.owner_email && animal.owner_email.trim() !== "" ? animal.owner_email.trim() : 'Unknown'}`;
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
					normalizeSourceDate(animal.lost_time),
					animal.lost_place ?? null,
					animal.picture ?? null,
					ownerId,
					animal.source_system ?? 'moa_lost_animals',
					animal.source_record_id ?? animal.chipid ?? null,
				);
				return `(${Array.from({ length: 14 }, (_, offset) => `$${baseIdx + offset + 1}`).join(', ')})`;
			}).join(", ");

			const insertAnimalQuery = `
				INSERT INTO animal_lost(
				chip_id, name, kind, variety, sex, colour, outlook, feature, lost_time, lost_place, picture, owner_id, source_system, source_record_id)
				VALUES ${animalPlaceholders}
				ON CONFLICT(chip_id) DO NOTHING;
			`;
			const result = await this.db.query(insertAnimalQuery, animalValues);
			insertedRowCount += result.rowCount ?? 0;
		}

		return insertedRowCount;
		});
	}
}

export default AnimalLostRepository;
