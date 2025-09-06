import { z } from 'zod';

export const animalResponseScheme = z.array(z.object({
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


export const AnimalColourSchema = z
	.string()
	.transform((val) =>
		val
			.replace(/[，。、；：,.!?/]/g, '') // 移除常見標點符號
			.split('色')
			.map((c) => c.trim())
			.filter((c) => c.length > 0)
	)
