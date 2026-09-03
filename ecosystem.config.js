module.exports = {
  apps: [{
    name: 'hcare-bangiao',
    script: './src/app.js',
    cwd: '/root/hcare-bangiao/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3004,
      JWT_SECRET: 'hcare-bangiao-secret-2026',
      DATABASE_PATH: './database/hcare-bangiao.db',
      EMAIL_USER: 'hcarevietnam.info@gmail.com',
      EMAIL_PASS: 'liqauzxsohcfpuzh',
      VAPID_PUBLIC: 'BE66CTP24q64DRpqZ9UVSmGghZRT5SDiAuohWJtBasp7XcgYzWXgdu7TwBMCzgV3670cyHi4BTzCffnEXNFRFPQ',
      VAPID_PRIVATE: 'x5G5LAbsV3b1yholGEf_LT8vkArvn0Hdd0YxYk3UHT8',
      VAPID_EMAIL: 'mailto:hcarevietnam.info@gmail.com'
    },
    error_file: '/root/hcare-bangiao/backend/logs/pm2-error.log',
    out_file: '/root/hcare-bangiao/backend/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
