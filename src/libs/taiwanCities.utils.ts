const taiwanCities = [
    '臺北市',
    '新北市',
    '桃園市',
    '臺中市',
    '臺南市',
    '高雄市',
    '基隆市',
    '新竹市',
    '新竹縣',
    '苗栗縣',
    '彰化縣',
    '南投縣',
    '雲林縣',
    '嘉義市',
    '嘉義縣',
    '屏東縣',
    '宜蘭縣',
    '花蓮縣',
    '臺東縣',
    '澎湖縣',
    '金門縣',
    '連江縣',
] as const;

const taiwanCityAliases: Record<string, (typeof taiwanCities)[number]> = {
    臺北: '臺北市',
    新北: '新北市',
    桃園: '桃園市',
    臺中: '臺中市',
    臺南: '臺南市',
    高雄: '高雄市',
    基隆: '基隆市',
    苗栗: '苗栗縣',
    彰化: '彰化縣',
    南投: '南投縣',
    雲林: '雲林縣',
    屏東: '屏東縣',
    宜蘭: '宜蘭縣',
    花蓮: '花蓮縣',
    臺東: '臺東縣',
    澎湖: '澎湖縣',
    金門: '金門縣',
    連江: '連江縣',
};

const normalizeTaiwanCityCounty = (city: string) => {
    const normalized = city.trim().replace(/台/g, '臺');
    if ((taiwanCities as readonly string[]).includes(normalized)) {
        return normalized;
    }

    return taiwanCityAliases[normalized] ?? null;
};

const cityInTaiwan = (city: string) => {
    return normalizeTaiwanCityCounty(city) !== null;
};

export { cityInTaiwan, normalizeTaiwanCityCounty, taiwanCities };
