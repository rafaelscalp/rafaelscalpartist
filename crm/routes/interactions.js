const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

// Agregar interacción a un cliente
router.post('/:clientId', (req, res) => {
  try {
    const { type, direction, content } = req.body;
    if (!content) return res.status(400).json({ ok: false, error: 'El contenido es obligatorio' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO interactions (id, client_id, type, direction, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, req.params.clientId, type || 'Nota', direction || 'Interno', content);

    const interaction = db.prepare(`SELECT * FROM interactions WHERE id = ?`).get(id);
    res.status(201).json({ ok: true, data: interaction });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Eliminar interacción
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare(`DELETE FROM interactions WHERE id = ?`).run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Interacción no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Agregar sesión
router.post('/:clientId/sessions', (req, res) => {
  try {
    const { date, type, price, paid, notes } = req.body;
    if (!date) return res.status(400).json({ ok: false, error: 'La fecha es obligatoria' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO sessions (id, client_id, date, type, price, paid, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.clientId, date, type || 'Sesión inicial', price || null, paid ? 1 : 0, notes || '');

    // Interacción automática
    db.prepare(`
      INSERT INTO interactions (id, client_id, type, direction, content)
      VALUES (?, ?, 'Sistema', 'Interno', ?)
    `).run(uuidv4(), req.params.clientId, `Sesión registrada: ${type || 'Sesión inicial'} el ${date}. Precio: $${price || 0}.`);

    const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
    res.status(201).json({ ok: true, data: session });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
