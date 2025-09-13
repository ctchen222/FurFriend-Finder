import path from 'path'
import fs from 'fs-extra'
import nodemailer from 'nodemailer'
import Mustache from 'mustache'
import mailConfig from '../config/mail'

const appRoot = path.resolve(__dirname, "../../")

class MailService {
	public mailer: nodemailer.Transporter
	constructor() {
		this.mailer = nodemailer.createTransport({
			host: process.env.SMTP_HOST || 'smtp-relaying.brevo.com',
			port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
			auth: {
				user: process.env.SMTP_USER || '',
				pass: process.env.SMTP_PASSWORD || '',
			},
		})
	}

	sendTestMail = async (mail: string) => {
		const mustacheTemp = await fs.readFile(`${appRoot}/views/mailtemplates/test.mt.html`, 'utf8')
		const htmlContent = Mustache.render(mustacheTemp.toString(), {})
		const response = await this.mailer.sendMail({
			from: mailConfig.sentFrom,
			to: mail,
			subject: 'FurFriend Welcome!',
			html: htmlContent
		})

		return response
	}

	sendWelcomeMail = async (mail: string) => {
		const mustacheTemp = await fs.readFile(`${appRoot}/views/mailtemplates/welcome.mt.html`, 'utf8')
		const htmlContent = Mustache.render(mustacheTemp.toString(), {})
		const response = await this.mailer.sendMail({
			from: mailConfig.sentFrom,
			to: mail,
			subject: 'FurFriend Test',
			html: htmlContent
		})

		return response
	}

	sendMatchedMail = async (mail: string, userName: string, top10Animals: any[]) => {
		const mustacheTemp = await fs.readFile(`${appRoot}/views/mailtemplates/animalMatchNotice.mt.html`, 'utf8');
		const htmlContent = Mustache.render(mustacheTemp.toString(), { userName, top10Animals });
		const response = await this.mailer.sendMail({
			from: mailConfig.sentFrom,
			to: mail,
			subject: 'FurFriend Finder 最新配對通知',
			html: htmlContent
		});

		return response;
	}

}

export default MailService;
