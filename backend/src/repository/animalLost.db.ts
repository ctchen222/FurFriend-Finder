import BaseRepository from "./base.db";

class AnimalLostRepository extends BaseRepository {

	constructor() {
		super("animal_losts");
	}

	async findMatchedAnimals(id: string) { }
}

export default AnimalLostRepository;
