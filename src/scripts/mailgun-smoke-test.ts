import 'dotenv/config';
import MailService from '../Service/mail';

async function run() {
    const testRecipient = process.env.SMTP_TEST_TO;

    if (!testRecipient) {
        throw new Error('Missing required environment variable: SMTP_TEST_TO');
    }

    const mailService = new MailService();

    await mailService.mailer.verify();
    const response = await mailService.sendTestMail(testRecipient);

    console.log('SMTP smoke test succeeded.');
    console.log(`Accepted: ${(response.accepted || []).join(', ') || 'none'}`);
    console.log(`Rejected: ${(response.rejected || []).join(', ') || 'none'}`);
    if ('messageId' in response && response.messageId) {
        console.log(`Message ID: ${response.messageId}`);
    }
}

run().catch((error) => {
    console.error('SMTP smoke test failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
