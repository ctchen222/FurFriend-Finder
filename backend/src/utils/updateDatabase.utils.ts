import axios from 'axios';
import { prisma } from '../db';
import { Request, Response } from 'express';

export const updateDatabase = async (req: Request, res: Response) => {
  const response = await axios.get(
    'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL',
  );
  const data = response.data;

  const animals = data.map((item: any) => ({
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
