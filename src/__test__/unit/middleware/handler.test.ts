import { Request, Response, NextFunction } from 'express';

// Mock router first — handler.ts imports routes at module level which pulls in better-auth (ESM)
jest.mock('../../../router', () => jest.fn());
jest.mock('morgan', () => () => jest.fn());
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { http: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  matchLogger: { http: jest.fn() },
}));

import { Handler } from '../../../middleware/handler';
import CustomError from '../../../libs/customError';
import SuccessResponse from '../../../libs/successResponse';
import { ANIMAL_NOT_EXISTS, GEOCODING_RATE_LIMIT } from '../../../libs/message';

function makeMockRes() {
  const res: Partial<Response> = {
    locals: {},
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  };
  return res as Response;
}

function makeMockReq(url = '/api/animals'): Partial<Request> {
  return {
    originalUrl: url,
    path: url,
    method: 'GET',
    accepts: jest.fn().mockReturnValue(false), // default: not an HTML request
  };
}

describe('Handler.completeHandler', () => {
  it('should call next() when res.locals.result is not a SuccessResponse', () => {
    const req = makeMockReq();
    const res = makeMockRes();
    res.locals!.result = { some: 'plain object' };
    const next = jest.fn();

    Handler.completeHandler(req as Request, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should send 200 JSON for api type', () => {
    const req = makeMockReq();
    const res = makeMockRes();
    res.locals!.result = new SuccessResponse('api', { animals: [] });
    const next = jest.fn();

    Handler.completeHandler(req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, extras: { animals: [] } })
    );
  });

  it('should redirect for redirect type', () => {
    const req = makeMockReq();
    const res = makeMockRes();
    res.locals!.result = new SuccessResponse('redirect', '/?message=success');
    const next = jest.fn();

    Handler.completeHandler(req as Request, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/?message=success');
  });

  it('should send html for html type', () => {
    const req = makeMockReq();
    const res = makeMockRes();
    res.locals!.result = new SuccessResponse('html', '<h1>Home</h1>');
    const next = jest.fn();

    Handler.completeHandler(req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('<h1>Home</h1>');
  });
});

describe('Handler.errorHandler', () => {
  it('should redirect to /?message=signup-failed on signup routes', () => {
    const req = makeMockReq('/api/auth/signup');
    const res = makeMockRes();
    const next = jest.fn();
    const err = new CustomError(ANIMAL_NOT_EXISTS);

    Handler.errorHandler(err, req as Request, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/register?message=signup-failed');
  });

  it('should redirect to /?message=login-failed on login routes', () => {
    const req = makeMockReq('/api/auth/login');
    const res = makeMockRes();
    const next = jest.fn();
    const err = new CustomError(ANIMAL_NOT_EXISTS);

    Handler.errorHandler(err, req as Request, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/login?message=login-failed');
  });

  it('should send CustomError response with correct httpCode and code', () => {
    const req = makeMockReq('/api/animals');
    const res = makeMockRes();
    const next = jest.fn();
    const err = new CustomError(GEOCODING_RATE_LIMIT);

    Handler.errorHandler(err, req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 202 }) })
    );
  });

  it('should send 400 for non-CustomError system errors', () => {
    const req = makeMockReq('/api/animals');
    const res = makeMockRes();
    const next = jest.fn();
    const err = new Error('Something went wrong');

    Handler.errorHandler(err, req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 1000 }) })
    );
  });
});

describe('Handler.notFoundHandler', () => {
  it('should send JSON 404 for API paths', () => {
    const req = makeMockReq('/api/no-such-path');
    const res = makeMockRes();
    const next = jest.fn();

    Handler.notFoundHandler(req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('should send JSON 404 for non-HTML requests to page paths', () => {
    const req = makeMockReq('/no-such-page'); // accepts('html') returns false
    const res = makeMockRes();
    const next = jest.fn();

    Handler.notFoundHandler(req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});
