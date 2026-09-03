#!/bin/bash
# HCARE Bàn Giao - Auto Backup Script
BACKUP_DIR="/root/hcare-bangiao/backups"
DB_PATH="/root/hcare-bangiao/backend/database/hcare-bangiao.db"
UPLOADS_DIR="/root/hcare-bangiao/backend/uploads"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

# Backup DB
if [ -f "$DB_PATH" ]; then
  cp "$DB_PATH" "$BACKUP_DIR/hcare-bangiao_${DATE}.db"
  echo "✅ DB backup: hcare-bangiao_${DATE}.db ($(du -sh $DB_PATH | cut -f1))"
fi

# Backup uploads (ảnh biên bản)
if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$BACKUP_DIR/uploads_${DATE}.tar.gz" -C "$UPLOADS_DIR" . 2>/dev/null
  echo "✅ Uploads backup: uploads_${DATE}.tar.gz ($(du -sh $UPLOADS_DIR | cut -f1))"
fi

# Xóa backup cũ hơn KEEP_DAYS ngày
find "$BACKUP_DIR" -name "*.db" -mtime +$KEEP_DAYS -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$KEEP_DAYS -delete

echo "🗂 Danh sách backup hiện tại:"
ls -lh "$BACKUP_DIR" | tail -10

echo "✅ Backup hoàn tất: $(date)"
