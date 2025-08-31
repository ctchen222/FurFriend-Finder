import { pool } from "../db";
import { formatDate } from "../utils/animal.utils";
import { Animal, AnimalLost } from "../utils/updateDatabase.utils";
import { flexibleDateSchema } from "../utils/zod/date";
import BaseRepository from "./base.db";

class AnimalRepository extends BaseRepository {
	constructor() {
		super("animals");
	}

	async findAnimalsByCity(city: string) {
		const query = `
			SELECT * FROM animals
			LEFT JOIN animal_shelters ON animals.animal_shelter_id = animal_shelters.id
			WHERE animal_shelters.address LIKE $1;
		`

		const values = [`%${city}%`]

		const { rows } = await pool.query(query, values)

		return rows
	}

	async findAllWithShelter(options?: string[]) {
		const animalFields = [
			'id', 'sub_id', 'kind', 'variety', 'sex', 'age', 'body_type', 'colour', 'found_place', 'remark', 'picture', 'status', 'animal_shelter_id', 'open_date', 'close_date', 'update_date'
		];
		const shelterFields = [
			'id', 'name', 'address', 'tel'
		];

		let selectFields: string;
		if (options && options.length > 0) {
			const safeAnimalFields = options.filter(opt => animalFields.includes(opt)).map(opt => `animals.${opt}`);
			selectFields = [...safeAnimalFields, ...shelterFields.map(f => `animal_shelters.${f} as shelter_${f}`)].join(', ');
		} else {
			selectFields = '*';
		}

		const query = `
			SELECT ${selectFields}
			FROM animals
			LEFT JOIN animal_shelters 
			ON animals.animal_shelter_id = animal_shelters.id
			ORDER BY ( animals.update_date, animals.open_date ) DESC;
		`

		const { rows } = await pool.query(query)
		return rows
	}

	async findAnimalShelterById(animalId: string): Promise<Animal | null> {
		const query = `
			SELECT 
				animals.*, animal_shelters.name AS shelter_name, 
				animal_shelters.address AS shelter_address, animal_shelters.tel AS shelter_tel
			FROM animals
			LEFT JOIN animal_shelters 
			ON animals.animal_shelter_id = animal_shelters.id
			WHERE animals.id = $1;
		`

		const values = [animalId]
		const { rows } = await pool.query(query, values)

		return rows[0] || null
	}

	async bulkInsertAnimals(animals: Animal[]): Promise<number> {
		let insertedRowCount = 0
		const batchSize = 100; // Adjust batch size as needed
		for (let i = 0; i < animals.length; i += batchSize) {
			const batch = animals.slice(i, i + batchSize);

			const shelterValues: any[] = [];
			const shelterPlaceholders = batch.map((animal, idx) => {
				const baseIdx = idx * 4; // 4 columns

				shelterValues.push(
					animal.animal_shelter_id,
					animal.shelter_name ?? null,
					animal.shelter_address ?? null,
					animal.shelter_tel ?? null
				);
				return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4})`;
			}
			).join(", ");

			const insertShelterQuery = `
				INSERT INTO animal_shelters(
				id, name, address, tel)
			    VALUES ${shelterPlaceholders}
			    ON CONFLICT(id) DO NOTHING;
`;
			await pool.query(insertShelterQuery, shelterValues);


			const values: any[] = [];
			const valuePlaceholders = batch.map((animal, idx) => {
				const baseIdx = idx * 15;

				values.push(
					animal.subid,
					animal.kind,
					animal.variety,
					animal.sex,
					animal.age,
					animal.bodytype,
					animal.colour,
					animal.found_place,
					animal.remark,
					animal.picture,
					animal.status,
					animal.animal_shelter_id,
					animal.opendate ? animal.opendate : "9999-12-31",
					animal.closedate ? animal.closedate : "9999-12-31",
					animal.updatedate ? flexibleDateSchema.parse(animal.updatedate) : "9999-12-31"
				);
				return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, $${baseIdx + 8}, $${baseIdx + 9}, $${baseIdx + 10}, $${baseIdx + 11}, $${baseIdx + 12}, $${baseIdx + 13}, $${baseIdx + 14}, $${baseIdx + 15})`;
			}).join(", ");

			const insertQuery = `
				INSERT INTO animals(
			    sub_id, kind, variety, sex, age, body_type, colour, found_place, remark, picture, status, animal_shelter_id, open_date, close_date, update_date )
			    VALUES ${valuePlaceholders}
			    ON CONFLICT(sub_id) DO NOTHING;
			`;
			const result = await pool.query(insertQuery, values);
			insertedRowCount += result.rowCount ?? 0;
		}
		return insertedRowCount;
	}

	// TODO: 
	// 1. animal_losts 對應的owners 檢查，目前好像不一定是正確
	// 2. date format 需要確認
	async bulkInsertAnimalLosts(animalLosts: AnimalLost[]): Promise<number> {
		let insertedRowCount = 0;
		const batchSize = 100;

		// First, ensure the global "Unknown" owner exists
		// const unknownOwnerQuery = `
		// 	INSERT INTO owners(name, phone, email)
		// 	VALUES('Unknown', 'Unknown', 'Unknown')
		// 	ON CONFLICT(phone, email) DO UPDATE SET
		// 		name = EXCLUDED.name
		// 	RETURNING id;
		// 	`;
		// const unknownOwnerResult = await pool.query(unknownOwnerQuery);
		// const unknownOwnerId = unknownOwnerResult.rows[0].id;

		for (let i = 0; i < animalLosts.length; i += batchSize) {
			const batch = animalLosts.slice(i, i + batchSize);

			// Separate animals with known vs unknown owners
			// const knownOwnerAnimals = batch.filter(animal =>
			// 	(animal.owner_phone && animal.owner_phone.trim() !== "") ||
			// 	(animal.owner_email && animal.owner_email.trim() !== "")
			// );
			//
			// const ownerMap = new Map<string, number>();
			//
			// // Insert known owners if any
			// if (knownOwnerAnimals.length > 0) {
			// 	const ownerValues: any[] = [];
			// 	const ownerPlaceholders = knownOwnerAnimals.map((animal, idx) => {
			// 		const baseIdx = idx * 3;
			// 		ownerValues.push(
			// 			animal.owner_name && animal.owner_name.trim() !== "" ? animal.owner_name.trim() : 'Unknown',
			// 			animal.owner_phone && animal.owner_phone.trim() !== "" ? animal.owner_phone.trim() : 'Unknown',
			// 			animal.owner_email && animal.owner_email.trim() !== "" ? animal.owner_email.trim() : 'Unknown'
			// 		);
			// 		return `(${baseIdx + 1}, ${baseIdx + 2}, ${baseIdx + 3})`;
			// 	}).join(", ");
			//
			// 	const insertOwnerQuery = `
			// 		INSERT INTO owners(name, phone, email)
			// 		VALUES ${ownerPlaceholders}
			// 		ON CONFLICT(phone, email) DO NOTHING
			// 		RETURNING id, phone, email;
			// 	`;
			// 	console.log('Inserting owners with query:', insertOwnerQuery);
			// 	console.log('With values:', ownerValues);
			// 	// console.log('With values:', ownerValues.length);
			// 	const ownerResult = await pool.query(insertOwnerQuery, ownerValues);
			//
			// 	// Map known owners
			// 	ownerResult.rows.forEach(row => {
			// 		const key = `${row.phone}_${row.email} `;
			// 		console.log('Mapping owner:', key, 'to ID:', row.id);
			// 		ownerMap.set(key, row.id);
			// 	});
			// }

			// Insert lost animals
			const animalValues: any[] = [];
			const animalPlaceholders = batch.map((animal, idx) => {
				const baseIdx = idx * 12;

				let ownerId: number;
				// if ((animal.owner_phone && animal.owner_phone.trim() !== "") ||
				// 	(animal.owner_email && animal.owner_email.trim() !== "")) {
				// 	const ownerKey = `
				// 		${animal.owner_phone && animal.owner_phone.trim() !== "" ? animal.owner_phone.trim() : 'Unknown'}_${animal.owner_email && animal.owner_email.trim() !== "" ? animal.owner_email.trim() : 'Unknown'} `;
				// 	ownerId = ownerMap.get(ownerKey) || unknownOwnerId;
				// } else {
				// 	ownerId = unknownOwnerId;
				// }
				ownerId = 1;

				animalValues.push(
					animal.chipid ?? null,
					animal.name ?? null,
					animal.kind ?? null,
					animal.variety ?? null,
					animal.sex ?? null,
					animal.colour ?? null,
					animal.outlook ?? null,
					animal.feature ?? null,
					animal.lost_time ? formatDate(animal.lost_time) : '9999-12-31',
					animal.lost_place ?? null,
					animal.picture ?? null,
					ownerId
				);
				return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, $${baseIdx + 8}, $${baseIdx + 9}, $${baseIdx + 10}, $${baseIdx + 11}, $${baseIdx + 12})`;
			}).join(", ");

			const insertAnimalQuery = `
				INSERT INTO animal_losts(
				chip_id, name, kind, variety, sex, colour, outlook, feature, lost_time, lost_place, picture, owner_id)
				VALUES ${animalPlaceholders}
				ON CONFLICT(chip_id) DO NOTHING;
			`;
			const result = await pool.query(insertAnimalQuery, animalValues);
			insertedRowCount += result.rowCount ?? 0;
		}

		return insertedRowCount;
	}

	async findMatchingAnimals(kind?: string, sex?: string, variety?: string) {
		const query = `
			SELECT * FROM animals
			WHERE kind = $1 AND sex = $2;
		`

		const values = [kind, sex]
		const { rows } = await pool.query(query, values)
		return rows
	}
}

export default AnimalRepository;
