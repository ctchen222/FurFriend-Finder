import BaseRepository from './base.db';

class UserRepository extends BaseRepository {
	constructor() {
		super('"user"');
	}
}

export default UserRepository;
