import {
  AnimalColourSchema,
  AnimalLostRequestSchema,
  AnimalOwnerSchema,
  AnimalResponseSchema,
  AnimalLostResponseSchema,
} from '../../../libs/zod/animals';

describe('AnimalColourSchema', () => {
  it('should transform "黃色" to ["黃"]', () => {
    const result = AnimalColourSchema.parse('黃色');
    expect(result).toEqual(['黃']);
  });

  it('should transform "黑白色" to ["黑白"]', () => {
    const result = AnimalColourSchema.parse('黑白色');
    expect(result).toEqual(['黑白']);
  });

  it('should transform "黑色 白色" to ["黑", "白"]', () => {
    const result = AnimalColourSchema.parse('黑色 白色');
    expect(result).toEqual(['黑', '白']);
  });

  it('should remove punctuation before splitting', () => {
    const result = AnimalColourSchema.parse('黑色,白色');
    expect(result).toEqual(['黑', '白']);
  });

  it('should handle triple colours', () => {
    const result = AnimalColourSchema.parse('黑色 白色 棕色');
    expect(result).toEqual(['黑', '白', '棕']);
  });
});

describe('AnimalLostRequestSchema', () => {
  it('should parse valid lost animal request with all optional fields', () => {
    const input = {
      chip_id: 'CHIP001',
      name: '小黑',
      kind: '狗',
      variety: '拉布拉多',
      sex: 'M',
      colour: '黑',
      lost_time: '2024-01-10',
      lost_place: '台北市',
    };
    const result = AnimalLostRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept empty object (all fields optional)', () => {
    const result = AnimalLostRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('AnimalOwnerSchema', () => {
  it('should parse valid owner with name, phone, email', () => {
    const input = { name: '王小明', phone: '0912345678', email: 'test@example.com' };
    const result = AnimalOwnerSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept nullish phone and email', () => {
    const input = { name: '王小明', phone: null, email: null };
    const result = AnimalOwnerSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept empty object (all fields nullish/optional)', () => {
    const result = AnimalOwnerSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('AnimalResponseSchema', () => {
  it('should parse valid MOA API response array', () => {
    const input = [
      {
        animal_shelter_pkid: 1,
        animal_kind: '狗',
        animal_Variety: '米克斯',
        animal_sex: 'M',
        shelter_name: '台北市動物之家',
        shelter_address: '台北市信義區',
        shelter_tel: '02-12345678',
      },
    ];
    const result = AnimalResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should fail when required animal_shelter_pkid is missing', () => {
    const input = [{ animal_kind: '狗' }];
    const result = AnimalResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('AnimalLostResponseSchema', () => {
  it('should parse valid MOA lost animal API response with Chinese field names', () => {
    const input = [
      {
        晶片號碼: 'CHIP001',
        寵物名: '小黑',
        寵物別: '狗',
        性別: '公',
        品種: '拉布拉多',
        毛色: '黑色',
        遺失地點: '台北市大安區',
      },
    ];
    const result = AnimalLostResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
