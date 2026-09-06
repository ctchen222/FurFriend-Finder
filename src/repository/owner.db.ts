import { pool } from '../db';
import { recordDbOperation } from '../config/metrics';
import { AnimalOwner } from '../libs/zod/animals';
import { Owner } from '../libs/zod/owner';
import BaseRepository from './base.db';
import type { DbExecutor } from '../libs/transaction';

class OwnerRepository extends BaseRepository {
	constructor(db?: DbExecutor) {
		super('owner', db);
	}

	public async findByEmail(email: string): Promise<Owner | null> {
		return recordDbOperation('find_owner', () => this.findOne<Owner>({ email }));
	}

	async findById<T>(id: number | string, options?: string[]): Promise<T> {
		return recordDbOperation('find_owner', () =>
			super.findById<T>(id, options),
		);
	}

	/**
	 * Finds an existing owner by phone or email, or creates a new one.
	 * @param owner The owner data to find or create.
	 * @returns The found or newly created owner object.
	 */
	public async findOrCreate(owner: AnimalOwner): Promise<Owner> {
		return recordDbOperation('find_owner', async () => {
			const { phone, email } = owner;

			// Manually query with OR condition as BaseRepository's findOne uses AND
			const findQuery = `SELECT * FROM ${this.tableName} WHERE phone = $1 OR email = $2 LIMIT 1`;
			const findValues = [phone, email];
			const result = await this.db.query(findQuery, findValues);
			const existingOwner = result.rows[0];

			if (existingOwner) {
				return existingOwner;
			}

			// Use the inherited create method if no owner is found
			const newOwner = await this.create<Owner>(owner);
			return newOwner;
		});
	}
}

export default OwnerRepository;
