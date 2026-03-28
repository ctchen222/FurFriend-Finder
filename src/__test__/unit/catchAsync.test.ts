import { catchAsync } from '../../libs/catchAsync';

describe('catchAsync', () => {
  it('should call next(error) when async function rejects', async () => {
    const error = new Error('test error');
    const fn = jest.fn().mockRejectedValue(error);
    const next = jest.fn();

    const wrapped = catchAsync(fn);
    await wrapped({} as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('should not call next with error when async function resolves', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const next = jest.fn();

    const wrapped = catchAsync(fn);
    await wrapped({} as any, {} as any, next);

    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it('should pass req, res, next to the wrapped function', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const req = { body: {} } as any;
    const res = { json: jest.fn() } as any;
    const next = jest.fn();

    const wrapped = catchAsync(fn);
    await wrapped(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
  });
});
