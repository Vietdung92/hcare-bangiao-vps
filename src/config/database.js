const sqlite3 = require('sqlite3').verbose();
const sqlite = require('sqlite');
const path = require('path');
const fs = require('fs');

let db = null;

async function initDB() {
  try {
    const dbPath = path.join(__dirname, '../../database/hcare-bangiao.db');
    
    // Tạo thư mục database nếu chưa có
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = await sqlite.open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON');

    console.log('✅ Database connected:', dbPath);
    return db;
  } catch (err) {
    console.error('❌ Database error:', err);
    process.exit(1);
  }
}

async function getDB() {
  if (!db) {
    await initDB();
  }
  return db;
}

module.exports = { initDB, getDB };
