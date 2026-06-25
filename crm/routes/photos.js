const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes'));
    }
    cb(null, true);
  },
});

// Subir foto
router.post('/:clientId', upload.single('photo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió ninguna imagen' });

    const id = uuidv4();
    const { type } = req.body;

    db.prepare(`
      INSERT INTO photos (id, client_id, filename, type)
      VALUES (?, ?, ?, ?)
    `).run(id, req.params.clientId, req.file.filename, type || 'Antes');

    db.prepare(`
      INSERT INTO interactions (id, client_id, type, direction, content)
      VALUES (?, ?, 'Sistema', 'Interno', ?)
    `).run(uuidv4(), req.params.clientId, `Foto subida: ${type || 'Antes'}.`);

    res.status(201).json({ ok: true, data: { id, filename: req.file.filename, type: type || 'Antes' } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Eliminar foto
router.delete('/:id', (req, res) => {
  try {
    const photo = db.prepare(`SELECT * FROM photos WHERE id = ?`).get(req.params.id);
    if (!photo) return res.status(404).json({ ok: false, error: 'Foto no encontrada' });

    const filePath = path.join(UPLOADS_DIR, photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    db.prepare(`DELETE FROM photos WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
