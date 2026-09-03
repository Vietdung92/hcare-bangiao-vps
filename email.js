const express = require('express');
const nodemailer = require('nodemailer');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

function moneyStr(n){ if(!n||n==0)return'—'; return Number(n).toLocaleString('vi-VN')+' đ'; }

function buildEmailHTML(data){
  const { ten_khach, ma_can, loai, ngay, hang_muc_list, congTo, vatDung, tienCoc, quoc_tich } = data;
  const isCI = loai === 'CHECKIN';
  const bilingual = quoc_tich && !['việt nam','viet nam'].includes(quoc_tich.trim().toLowerCase());

  // Build table rows
  let stt = 0;
  let tableRows = '';
  if (hang_muc_list) {
    Object.entries(hang_muc_list).forEach(([kv, items]) => {
      tableRows += `<tr><td colspan="5" style="background:#EBF2FA;font-weight:700;color:#1B4F8A;padding:8px 10px;font-size:13px">🏷️ ${kv}</td></tr>`;
      items.forEach(item => {
        stt++;
        const stColor = item.status==='TOT'?'#1A7A4A':item.status==='XUOC'?'#854d0e':item.status==='HONG'?'#C0392B':'#64748B';
        const stLabel = item.status==='TOT'?'✓ Tốt':item.status==='XUOC'?'⚠ Trầy xước':item.status==='HONG'?'✗ Hư hỏng':'— Không có';
        const photoCells = (item.photos||[]).map(p =>
          `<div style="display:inline-block;text-align:center;margin:2px"><img src="${p.url}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;display:block"><div style="font-size:9px;color:#94A3B8;margin-top:2px">${p.ts||''}</div></div>`
        ).join('');
        tableRows += `<tr style="border-bottom:1px solid #F1F5F9">
          <td style="padding:8px 6px;text-align:center;color:#94A3B8;font-size:12px">${stt}</td>
          <td style="padding:8px 6px;font-weight:500">${item.name}</td>
          <td style="padding:8px 6px;text-align:center">${item.sl||1}</td>
          <td style="padding:8px 6px;color:${stColor};font-weight:600">${stLabel}</td>
          <td style="padding:8px 6px">${item.ghi_chu||''}</td>
        </tr>`;
        if(photoCells){
          tableRows += `<tr style="border-bottom:1px solid #F1F5F9"><td></td><td colspan="4" style="padding:6px">${photoCells}</td></tr>`;
        }
      });
    });
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:680px;margin:0 auto;padding:20px">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#1B4F8A,#2E6DB4);border-radius:16px 16px 0 0;padding:28px 24px;text-align:center">
    <div style="font-size:36px;margin-bottom:8px">${isCI?'🏠':'🔑'}</div>
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">
      ${isCI?'BIÊN BẢN BÀN GIAO NHẬN CĂN HỘ':'BIÊN BẢN TRẢ CĂN HỘ'}
    </h1>
    ${bilingual?`<p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:14px">${isCI?'APARTMENT HANDOVER RECORD':'APARTMENT RETURN RECORD'}</p>`:''}
    <p style="color:rgba(255,255,255,.7);margin:8px 0 0;font-size:13px">📅 Ngày: ${ngay}</p>
  </div>

  <!-- THÔNG TIN -->
  <div style="background:#fff;padding:20px 24px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
    <h2 style="color:#1B4F8A;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #EBF2FA">
      ${bilingual?'Thông tin khách thuê / Tenant Information':'Thông tin khách thuê'}
    </h2>
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <tr><td style="padding:5px 0;color:#64748B;width:140px">Căn hộ / Unit</td><td style="padding:5px 0;font-weight:700;color:#1B4F8A">${ma_can}</td></tr>
      <tr><td style="padding:5px 0;color:#64748B">Khách thuê / Tenant</td><td style="padding:5px 0;font-weight:600">${ten_khach}</td></tr>
      <tr><td style="padding:5px 0;color:#64748B">Quốc tịch / Nationality</td><td style="padding:5px 0">${quoc_tich||'—'}</td></tr>
      <tr><td style="padding:5px 0;color:#64748B">Tiền đặt cọc / Deposit</td><td style="padding:5px 0;font-weight:700;color:#1A7A4A">${moneyStr(tienCoc)}</td></tr>
    </table>
  </div>

  <!-- KIỂM KÊ BẢNG -->
  <div style="background:#fff;padding:20px 24px;border:1px solid #e5e7eb;border-top:none">
    <h2 style="color:#1B4F8A;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #EBF2FA">
      ${bilingual?'Kiểm kê tình trạng / Condition Checklist':'Kiểm kê tình trạng hạng mục'}
    </h2>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#1B4F8A">
            <th style="padding:9px 6px;color:#fff;text-align:center;font-size:11px;width:36px">STT</th>
            <th style="padding:9px 6px;color:#fff;text-align:left;font-size:11px">Hạng mục</th>
            <th style="padding:9px 6px;color:#fff;text-align:center;font-size:11px;width:40px">SL</th>
            <th style="padding:9px 6px;color:#fff;text-align:left;font-size:11px;width:110px">Tình trạng</th>
            <th style="padding:9px 6px;color:#fff;text-align:left;font-size:11px">Ghi chú</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>

  <!-- CHỈ SỐ -->
  ${congTo?`<div style="background:#fff;padding:20px 24px;border:1px solid #e5e7eb;border-top:none">
    <h2 style="color:#1B4F8A;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #EBF2FA">
      ${bilingual?'Chỉ số công tơ / Utility Meters':'Chỉ số công tơ & Bàn giao'}
    </h2>
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <tr><td style="padding:5px 0;color:#64748B;width:160px">⚡ Điện / Electricity</td><td style="padding:5px 0;font-weight:600">${congTo.dien||'—'} kWh</td></tr>
      <tr><td style="padding:5px 0;color:#64748B">💧 Nước / Water</td><td style="padding:5px 0;font-weight:600">${congTo.nuoc||'—'} m³</td></tr>
      ${vatDung?`<tr><td style="padding:5px 0;color:#64748B">🗝 Chìa khóa / Keys</td><td style="padding:5px 0">${vatDung.chiaKhoa||'—'} chiếc</td></tr>
      <tr><td style="padding:5px 0;color:#64748B">💳 Thẻ từ / Cards</td><td style="padding:5px 0">${vatDung.theTu||'—'} thẻ</td></tr>
      <tr><td style="padding:5px 0;color:#64748B">📡 Remote</td><td style="padding:5px 0">${vatDung.remote||'—'} cái</td></tr>`:''}
    </table>
  </div>`:''}

  <!-- XÁC NHẬN -->
  <div style="background:#EBF2FA;padding:20px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px">
    <p style="font-size:14px;color:#1a2332;margin:0 0 10px;font-weight:600">
      ${bilingual?'Xác nhận / Confirmation:':'Xác nhận:'}
    </p>
    <p style="font-size:13px;color:#64748B;margin:0 0 12px;line-height:1.6">
      Vui lòng reply email này với nội dung xác nhận:<br>
      <strong style="color:#1B4F8A">"Tôi xác nhận đồng ý với những thông tin trong biên bản ${isCI?'check in':'check out'} trên."</strong>
    </p>
    ${bilingual?`<p style="font-size:13px;color:#64748B;margin:0;line-height:1.6">
      Please reply to this email to confirm:<br>
      <strong style="color:#1B4F8A">"I confirm and agree with the information in the ${isCI?'check-in':'check-out'} record above."</strong>
    </p>`:''}
  </div>

  <!-- FOOTER -->
  <div style="text-align:center;padding:16px;font-size:12px;color:#94A3B8">
    <p style="margin:0">📧 Email tự động từ hệ thống <strong>HCARE Bàn Giao</strong></p>
    <p style="margin:4px 0 0">Liên hệ: ${process.env.EMAIL_USER}</p>
  </div>
</div>
</body></html>`;
}

router.post('/gui-bien-ban', verifyToken, async (req, res) => {
  try {
    const { email_khach, ten_khach, ma_can, loai, ngay, hang_muc_list, tieu_de, congTo, vatDung, tienCoc, quoc_tich } = req.body;
    if (!email_khach) return res.status(400).json({ thanhCong: false, thongBao: 'Thiếu email khách' });

    const subject = tieu_de || `[HCARE] Biên Bản ${loai==='CHECKIN'?'Check In':'Check Out'} Căn Hộ ${ma_can} Ngày ${ngay}`;
    const html = buildEmailHTML({ ten_khach, ma_can, loai, ngay, hang_muc_list, congTo, vatDung, tienCoc, quoc_tich });

    await transporter.sendMail({
      from: `HCARE Bàn Giao <${process.env.EMAIL_USER}>`,
      to: email_khach,
      subject,
      html
    });

    res.json({ thanhCong: true, thongBao: `Đã gửi email tới ${email_khach}` });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ thanhCong: false, thongBao: 'Lỗi gửi email: ' + err.message });
  }
});

module.exports = router;
