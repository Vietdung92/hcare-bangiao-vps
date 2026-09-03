const express = require('express');
const { getDB } = require('../config/database');
const { verifyToken, requireQL } = require('../middleware/auth');

const router = express.Router();

// GET danh sách
router.get('/', verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const { trang_thai, ma_can } = req.query;
    let sql = 'SELECT * FROM bien_ban WHERE 1=1';
    const params = [];
    if (trang_thai) { sql += ' AND trang_thai = ?'; params.push(trang_thai); }
    if (ma_can) { sql += ' AND ma_can = ?'; params.push(ma_can); }
    sql += ' ORDER BY ngay_thuc_hien DESC, id DESC';
    const list = await db.all(sql, params);
    res.json({ thanhCong: true, data: list });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// GET chi tiết
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const bb = await db.get('SELECT * FROM bien_ban WHERE id = ?', [req.params.id]);
    if (!bb) return res.status(404).json({ thanhCong: false, thongBao: 'Không tìm thấy' });
    if (bb.du_lieu_json && typeof bb.du_lieu_json === 'string') {
      try { bb.du_lieu_json = JSON.parse(bb.du_lieu_json); } catch(e) {}
    }
    res.json({ thanhCong: true, data: bb });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// POST tạo mới → CHO_DUYET
router.post('/', verifyToken, async (req, res) => {
  try {
    const { loai, ma_can, so_hd, ten_khach, cccd, sdt, quoc_tich, ngay_thuc_hien, du_lieu_json } = req.body;
    if (!loai || !ma_can || !ten_khach) return res.status(400).json({ thanhCong: false, thongBao: 'Thiếu thông tin bắt buộc' });
    const db = await getDB();
    const duLieuStr = typeof du_lieu_json === 'string' ? du_lieu_json : JSON.stringify(du_lieu_json || {});
    const result = await db.run(
      `INSERT INTO bien_ban (loai, ma_can, so_hd, ten_khach, cccd, sdt, quoc_tich, ngay_thuc_hien, trang_thai, nhan_vien, nhan_vien_ma, du_lieu_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CHO_DUYET', ?, ?, ?)`,
      [loai, ma_can, so_hd, ten_khach, cccd, sdt, quoc_tich, ngay_thuc_hien,
       req.user.ma_nv, req.user.ma_nv, duLieuStr]
    );
    res.json({ thanhCong: true, thongBao: 'Đã lưu biên bản, chờ Quản lý duyệt', id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// PUT cập nhật nội dung (NV sửa theo yêu cầu QL)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const bb = await db.get('SELECT * FROM bien_ban WHERE id = ?', [req.params.id]);
    if (!bb) return res.status(404).json({ thanhCong: false, thongBao: 'Không tìm thấy' });
    if (bb.trang_thai === 'HOANTAT' && req.user.vai_tro !== 'QuanLy')
      return res.status(403).json({ thanhCong: false, thongBao: 'Biên bản đã hoàn tất, chỉ QL có thể chỉnh sửa' });
    const { du_lieu_json, ten_khach, cccd, sdt, so_hd } = req.body;
    const duLieuStr = typeof du_lieu_json === 'string' ? du_lieu_json : JSON.stringify(du_lieu_json || {});
    await db.run(
      `UPDATE bien_ban SET du_lieu_json=?, ten_khach=?, cccd=?, sdt=?, so_hd=?, trang_thai='CHO_DUYET', ghi_chu_ql=NULL WHERE id=?`,
      [duLieuStr, ten_khach||bb.ten_khach, cccd||bb.cccd, sdt||bb.sdt, so_hd||bb.so_hd, req.params.id]
    );
    res.json({ thanhCong: true, thongBao: 'Đã cập nhật, gửi lại Quản lý duyệt' });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// POST QL duyệt → NV_DUYET (NV được phép cho khách xem và hoàn tất)
router.post('/:id/duyet', verifyToken, requireQL, async (req, res) => {
  try {
    const db = await getDB();
    await db.run(`UPDATE bien_ban SET trang_thai='NV_DUYET', ghi_chu_ql=NULL WHERE id=?`, [req.params.id]);
    res.json({ thanhCong: true, thongBao: 'Đã duyệt! Nhân viên có thể cho khách xem và hoàn tất.' });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// POST QL yêu cầu sửa → CAN_SUA
router.post('/:id/yeu-cau-sua', verifyToken, requireQL, async (req, res) => {
  try {
    const { ghi_chu_ql } = req.body;
    if (!ghi_chu_ql) return res.status(400).json({ thanhCong: false, thongBao: 'Cần nhập ghi chú yêu cầu sửa' });
    const db = await getDB();
    await db.run(`UPDATE bien_ban SET trang_thai='CAN_SUA', ghi_chu_ql=? WHERE id=?`, [ghi_chu_ql, req.params.id]);
    res.json({ thanhCong: true, thongBao: 'Đã gửi yêu cầu sửa cho nhân viên' });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// POST NV hoàn tất → HOANTAT (sau khi QL duyệt)
router.post('/:id/hoan-tat', verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const bb = await db.get('SELECT * FROM bien_ban WHERE id = ?', [req.params.id]);
    if (!bb) return res.status(404).json({ thanhCong: false, thongBao: 'Không tìm thấy' });
    if (bb.trang_thai !== 'NV_DUYET')
      return res.status(400).json({ thanhCong: false, thongBao: 'Biên bản chưa được Quản lý duyệt' });
    await db.run(`UPDATE bien_ban SET trang_thai='HOANTAT' WHERE id=?`, [req.params.id]);
    res.json({ thanhCong: true, thongBao: 'Hoàn tất biên bản thành công', data: bb });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// POST QL chỉnh sửa biên bản đã hoàn tất
router.post('/:id/ql-chinh-sua', verifyToken, requireQL, async (req, res) => {
  try {
    const db = await getDB();
    const { du_lieu_json, ghi_chu_ql } = req.body;
    const duLieuStr = typeof du_lieu_json === 'string' ? du_lieu_json : JSON.stringify(du_lieu_json || {});
    await db.run(`UPDATE bien_ban SET du_lieu_json=?, ghi_chu_ql=? WHERE id=?`,
      [duLieuStr, ghi_chu_ql||null, req.params.id]);
    res.json({ thanhCong: true, thongBao: 'Quản lý đã chỉnh sửa biên bản' });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

module.exports = router;
