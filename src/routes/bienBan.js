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
// GET trang thai tat ca can ho
router.get("/status-all", verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all("SELECT b1.ma_can, b1.id, b1.ten_khach, b1.ngay_thuc_hien, b1.du_lieu_json FROM bien_ban b1 INNER JOIN (SELECT ma_can, MAX(ngay_thuc_hien) as max_ngay FROM bien_ban WHERE loai=? AND trang_thai=? GROUP BY ma_can) b2 ON b1.ma_can=b2.ma_can AND b1.ngay_thuc_hien=b2.max_ngay WHERE b1.loai=? AND b1.trang_thai=?", ["CHECKIN","HOANTAT","CHECKIN","HOANTAT"]);
    const statusMap = {};
    for (const r of rows) {
      const co = await db.get("SELECT id FROM bien_ban WHERE ma_can=? AND loai=? AND trang_thai=? AND ngay_thuc_hien > ? LIMIT 1", [r.ma_can,"CHECKOUT","HOANTAT",r.ngay_thuc_hien]);
      if (!co) { try { if (typeof r.du_lieu_json==="string") r.du_lieu_json=JSON.parse(r.du_lieu_json); } catch(e) {} statusMap[r.ma_can]=r; }
    }
    res.json({ thanhCong: true, data: statusMap });
  } catch(err) { res.status(500).json({ thanhCong: false, thongBao: "Loi server" }); }
});

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
    const ma_bb = 'BB-' + loai + '-' + Date.now() + '-' + Math.random().toString(36).substr(2,5).toUpperCase();
    const result = await db.run(
      `INSERT INTO bien_ban (ma_bb, loai, ma_can, so_hd, ten_khach, cccd, sdt, quoc_tich, ngay_thuc_hien, trang_thai, nhan_vien, nhan_vien_ma, du_lieu_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CHO_DUYET', ?, ?, ?)`,
      [ma_bb, loai, ma_can, so_hd, ten_khach, cccd, sdt, quoc_tich, ngay_thuc_hien,
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
    const { chu_ky_ql } = req.body || {};
    if (chu_ky_ql) {
      await db.run("UPDATE bien_ban SET trang_thai='NV_DUYET', ghi_chu_ql=NULL, chu_ky_ql=?, ngay_ky_ql=CURRENT_TIMESTAMP, ten_ql=? WHERE id=?", [chu_ky_ql, req.user.ten_nv || req.user.ma_nv, req.params.id]);
    } else {
      await db.run("UPDATE bien_ban SET trang_thai='NV_DUYET', ghi_chu_ql=NULL WHERE id=?", [req.params.id]);
    }
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

// ===== HOAN TAT (rewritten) =====
router.post('/:id/hoan-tat', verifyToken, async (req, res) => {
  const { chu_ky_khach, chu_ky_nv } = req.body || {};
  if (!chu_ky_khach) return res.status(400).json({ thanhCong: false, thongBao: 'Cần chữ ký khách thuê' });
  if (!chu_ky_nv) return res.status(400).json({ thanhCong: false, thongBao: 'Cần chữ ký nhân viên' });
  try {
    const db = await getDB();
    const bb = await db.get('SELECT * FROM bien_ban WHERE id=?', [req.params.id]);
    if (!bb) return res.status(404).json({ thanhCong: false, thongBao: 'Không tìm thấy biên bản' });
    await db.run(
      "UPDATE bien_ban SET chu_ky_ql=?, chu_ky_nv=?, ten_nv_ky=?, ngay_ky_ql=CURRENT_TIMESTAMP, trang_thai='HOANTAT' WHERE id=?",
      [chu_ky_khach, chu_ky_nv, req.user.ten_nv || req.user.ho_ten || req.user.ma_nv, req.params.id]
    );
    // Gui email noi bo
    const http = require('http');
    const port = parseInt(process.env.PORT || 3004);
    const emailOK = await new Promise(resolve => {
      const data = JSON.stringify({ bien_ban_id: parseInt(req.params.id) });
      const opts = {
        hostname: 'localhost', port,
        path: '/api/email/gui-bien-ban', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Authorization': req.headers.authorization }
      };
      const r = http.request(opts, resp => {
        let b = '';
        resp.on('data', d => b += d);
        resp.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve({ thanhCong: false }); } });
      });
      r.on('error', e => { console.error('[HOANTAT] Email loi:', e.message); resolve({ thanhCong: false }); });
      r.write(data); r.end();
    });
    const msg = emailOK.thanhCong
      ? 'Hoàn tất! Email đã gửi cho khách thuê.'
      : 'Hoàn tất! Gửi email chưa thành công — vui lòng gửi lại từ chi tiết biên bản.';
    res.json({ thanhCong: true, guiEmailOK: emailOK.thanhCong, thongBao: msg });
  } catch (err) {
    console.error('[HOANTAT] Loi:', err.message);
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi hệ thống: ' + err.message });
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

// GET check-in hiện tại của căn hộ (dùng cho màn hình check-out)
router.get('/can-ho/:ma_can/checkin', verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const bb = await db.get(
      `SELECT * FROM bien_ban WHERE ma_can=? AND loai='CHECKIN' AND trang_thai='HOANTAT'
       ORDER BY ngay_thuc_hien DESC LIMIT 1`,
      [req.params.ma_can]
    );
    if (!bb) return res.json({ thanhCong: false, thongBao: 'Không tìm thấy check-in' });
    if (typeof bb.du_lieu_json === 'string') bb.du_lieu_json = JSON.parse(bb.du_lieu_json);
    res.json({ thanhCong: true, data: bb });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// POST QL nhập quyết toán bồi thường cho check-out
router.post('/:id/ql-quyet-toan', verifyToken, requireQL, async (req, res) => {
  try {
    const db = await getDB();
    const bb = await db.get('SELECT * FROM bien_ban WHERE id=?', [req.params.id]);
    if (!bb) return res.status(404).json({ thanhCong: false, thongBao: 'Không tìm thấy' });
    let du = {};
    try { du = typeof bb.du_lieu_json === 'string' ? JSON.parse(bb.du_lieu_json) : (bb.du_lieu_json || {}); } catch(e) {}
    const { boiThuong, ghiChuQL, tongBoiThuong } = req.body;
    du.boiThuong = boiThuong || {};
    du.tongBoiThuong = tongBoiThuong || 0;
    du.ghiChuQuyetToan = ghiChuQL || '';
    du.ngayQuyetToan = new Date().toISOString();
    await db.run(
      'UPDATE bien_ban SET du_lieu_json=?, trang_thai=? WHERE id=?',
      [JSON.stringify(du), 'NV_DUYET', req.params.id]
    );
    res.json({ thanhCong: true, thongBao: 'Đã lưu quyết toán, chờ NV hoàn tất' });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// XOA bien ban (chi QL) - luu vao bang bien_ban_da_xoa
router.delete('/:id', verifyToken, requireQL, async (req, res) => {
  try {
    const db = await getDB();
    const b = await db.get('SELECT * FROM bien_ban WHERE id = ?', [req.params.id]);
    if (!b) return res.status(404).json({ thanhCong: false, thongBao: 'Khong tim thay bien ban' });
    await db.run(
      'INSERT OR REPLACE INTO bien_ban_da_xoa (id, loai, ma_can, so_hd, ten_khach, cccd, sdt, quoc_tich, ngay_thuc_hien, trang_thai, nhan_vien, du_lieu_json, ngay_tao, xoa_boi, ly_do) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [b.id, b.loai, b.ma_can, b.so_hd, b.ten_khach, b.cccd, b.sdt, b.quoc_tich,
       b.ngay_thuc_hien, b.trang_thai, b.nhan_vien, b.du_lieu_json, b.ngay_tao,
       req.user.ma_nv, (req.body && req.body.ly_do) || null]
    );
    await db.run('DELETE FROM bien_ban WHERE id = ?', [req.params.id]);
    res.json({ thanhCong: true, thongBao: 'Da xoa bien ban ' + b.loai + ' can ' + b.ma_can + ' - ' + b.ten_khach });
  } catch (err) {
    console.error('Delete BB error:', err.message);
    res.status(500).json({ thanhCong: false, thongBao: 'Loi server: ' + err.message });
  }
});

// Danh sach bien ban da xoa (chi QL)
router.get('/da-xoa/list', verifyToken, requireQL, async (req, res) => {
  try {
    const db = await getDB();
    const list = await db.all('SELECT id, loai, ma_can, ten_khach, ngay_thuc_hien, xoa_boi, ngay_xoa, ly_do FROM bien_ban_da_xoa ORDER BY ngay_xoa DESC LIMIT 100');
    res.json({ thanhCong: true, data: list });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Loi server' });
  }
});

// Phuc hoi bien ban da xoa (chi QL)
router.post('/da-xoa/:id/phuc-hoi', verifyToken, requireQL, async (req, res) => {
  try {
    const db = await getDB();
    const b = await db.get('SELECT * FROM bien_ban_da_xoa WHERE id = ?', [req.params.id]);
    if (!b) return res.status(404).json({ thanhCong: false, thongBao: 'Khong tim thay' });
    await db.run(
      'INSERT OR REPLACE INTO bien_ban (id, loai, ma_can, so_hd, ten_khach, cccd, sdt, quoc_tich, ngay_thuc_hien, trang_thai, nhan_vien, du_lieu_json, ngay_tao) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [b.id, b.loai, b.ma_can, b.so_hd, b.ten_khach, b.cccd, b.sdt, b.quoc_tich,
       b.ngay_thuc_hien, b.trang_thai, b.nhan_vien, b.du_lieu_json, b.ngay_tao]
    );
    await db.run('DELETE FROM bien_ban_da_xoa WHERE id = ?', [req.params.id]);
    res.json({ thanhCong: true, thongBao: 'Da phuc hoi bien ban' });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Loi server' });
  }
});

module.exports = router;
