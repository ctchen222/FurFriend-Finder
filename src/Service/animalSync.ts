import axios from "axios";
import AnimalLostRepository from "../repository/animalLost.db";
import { AnimalLostData, AnimalLostResponseSchema } from "../libs/zod/animals";

class AnimalSyncService {
	private repository: AnimalLostRepository;

	constructor(deps?: { repository?: AnimalLostRepository }) {
		this.repository = deps?.repository ?? new AnimalLostRepository();
	}

	async updateTableAnimalLosts(): Promise<number> {
		const response = await axios.get(
			'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=IFJomqVzyB0i',
		);
		const parseResult = AnimalLostResponseSchema.safeParse(response.data);

		if (!parseResult.success) {
			throw new Error("Invalid data format received from the API");
		}

		const lostAnimals: AnimalLostData[] = parseResult.data.map((item) => ({
			chipid: item.晶片號碼,
			name: item.寵物名,
			kind: item.寵物別,
			sex: item.性別,
			variety: item.品種,
			colour: item.毛色,
			outlook: item.外觀,
			feature: item.特徵,
			lost_time: item.遺失時間,
			lost_place: item.遺失地點,
			owner_name: item.飼主姓名,
			owner_phone: item.連絡電話,
			owner_email: item.EMail,
			picture: item.PICTURE,
		}));

		return this.repository.bulkInsertAnimalLosts(lostAnimals);
	}
}

export default AnimalSyncService;
