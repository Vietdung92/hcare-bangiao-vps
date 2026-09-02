const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');
const { verifyToken, requireQL } = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'hcare-bangiao-secret-2026';

// Đăng nhập bằng SĐT hoặc mã NV (tương thích cả hai)
router.post('/login', async (req, res) => {
  try {
    const { so_dien_thoai, ma_nv, pin } = req.body;
    const loginId = so_dien_thoai || ma_nv;
    if (!loginId || !pin) return res.status(400).json({ thanhCong: false, thongBao: 'Thiếu thông tin đăng nhập' });
    const db = await getDB();
    const nv = await db.get(
      'SELECT * FROM nhan_vien WHERE (so_dien_thoai = ? OR ma_nv = ?) AND pin = ?',
      [loginId, loginId, pin]
    );
    if (!nv) return res.status(401).json({ thanhCong: false, thongBao: 'Sai số điện thoại hoặc PIN' });
    if (nv.trang_thai === 'TAM_KHOA') return res.status(403).json({ thanhCong: false, thongBao: 'Tài khoản đang bị tạm khóa. Liên hệ Quản lý!' });
    const token = jwt.sign({ ma_nv: nv.ma_nv, vai_tro: nv.vai_tro }, SECRET, { expiresIn: '30d' });
    res.json({ thanhCong: true, token, user: { ma_nv: nv.ma_nv, ten_nv: nv.ten_nv, vai_tro: nv.vai_tro, so_dien_thoai: nv.so_dien_thoai } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// Đổi PIN (không cần duyệt)
router.post('/doi-pin', verifyToken, async (req, res) => {
  try {
    const { pin_cu, pin_moi } = req.body;
    if (!pin_cu || !pin_moi) return res.status(400).json({ thanhCong: false, thongBao: 'Thiếu thông tin' });
    if (pin_moi.length !== 4 || !/^\d{4}$/.test(pin_moi)) return res.status(400).json({ thanhCong: false, thongBao: 'PIN mới phải là 4 chữ số' });
    const db = await getDB();
    const nv = await db.get('SELECT * FROM nhan_vien WHERE ma_nv = ? AND pin = ?', [req.user.ma_nv, pin_cu]);
    if (!nv) return res.status(401).json({ thanhCong: false, thongBao: 'PIN cũ không đúng' });
    await db.run('UPDATE nhan_vien SET pin = ? WHERE ma_nv = ?', [pin_moi, req.user.ma_nv]);
    res.json({ thanhCong: true, thongBao: 'Đổi PIN thành công' });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const nv = await db.get('SELECT ma_nv, ten_nv, vai_tro, so_dien_thoai, trang_thai FROM nhan_vien WHERE ma_nv = ?', [req.user.ma_nv]);
    res.json({ thanhCong: true, user: nv });
  } catch (err) {
    res.status(500).json({ thanhCong: false });
  }
});

module.exports = router;
