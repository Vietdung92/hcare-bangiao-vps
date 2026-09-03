const express = require('express');
const webpush = require('web-push');
const { getDB } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

router.post('/subscribe', verifyToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    const db = await getDB();
    await db.run(
      `INSERT OR REPLACE INTO push_subscription (ma_nv, subscription_json, ngay_cap_nhat) VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [req.user.ma_nv, JSON.stringify(subscription)]
    );
    res.json({ thanhCong: true });
  } catch (err) { res.status(500).json({ thanhCong: false }); }
});

router.post('/push-ql', verifyToken, async (req, res) => {
  try {
    const { title, body } = req.body;
    const db = await getDB();
    const qlList = await db.all(
      `SELECT ps.subscription_json FROM push_subscription ps
       JOIN nhan_vien nv ON ps.ma_nv = nv.ma_nv WHERE nv.vai_tro = 'QuanLy'`
    );
    const payload = JSON.stringify({ title, body });
    await Promise.all(qlList.map(async row => {
      try { await webpush.sendNotification(JSON.parse(row.subscription_json), payload); } catch(e) {}
    }));
    res.json({ thanhCong: true, sent: qlList.length });
  } catch (err) { res.status(500).json({ thanhCong: false }); }
});

router.post('/push-all', verifyToken, async (req, res) => {
  try {
    const { title, body } = req.body;
    const db = await getDB();
    const subs = await db.all('SELECT subscription_json FROM push_subscription');
    const payload = JSON.stringify({ title, body, url: '/bangiao/' });
    await Promise.all(subs.map(async s => {
      try { await webpush.sendNotification(JSON.parse(s.subscription_json), payload); } catch(e) {}
    }));
    res.json({ thanhCong: true });
  } catch(err) { res.status(500).json({ thanhCong: false }); }
});

router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC });
});

module.exports = router;
