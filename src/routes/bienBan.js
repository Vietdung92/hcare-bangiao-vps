const express = require('express');
const { getDB } = require('../config/database');
const { verifyToken, requireQuanLy } = require('../middleware/auth');

const router = express.Router();

// GET /api/bien-ban - Danh sách biên bản
router.get('/', verifyToken, async (req, res) => {
  try {
    const { loai, ma_can, trang_thai } = req.query;
    const db = await getDB();

    let query = 'SELECT * FROM bien_ban WHERE 1=1';
    const params = [];

    if (loai) {
      query += ' AND loai = ?';
      params.push(loai);
    }
    if (ma_can) {
      query += ' AND ma_can = ?';
      params.push(ma_can);
    }
    if (trang_thai) {
      query += ' AND trang_thai = ?';
      params.push(trang_thai);
    }

    query += ' ORDER BY ngay_thuc_hien DESC';

    const bienBans = await db.all(query, params);

    res.status(200).json({
      thanhCong: true,
      thongBao: 'Lấy danh sách biên bản thành công',
      tongSo: bienBans.length,
      data: bienBans,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('GET /bien-ban error:', err);
    res.status(500).json({
      thanhCong: false,
      thongBao: 'Lỗi server',
      code: 'SERVER_ERROR'
    });
  }
});

// GET /api/bien-ban/:id - Chi tiết biên bản
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();

    const bienBan = await db.get(
      'SELECT * FROM bien_ban WHERE id = ?',
      [id]
    );

    if (!bienBan) {
      return res.status(404).json({
        thanhCong: false,
        thongBao: 'Biên bản không tồn tại',
        code: 'NOT_FOUND'
      });
    }

    // Parse JSON data nếu có
    if (bienBan.du_lieu_json) {
      try {
        bienBan.du_lieu_json = JSON.parse(bienBan.du_lieu_json);
      } catch (e) {
        // Keep as string nếu parse lỗi
      }
    }

    res.status(200).json({
      thanhCong: true,
      thongBao: 'Lấy chi tiết biên bản thành công',
      data: bienBan,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('GET /bien-ban/:id error:', err);
    res.status(500).json({
      thanhCong: false,
      thongBao: 'Lỗi server',
      code: 'SERVER_ERROR'
    });
  }
});

// POST /api/bien-ban - Tạo biên bản mới
router.post('/', verifyToken, async (req, res) => {
  try {
    const { loai, ma_can, so_hd, ten_khach, cccd, sdt, quoc_tich, ngay_thuc_hien, du_lieu_json } = req.body;

    // Validate
    if (!loai || !ma_can || !so_hd || !ten_khach || !ngay_thuc_hien) {
      return res.status(400).json({
        thanhCong: false,
        thongBao: 'Thiếu thông tin bắt buộc',
        code: 'MISSING_FIELDS'
      });
    }

    if (!['CHECKIN', 'CHECKOUT'].includes(loai)) {
      return res.status(400).json({
        thanhCong: false,
        thongBao: 'Loại biên bản không hợp lệ (CHECKIN/CHECKOUT)',
        code: 'INVALID_LOAI'
      });
    }

    const db = await getDB();

    // Kiểm tra căn hộ tồn tại
    const canHo = await db.get('SELECT id FROM can_ho WHERE ma_can = ?', [ma_can]);
    if (!canHo) {
      return res.status(400).json({
        thanhCong: false,
        thongBao: 'Căn hộ không tồn tại',
        code: 'INVALID_MA_CAN'
      });
    }

    // Tạo mã biên bản
    const ma_bb = `BB-${loai.substring(0, 2)}-${Date.now()}`;

    // Tạo mới
    const result = await db.run(
      `INSERT INTO bien_ban (ma_bb, loai, ma_can, so_hd, ten_khach, cccd, sdt, quoc_tich, ngay_thuc_hien, nhan_vien, trang_thai, du_lieu_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NHAP', ?)`,
      [
        ma_bb,
        loai,
        ma_can,
        so_hd,
        ten_khach,
        cccd || null,
        sdt || null,
        quoc_tich || null,
        ngay_thuc_hien,
        req.user.ma_nv,
        du_lieu_json ? JSON.stringify(du_lieu_json) : null
      ]
    );

    res.status(201).json({
      thanhCong: true,
      thongBao: 'Tạo biên bản thành công',
      ma_bb: ma_bb,
      id: result.lastID,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('POST /bien-ban error:', err);
    res.status(500).json({
      thanhCong: false,
      thongBao: 'Lỗi server',
      code: 'SERVER_ERROR'
    });
  }
});

// PUT /api/bien-ban/:id - Cập nhật biên bản (chỉ khi NHAP)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { ten_khach, cccd, sdt, quoc_tich, du_lieu_json } = req.body;
    const db = await getDB();

    // Kiểm tra biên bản tồn tại
    const bienBan = await db.get('SELECT * FROM bien_ban WHERE id = ?', [id]);
    if (!bienBan) {
      return res.status(404).json({
        thanhCong: false,
        thongBao: 'Biên bản không tồn tại',
        code: 'NOT_FOUND'
      });
    }

    // Chỉ được cập nhật khi ở trạng thái NHAP
    if (bienBan.trang_thai !== 'NHAP') {
      return res.status(400).json({
        thanhCong: false,
        thongBao: 'Chỉ được cập nhật biên bản ở trạng thái NHAP',
        code: 'INVALID_STATUS'
      });
    }

    // Cập nhật
    await db.run(
      `UPDATE bien_ban SET 
       ten_khach = ?, cccd = ?, sdt = ?, quoc_tich = ?, du_lieu_json = ?, ngay_cap_nhat = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        ten_khach || bienBan.ten_khach,
        cccd || bienBan.cccd,
        sdt || bienBan.sdt,
        quoc_tich || bienBan.quoc_tich,
        du_lieu_json ? JSON.stringify(du_lieu_json) : bienBan.du_lieu_json,
        id
      ]
    );

    res.status(200).json({
      thanhCong: true,
      thongBao: 'Cập nhật biên bản thành công',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('PUT /bien-ban/:id error:', err);
    res.status(500).json({
      thanhCong: false,
      thongBao: 'Lỗi server',
      code: 'SERVER_ERROR'
    });
  }
});

// POST /api/bien-ban/:id/hoan-tat - Hoàn tất biên bản
router.post('/:id/hoan-tat', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();

    const bienBan = await db.get('SELECT * FROM bien_ban WHERE id = ?', [id]);
    if (!bienBan) {
      return res.status(404).json({
        thanhCong: false,
        thongBao: 'Biên bản không tồn tại',
        code: 'NOT_FOUND'
      });
    }

    if (bienBan.trang_thai !== 'NHAP') {
      return res.status(400).json({
        thanhCong: false,
        thongBao: 'Chỉ được hoàn tất biên bản ở trạng thái NHAP',
        code: 'INVALID_STATUS'
      });
    }

    // Cập nhật trạng thái
    await db.run(
      'UPDATE bien_ban SET trang_thai = ?, ngay_cap_nhat = CURRENT_TIMESTAMP WHERE id = ?',
      ['HOANTAT', id]
    );

    res.status(200).json({
      thanhCong: true,
      thongBao: 'Biên bản đã hoàn tất',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('POST /bien-ban/:id/hoan-tat error:', err);
    res.status(500).json({
      thanhCong: false,
      thongBao: 'Lỗi server',
      code: 'SERVER_ERROR'
    });
  }
});

// POST /api/bien-ban/:id/duyet - Duyệt biên bản (Quản lý)
router.post('/:id/duyet', verifyToken, requireQuanLy, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();

    const bienBan = await db.get('SELECT * FROM bien_ban WHERE id = ?', [id]);
    if (!bienBan) {
      return res.status(404).json({
        thanhCong: false,
        thongBao: 'Biên bản không tồn tại',
        code: 'NOT_FOUND'
      });
    }

    if (bienBan.trang_thai !== 'HOANTAT') {
      return res.status(400).json({
        thanhCong: false,
        thongBao: 'Chỉ được duyệt biên bản ở trạng thái HOANTAT',
        code: 'INVALID_STATUS'
      });
    }

    // Cập nhật trạng thái
    await db.run(
      'UPDATE bien_ban SET trang_thai = ?, ngay_cap_nhat = CURRENT_TIMESTAMP WHERE id = ?',
      ['DADUYET', id]
    );

    res.status(200).json({
      thanhCong: true,
      thongBao: 'Biên bản đã được duyệt',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('POST /bien-ban/:id/duyet error:', err);
    res.status(500).json({
      thanhCong: false,
      thongBao: 'Lỗi server',
      code: 'SERVER_ERROR'
    });
  }
});

// GET /api/bien-ban/thong-ke/tong-quan - Thống kê tổng quan
router.get('/thong-ke/tong-quan', verifyToken, async (req, res) => {
  try {
    const db = await getDB();

    const stats = await db.get(`
      SELECT 
        COUNT(*) as tong_so,
        SUM(CASE WHEN trang_thai = 'NHAP' THEN 1 ELSE 0 END) as nhap,
        SUM(CASE WHEN trang_thai = 'HOANTAT' THEN 1 ELSE 0 END) as hoan_tat,
        SUM(CASE WHEN trang_thai = 'DADUYET' THEN 1 ELSE 0 END) as da_duyet,
        SUM(CASE WHEN loai = 'CHECKIN' THEN 1 ELSE 0 END) as checkin,
        SUM(CASE WHEN loai = 'CHECKOUT' THEN 1 ELSE 0 END) as checkout
      FROM bien_ban
    `);

    res.status(200).json({
      thanhCong: true,
      thongBao: 'Lấy thống kê thành công',
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('GET /bien-ban/thong-ke error:', err);
    res.status(500).json({
      thanhCong: false,
      thongBao: 'Lỗi server',
      code: 'SERVER_ERROR'
    });
  }
});


module.exports = router;
