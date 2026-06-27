try { require('dotenv').config(); } catch(e) {}
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ─── RUTAS API ───────────────────────────────────────────────────────────────
app.use('/api/leads',          require('./routes/leads'));
app.use('/api/interactions',   require('./routes/interactions'));
app.use('/api/export',         require('./routes/export'));
app.use('/api/photos',         require('./routes/photos'));
app.use('/api/conversations',  require('./routes/conversations'));

// ─── WEBHOOKS ────────────────────────────────────────────────────────────────
app.use('/webhooks',           require('./webhooks/meta'));
app.use('/webhooks/whatsapp',  require('./webhooks/whatsapp'));

// Cualquier otra ruta devuelve el frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Rafael Scalp CRM corriendo en http://localhost:${PORT}\n`);

  // Iniciar cron de seguimientos automáticos
  try {
    const { startFollowupCron } = require('./services/followup');
    startFollowupCron();
  } catch (err) {
    console.error('[Cron] No se pudo iniciar:', err.message);
  }
});
