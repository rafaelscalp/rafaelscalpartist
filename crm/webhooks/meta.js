// FASE 2 — Webhook Meta Lead Ads
// Este archivo recibirá leads en tiempo real desde Meta.
// Pendiente de implementación en Fase 2.

const express = require('express');
const router = express.Router();

router.get('/meta', (req, res) => {
  // Verificación del webhook (Meta requiere esto al registrar el endpoint)
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'scalp_verify_2024';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook Meta verificado');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

router.post('/meta', (req, res) => {
  // TODO Fase 2: procesar lead y crear cliente automáticamente
  console.log('📥 Lead recibido de Meta:', JSON.stringify(req.body));
  res.sendStatus(200);
});

module.exports = router;
