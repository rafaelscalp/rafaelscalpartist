const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'scalp_verify_2024';
const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || '';

// ─── VERIFICACIÓN DEL WEBHOOK (Meta lo llama una vez al registrarlo) ──────────
router.get('/meta', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook Meta verificado correctamente');
    return res.status(200).send(challenge);
  }
  console.warn('⚠️  Verificación fallida — token incorrecto');
  res.sendStatus(403);
});

// ─── RECEPCIÓN DE LEADS EN TIEMPO REAL ───────────────────────────────────────
router.post('/meta', async (req, res) => {
  // Meta espera respuesta 200 inmediata
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'page') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;

        const leadgenId  = change.value.leadgen_id;
        const adId       = change.value.ad_id;
        const campaignId = change.value.campaign_id;
        const adsetId    = change.value.adset_id;
        const formId     = change.value.form_id;

        console.log(`📥 Lead recibido de Meta — ID: ${leadgenId}`);

        // Obtener datos completos del lead desde la Graph API
        const leadData = await fetchLeadData(leadgenId);
        if (!leadData) continue;

        // Guardar en la base de datos
        await processLead(leadData, { adId, campaignId, adsetId, formId });
      }
    }
  } catch (err) {
    console.error('Error procesando webhook Meta:', err.message);
  }
});

// ─── OBTENER DATOS DEL LEAD VÍA GRAPH API ────────────────────────────────────
async function fetchLeadData(leadgenId) {
  if (!PAGE_ACCESS_TOKEN) {
    console.warn('⚠️  META_PAGE_ACCESS_TOKEN no configurado');
    return null;
  }

  const url = `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data,ad_id,campaign_id,adset_id,adset_name,campaign_name,ad_name,form_id,created_time&access_token=${PAGE_ACCESS_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error('Error Graph API:', await res.text());
    return null;
  }
  return res.json();
}

// ─── PROCESAR Y GUARDAR EL LEAD ───────────────────────────────────────────────
async function processLead(leadData, meta) {
  // Extraer campos del formulario
  const fields = {};
  for (const f of leadData.field_data || []) {
    fields[f.name] = f.values?.[0] || '';
  }

  // Mapeo de campos comunes de formularios Meta
  const name  = fields['full_name']    || fields['nombre']       || fields['name']  || 'Sin nombre';
  const phone = fields['phone_number'] || fields['telefono']     || fields['phone'] || '';
  const email = fields['email']        || fields['correo']       || '';
  const notes = fields['comments']     || fields['consulta']     || fields['message'] || '';

  const campaignName = leadData.campaign_name || meta.campaignId || '';

  // Verificar si el lead ya existe (por leadgen_id)
  const existing = db.prepare('SELECT id FROM meta_leads WHERE id = ?').get(leadData.id);
  if (existing) {
    console.log(`⚠️  Lead ${leadData.id} ya procesado, ignorando`);
    return;
  }

  // Crear cliente en el CRM
  const clientId = uuidv4();
  db.prepare(`
    INSERT INTO clients (id, name, phone, email, origin, campaign, ad_id, stage, temperature, notes)
    VALUES (?, ?, ?, ?, 'Meta', ?, ?, 'Nuevo', 'Tibio', ?)
  `).run(clientId, name, phone, email, campaignName, meta.adId || '', notes);

  // Registrar el lead de Meta
  db.prepare(`
    INSERT INTO meta_leads (id, client_id, form_id, ad_id, campaign_id, campaign_name, adset_name, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    leadData.id,
    clientId,
    meta.formId || '',
    meta.adId || '',
    meta.campaignId || '',
    leadData.campaign_name || '',
    leadData.adset_name || '',
    JSON.stringify(leadData)
  );

  // Interacción automática de sistema
  db.prepare(`
    INSERT INTO interactions (id, client_id, type, direction, content)
    VALUES (?, ?, 'Sistema', 'Interno', ?)
  `).run(uuidv4(), clientId, `Lead recibido automáticamente desde Meta Ads. Campaña: "${campaignName}". Formulario ID: ${meta.formId || 'N/A'}.`);

  console.log(`✅ Lead guardado: ${name} (${phone}) — Campaña: ${campaignName}`);
}

module.exports = router;
