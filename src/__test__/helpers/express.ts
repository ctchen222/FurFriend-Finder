import { Request, Response, NextFunction } from 'express';

// 建立模擬的 Express Request 物件
export const createMockReq = (overrides: Partial<Request> = {}): Partial<Request> => ({
  query: {},
  params: {},
  body: {},
  headers: {},
  locals: {},
  ...overrides,
});

// 建立模擬的 Express Response 物件
export const createMockRes = (): Partial<Response> & {
  statusCode: number;
  _headers: Record<string, string>;
  _body: unknown;
  _redirectUrl: string | undefined;
} => {
  const res = {
    statusCode: 200,
    _headers: {} as Record<string, string>,
    _body: undefined as unknown,
    _redirectUrl: undefined as string | undefined,
    locals: {} as Record<string, unknown>,
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockImplementation(function (this: typeof res, body: unknown) {
      this._body = body;
      return this;
    }),
    json: jest.fn().mockImplementation(function (this: typeof res, body: unknown) {
      this._body = body;
      return this;
    }),
    redirect: jest.fn().mockImplementation(function (this: typeof res, url: string) {
      this._redirectUrl = url;
      return this;
    }),
    setHeader: jest.fn().mockImplementation(function (
      this: typeof res,
      name: string,
      value: string
    ) {
      this._headers[name] = value;
      return this;
    }),
    render: jest.fn(),
    end: jest.fn(),
  };
  return res;
};

// 建立模擬的 Express Next 函數
export const createMockNext = (): NextFunction => jest.fn() as unknown as NextFunction;
