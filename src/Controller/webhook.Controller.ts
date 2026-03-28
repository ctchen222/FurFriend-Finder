import express from 'express'
import crypto from 'crypto'

import { client } from "../lineClient"
import CustomError from '../libs/customError';
import * as apiMessage from '../libs/message'
import AnimalRepository from '../repository/animal.db';

class WebhookController {
	private animalRepository: AnimalRepository
	constructor() {
		this.animalRepository = new AnimalRepository()
	}

	handleWebhook = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		const channelSecret = process.env.CHANNEL_SECRET;
		if (!channelSecret) throw new CustomError(apiMessage.INVALID_LINE_SECRET);

		const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
		const hash = crypto.createHmac('sha256', channelSecret).update(body).digest('base64');
		const signature = req.get('X-Line-Signature');
		if (signature !== hash) {
			throw new CustomError(apiMessage.INVALID_LINE_REQUEST);
		}
		const event = req.body.events && req.body.events[0];

		if (!event) {
			return res.status(200).send('OK');
		}

		// Handle postback events
		if (event.type === 'postback') {
			const postbackData = new URLSearchParams(event.postback.data);
			if (postbackData.get('action') === 'previous') {
				await client.replyMessage({
					replyToken: event.replyToken,
					messages: [{ type: 'text', text: '這是之前的內容。' }],
				});
				return res.status(200).json({});
			}

			if (postbackData.get('action') === 'draw') {
				const animal = await this.animalRepository.findRandomAnimal();

				if (animal) {
					const replyText = `✨ 找到您專屬的毛茸茸夥伴！ ✨\n\n這是一隻正在等待一個溫暖的家的可愛動物：\n\n🐾【基本資料】\n- 種類：${animal.kind}\n- 品種：${animal.variety}\n- 性別：${animal.sex}\n- 年齡：${animal.age}\n- 體型：${animal.body_type}\n- 毛色：${animal.colour}\n\n🏠【收容所資訊】\n- 名稱：${animal.shelter_name}\n- 地址：${animal.shelter_address}\n- 電話：${animal.shelter_tel}\n\n💖 如果您對牠有興趣，請直接透過上方電話聯繫收容所，給牠一個機會！\n\n👇 點擊下方圖片查看牠可愛的模樣！`;
					await client.replyMessage({
						replyToken: event.replyToken,
						messages: [
							{ type: 'text', text: replyText },
							{ type: 'image', originalContentUrl: animal.picture, previewImageUrl: animal.picture }
						],
					});
				} else {
					await client.replyMessage({
						replyToken: event.replyToken,
						messages: [{ type: 'text', text: '抱歉，目前沒有可抽的動物。' }],
					});
				}
				return res.status(200).json({});
			}
			res.status(200).send('OK');
		}
	}
}

export default WebhookController
