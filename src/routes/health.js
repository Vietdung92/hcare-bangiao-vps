const express = require('express');
const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    thanhCong: true,
    thongBao: 'HCARE Bàn Giao API đang hoạt động',
    phien_ban: '1.0.0',
    database: 'SQLite',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
