const express = require('express');
const { getDB } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/thong-ke/tong-quan
router.get('/tong-quan', verifyToken, async (req, res) => {
  try {
    const db = await getDB();

    const tongCanHo = await db.get('SELECT COUNT(*) as total FROM can_ho');
    const tongBienBan = await db.get('SELECT COUNT(*) as total FROM bien_ban');
    const thangNay = new Date().toISOString().slice(0, 7);
    const bienBanThangNay = await db.get(
      "SELECT COUNT(*) as total FROM bien_ban WHERE ngay_thuc_hien LIKE ?",
      [`${thangNay}%`]
    );
    const checkin = await db.get("SELECT COUNT(*) as total FROM bien_ban WHERE loai='CHECKIN'");
    const checkout = await db.get("SELECT COUNT(*) as total FROM bien_ban WHERE loai='CHECKOUT'");

    res.json({
      thanhCong: true,
      data: {
        tong_can_ho: tongCanHo.total,
        tong_bien_ban: tongBienBan.total,
        bien_ban_thang_nay: bienBanThangNay.total,
        tong_checkin: checkin.total,
        tong_checkout: checkout.total
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('GET /thong-ke/tong-quan error:', err);
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

module.exports = router;
