export class MailConfig {
	smtpHost: string
	smtpPort: number
	smtpSecure: boolean
	smtpUser: string
	smtpPassword: string
	sentFrom: string

	constructor() {
		this.smtpHost = process.env.SMTP_HOST || ''
		this.smtpPort = parseInt(process.env.SMTP_PORT || '587', 10)
		this.smtpSecure = (process.env.SMTP_SECURE || '').toLowerCase() === 'true'
		this.smtpUser = process.env.SMTP_USER || ''
		this.smtpPassword = process.env.SMTP_PASSWORD || ''
		this.sentFrom = process.env.SMTP_SENT_FROM || ''

		const missingVars = [
			['SMTP_HOST', this.smtpHost],
			['SMTP_USER', this.smtpUser],
			['SMTP_PASSWORD', this.smtpPassword],
			['SMTP_SENT_FROM', this.sentFrom],
		]
			.filter(([, value]) => !value)
			.map(([key]) => key)

		if (missingVars.length > 0) {
			throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
		}

		if (Number.isNaN(this.smtpPort)) {
			throw new Error('Invalid SMTP_PORT environment variable: must be a number')
		}
	}
}

export default new MailConfig()
