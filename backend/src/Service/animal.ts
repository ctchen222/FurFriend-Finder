import axios from "axios";
import AnimalRepository from "../repository/animal.db";
import { Animal, AnimalResponseSchema } from "../libs/zod/animals";

class AnimalService {
	private repository: AnimalRepository
	constructor() {
		this.repository = new AnimalRepository()
	}

	updateAnimalTable = async () => {
		const response = await axios.get(
			'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL',
		);
		const parseResult = AnimalResponseSchema.safeParse(response.data);

		if (!parseResult.success) {
			// throw new CustomError();
			throw new Error("Invalid data format received from the API");
		}

		const animals: Animal[] = parseResult.data.map((item) => (
			{
				subid: item.animal_subid,
				kind: item.animal_kind,
				variety: item.animal_Variety,
				sex: item.animal_sex,
				age: item.animal_age,
				bodytype: item.animal_bodytype,
				colour: item.animal_colour,
				found_place: item.animal_foundplace,
				remark: item.animal_remark,
				picture: item.album_file,
				status: item.animal_status,

				opendate: item.animal_opendate,
				closedate: item.animal_closedate,
				updatedate: item.animal_update,

				animal_shelter_id: item.animal_shelter_pkid,
				shelter_name: item.shelter_name,
				shelter_address: item.shelter_address,
				shelter_tel: item.shelter_tel,
			}
		));

		const insertedRowCount = await this.repository.bulkInsertAnimals(animals)

		return insertedRowCount;
	};
}

export default AnimalService
