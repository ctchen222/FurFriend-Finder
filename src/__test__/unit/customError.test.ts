import CustomError from '../../libs/customError';
import { ANIMAL_NOT_EXISTS, GEOCODING_RATE_LIMIT, CONTENT_NOT_FOUND } from '../../libs/message/index';

describe('CustomError', () => {
  it('should create error with correct code, httpCode, and message from MESSAGE constant', () => {
    const err = new CustomError(ANIMAL_NOT_EXISTS);
    expect(err.code).toBe(101);
    expect(err.httpCode).toBe(400);
    expect(err.message).toBe('Animal does not exist');
  });

  it('should be instanceof Error', () => {
    const err = new CustomError(CONTENT_NOT_FOUND);
    expect(err).toBeInstanceOf(Error);
  });

  it('should have name "CustomError"', () => {
    const err = new CustomError(GEOCODING_RATE_LIMIT);
    expect(err.name).toBe('CustomError');
  });

  it('should store httpCode correctly for different error types', () => {
    const rateLimit = new CustomError(GEOCODING_RATE_LIMIT);
    expect(rateLimit.httpCode).toBe(429);
    expect(rateLimit.code).toBe(202);
  });
});
