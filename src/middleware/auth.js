const jwt = require('jsonwebtoken');

// Middleware kiểm tra JWT token
function verifyToken(req, res, next) {
  try {
    // Lấy token từ header: Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        thanhCong: false,
        thongBao: 'Không có token',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7); // Bỏ "Bearer "

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    );

    // Gắn user info vào request
    req.user = decoded;
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        thanhCong: false,
        thongBao: 'Token đã hết hạn',
        code: 'TOKEN_EXPIRED'
      });
    }

    res.status(401).json({
      thanhCong: false,
      thongBao: 'Token không hợp lệ',
      code: 'INVALID_TOKEN'
    });
  }
}

// Middleware kiểm tra quyền Quản lý
function requireQuanLy(req, res, next) {
  if (req.user.vai_tro !== 'QuanLy') {
    return res.status(403).json({
      thanhCong: false,
      thongBao: 'Chỉ quản lý mới có quyền',
      code: 'FORBIDDEN'
    });
  }
  next();
}

module.exports = { verifyToken, requireQuanLy };
	

const requireQL = (req, res, next) => {
  if (req.user?.vai_tro !== 'QuanLy') {
    return res.status(403).json({ thanhCong: false, thongBao: 'Chỉ Quản lý mới có quyền thực hiện' });
  }
  next();
};

module.exports.requireQL = requireQL;
