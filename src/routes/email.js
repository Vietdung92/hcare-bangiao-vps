const express = require('express');
const nodemailer = require('nodemailer');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

router.post('/gui-bien-ban', verifyToken, async (req, res) => {
  try {
    const { email_khach, ten_khach, ma_can, loai, ngay, hang_muc_list } = req.body;
    if (!email_khach) return res.status(400).json({ thanhCong: false, thongBao: 'Thiếu email khách' });

    const isCheckin = loai === 'CHECKIN';
    const tieuDe = isCheckin
      ? `[HCARE] Biên bản nhận bàn giao căn hộ ${ma_can}`
      : `[HCARE] Biên bản trả căn hộ ${ma_can}`;

    // Build HTML email
    let hangMucHTML = '';
    if (hang_muc_list) {
      Object.entries(hang_muc_list).forEach(([kv, items]) => {
        hangMucHTML += `<h3 style="color:#1B4F8A;margin:16px 0 8px">${kv}</h3>`;
        items.forEach(item => {
          const color = item.status === 'TOT' ? '#1A7A4A' : item.status === 'HONG' ? '#C0392B' : item.status === 'XUOC' ? '#C0590A' : '#64748B';
          const label = item.status === 'TOT' ? '✓ Tốt' : item.status === 'XUOC' ? '⚠ Trầy xước' : item.status === 'HONG' ? '✗ Hư hỏng' : '— Không có';
          hangMucHTML += `<div style="margin-bottom:12px;padding:10px;border:1px solid #e5e7eb;border-radius:8px">
            <div style="font-weight:600;margin-bottom:4px">${item.name} — <span style="color:${color}">${label}</span></div>
            ${item.ghi_chu ? `<div style="font-size:13px;color:#64748B;margin-bottom:6px">${item.ghi_chu}</div>` : ''}
            ${item.photos && item.photos.length > 0 ? `
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                ${item.photos.map(p => `
                  <div style="text-align:center">
                    <img src="${p.url}" style="width:180px;height:180px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb">
                    <div style="font-size:11px;color:#94A3B8;margin-top:2px">${p.ts || ''}</div>
                  </div>`).join('')}
              </div>` : ''}
          </div>`;
        });
      });
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#1a2332">
  <div style="background:linear-gradient(135deg,#1B4F8A,#2E6DB4);padding:24px;border-radius:12px;margin-bottom:24px">
    <h1 style="color:#fff;margin:0;font-size:20px">🏢 HCARE Bàn Giao</h1>
    <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px">
      ${isCheckin ? 'BIÊN BẢN NHẬN BÀN GIAO CĂN HỘ' : 'BIÊN BẢN TRẢ CĂN HỘ'}
    </p>
  </div>

  <div style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:20px">
    <h2 style="color:#1B4F8A;font-size:16px;margin:0 0 12px">Thông tin chung</h2>
    <table style="width:100%;font-size:14px">
      <tr><td style="color:#64748B;padding:4px 0;width:140px">Căn hộ</td><td style="font-weight:600">${ma_can}</td></tr>
      <tr><td style="color:#64748B;padding:4px 0">Khách thuê</td><td style="font-weight:600">${ten_khach}</td></tr>
      <tr><td style="color:#64748B;padding:4px 0">Ngày thực hiện</td><td style="font-weight:600">${ngay}</td></tr>
      <tr><td style="color:#64748B;padding:4px 0">Loại biên bản</td><td style="font-weight:600">${isCheckin ? 'Check-in (Nhận căn)' : 'Check-out (Trả căn)'}</td></tr>
    </table>
  </div>

  <h2 style="color:#1B4F8A;font-size:16px;border-bottom:2px solid #EBF2FA;padding-bottom:8px">
    Kiểm kê tình trạng & Hình ảnh
  </h2>
  ${hangMucHTML}

  <div style="margin-top:24px;padding:16px;background:#EBF2FA;border-radius:10px;font-size:13px;color:#64748B">
    <p style="margin:0">Email này được gửi tự động từ hệ thống HCARE Bàn Giao.</p>
    <p style="margin:4px 0 0">Nếu có thắc mắc, vui lòng liên hệ: ${process.env.EMAIL_USER}</p>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: `HCARE Bàn Giao <${process.env.EMAIL_USER}>`,
      to: email_khach,
      subject: tieuDe,
      html: htmlContent
    });

    res.json({ thanhCong: true, thongBao: `Đã gửi email tới ${email_khach}` });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi gửi email: ' + err.message });
  }
});

module.exports = router;
