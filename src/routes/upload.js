const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/anh', verifyToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ thanhCong: false, thongBao: 'Không có file' });
    }
    res.json({
      thanhCong: true,
      thongBao: 'Upload thành công',
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi server' });
  }
});

module.exports = router;
