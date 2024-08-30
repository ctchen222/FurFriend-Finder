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

  const { count: updateCount } = await prisma.animal.createMany({
    data: animals,
    skipDuplicates: true, // 如果有重複的資料，可以選擇跳過
  });

  return updateCount;
};
