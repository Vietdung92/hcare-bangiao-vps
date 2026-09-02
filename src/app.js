const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load env variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files (uploads, public)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api', require('./routes/health'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/can-ho', require('./routes/canHo'));
app.use('/api/bien-ban', require('./routes/bienBan'));
app.use('/api/hop-dong', require('./routes/hopDong'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/thong-ke', require('./routes/thongKe'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    thanhCong: false,
    thongBao: err.message || 'Lỗi server',
    code: err.code || 'SERVER_ERROR',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 HCARE Bàn Giao API chạy trên http://localhost:${PORT}`);
  console.log(`📁 Database: ${process.env.DATABASE_PATH}`);
});
