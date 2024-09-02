"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taiwanCities = [
    '臺北',
    '新北',
    '桃園',
    '臺中',
    '臺南',
    '高雄',
    '基隆',
    '新竹',
    '新竹',
    '苗栗',
    '彰化',
    '南投',
    '雲林',
    '嘉義',
    '嘉義',
    '屏東',
    '宜蘭',
    '花蓮',
    '臺東',
    '澎湖',
    '金門',
    '連江',
];
const cityInTaiwan = (city) => {
    city = city.replace('台', '臺');
    return taiwanCities.includes(city);
};
exports.default = cityInTaiwan;
