import * as line from '@line/bot-sdk';
import * as dotenv from 'dotenv';
dotenv.config();

// create LINE SDK config from env variables
const config = {
  channelSecret: process.env.CHANNEL_SECRET as string,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN as string,
};

const client = new line.messagingApi.MessagingApiClient(config);
line.middleware(config);

export { client, line };
