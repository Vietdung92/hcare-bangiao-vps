const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.APP_URL || 'https://bangiao.hcarevietnam.vn';
const PDF_DIR = path.join(__dirname, '../../pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Nen anh xuong 400px, chat luong 60% de PDF nhe
const sharp = require('sharp');
const anhCache = {};
async function nenAnh(fp) {
  if (anhCache[fp]) return anhCache[fp];
  try {
    const buf = await sharp(fp).resize(150, 150, {fit:'inside', withoutEnlargement:true}).jpeg({quality:50}).toBuffer();
    const uri = 'data:image/jpeg;base64,' + buf.toString('base64');
    anhCache[fp] = uri;
    return uri;
  } catch(e) { return ''; }
}

// Doc chu ky Giam doc tu disk (moi lan tao PDF)
function getChuKyGD() {
  try {
    const f = path.join(UPLOAD_DIR, 'chu-ky-giam-doc.png');
    if (!fs.existsSync(f)) return '';
    return 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  } catch (e) { return ''; }
}

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

async function buildPdfHTML(b, du, hash) {
  let rows = '';
  let stt = 0;
  if (du.khuVuc) {
    for (const [kv, items] of Object.entries(du.khuVuc)) {
      rows += `<tr class="kv"><td colspan="5">${kv}</td></tr>`;
      for (const it of (items || [])) {
        stt++;
        let imgs = '';
        for (const ph of (it.photos || [])) {
          let nm = ph.url || '';
          const ix = nm.lastIndexOf('/'); if (ix >= 0) nm = nm.slice(ix + 1);
          const fp = path.join(UPLOAD_DIR, nm);
          if (fs.existsSync(fp)) {
            const uri = await nenAnh(fp);
            if (uri) imgs += `<a href="${BASE_URL}/uploads/${nm}"><img src="${uri}" class="thumb"></a>`;
          }
        }
        rows += `<tr>
          <td class="c">${stt}</td>
          <td>${it.name || ''}</td>
          <td class="c" style="color:${stColor(it.status)};font-weight:600">${stVN(it.status)}</td>
          <td class="note">${it.ghi_chu || ''}</td>
          <td>${imgs || '<span class="muted">—</span>'}</td>
        </tr>`;
      }
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
.thumb { width: 46px; height: 46px; object-fit: cover; border-radius: 3px; border: 1px solid #CBD5E1; margin: 1px; }
.muted { color: #94A3B8; }
.sigs { display: flex; gap: 16px; margin-top: 20px; page-break-inside: avoid; }
.sigbox { flex: 1; border: 1px solid #CBD5E1; border-radius: 4px; padding: 10px; text-align: center; }
.sigbox .role { font-size: 9pt; font-weight: 700; color: #475569; margin-bottom: 4px; }
.sigbox .hint { font-size: 8pt; color: #94A3B8; }
.sig { max-height: 70px; max-width: 100%; mix-blend-mode: multiply; filter: contrast(1.5) brightness(0.85); }
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
    <img src="${b.chu_ky_nv || b.chu_ky_ql || getChuKyGD()}" class="sig" style="max-height:65px;max-width:180px;">
    <div class="nm">${b.ten_nv_ky || b.ten_ql || b.nhan_vien || ''}</div>
    <div class="hint">${b.ngay_ky_ql ? 'Đã ký điện tử ' + dmy(b.ngay_ky_ql) : 'Ký, ghi rõ họ tên'}</div>
  </div>
  <div class="sigbox">
    <div class="role">KHÁCH THUÊ</div>
    ${sigImg}
    <div class="nm">${b.ten_khach}</div>
    <div class="hint">${du.ngayKy ? 'Đã ký điện tử ngày ' + dmy(du.ngayKy) : 'Ký, ghi rõ họ tên'}</div>
  </div>
</div>

<div class="legal">
  <strong>Ảnh trong biên bản.</strong> Hình ảnh hiển thị ở dạng thu nhỏ. Bấm vào ảnh (khi mở trên máy tính/điện thoại có mạng) để xem ảnh gốc chất lượng cao.<br><br><strong>Xác thực biên bản điện tử.</strong> Biên bản này được lập tự động bởi hệ thống HCARE Bàn Giao và gửi tới địa chỉ email của khách thuê. Mọi thay đổi nội dung sau khi phát hành sẽ làm sai lệch mã xác thực bên dưới. Nếu không nhận được phản hồi trong 48 giờ kể từ thời điểm gửi, biên bản được xem là đã được khách thuê xác nhận.
  <div style="margin-top:6px">Mã xác thực (SHA-256): <span class="hash">${hash}</span></div>
  <div>Thời điểm phát hành: ${new Date().toLocaleString('vi-VN')}</div>
</div>
</body></html>`;
}

async function taoPDF(b, du) {
  const html = await buildPdfHTML(b, du, 'DANG_TINH');
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

    const html2 = await buildPdfHTML(b, du, hash);
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
