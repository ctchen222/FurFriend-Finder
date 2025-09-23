
import request from 'supertest';
import express from 'express';
import { webhookServer } from '../../Controller/webhook.Controller';
import AnimalRepository from '../../repository/animal.db';
import { client } from '../../lineClient';

// Mock a simple express app
const app = express();
app.use(express.json());
app.post('/webhook', webhookServer);

// Mock dependencies
jest.mock('../../repository/animal.db');
jest.mock('../../lineClient', () => ({
  client: {
    replyMessage: jest.fn(),
  },
}));

const mockAnimalRepository = AnimalRepository as jest.MockedClass<typeof AnimalRepository>;
const mockLineClient = client as jest.Mocked<typeof client>;

describe('Webhook Controller - Postback Integration Tests', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  const createPostbackEvent = (action: string) => ({
    destination: 'Uxxxxxxxxxxxx',
    events: [
      {
        type: 'postback',
        replyToken: 'testReplyToken',
        source: {
          userId: 'Uyyyyyyyyyyyy',
          type: 'user',
        },
        timestamp: Date.now(),
        postback: {
          data: `action=${action}`,
        },
      },
    ],
  });

  it('should reply with a Flex Message when action=draw and an animal is found', async () => {
    const mockAnimal = {
      id: 1,
      kind: '狗',
      variety: '柴犬',
      sex: 'M',
      colour: '黃',
      picture: 'https://example.com/dog.jpg',
      shelter_name: '快樂狗收容所',
      shelter_address: '快樂市幸福路一段1號',
    };
    (mockAnimalRepository.prototype.findRandomAnimal as jest.Mock).mockResolvedValue(mockAnimal);

    const response = await request(app)
      .post('/webhook')
      .send(createPostbackEvent('draw'));

    expect(response.status).toBe(200);
    expect(mockAnimalRepository.prototype.findRandomAnimal).toHaveBeenCalledTimes(1);
    expect(mockLineClient.replyMessage).toHaveBeenCalledTimes(1);

    const replyCall = mockLineClient.replyMessage.mock.calls[0][0];
    expect(replyCall.replyToken).toBe('testReplyToken');
    const message = replyCall.messages[0];
    expect(message.type).toBe('flex');
    expect(message.altText).toContain(mockAnimal.kind);
    // @ts-ignore
    expect(message.contents.hero.url).toBe(mockAnimal.picture);
    // @ts-ignore
    expect(message.contents.body.contents[0].text).toContain(mockAnimal.kind);
  });

  it('should reply with a text message when action=draw and no animal is found', async () => {
    (mockAnimalRepository.prototype.findRandomAnimal as jest.Mock).mockResolvedValue(undefined);

    const response = await request(app)
      .post('/webhook')
      .send(createPostbackEvent('draw'));

    expect(response.status).toBe(200);
    expect(mockAnimalRepository.prototype.findRandomAnimal).toHaveBeenCalledTimes(1);
    expect(mockLineClient.replyMessage).toHaveBeenCalledTimes(1);

    const replyCall = mockLineClient.replyMessage.mock.calls[0][0];
    expect(replyCall.replyToken).toBe('testReplyToken');
    const message = replyCall.messages[0];
    expect(message.type).toBe('text');
    expect(message.text).toBe('抱歉，目前沒有可顯示的動物。');
  });

  it('should not call findRandomAnimal for other actions like \'previous\'', async () => {
    const response = await request(app)
      .post('/webhook')
      .send(createPostbackEvent('previous'));

    expect(response.status).toBe(200);
    expect(mockAnimalRepository.prototype.findRandomAnimal).not.toHaveBeenCalled();
    // The 'previous' action has its own reply, so replyMessage will be called.
    expect(mockLineClient.replyMessage).toHaveBeenCalledTimes(1);
    const replyCall = mockLineClient.replyMessage.mock.calls[0][0];
    const message = replyCall.messages[0];
    expect(message.text).toBe('這是之前的內容。');
  });
});
