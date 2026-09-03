const express = require('express');
const nodemailer = require('nodemailer');
const { getDB } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const stLabel = (s) => s === 'TOT' ? 'Tot' : s === 'XUOC' ? 'Tray xuoc' : s === 'HONG' ? 'Hu hong' : 'Khong co';
const stVN = (s) => s === 'TOT' ? '\u0054\u1ed1t' : s === 'XUOC' ? 'Tr\u1ea7y x\u01b0\u1edbc' : s === 'HONG' ? 'H\u01b0 h\u1ecfng' : 'Kh\u00f4ng c\u00f3';
const stColor = (s) => s === 'TOT' ? '#1A7A4A' : s === 'XUOC' ? '#C0590A' : s === 'HONG' ? '#C0392B' : '#64748B';
const money = (n) => n ? Number(n).toLocaleString('vi-VN') + ' d' : '-';
const dmy = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '-';

// Tach base64 thanh attachment CID
function extractSig(dataUri, cid) {
  if (!dataUri || !dataUri.startsWith('data:')) return null;
  const m = dataUri.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!m) return null;
  return {
    filename: cid + '.' + (m[1].split('/')[1] || 'png'),
    content: Buffer.from(m[2], 'base64'),
    contentType: m[1],
    cid: cid
  };
}

function buildHTML(b, du, hasSig) {
  let hm = '';
  if (du.khuVuc) {
    for (const [kv, items] of Object.entries(du.khuVuc)) {
      hm += '<tr><td colspan="3" style="background:#EBF2FA;color:#1B4F8A;font-weight:700;padding:8px 10px;font-size:13px">' + kv + '</td></tr>';
      (items || []).forEach(it => {
        const imgs = (it.photos || []).map(p =>
          '<img src="' + p.url + '" width="88" style="width:88px;height:88px;object-fit:cover;border-radius:4px;border:1px solid #ddd;margin:2px">'
        ).join('');
        hm += '<tr>'
          + '<td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px">' + (it.name || '') + '</td>'
          + '<td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:' + stColor(it.status) + ';font-weight:600;white-space:nowrap">' + stVN(it.status) + '</td>'
          + '<td style="padding:8px 10px;border-bottom:1px solid #eee">' + (imgs || '<span style="color:#94A3B8;font-size:12px">-</span>') + '</td>'
          + '</tr>';
      });
    }
  }

  const sigBlock = hasSig
    ? '<div style="margin-top:24px;border-top:2px solid #CBD5E1;padding-top:16px">'
      + '<div style="font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:8px">Ch\u1eef k\u00fd kh\u00e1ch thu\u00ea</div>'
      + '<img src="cid:chuky" style="max-width:260px;height:auto;border:1px solid #e5e7eb;border-radius:6px;background:#fff;padding:6px">'
      + '<div style="font-size:12px;color:#64748B;margin-top:6px">' + (b.ten_khach || '') + (du.ngayKy ? ' \u2014 ' + dmy(du.ngayKy) : '') + '</div>'
      + '</div>'
    : '';

  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;background:#fff">'
    + '<div style="background:#1B4F8A;color:#fff;padding:20px;text-align:center">'
    + '<div style="font-size:20px;font-weight:700">HCARE VIETNAM</div>'
    + '<div style="font-size:13px;opacity:.85;margin-top:4px">D\u1ecbch v\u1ee5 qu\u1ea3n l\u00fd c\u0103n h\u1ed9</div>'
    + '</div>'
    + '<div style="padding:20px">'
    + '<p style="font-size:14px">K\u00ednh g\u1eedi <strong>' + (b.ten_khach || '') + '</strong>,</p>'
    + '<p style="font-size:14px;line-height:1.6">HCARE xin g\u1eedi Qu\u00fd kh\u00e1ch bi\u00ean b\u1ea3n '
    + (b.loai === 'CHECKIN' ? 'nh\u1eadn b\u00e0n giao' : 'tr\u1ea3') + ' c\u0103n h\u1ed9 <strong>' + b.ma_can
    + '</strong> ng\u00e0y <strong>' + dmy(b.ngay_thuc_hien) + '</strong>. Vui l\u00f2ng ki\u1ec3m tra v\u00e0 ph\u1ea3n h\u1ed3i email n\u00e0y n\u1ebfu c\u00f3 sai s\u00f3t.</p>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #CBD5E1;border-radius:6px;margin:16px 0;font-size:13px">'
    + '<tr><td style="padding:8px 10px;color:#64748B;width:150px">C\u0103n h\u1ed9</td><td style="padding:8px 10px;font-weight:600">' + b.ma_can + '</td></tr>'
    + '<tr><td style="padding:8px 10px;color:#64748B">S\u1ed1 h\u1ee3p \u0111\u1ed3ng</td><td style="padding:8px 10px">' + (b.so_hd || '-') + '</td></tr>'
    + '<tr><td style="padding:8px 10px;color:#64748B">CCCD / Passport</td><td style="padding:8px 10px">' + (b.cccd || '-') + '</td></tr>'
    + '<tr><td style="padding:8px 10px;color:#64748B">Ng\u00e0y th\u1ef1c hi\u1ec7n</td><td style="padding:8px 10px">' + dmy(b.ngay_thuc_hien) + '</td></tr>'
    + '<tr><td style="padding:8px 10px;color:#64748B">Ng\u00e0y h\u1ebft H\u0110</td><td style="padding:8px 10px">' + dmy(du.ngayHetHD) + '</td></tr>'
    + '<tr><td style="padding:8px 10px;color:#64748B">Ti\u1ec1n \u0111\u1eb7t c\u1ecdc</td><td style="padding:8px 10px;color:#1A7A4A;font-weight:700">' + money(du.tienCoc) + '</td></tr>'
    + '<tr><td style="padding:8px 10px;color:#64748B">Ch\u1ec9 s\u1ed1 \u0111i\u1ec7n</td><td style="padding:8px 10px">' + (du.congTo?.dien || '-') + ' kWh</td></tr>'
    + '<tr><td style="padding:8px 10px;color:#64748B">Ch\u1ec9 s\u1ed1 n\u01b0\u1edbc</td><td style="padding:8px 10px">' + (du.congTo?.nuoc || '-') + ' m3</td></tr>'
    + '<tr><td style="padding:8px 10px;color:#64748B">Ch\u00eca kh\u00f3a</td><td style="padding:8px 10px">' + (du.vatDung?.chiaKhoa || '-') + ' chi\u1ebfc</td></tr>'
    + '<tr><td style="padding:8px 10px;color:#64748B">Th\u1ebb t\u1eeb / xe</td><td style="padding:8px 10px">' + (du.vatDung?.theTu || '-') + ' th\u1ebb</td></tr>'
    + '</table>'
    + '<div style="font-size:14px;font-weight:700;color:#1B4F8A;margin:20px 0 8px">KI\u1ec2M K\u00ca T\u00ccNH TR\u1ea0NG</div>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #CBD5E1;border-collapse:collapse">'
    + '<tr style="background:#F1F5F9"><th align="left" style="padding:8px 10px;font-size:12px">H\u1ea1ng m\u1ee5c</th><th align="left" style="padding:8px 10px;font-size:12px">T\u00ecnh tr\u1ea1ng</th><th align="left" style="padding:8px 10px;font-size:12px">H\u00ecnh \u1ea3nh</th></tr>'
    + hm
    + '</table>'
    + (du.ghiChu ? '<p style="font-size:13px;margin-top:14px"><strong>Ghi ch\u00fa:</strong> ' + du.ghiChu + '</p>' : '')
    + sigBlock
    + '<p style="font-size:13px;color:#64748B;margin-top:20px;line-height:1.6">N\u1ebfu kh\u00f4ng c\u00f3 ph\u1ea3n h\u1ed3i trong 48 gi\u1edd, bi\u00ean b\u1ea3n \u0111\u01b0\u1ee3c xem l\u00e0 \u0111\u00e3 \u0111\u01b0\u1ee3c Qu\u00fd kh\u00e1ch x\u00e1c nh\u1eadn.</p>'
    + '<p style="font-size:13px;margin-top:16px">Tr\u00e2n tr\u1ecdng,<br><strong>HCARE VIETNAM</strong><br>hcarevietnam.info@gmail.com</p>'
    + '</div></div>';
}

// Gui bien ban - chi can bien_ban_id
router.post('/gui-bien-ban', verifyToken, async (req, res) => {
  try {
    const { bien_ban_id, tieu_de, email_khach } = req.body;
    if (!bien_ban_id) return res.status(400).json({ thanhCong: false, thongBao: 'Thieu bien_ban_id' });

    const db = await getDB();
    const b = await db.get('SELECT * FROM bien_ban WHERE id = ?', [bien_ban_id]);
    if (!b) return res.status(404).json({ thanhCong: false, thongBao: 'Khong tim thay bien ban' });

    let du = {};
    try { du = typeof b.du_lieu_json === 'string' ? JSON.parse(b.du_lieu_json) : (b.du_lieu_json || {}); } catch (e) {}

    const to = email_khach || du.emailKhach;
    if (!to) return res.status(400).json({ thanhCong: false, thongBao: 'Bien ban khong co email khach' });

    const sig = extractSig(du.chuKy, 'chuky');
    const attachments = sig ? [sig] : [];

    const ngay = dmy(b.ngay_thuc_hien);
    const loaiTxt = b.loai === 'CHECKIN' ? 'Check In' : 'Check Out';
    const subject = tieu_de || (du.isUpdate
      ? `Update Tinh Trang ${loaiTxt} Can Ho ${b.ma_can} Ngay ${ngay}`
      : `Bien Ban ${loaiTxt} Can Ho ${b.ma_can} Ngay ${ngay}`);

    await transporter.sendMail({
      from: `"HCARE Vietnam" <${process.env.EMAIL_USER}>`,
      to,
      bcc: process.env.EMAIL_USER,
      subject,
      html: buildHTML(b, du, !!sig),
      attachments
    });

    res.json({ thanhCong: true, thongBao: 'Da gui email cho khach', email: to, coChuKy: !!sig });
  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ thanhCong: false, thongBao: 'Loi gui email: ' + err.message });
  }
});

router.get('/test', verifyToken, async (req, res) => {
  try {
    await transporter.verify();
    res.json({ thanhCong: true, thongBao: 'Ket noi Gmail OK', user: process.env.EMAIL_USER });
  } catch (err) {
    res.status(500).json({ thanhCong: false, thongBao: err.message });
  }
});

module.exports = router;
