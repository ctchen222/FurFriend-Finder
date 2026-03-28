// 共用測試 fixture factories
// 使用 overrides 參數讓每個測試可以客製化需要的欄位

export const createMockAnimalShelter = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: '台北市動物之家',
  address: '台北市信義區信義路五段150巷',
  tel: '02-87897678',
  ...overrides,
});

export const createMockAnimal = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  sub_id: 'TEST001',
  kind: '狗',
  variety: '米克斯',
  sex: 'M',
  age: 'ADULT',
  body_type: 'MEDIUM',
  colour: '黑白',
  found_place: '台北市信義區',
  remark: null,
  picture: 'https://example.com/photo.jpg',
  status: 'OPEN',
  open_date: '2024-01-01',
  close_date: null,
  update_date: '2024-01-15',
  animal_shelter_id: 1,
  ...overrides,
});

export const createMockAnimalWithShelter = (overrides: Record<string, unknown> = {}) => ({
  ...createMockAnimal(),
  shelter_name: '台北市動物之家',
  shelter_address: '台北市信義區信義路五段150巷',
  shelter_tel: '02-87897678',
  ...overrides,
});

export const createMockOwner = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: '王小明',
  phone: '0912345678',
  email: 'test@example.com',
  ...overrides,
});

export const createMockAnimalLost = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  chip_id: 'CHIP001',
  name: '小黑',
  kind: '狗',
  variety: '拉布拉多',
  sex: 'M',
  colour: '黑',
  outlook: '短毛，有白色胸斑',
  feature: '左耳有缺口',
  lost_time: '2024-01-10',
  lost_place: '台北市大安區和平東路',
  picture: null,
  owner_id: 1,
  ...overrides,
});

// 農業部 API 收容動物回應格式（英文欄位）
export const createMockMoaApiResponse = (count = 1) =>
  Array.from({ length: count }, (_, i) => ({
    animal_subid: `TEST${String(i + 1).padStart(3, '0')}`,
    animal_kind: '狗',
    animal_Variety: '米克斯',
    animal_sex: 'M',
    animal_bodytype: 'MEDIUM',
    animal_colour: '黑白色',
    animal_age: 'ADULT',
    animal_foundplace: '台北市信義區',
    animal_remark: '',
    album_file: 'https://example.com/photo.jpg',
    animal_status: 'OPEN',
    animal_opendate: '2024/01/01',
    animal_closeddate: '',
    animal_update: '2024/01/15',
    animal_shelter_pkid: 1,
    shelter_name: '台北市動物之家',
    shelter_address: '台北市信義區信義路五段150巷',
    shelter_tel: '02-87897678',
  }));

// 農業部 API 走失動物回應格式（中文欄位）
export const createMockMoaLostApiResponse = (count = 1) =>
  Array.from({ length: count }, (_, i) => ({
    晶片號碼: `CHIP${String(i + 1).padStart(3, '0')}`,
    寵物名: `小黑${i + 1}`,
    寵物別: '狗',
    性別: '公',
    品種: '拉布拉多',
    毛色: '黑色',
    外觀: '短毛',
    特徵: '左耳有缺口',
    遺失時間: '1130110',
    遺失地點: '台北市大安區',
    EMail: `owner${i + 1}@example.com`,
    飼主姓名: `飼主${i + 1}`,
    連絡電話: `091234567${i}`,
    PICTURE: '',
  }));
