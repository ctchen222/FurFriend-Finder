import { pool } from '../db';
import { AnimalOwner } from '../utils/zod/animals';
import { Owner } from '../utils/zod/owner';
import BaseRepository from './base.db';

class OwnerRepository extends BaseRepository {
	constructor() {
		super('owners');
	}

	/**
	 * Finds an existing owner by phone or email, or creates a new one.
	 * @param owner The owner data to find or create.
	 * @returns The found or newly created owner object.
	 */
	public async findOrCreate(owner: AnimalOwner): Promise<Owner> {
		const { phone, email } = owner;

		// Manually query with OR condition as BaseRepository's findOne uses AND
		const findQuery = `SELECT * FROM ${this.tableName} WHERE phone = $1 OR email = $2 LIMIT 1`;
		const findValues = [phone, email];
		const result = await pool.query(findQuery, findValues);
		const existingOwner = result.rows[0];

		if (existingOwner) {
			return existingOwner;
		}

		// Use the inherited create method if no owner is found
		const newOwner = await this.create<Owner>(owner);
		return newOwner;
	}
}

export default OwnerRepository;
