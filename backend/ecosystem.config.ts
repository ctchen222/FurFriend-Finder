// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'app',
      script: './dist/app.js',
      instances: 1,
      autorestart: true,
      watch: true,
      mode: 'cluster',
      max_memory_restart: '2G',
      env: {
        PORT: 3000,
        NODE_ENV: 'development', // 確保在開發環境中設置
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
