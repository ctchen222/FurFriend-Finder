import { pool } from '../db';
import { Animal } from '../libs/zod/animals';
import { flexibleDateSchema } from '../libs/zod/date';
import BaseRepository from './base.db';

class AnimalRepository extends BaseRepository {
    constructor() {
        super('animal');
    }

    async findAnimalsByCity(city: string) {
        const query = `
			SELECT * FROM ${this.tableName}
			LEFT JOIN animal_shelter ON animal.animal_shelter_id = animal_shelter.id
			WHERE animal_shelter.address LIKE $1;
		`;

        const values = [`%${city}%`];

        const { rows } = await pool.query(query, values);

        return rows;
    }

    async findAllWithShelter(
        pageSize: number = 10,
        cursor?: string | undefined,
        options?: string[],
    ) {
        const animalFields = [
            'id',
            'sub_id',
            'kind',
            'variety',
            'sex',
            'age',
            'body_type',
            'colour',
            'found_place',
            'remark',
            'picture',
            'status',
            'animal_shelter_id',
            'open_date',
            'close_date',
            'update_date',
        ];
        const shelterFields = ['id', 'name', 'address', 'tel'];

        let selectFields: string;
        if (options && options.length > 0) {
            const safeAnimalFields = options
                .filter((opt) => animalFields.includes(opt))
                .map((opt) => `animal.${opt}`);
            selectFields = [
                ...safeAnimalFields,
                ...shelterFields.map(
                    (f) => `animal_shelter.${f} as shelter_${f}`,
                ),
            ].join(', ');
        } else {
            selectFields = '*';
        }

        const values: any[] = [];
        let cursorClause = '';
        if (cursor !== undefined) {
            values.push(cursor);
            cursorClause = `WHERE animal.id > $${values.length}`;
        }
        values.push(pageSize);
        const pageSizePlaceholder = `$${values.length}`;

        const query = `
			SELECT ${selectFields}
			FROM ${this.tableName}
			LEFT JOIN animal_shelter
			ON animal.animal_shelter_id = animal_shelter.id
			${cursorClause}
			ORDER BY animal.update_date DESC, animal.open_date DESC
			LIMIT ${pageSizePlaceholder};
		`;

        const { rows } = await pool.query(query, values);
        return rows;
    }

    async findAnimalShelterById(animalId: string): Promise<Animal | null> {
        const query = `
			SELECT 
				animal.*, animal_shelter.name AS shelter_name,
				animal_shelter.address AS shelter_address, animal_shelter.tel AS shelter_tel
			FROM animal
			LEFT JOIN animal_shelter
			ON animal.animal_shelter_id = animal_shelter.id
			WHERE animal.id = $1;
		`;

        const values = [animalId];
        const { rows } = await pool.query(query, values);

        return rows[0] || null;
    }

    async bulkInsertAnimals(animals: Animal[]): Promise<number> {
        const seen = new Map<string, Animal>();
        const noSubId: Animal[] = [];
        for (const animal of animals) {
            if (!animal.subid) {
                noSubId.push(animal);
            } else {
                const existing = seen.get(animal.subid);
                if (
                    !existing ||
                    (animal.updatedate ?? '') >= (existing.updatedate ?? '')
                ) {
                    seen.set(animal.subid, animal);
                }
            }
        }
        const uniqueAnimals = [...seen.values(), ...noSubId];

        await pool.query('START TRANSACTION');

        let insertedRowCount = 0;
        const batchSize = 100;
        for (let i = 0; i < uniqueAnimals.length; i += batchSize) {
            const batch = uniqueAnimals.slice(i, i + batchSize);

            const shelterValues: any[] = [];
            const shelterPlaceholders = batch
                .map((animal, idx) => {
                    const baseIdx = idx * 4; // 4 columns

                    shelterValues.push(
                        animal.animal_shelter_id,
                        animal.shelter_name ?? null,
                        animal.shelter_address ?? null,
                        animal.shelter_tel ?? null,
                    );
                    return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4})`;
                })
                .join(', ');

            const insertShelterQuery = `
				INSERT INTO animal_shelter(
				id, name, address, tel)
			    VALUES ${shelterPlaceholders}
			    ON CONFLICT(id) DO NOTHING;
				`;
            await pool.query(insertShelterQuery, shelterValues);

            const values: any[] = [];
            const valuePlaceholders = batch
                .map((animal, idx) => {
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
                        animal.opendate ? animal.opendate : '1970-01-01',
                        animal.closedate ? animal.closedate : '1970-01-01',
                        animal.updatedate
                            ? flexibleDateSchema.parse(animal.updatedate)
                            : '1970-01-01',
                    );
                    return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, $${baseIdx + 8}, $${baseIdx + 9}, $${baseIdx + 10}, $${baseIdx + 11}, $${baseIdx + 12}, $${baseIdx + 13}, $${baseIdx + 14}, $${baseIdx + 15})`;
                })
                .join(', ');

            const insertQuery = `
				INSERT INTO animal(
			    sub_id, kind, variety, sex, age, body_type, colour, found_place, remark, picture, status, animal_shelter_id, open_date, close_date, update_date )
			    VALUES ${valuePlaceholders}
				ON CONFLICT(sub_id) DO UPDATE SET
				    status      = EXCLUDED.status,
				    close_date  = EXCLUDED.close_date,
				    update_date = EXCLUDED.update_date,
				    picture     = EXCLUDED.picture,
				    remark      = EXCLUDED.remark;
			`;
            const result = await pool.query(insertQuery, values);
            insertedRowCount += result.rowCount ?? 0;
        }

        await pool.query('COMMIT');
        return insertedRowCount;
    }

    async findRandomAnimal() {
        const selectRandomAnimal = (whereClause = '') => `
			SELECT
				animal.*,
				animal_shelter.name AS shelter_name,
				animal_shelter.address AS shelter_address,
				animal_shelter.tel AS shelter_tel
			FROM ${this.tableName}
			LEFT JOIN animal_shelter
			ON ${this.tableName}.animal_shelter_id = animal_shelter.id
			${whereClause}
			ORDER BY RANDOM()
			LIMIT 1;
		`;

        const pictured = await pool.query(
            selectRandomAnimal(
                `WHERE ${this.tableName}.picture IS NOT NULL AND ${this.tableName}.picture <> ''`,
            ),
        );
        if (pictured.rows[0]) {
            return pictured.rows[0];
        }

        const fallback = await pool.query(selectRandomAnimal());
        return fallback.rows[0];
    }
}

export default AnimalRepository;
