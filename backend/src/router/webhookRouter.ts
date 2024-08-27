import express, { Request, Response } from 'express';
import { prisma } from '../db';
import { client, line } from '../lineClient';
import { catchAsync } from '../utils/catchAsync';
import { equal } from 'assert';

const router = express.Router();

router.route('/').post(
  catchAsync(async (req: Request, res: Response) => {
    // 1. check sentFrom is in db or not
    const destination = req.body.destination;
    const user = await prisma.users.findFirst({
      where: {
        sentfrom: destination,
      },
    });
    const userExisted = user !== null;

    // 2. if not, write user to db
    const profile = req.body.events.at(0).message.text as string;
    const [name, email, city] = profile.split(' ');
    if (!userExisted) {
      const user = await prisma.users.create({
        data: {
          name: name,
          email: email,
          city: city,
          sentfrom: destination,
        },
      });
      console.log('User Add to Database Successfully!');
    } else {
      console.log('User Already in Database! 2486!');
    }

    //   console.log(users);
    // const echo = { type: 'text', text: 'hello' };
    // client.replyMessage({
    //   replyToken: req.body.events.at(0).replyToken,
    //   messages: [echo as line.TextMessage],
    // });
  }),
);

export { router };
