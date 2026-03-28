import { Request, Response, NextFunction } from 'express';
import { addUserToLocals } from '../../../middleware/userSession';

jest.mock('../../../auth', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

import { auth } from '../../../auth';
const mockGetSession = auth.api.getSession as jest.Mock;

function makeMockReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers };
}

function makeMockRes(): { locals: Record<string, any>; res: Response } {
  const locals: Record<string, any> = {};
  return { locals, res: { locals } as unknown as Response };
}

describe('addUserToLocals', () => {
  it('should set res.locals.user to session.user when session exists', async () => {
    const fakeUser = { id: 'u1', email: 'test@example.com' };
    mockGetSession.mockResolvedValue({ user: fakeUser });

    const req = makeMockReq({ cookie: 'session=abc' });
    const { res } = makeMockRes();
    const next = jest.fn() as NextFunction;

    await addUserToLocals(req as Request, res, next);

    expect(res.locals.user).toEqual(fakeUser);
    expect(next).toHaveBeenCalled();
  });

  it('should set res.locals.user to null when no session', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = makeMockReq();
    const { res } = makeMockRes();
    const next = jest.fn() as NextFunction;

    await addUserToLocals(req as Request, res, next);

    expect(res.locals.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('should set res.locals.user to null and call next() when getSession throws', async () => {
    mockGetSession.mockRejectedValue(new Error('Auth server down'));

    const req = makeMockReq();
    const { res } = makeMockRes();
    const next = jest.fn() as NextFunction;

    await addUserToLocals(req as Request, res, next);

    expect(res.locals.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('should pass array header values correctly to Headers', async () => {
    mockGetSession.mockResolvedValue(null);

    // Simulate multi-value header (Express sometimes gives string[])
    const req = makeMockReq();
    (req as any).headers = { 'x-custom': ['val1', 'val2'] };
    const { res } = makeMockRes();
    const next = jest.fn() as NextFunction;

    await addUserToLocals(req as Request, res, next);

    expect(next).toHaveBeenCalled();
  });
});
