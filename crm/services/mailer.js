// ─── SERVICIO DE EMAIL ────────────────────────────────────────────────────────

const nodemailer = require('nodemailer');

const BASE_URL = process.env.APP_URL || 'https://rafaelscalpartist-production.up.railway.app';
const NOTIFY_TO = 'rafaelscalpartist@gmail.com';

function createTransport() {
  // Gmail via OAuth o App Password. En Railway configurar:
  // GMAIL_USER=rafaelscalpartist@gmail.com
  // GMAIL_PASS=<app-password-16-chars>
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}

async function sendHotLeadEmail({ name, phone, lastMessage, clientId }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.log('[Mailer] Sin credenciales Gmail — email no enviado');
    return;
  }

  const displayName = name !== phone ? name : 'Desconocido';
  const fichaUrl = `${BASE_URL}/#client-${clientId}`;

  const html = `
    <div style="font-family:sans-serif;max-width:500px">
      <h2 style="color:#e05555">🔥 Lead Caliente detectado</h2>
      <p><strong>Nombre:</strong> ${displayName}</p>
      <p><strong>Teléfono:</strong> <a href="https://wa.me/${phone.replace('+','')}">${phone}</a></p>
      <p><strong>Último mensaje:</strong><br>
        <em style="color:#555">"${lastMessage}"</em></p>
      <hr>
      <p>
        <a href="${fichaUrl}" style="background:#57C84D;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
          Ver ficha del lead →
        </a>
      </p>
    </div>
  `;

  const transporter = createTransport();
  await transporter.sendMail({
    from: `"Rafael Scalp CRM" <${process.env.GMAIL_USER}>`,
    to: NOTIFY_TO,
    subject: `🔥 Lead caliente: ${displayName}`,
    html,
  });

  console.log(`[Mailer] Email enviado para lead caliente: ${displayName}`);
}

module.exports = { sendHotLeadEmail };
