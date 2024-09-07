"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDateToday = void 0;
const getDateToday = () => {
    const today = new Date();
    const taiwanFormatter = new Intl.DateTimeFormat('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Taipei',
    });
    const [{ value: year }, , { value: month }, , { value: day }] = taiwanFormatter.formatToParts(today);
    const formattedDate = `${year}-${month}-${day}`;
    // 將日期組合成 'year-month-day' 格式
    return formattedDate;
};
exports.getDateToday = getDateToday;
