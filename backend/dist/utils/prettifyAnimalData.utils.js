"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prettifyAnimalData = (data) => {
    const numOfData = data.length;
    let textMsg = '';
    data.forEach((animal, idx) => {
        animal.variety = animal.variety.replace(/\s/g, '');
        textMsg += `${idx + 1}, ${animal.variety} | ${animal.sheltername} | ${animal.photo}\n `;
    });
    return textMsg;
};
exports.default = prettifyAnimalData;
