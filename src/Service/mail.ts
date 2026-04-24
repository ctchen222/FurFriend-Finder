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
			host: mailConfig.smtpHost,
			port: mailConfig.smtpPort,
			secure: mailConfig.smtpSecure,
			auth: {
				user: mailConfig.smtpUser,
				pass: mailConfig.smtpPassword,
			},
		})
	}

	sendMail = async (options: Parameters<nodemailer.Transporter['sendMail']>[0]) => {
		return this.mailer.sendMail({
			from: mailConfig.sentFrom,
			...options,
		})
	}

	sendTestMail = async (mail: string) => {
		const mustacheTemp = await fs.readFile(`${appRoot}/views/mailtemplates/test.mt.html`, 'utf8')
		const htmlContent = Mustache.render(mustacheTemp.toString(), {})
		const response = await this.sendMail({
			to: mail,
			subject: 'FurFriend Welcome!',
			html: htmlContent
		})

		return response
	}

	sendWelcomeMail = async (mail: string, userName: string) => {
		const mustacheTemp = await fs.readFile(`${appRoot}/views/mailtemplates/welcome.mt.html`, 'utf8')
		const htmlContent = Mustache.render(mustacheTemp.toString(), { userName })
		const response = await this.sendMail({
			to: mail,
			subject: 'FurFriend Test',
			html: htmlContent
		})

		return response
	}

	sendMatchedMail = async (mail: string, userName: string, top10Animals: any[]) => {
		const mustacheTemp = await fs.readFile(`${appRoot}/views/mailtemplates/animalMatchNotice.mt.html`, 'utf8');
		const htmlContent = Mustache.render(mustacheTemp.toString(), { userName, top10Animals });
		const response = await this.sendMail({
			to: mail,
			subject: 'FurFriend Finder 最新配對通知',
			html: htmlContent
		});

		return response;
	}

}

export default MailService;
