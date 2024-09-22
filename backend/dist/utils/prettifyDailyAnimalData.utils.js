"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prettiftyDailyAnimalData = (dailyAnimalData) => {
    let textMsg = '';
    const numOfData = dailyAnimalData.length;
    if (numOfData === 0) {
        textMsg +=
            '[每日訊息] \n今日沒有新的動物更新 \n輸入縣市、品種來獲得更多資訊！';
    }
    dailyAnimalData.forEach((animal, idx) => {
        animal.variety = animal.variety.replace(/\s/g, '');
        textMsg += `${idx + 1}, ${animal.variety} | ${animal.sheltername} | ${animal.photo}\n `;
    });
    return textMsg;
};
exports.default = prettiftyDailyAnimalData;
