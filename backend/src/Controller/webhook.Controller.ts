import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { catchAsync } from '../utils/catchAsync';
import { client, line } from '../lineClient';
import { findAnimalsByCity } from '../factory/animal.db';
import prettifyAnimalData from '../utils/prettifyAnimalData.utils';
import cityInTaiwan from '../utils/taiwanCities.utils';

export const webhookServer = catchAsync(async (req: Request, res: Response) => {
  // 1. check sentFrom is in db or not(user exist or not)
  const destination = req.body.destination;
  const userId = req.body.events.at(0).source.userId;
  const userExisted = await checkUserExistance(destination);
  const msgFromUser = req.body.events.at(0).message.text as string;

  // if user need help
  if (msgFromUser === '我需要協助') {
    console.log(`User ${userId} need help!`);
    sendTextMsgAuto(req, '收到！請等候專人回覆！');
  }

  const count = msgFromUser.split(' ').length; // count how many parts user enter

  // count: 3 -> User attempt sign up or try to get animals message
  if (count === 3) {
    const [name, email, city] = msgFromUser.split(' ');

    if (!userExisted) {
      // if user not exist, create one
      await prisma.users.create({
        data: {
          name: name,
          email: email,
          city: city,
          sentfrom: destination,
          userId: userId,
        },
      });

      const text =
        '成功將您的個人資料加進資料庫！\n請輸入您所在的縣市以取得領養資訊！';
      sendTextMsgAuto(req, text);
      console.log(`User ${name} has been created`);
    } else {
      // user exist, send animal data back to user
      const data = await findAnimalsByCity(city); // data send back
      const text = prettifyAnimalData(data);
      sendTextMsgAuto(req, text);
      console.log(`資料已傳送給用戶${name}`);
    }
  }

  // count: 1 -> User Try to get animals data by entering city name
  if (count === 1) {
    if (!userExisted) {
      // if user not exist
      console.log(
        `User ${userId} tries to use the service, but not sign up yet.`,
      );
      sendTextMsgAuto(
        req,
        '請先按照說明輸入您的個人資料，才能使用我們的服務呦！',
      );
    } else {
      // if user exist
      const city = msgFromUser;

      if (cityInTaiwan(city)) {
        const data = await findAnimalsByCity(city);
        const text = prettifyAnimalData(data);
        sendTextMsgAuto(req, text);
      } else {
        sendTextMsgAuto(
          req,
          '您輸入的縣市並不屬於台灣，請確定是否輸入正確。\n若有問題，請輸入：我需要協助，將會有專人替您解答問題。',
        );
      }
    }
  }
});

// Send Data to Specific User manually
export const sendTextMsgManually = (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const textMsg = ''; // Enter the msg you want to send back to user
  const message: line.TextMessage = { type: 'text', text: textMsg };
  client
    .pushMessage({ to: userId, messages: [message] })
    .then(() => {
      console.log('Message sent successfully');
      res.status(200).send('Message sent successfully');
    })
    .catch((err) => {
      console.error('Error sending message:', err);
      res.status(500).send('Error sending message');
    });
};

const checkUserExistance = async (destination: string) => {
  const user = await prisma.users.findFirst({
    where: {
      sentfrom: destination,
    },
  });
  const userExisted = user !== null;
  return userExisted;
};

const sendTextMsgAuto = (req: Request, text: string) => {
  const replyMsg = {
    type: 'text',
    text: text,
  };
  client.replyMessage({
    replyToken: req.body.events.at(0).replyToken,
    messages: [replyMsg as line.TextMessage],
  });
};
