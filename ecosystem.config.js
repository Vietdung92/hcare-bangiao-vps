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
      VAPID_PUBLIC: 'BPOmT-VFwqvoTaL0yTytAMhtxIknPo350xR5FLpKOFv9jQaxssouD441XlKhW2DXjqFA33UyPasM4jJOD_Wysqw',
      VAPID_PRIVATE: 'uYAoEDv-OtY1ai5_jTtOCmvFRI68XeI0WVMNsNDMXw0',
      VAPID_EMAIL: 'mailto:hcarevietnam.info@gmail.com'
    },
    error_file: '/root/hcare-bangiao/backend/logs/pm2-error.log',
    out_file: '/root/hcare-bangiao/backend/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
