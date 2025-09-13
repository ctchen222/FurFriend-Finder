import path from 'path'
import fs from 'fs-extra'
import nodemailer from 'nodemailer'
import Mustache from 'mustache'

const appRoot = path.resolve(__dirname, "../../")

class MailService {
	private mailer: nodemailer.Transporter
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

	sendWelcomeMail = async (mail: string) => {
		const mustacheTemp = await fs.readFile(`${appRoot}/views/mailtemplates/welcome.mt.html`, 'utf8')
		const htmlContent = Mustache.render(mustacheTemp.toString(), {})
		const response = await this.mailer.sendMail({
			from: 'abfa762466@gmail.com',
			to: mail,
			subject: 'FurFriend Welcome!',
			html: htmlContent
		})

		return response
	}

	sendMatchedMail = async (mail: string, userName: string, top10Animals: any[]) => {
		const mustacheTemp = await fs.readFile(`${appRoot}/views/mailtemplates/animalMatchNotice.mt.html`, 'utf8');
		const htmlContent = Mustache.render(mustacheTemp.toString(), { userName, top10Animals });
		const response = await this.mailer.sendMail({
			from: 'abfa762466@gmail.com',
			to: mail,
			subject: 'FurFriend Finder 最新配對通知',
			html: htmlContent
		});

		return response;
	}

}

export default MailService;
