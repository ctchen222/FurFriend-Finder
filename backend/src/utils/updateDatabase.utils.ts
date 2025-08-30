import axios from 'axios';
import { z } from 'zod';

import AnimalRepository from '../repository/animal.db';

const animalRepository = new AnimalRepository();

const animalResponseScheme = z.array(z.object({
	animal_id: z.number().optional(),
	animal_subid: z.string().optional(),
	animal_area_pkid: z.number().optional(),
	animal_shelter_pkid: z.number(),
	animal_place: z.string().optional(),
	animal_kind: z.string().optional(),
	animal_Variety: z.string().optional(),
	animal_sex: z.string().optional(),
	animal_bodytype: z.string().optional(),
	animal_colour: z.string().optional(),
	animal_age: z.string().optional(),
	animal_sterilization: z.string().optional(),
	animal_bacterin: z.string().optional(),
	animal_foundplace: z.string().optional(),
	animal_title: z.string().optional(),
	animal_status: z.string().optional(),
	animal_remark: z.string().optional(),
	animal_caption: z.string().optional(),
	animal_opendate: z.string().nullish().optional(),
	animal_closedate: z.string().nullish().optional(),
	animal_update: z.string().nullish().optional(),
	animal_createtime: z.string().nullish().optional(),
	shelter_name: z.string().optional(),
	album_file: z.string().optional(),
	album_update: z.string().optional(),
	cDate: z.string().optional(),
	shelter_address: z.string().optional(),
	shelter_tel: z.string().optional(),
}))
export type AnimalResponse = z.infer<typeof animalResponseScheme>[number];

const AnimalSchema = z.object({
	id: z.number().optional(),
	subid: z.string().trim().optional(),
	kind: z.string().trim().optional(),
	variety: z.string().trim().optional(),
	sex: z.string().trim().optional(),
	age: z.string().trim().optional(),
	bodytype: z.string().trim().optional(),
	colour: z.string().trim().optional(),
	found_place: z.string().trim().optional(),
	remark: z.string().trim().optional(),
	picture: z.string().trim().optional(),
	status: z.string().trim().optional(),
	opendate: z.string().trim().nullable().optional(),
	closedate: z.string().trim().nullable().optional(),
	updatedate: z.string().nullable().optional(),
	animal_shelter_id: z.number(),
	shelter_name: z.string().optional(),
	shelter_address: z.string().trim().optional(),
	shelter_tel: z.string().trim().optional(),
});
export type Animal = z.infer<typeof AnimalSchema>;

export const AnimalShelterSchema = z.object({
	id: z.number().optional(),
	name: z.string().optional(),
	address: z.string().optional(),
	tel: z.string().optional(),
});
export type AnimalShelter = z.infer<typeof AnimalShelterSchema>;

export const AnimalLostSchema = z.object({
	chipid: z.string().optional(),
	name: z.string().optional(),
	kind: z.string().optional(),
	variety: z.string().optional(),
	sex: z.string().optional(),
	colour: z.string().optional(),
	outlook: z.string().optional(),
	feature: z.string().optional(),
	lost_time: z.string().optional(),
	lost_place: z.string().optional(),
	picture: z.string().optional(),
	owner_name: z.string().nullish().optional(),
	owner_phone: z.string().nullish().optional(),
	owner_email: z.string().nullish().optional(),
})
export type AnimalLost = z.infer<typeof AnimalLostSchema>;

export const AnimalOwnerSchema = z.object({
	name: z.string().nullish().optional(),
	phone: z.string().nullish().optional(),
	email: z.string().nullish().optional(),
});
export type AnimalOwner = z.infer<typeof AnimalOwnerSchema>;

export const AnimalLostResponseSchema = z.array(z.object({
	晶片號碼: z.string().optional(),
	寵物名: z.string().optional(),
	寵物別: z.string().optional(),
	性別: z.string().optional(),
	品種: z.string().optional(),
	毛色: z.string().optional(),
	外觀: z.string().optional(),
	特徵: z.string().optional(),
	遺失時間: z.string().optional(),
	遺失地點: z.string().optional(),
	EMail: z.string().optional(),
	飼主姓名: z.string().optional(),
	連絡電話: z.string().optional(),
	PICTURE: z.string().optional(),
}));
export type AnimalLostResponse = z.infer<typeof AnimalLostResponseSchema>;

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
