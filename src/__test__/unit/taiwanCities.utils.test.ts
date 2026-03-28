import { cityInTaiwan } from '../../libs/taiwanCities.utils';

describe('cityInTaiwan', () => {
  it('should return true for "臺北"', () => {
    expect(cityInTaiwan('臺北')).toBe(true);
  });

  it('should return true for "台北" (台→臺 conversion)', () => {
    expect(cityInTaiwan('台北')).toBe(true);
  });

  it('should return true for "嘉義市"', () => {
    expect(cityInTaiwan('嘉義市')).toBe(true);
  });

  it('should return true for "嘉義縣"', () => {
    expect(cityInTaiwan('嘉義縣')).toBe(true);
  });

  it('should return false for "東京"', () => {
    expect(cityInTaiwan('東京')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(cityInTaiwan('')).toBe(false);
  });

  it('should return true for "金門"', () => {
    expect(cityInTaiwan('金門')).toBe(true);
  });

  it('should return true for "連江"', () => {
    expect(cityInTaiwan('連江')).toBe(true);
  });

  it('should return true for "台中" (台→臺 conversion)', () => {
    expect(cityInTaiwan('台中')).toBe(true);
  });

  it('should return false for partial match "臺"', () => {
    expect(cityInTaiwan('臺')).toBe(false);
  });
});
