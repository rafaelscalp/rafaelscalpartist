try { require('dotenv').config(); } catch(e) {}
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));
// Fotos subidas
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ─── RUTAS API ───────────────────────────────────────────────────────────────
app.use('/api/leads',        require('./routes/leads'));
app.use('/api/interactions', require('./routes/interactions'));
app.use('/api/export',       require('./routes/export'));
app.use('/api/photos',       require('./routes/photos'));
app.use('/webhooks',         require('./webhooks/meta'));

// Cualquier otra ruta devuelve el frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Rafael Scalp CRM corriendo en http://localhost:${PORT}\n`);
});
