import { Request, Response } from 'express';

export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: Function) => {
    fn(req, res, next).catch((error: Error) => next(error));
  };
};
