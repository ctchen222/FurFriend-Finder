import { Request, Response, NextFunction } from 'express';
import { logMatchRequest } from '../../../middleware/logMatchRequests';

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { http: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  matchLogger: { http: jest.fn() },
}));

import { matchLogger } from '../../../config/logger';
const mockMatchLoggerHttp = matchLogger.http as jest.Mock;

function makeReqWithParams(id: string): Partial<Request> {
  return { params: { id } };
}

describe('logMatchRequest', () => {
  it('should call next() after logging', () => {
    const req = makeReqWithParams('42');
    const res = { locals: { user: null } } as unknown as Response;
    const next = jest.fn() as NextFunction;

    logMatchRequest(req as Request, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should log with user info when user is in res.locals', () => {
    const req = makeReqWithParams('99');
    const res = {
      locals: { user: { id: 'u1', email: 'owner@example.com' } },
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    logMatchRequest(req as Request, res, next);

    expect(mockMatchLoggerHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Match request received',
        data: expect.objectContaining({
          animalId: '99',
          user: expect.objectContaining({ id: 'u1', email: 'owner@example.com' }),
        }),
      })
    );
  });

  it('should log "anonymous" when no user in res.locals', () => {
    const req = makeReqWithParams('10');
    const res = { locals: {} } as unknown as Response;
    const next = jest.fn() as NextFunction;

    logMatchRequest(req as Request, res, next);

    expect(mockMatchLoggerHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user: 'anonymous' }),
      })
    );
  });
});
