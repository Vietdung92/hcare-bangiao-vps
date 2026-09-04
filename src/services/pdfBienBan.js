const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.APP_URL || 'https://bangiao.hcarevietnam.vn';
const PDF_DIR = path.join(__dirname, '../../pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Doc anh tu dia -> base64 (nhanh, khong qua mang)
const imgData = (u) => {
  if (!u) return '';
  if (u.startsWith('data:')) return u;
  try {
    let name = u;
    if (name.startsWith('http')) name = new URL(name).pathname;
    const idx = name.lastIndexOf('/'); if (idx >= 0) name = name.slice(idx + 1);
    const fp = path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(fp)) return '';
    const ext = (path.extname(fp).slice(1) || 'jpeg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return 'data:' + mime + ';base64,' + fs.readFileSync(fp).toString('base64');
  } catch (e) { return ''; }
};

const stVN = (s) => s === 'TOT' ? 'Tốt' : s === 'XUOC' ? 'Trầy xước' : s === 'HONG' ? 'Hư hỏng' : 'Không có';
const stColor = (s) => s === 'TOT' ? '#1A7A4A' : s === 'XUOC' ? '#C0590A' : s === 'HONG' ? '#C0392B' : '#64748B';
const money = (n) => n ? Number(n).toLocaleString('vi-VN') + ' đ' : '—';
const dmy = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

function buildPdfHTML(b, du, hash) {
  let rows = '';
  let stt = 0;
  if (du.khuVuc) {
    for (const [kv, items] of Object.entries(du.khuVuc)) {
      rows += `<tr class="kv"><td colspan="5">${kv}</td></tr>`;
      (items || []).forEach(it => {
        stt++;
        const imgs = (it.photos || []).map(p =>
          `<img src="${imgData(p.url)}" class="thumb">`
        ).join('');
        rows += `<tr>
          <td class="c">${stt}</td>
          <td>${it.name || ''}</td>
          <td class="c" style="color:${stColor(it.status)};font-weight:600">${stVN(it.status)}</td>
          <td class="note">${it.ghi_chu || ''}</td>
          <td>${imgs || '<span class="muted">—</span>'}</td>
        </tr>`;
      });
    }
  }

  const sigImg = du.chuKy
    ? `<img src="${imgData(du.chuKy)}" class="sig">`
    : '<div class="sig-empty">Chưa ký</div>';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { size: A4; margin: 14mm 12mm 18mm 12mm; }
* { box-sizing: border-box; }
body { font-family: 'Liberation Sans', Arial, sans-serif; font-size: 10pt; color: #1a2332; margin: 0; }
.hdr { border-bottom: 3px solid #1B4F8A; padding-bottom: 10px; margin-bottom: 14px; }
.hdr .co { font-size: 16pt; font-weight: 700; color: #1B4F8A; }
.hdr .sub { font-size: 9pt; color: #64748B; margin-top: 2px; }
h1 { font-size: 13pt; text-align: center; margin: 14px 0 4px; text-transform: uppercase; color: #1B4F8A; }
.docno { text-align: center; font-size: 9pt; color: #64748B; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; }
.info td { padding: 5px 8px; border: 1px solid #CBD5E1; font-size: 9.5pt; }
.info td.lbl { background: #F1F5F9; color: #475569; width: 26%; }
.sec { font-size: 10.5pt; font-weight: 700; color: #1B4F8A; margin: 16px 0 6px; text-transform: uppercase; }
.items { border: 1px solid #CBD5E1; }
.items th { background: #1B4F8A; color: #fff; padding: 6px; font-size: 9pt; text-align: left; }
.items td { border-bottom: 1px solid #E2E8F0; padding: 5px 6px; font-size: 9pt; vertical-align: middle; }
.items tr.kv td { background: #EBF2FA; color: #1B4F8A; font-weight: 700; font-size: 9pt; }
.items td.c { text-align: center; }
.items td.note { font-size: 8.5pt; color: #64748B; max-width: 90px; }
.thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 3px; border: 1px solid #CBD5E1; margin: 1px; }
.muted { color: #94A3B8; }
.sigs { display: flex; gap: 16px; margin-top: 20px; page-break-inside: avoid; }
.sigbox { flex: 1; border: 1px solid #CBD5E1; border-radius: 4px; padding: 10px; text-align: center; }
.sigbox .role { font-size: 9pt; font-weight: 700; color: #475569; margin-bottom: 4px; }
.sigbox .hint { font-size: 8pt; color: #94A3B8; }
.sig { max-height: 70px; max-width: 100%; }
.sig-empty { height: 70px; line-height: 70px; color: #94A3B8; font-size: 9pt; }
.sigbox .nm { font-weight: 600; margin-top: 6px; font-size: 9.5pt; }
.legal { margin-top: 16px; padding: 8px 10px; background: #F8FAFC; border-left: 3px solid #1B4F8A; font-size: 8pt; color: #475569; line-height: 1.5; }
.hash { font-family: monospace; font-size: 7pt; word-break: break-all; color: #64748B; }
</style></head><body>
<div class="hdr">
  <div class="co">HCARE VIETNAM</div>
  <div class="sub">CÔNG TY TNHH TECHNOLOGY AND SERVICE HCARE · MST 319673225</div>
  <div class="sub">Số 8/8 Đường số 1, Khu Phố 1, Phường An Khánh, TP HCM</div>
</div>

<h1>Biên bản ${b.loai === 'CHECKIN' ? 'bàn giao nhận' : 'bàn giao trả'} căn hộ</h1>
<div class="docno">Số: ${b.ma_bb || b.id} · Ngày ${dmy(b.ngay_thuc_hien)}</div>

<table class="info">
  <tr><td class="lbl">Căn hộ</td><td><strong>${b.ma_can}</strong></td><td class="lbl">Số hợp đồng</td><td>${b.so_hd || '—'}</td></tr>
  <tr><td class="lbl">Khách thuê</td><td>${b.ten_khach}</td><td class="lbl">CCCD/Passport</td><td>${b.cccd || '—'}</td></tr>
  <tr><td class="lbl">Điện thoại</td><td>${b.sdt || '—'}</td><td class="lbl">Quốc tịch</td><td>${du.quocTich || b.quoc_tich || '—'}</td></tr>
  <tr><td class="lbl">Ngày thực hiện</td><td>${dmy(b.ngay_thuc_hien)}</td><td class="lbl">Ngày hết HĐ</td><td>${dmy(du.ngayHetHD)}</td></tr>
  <tr><td class="lbl">Tiền đặt cọc</td><td colspan="3" style="color:#1A7A4A;font-weight:700">${money(du.tienCoc)}</td></tr>
  <tr><td class="lbl">Chỉ số điện</td><td>${du.congTo?.dien || '—'} kWh</td><td class="lbl">Chỉ số nước</td><td>${du.congTo?.nuoc || '—'} m³</td></tr>
  <tr><td class="lbl">Chìa khóa</td><td>${du.vatDung?.chiaKhoa || '—'} chiếc</td><td class="lbl">Thẻ từ / xe</td><td>${du.vatDung?.theTu || '—'} thẻ</td></tr>
</table>

<div class="sec">Kiểm kê tình trạng</div>
<table class="items">
  <thead><tr><th style="width:6%">STT</th><th style="width:28%">Hạng mục</th><th style="width:14%">Tình trạng</th><th style="width:20%">Ghi chú</th><th>Hình ảnh</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

${du.ghiChu ? `<div class="sec">Ghi chú</div><div style="font-size:9.5pt">${du.ghiChu}</div>` : ''}

<div class="sigs">
  <div class="sigbox">
    <div class="role">ĐẠI DIỆN HCARE</div>
    <img src="data:image/webp;base64,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" class="sig" style="max-height:65px;max-width:180px;">
    <div class="nm">Bùi Viết Dũng</div>
    <div class="hint">Giám đốc</div>
  </div>
  <div class="sigbox">
    <div class="role">KHÁCH THUÊ</div>
    ${sigImg}
    <div class="nm">${b.ten_khach}</div>
    <div class="hint">${du.ngayKy ? 'Đã ký điện tử ngày ' + dmy(du.ngayKy) : 'Ký, ghi rõ họ tên'}</div>
  </div>
</div>

<div class="legal">
  <strong>Xác thực biên bản điện tử.</strong> Biên bản này được lập tự động bởi hệ thống HCARE Bàn Giao và gửi tới địa chỉ email của khách thuê. Mọi thay đổi nội dung sau khi phát hành sẽ làm sai lệch mã xác thực bên dưới. Nếu không nhận được phản hồi trong 48 giờ kể từ thời điểm gửi, biên bản được xem là đã được khách thuê xác nhận.
  <div style="margin-top:6px">Mã xác thực (SHA-256): <span class="hash">${hash}</span></div>
  <div>Thời điểm phát hành: ${new Date().toLocaleString('vi-VN')}</div>
</div>
</body></html>`;
}

async function taoPDF(b, du) {
  const html = buildPdfHTML(b, du, 'DANG_TINH');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
    let buf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="width:100%;font-size:7pt;color:#94A3B8;padding:0 12mm;font-family:Arial"><span style="float:left">HCARE Bàn Giao · bangiao.hcarevietnam.vn</span><span style="float:right">Trang <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>',
      margin: { top: '14mm', bottom: '18mm', left: '12mm', right: '12mm' }
    });

    const hash = crypto.createHash('sha256').update(buf).digest('hex');

    const html2 = buildPdfHTML(b, du, hash);
    await page.setContent(html2, { waitUntil: 'domcontentloaded', timeout: 30000 });
    buf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="width:100%;font-size:7pt;color:#94A3B8;padding:0 12mm;font-family:Arial"><span style="float:left">HCARE Bàn Giao · bangiao.hcarevietnam.vn</span><span style="float:right">Trang <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>',
      margin: { top: '14mm', bottom: '18mm', left: '12mm', right: '12mm' }
    });

    const finalHash = crypto.createHash('sha256').update(buf).digest('hex');
    const fname = `BienBan_${(b.ma_can || '').replace(/[^\w.-]/g, '')}_${b.id}_${Date.now()}.pdf`;
    const fpath = path.join(PDF_DIR, fname);
    fs.writeFileSync(fpath, buf);

    return { buffer: buf, hash: finalHash, filename: fname, filepath: fpath };
  } finally {
    await browser.close();
  }
}

module.exports = { taoPDF };
