"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAnimalLostTable = exports.updateAnimalTable = void 0;
const axios_1 = __importDefault(require("axios"));
const db_1 = require("../db");
const updateAnimalTable = async () => {
    const response = await axios_1.default.get('https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL');
    const data = response.data;
    const animals = data.map((item) => ({
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
    console.log(animals);
    // Upsert data into table animal_sheltername_address
    data.map(async (item) => {
        await db_1.prisma.animal_sheltername_address.upsert({
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
    const { count: dataUpdatedNumber } = await db_1.prisma.animal.createMany({
        data: animals,
        skipDuplicates: true, // skip repeated data
    });
    return dataUpdatedNumber;
};
exports.updateAnimalTable = updateAnimalTable;
const updateAnimalLostTable = async () => {
    const response = await axios_1.default.get('https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=IFJomqVzyB0i');
    const data = response.data;
    const lostAnimals = data.map((item) => ({
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
    const { count: dataUpdatedNumber } = await db_1.prisma.animal_lost.createMany({
        data: lostAnimals,
        skipDuplicates: true,
    });
    return dataUpdatedNumber;
};
exports.updateAnimalLostTable = updateAnimalLostTable;
