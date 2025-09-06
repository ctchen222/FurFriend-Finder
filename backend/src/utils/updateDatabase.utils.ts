import axios from 'axios';
import { z } from 'zod';

import AnimalRepository from '../repository/animal.db';
import { Animal, AnimalLost, AnimalLostResponseSchema, animalResponseScheme } from './zod/animals';

const animalRepository = new AnimalRepository();


export const updateAnimalTable = async () => {
	const response = await axios.get(
		'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL',
	);
	const parseResult = animalResponseScheme.safeParse(response.data);

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

	const insertedRowCount = await animalRepository.bulkInsertAnimals(animals)

	return insertedRowCount;
};

export const updateAnimalLostTable = async () => {
	const response = await axios.get(
		'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=IFJomqVzyB0i',
	);
	const parseResult = AnimalLostResponseSchema.safeParse(response.data);

	if (!parseResult.success) {
		// throw new CustomError();
		throw new Error("Invalid data format received from the API");
	}

	const lostAnimals: AnimalLost[] = parseResult.data.map((item) => (
		{
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
		}
	));

	const insertedRowCount = await animalRepository.bulkInsertAnimalLosts(lostAnimals);

	return insertedRowCount;
};
