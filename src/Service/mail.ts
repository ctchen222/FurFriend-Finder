import path from 'path'
import fs from 'fs-extra'
import nodemailer from 'nodemailer'
import Mustache from 'mustache'
import mailConfig from '../config/mail'
import {
	recordEmailAttempt,
	recordEmailTemplateFailure,
	type EmailFailureReason,
	type EmailTemplate,
} from '../config/metrics'

const appRoot = path.resolve(__dirname, "../../")

export function classifyEmailFailureReason(error: unknown): EmailFailureReason {
	const err = error as { code?: unknown; responseCode?: unknown; message?: unknown };
	const code = typeof err.code === 'string' ? err.code.toUpperCase() : '';
	const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';
	const responseCode = typeof err.responseCode === 'number' ? err.responseCode : undefined;

	if (code.includes('EAUTH') || responseCode === 535 || message.includes('auth')) {
		return 'auth';
	}

	if (code.includes('ETIMEDOUT') || message.includes('timeout')) {
		return 'timeout';
	}

	if (['ECONNECTION', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ESOCKET'].includes(code)) {
		return 'network';
	}

	if (responseCode !== undefined && responseCode >= 400 && responseCode < 600) {
		return 'smtp_rejected';
	}

	return 'unknown';
}

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

	private recordTemplateFailure(template: EmailTemplate): void {
		recordEmailTemplateFailure(template);
	}

	private renderTemplate = async (
		template: EmailTemplate,
		templatePath: string,
		view: Record<string, unknown>,
	) => {
		try {
			const mustacheTemp = await fs.readFile(templatePath, 'utf8')
			return Mustache.render(mustacheTemp.toString(), view)
		} catch (error) {
			this.recordTemplateFailure(template);
			throw error;
		}
	}

	sendMail = async (
		options: Parameters<nodemailer.Transporter['sendMail']>[0],
		template: EmailTemplate = 'generic',
	) => {
		return recordEmailAttempt(
			template,
			classifyEmailFailureReason,
			() => this.mailer.sendMail({
				from: mailConfig.sentFrom,
				...options,
			}),
		);
	}

	sendTestMail = async (mail: string) => {
		const htmlContent = await this.renderTemplate(
			'generic',
			`${appRoot}/views/mailtemplates/test.mt.html`,
			{},
		)
		const response = await this.sendMail({
			to: mail,
			subject: 'FurFriend Welcome!',
			html: htmlContent
		}, 'generic')

		return response
	}

	sendWelcomeMail = async (mail: string, userName: string) => {
		const htmlContent = await this.renderTemplate(
			'generic',
			`${appRoot}/views/mailtemplates/welcome.mt.html`,
			{ userName },
		)
		const response = await this.sendMail({
			to: mail,
			subject: 'FurFriend Test',
			html: htmlContent
		}, 'generic')

		return response
	}

	sendMatchedMail = async (mail: string, userName: string, top10Animals: any[]) => {
		const htmlContent = await this.renderTemplate(
			'match_notice',
			`${appRoot}/views/mailtemplates/animalMatchNotice.mt.html`,
			{ userName, top10Animals },
		);
		const response = await this.sendMail({
			to: mail,
			subject: 'FurFriend Finder 最新配對通知',
			html: htmlContent
		}, 'match_notice');

		return response;
	}

}

export default MailService;
