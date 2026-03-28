// 測試環境變數設定
// 在所有測試執行前先設定必要的環境變數，避免 import 時因缺少 env 而 throw Error

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/furfriend_test';
process.env.PORT = '3000';
process.env.APP_BASE_URL = 'http://localhost:3000';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.EMAIL_VERIFY_CALLBACK_URL = 'http://localhost:3000/verify-email';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';

process.env.SMTP_HOST = 'smtp.test.local';
process.env.SMTP_PORT = '587';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASSWORD = 'testpassword';
process.env.SMTP_SENT_FROM = 'noreply@furfriend-test.com';

process.env.GEOCODING_API_KEY = 'test-geocoding-api-key';

process.env.CHANNEL_SECRET = 'test-channel-secret-32byteslong123456';
process.env.CHANNEL_ACCESS_TOKEN = 'test-channel-access-token';

process.env.ADMIN_API_KEY = 'test-admin-api-key-secret';

process.env.NODE_ENV = 'test';
