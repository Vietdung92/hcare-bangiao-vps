const express = require('express');
const { getDB } = require('../config/database');
const { verifyToken, requireQL } = require('../middleware/auth');

const router = express.Router();

// Lấy danh sách nhân viên (chỉ QL)
router.get('/', verifyToken, requireQL, async (req, res) => {
  try {
    const db = await getDB();
    const list = await db.all(
      'SELECT ma_nv, ten_nv, so_dien_thoai, vai_tro, trang_thai FROM nhan_vien ORDER BY ten_nv'
    );
    res.json({ thanhCong: true, data: list });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// Tạo tài khoản mới (chỉ QL)
router.post('/', verifyToken, requireQL, async (req, res) => {
  try {
    const { ten_nv, so_dien_thoai, vai_tro } = req.body;
    if (!ten_nv || !so_dien_thoai) return res.status(400).json({ thanhCong: false, thongBao: 'Thiếu họ tên hoặc số điện thoại' });
    const db = await getDB();
    const existed = await db.get('SELECT ma_nv FROM nhan_vien WHERE so_dien_thoai = ?', [so_dien_thoai]);
    if (existed) return res.status(400).json({ thanhCong: false, thongBao: 'Số điện thoại đã tồn tại' });
    const count = await db.get('SELECT COUNT(*) as n FROM nhan_vien');
    const ma_nv = 'NV' + String(count.n + 1).padStart(3, '0');
    await db.run(
      'INSERT INTO nhan_vien (ma_nv, ten_nv, so_dien_thoai, pin, vai_tro, trang_thai) VALUES (?, ?, ?, ?, ?, ?)',
      [ma_nv, ten_nv, so_dien_thoai, '1234', vai_tro || 'NhanVien', 'HOAT_DONG']
    );
    res.json({ thanhCong: true, thongBao: `Tạo tài khoản thành công! Mã: ${ma_nv}, PIN mặc định: 1234`, ma_nv });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// Cập nhật tài khoản (chỉ QL)
router.put('/:ma_nv', verifyToken, requireQL, async (req, res) => {
  try {
    const { ten_nv, so_dien_thoai, vai_tro } = req.body;
    const db = await getDB();
    await db.run(
      'UPDATE nhan_vien SET ten_nv = ?, so_dien_thoai = ?, vai_tro = ? WHERE ma_nv = ?',
      [ten_nv, so_dien_thoai, vai_tro, req.params.ma_nv]
    );
    res.json({ thanhCong: true, thongBao: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// Đóng/mở tài khoản (chỉ QL)
router.post('/:ma_nv/trang-thai', verifyToken, requireQL, async (req, res) => {
  try {
    const { trang_thai } = req.body;
    if (!['HOAT_DONG', 'TAM_KHOA'].includes(trang_thai)) return res.status(400).json({ thanhCong: false, thongBao: 'Trạng thái không hợp lệ' });
    const db = await getDB();
    await db.run('UPDATE nhan_vien SET trang_thai = ? WHERE ma_nv = ?', [trang_thai, req.params.ma_nv]);
    res.json({ thanhCong: true, thongBao: trang_thai === 'TAM_KHOA' ? 'Đã tạm khóa tài khoản' : 'Đã mở lại tài khoản' });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// Reset PIN về 1234 (chỉ QL)
router.post('/:ma_nv/reset-pin', verifyToken, requireQL, async (req, res) => {
  try {
    const db = await getDB();
    await db.run('UPDATE nhan_vien SET pin = ? WHERE ma_nv = ?', ['1234', req.params.ma_nv]);
    res.json({ thanhCong: true, thongBao: 'Đã reset PIN về 1234' });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

// Xóa tài khoản - giữ lại biên bản (chỉ QL)
router.delete('/:ma_nv', verifyToken, requireQL, async (req, res) => {
  try {
    const db = await getDB();
    const nv = await db.get('SELECT * FROM nhan_vien WHERE ma_nv = ?', [req.params.ma_nv]);
    if (!nv) return res.status(404).json({ thanhCong: false, thongBao: 'Không tìm thấy nhân viên' });
    if (nv.vai_tro === 'QuanLy') return res.status(400).json({ thanhCong: false, thongBao: 'Không thể xóa tài khoản Quản lý' });
    await db.run('DELETE FROM nhan_vien WHERE ma_nv = ?', [req.params.ma_nv]);
    res.json({ thanhCong: true, thongBao: `Đã xóa tài khoản ${nv.ten_nv}. Lịch sử biên bản vẫn được giữ lại.` });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

module.exports = router;
