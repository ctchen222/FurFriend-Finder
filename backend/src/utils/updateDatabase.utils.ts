import axios from 'axios';
import { prisma } from '../db';
import { Request, Response } from 'express';
import { animal_lost } from 'prisma/prisma-client';
interface Animal {
  animal_id: number;
  animal_kind: string;
  animal_Variety?: string;
  animal_sex?: string;
  animal_age?: string;
  animal_bodytype?: string;
  animal_colour?: string;
  animal_status?: string;
  animal_remark?: string;
  animal_opendate?: Date | null;
  animal_createtime?: Date | null;
  album_file?: string;
  shelter_name: string;
}

interface AnimalLost {
  chipid: string;
  petname?: string;
  petcategory: string;
  gender: string;
  variety: string;
  coat?: string;
  exterior?: string;
  feature?: string;
  losttime: string;
  lostplace: string;
  feedername?: string;
  phonenum: string;
  email?: string;
  photo?: string;
}

interface AnimalLostResponse {
  晶片號碼: string;
  寵物名?: string;
  寵物別: string;
  性別: string;
  品種: string;
  毛色?: string;
  外觀?: string;
  特徵?: string;
  遺失時間: string;
  遺失地點: string;
  飼主姓名?: string;
  連絡電話: string;
  EMail?: string;
  PICTURE?: string;
}

export const updateAnimalTable = async () => {
  const response = await axios.get(
    'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL',
  );
  const data = response.data;

  const animals = data.map((item: Animal) => ({
    animal_id: item.animal_id,
    kind: item.animal_kind,
    variety: item.animal_Variety,
    sex: item.animal_sex,
    age: item.animal_age,
    bodytype: item.animal_bodytype,
    colour: item.animal_colour,
    status: item.animal_status,
    remark: item.animal_remark,
    opendate: item.animal_opendate ? new Date(item.animal_opendate) : null,
    createtime: item.animal_createtime
      ? new Date(item.animal_createtime)
      : null,
    photo: item.album_file,
    sheltername: item.shelter_name,
  }));

  // Upsert data into table animal_sheltername_address
  data.map(async (item: any) => {
    await prisma.animal_sheltername_address.upsert({
      where: { sheltername: item.shelter_name },
      update: { address: item.shelter_address, tel: item.shelter_tel }, // update data searched
      create: {
        // create data if not existed
        sheltername: item.shelter_name,
        address: item.shelter_address,
        tel: item.shelter_tel,
      },
    });
  });

  const { count: dataUpdatedNumber } = await prisma.animal.createMany({
    data: animals,
    skipDuplicates: true, // skip repeated data
  });

  return dataUpdatedNumber;
};

export const updateAnimalLostTable = async () => {
  const response = await axios.get(
    'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=IFJomqVzyB0i',
  );
  const data = response.data;

  const lostAnimals: AnimalLost[] = data.map((item: AnimalLostResponse) => ({
    chipid: item.晶片號碼,
    petname: item.寵物名,
    petcategory: item.寵物別,
    gender: item.性別,
    variety: item.品種,
    coat: item.毛色,
    exterior: item.外觀,
    feature: item.特徵,
    losttime: item.遺失時間,
    lostplace: item.遺失地點,
    feedername: item.飼主姓名,
    phonenum: item.連絡電話,
    email: item.EMail,
    photo: item.PICTURE,
  }));

  const { count: dataUpdatedNumber } = await prisma.animal_lost.createMany({
    data: lostAnimals,
    skipDuplicates: true,
  });

  return dataUpdatedNumber;
};
