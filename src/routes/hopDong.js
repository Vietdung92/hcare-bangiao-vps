const express = require('express');
const { getDB } = require('../config/database');
const { verifyToken, requireQuanLy } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const { ma_can, trang_thai } = req.query;
    let query = 'SELECT * FROM hop_dong WHERE 1=1';
    const params = [];
    if (ma_can) { query += ' AND ma_can = ?'; params.push(ma_can); }
    if (trang_thai) { query += ' AND trang_thai = ?'; params.push(trang_thai); }
    query += ' ORDER BY ngay_tao DESC';
    const data = await db.all(query, params);
    res.json({ thanhCong: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const data = await db.get('SELECT * FROM hop_dong WHERE id = ?', [req.params.id]);
    if (!data) return res.status(404).json({ thanhCong: false, thongBao: 'Không tìm thấy' });
    res.json({ thanhCong: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const { ma_can, so_hd, ten_khach, ngay_bat_dau, ngay_ket_thuc, tien_thue, tien_coc } = req.body;
    if (!ma_can || !so_hd || !ten_khach || !ngay_bat_dau) {
      return res.status(400).json({ thanhCong: false, thongBao: 'Thiếu thông tin bắt buộc' });
    }
    const result = await db.run(
      `INSERT INTO hop_dong (ma_can, so_hd, ten_khach, ngay_bat_dau, ngay_ket_thuc, tien_thue_hang_thang, tien_coc, nhan_vien_tao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ma_can, so_hd, ten_khach, ngay_bat_dau, ngay_ket_thuc, tien_thue, tien_coc, req.user.ma_nv]
    );
    res.status(201).json({ thanhCong: true, id: result.lastID, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

module.exports = router;
