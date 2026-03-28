import SuccessResponse from '../../libs/successResponse';

describe('SuccessResponse', () => {
  it('should create api response with success=true and result', () => {
    const result = { animals: [{ id: 1 }] };
    const res = new SuccessResponse('api', result);
    expect(res.success).toBe(true);
    expect(res.type).toBe('api');
    expect(res.extras).toEqual(result);
  });

  it('should create redirect response with redirect path', () => {
    const res = new SuccessResponse('redirect', '/?message=success');
    expect(res.type).toBe('redirect');
    expect(res.extras).toBe('/?message=success');
  });

  it('should create html response', () => {
    const res = new SuccessResponse('html', 'home');
    expect(res.type).toBe('html');
    expect(res.extras).toBe('home');
  });

  it('should create text response', () => {
    const res = new SuccessResponse('text', 'OK');
    expect(res.type).toBe('text');
    expect(res.extras).toBe('OK');
  });

  it('should set extras to null when no result provided', () => {
    const res = new SuccessResponse('api');
    expect(res.extras).toBeNull();
  });
});
