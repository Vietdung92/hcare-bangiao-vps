const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'hcare-bangiao-secret-2026';

router.post('/login', async (req, res) => {
  try {
    const { ma_nv, pin } = req.body;
    if (!ma_nv || !pin) {
      return res.status(400).json({ thanhCong: false, thongBao: 'Thiếu mã NV hoặc PIN' });
    }
    const db = await getDB();
    const nv = await db.get('SELECT * FROM nhan_vien WHERE ma_nv = ? AND pin = ?', [ma_nv, pin]);
    if (!nv) {
      return res.status(401).json({ thanhCong: false, thongBao: 'Sai mã NV hoặc PIN' });
    }
    const token = jwt.sign({ ma_nv: nv.ma_nv, vai_tro: nv.vai_tro }, SECRET, { expiresIn: '30d' });
    res.json({
      thanhCong: true,
      token,
      user: { ma_nv: nv.ma_nv, ten_nv: nv.ten_nv, vai_tro: nv.vai_tro }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ thanhCong: false });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    res.json({ thanhCong: true, user: decoded });
  } catch {
    res.status(401).json({ thanhCong: false, thongBao: 'Token không hợp lệ' });
  }
});

module.exports = router;
