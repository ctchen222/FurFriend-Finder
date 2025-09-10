export class MailConfig {
	smtpHost: string
	smtpPort: number
	smtpSecure: boolean
	smtpUser: string
	smtpPassword: string

	constructor() {
		this.smtpHost = process.env.SMTP_HOST || ''
		this.smtpPort = parseInt(process.env.SMTP_PORT || '587', 10)
		this.smtpSecure = (process.env.SMTP_SECURE || '').toLowerCase() === 'true'
		this.smtpUser = process.env.SMTP_USER || ''
		this.smtpPassword = process.env.SMTP_PASSWORD || ''
	}
}

export default new MailConfig()
