// ─── CLIENTES LIST + MODALES ──────────────────────────────────────────────────

let clientsData = [];
let currentClientId = null;
let currentClientData = null;

// ─── LISTA ────────────────────────────────────────────────────────────────────

async function loadClients(params = {}) {
  try {
    clientsData = await api.leads.list(params);
    renderClientsList();
  } catch (err) {
    toast('Error cargando clientes', 'error');
  }
}

function renderClientsList() {
  const grid = document.getElementById('clients-grid');
  if (!clientsData.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">👤</div><p>No hay clientes que coincidan.</p>
    </div>`;
    return;
  }
  grid.innerHTML = clientsData.map(c => `
    <div class="client-card" onclick="openClientDetail('${c.id}')">
      <div class="cc-actions">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();openEditModal('${c.id}')">✏️</button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();deleteClient('${c.id}')">🗑</button>
      </div>
      <div class="cc-name">${c.name}</div>
      <div class="cc-phone">${c.phone || 'Sin teléfono'} ${c.email ? '· '+c.email : ''}</div>
      <div class="cc-meta">
        ${tempBadge(c.temperature)}
        <span class="badge badge-origin">${c.origin}</span>
        <span class="badge badge-stage">${c.stage}</span>
      </div>
      ${c.total_paid ? `<div style="font-size:12px;color:var(--accent);margin-bottom:6px">Cobrado: ${fmtCurrency(c.total_paid)}</div>` : ''}
      <div class="cc-date">Ingresó ${timeAgo(c.created_at)} · ${c.interaction_count || 0} interacciones</div>
    </div>
  `).join('');
}

function applyClientsFilters() {
  const params = {};
  const stage  = document.getElementById('filter-stage').value;
  const origin = document.getElementById('filter-origin').value;
  const temp   = document.getElementById('filter-temp').value;
  const from   = document.getElementById('filter-from').value;
  const to     = document.getElementById('filter-to').value;
  const search = document.getElementById('global-search').value;
  if (stage)  params.stage = stage;
  if (origin) params.origin = origin;
  if (temp)   params.temperature = temp;
  if (from)   params.from = from;
  if (to)     params.to = to;
  if (search) params.search = search;
  loadClients(params);
}

// ─── MODAL CREAR / EDITAR ─────────────────────────────────────────────────────

function openCreateModal() {
  currentClientId = null;
  document.getElementById('modal-form-title').textContent = 'Nuevo lead';
  document.getElementById('client-form').reset();
  toggleMetaFields('Otro');
  document.getElementById('modal-form').classList.add('open');
}

async function openEditModal(id) {
  currentClientId = id;
  document.getElementById('modal-form-title').textContent = 'Editar cliente';
  try {
    const c = await api.leads.get(id);
    const f = document.getElementById('client-form');
    f.elements['name'].value            = c.name || '';
    f.elements['phone'].value           = c.phone || '';
    f.elements['email'].value           = c.email || '';
    f.elements['origin'].value          = c.origin || 'Otro';
    f.elements['campaign'].value        = c.campaign || '';
    f.elements['adset'].value           = c.adset || '';
    f.elements['ad_name'].value         = c.ad_name || '';
    f.elements['stage'].value           = c.stage || 'Nuevo';
    f.elements['temperature'].value     = c.temperature || 'Tibio';
    f.elements['budget'].value          = c.budget || '';
    f.elements['next_touch'].value      = c.next_touch || '';
    f.elements['initial_message'].value = c.initial_message || '';
    f.elements['notes'].value           = c.notes || '';
    toggleMetaFields(c.origin);
    document.getElementById('modal-form').classList.add('open');
  } catch (err) {
    toast('Error cargando datos', 'error');
  }
}

function toggleMetaFields(origin) {
  const show = origin === 'Meta';
  document.getElementById('meta-extra-fields').classList.toggle('visible', show);
  document.getElementById('meta-extra-fields-2').classList.toggle('visible', show);
}

function closeFormModal() {
  document.getElementById('modal-form').classList.remove('open');
  currentClientId = null;
}

async function submitClientForm(e) {
  e.preventDefault();
  const f = e.target;

  // Validación de teléfono
  const phone = f.elements['phone'].value.trim();
  const digits = phone.replace(/\D/g, '');
  if (!phone) return toast('El teléfono es obligatorio', 'error');
  if (digits.length < 8) return toast('El teléfono debe tener al menos 8 dígitos', 'error');

  const data = {
    name:            f.elements['name'].value.trim(),
    phone,
    email:           f.elements['email'].value.trim(),
    origin:          f.elements['origin'].value,
    campaign:        f.elements['campaign'].value.trim(),
    adset:           f.elements['adset'].value.trim(),
    ad_name:         f.elements['ad_name'].value.trim(),
    stage:           f.elements['stage'].value,
    temperature:     f.elements['temperature'].value,
    budget:          parseFloat(f.elements['budget'].value) || null,
    next_touch:      f.elements['next_touch'].value || null,
    initial_message: f.elements['initial_message'].value.trim() || null,
    notes:           f.elements['notes'].value.trim(),
  };

  try {
    if (currentClientId) {
      await api.leads.update(currentClientId, data);
      toast('Cliente actualizado', 'success');
    } else {
      await api.leads.create(data);
      toast('Lead creado', 'success');
    }
    closeFormModal();
    loadClients();
    loadPipeline();
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteClient(id) {
  if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return;
  try {
    await api.leads.delete(id);
    toast('Cliente eliminado', 'success');
    loadClients(); loadPipeline(); loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ─── DETALLE ──────────────────────────────────────────────────────────────────

async function openClientDetail(id) {
  try {
    const c = await api.leads.get(id);
    currentClientId = id;
    currentClientData = c;
    renderDetailModal(c);
    document.getElementById('modal-detail').classList.add('open');
    return c;
  } catch (err) {
    toast('Error cargando cliente', 'error');
  }
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.remove('open');
}

function renderDetailModal(c) {
  document.getElementById('detail-avatar').textContent = initials(c.name);
  document.getElementById('detail-name').textContent   = c.name;
  document.getElementById('detail-sub').textContent    =
    [c.phone, c.email].filter(Boolean).join(' · ') || 'Sin contacto';

  document.getElementById('detail-badges').innerHTML = `
    ${tempBadge(c.temperature)}
    <span class="badge badge-origin">${c.origin}</span>
    <span class="badge badge-stage">${c.stage}</span>
    ${c.campaign ? `<span class="badge" style="background:var(--bg-elevated);color:var(--text-muted)">📣 ${c.campaign}</span>` : ''}
  `;

  document.getElementById('detail-edit-btn').onclick   = () => { closeDetailModal(); openEditModal(c.id); };
  document.getElementById('detail-delete-btn').onclick = () => { closeDetailModal(); deleteClient(c.id); };

  renderInfoPanel(c);
  renderTimelinePanel(c);
  renderSessionsPanel(c);
  renderPhotosPanel(c);

  activateTab('info');
}

function renderInfoPanel(c) {
  const lastContact = c.last_contact_at
    ? `${fmtDateTime(c.last_contact_at)} (${timeAgo(c.last_contact_at)})`
    : `Nunca (ingresó ${timeAgo(c.created_at)})`;

  document.getElementById('panel-info').innerHTML = `
    <div class="info-grid" style="margin-bottom:16px">
      <div class="info-item"><div class="lbl">Nombre</div><div class="val">${c.name}</div></div>
      <div class="info-item"><div class="lbl">Teléfono</div><div class="val">${c.phone || '—'}
        ${c.phone ? `<a href="https://wa.me/${c.phone.replace(/\D/g,'')}" target="_blank" style="color:var(--accent);margin-left:8px;font-size:12px">WhatsApp ↗</a>` : ''}
      </div></div>
      <div class="info-item"><div class="lbl">Email</div><div class="val">${c.email || '—'}</div></div>
      <div class="info-item"><div class="lbl">Origen</div><div class="val">${c.origin}${c.campaign ? ` · ${c.campaign}` : ''}</div></div>
      <div class="info-item"><div class="lbl">Presupuesto</div><div class="val text-accent">${fmtCurrency(c.budget)}</div></div>
      <div class="info-item"><div class="lbl">Último contacto</div><div class="val" style="color:${!c.last_contact_at ? 'var(--warning)' : 'inherit'}">${lastContact}</div></div>
      <div class="info-item"><div class="lbl">Fecha de ingreso</div><div class="val">${fmtDateTime(c.created_at)}</div></div>
      <div class="info-item"><div class="lbl">Próximo contacto</div><div class="val">${c.next_touch ? fmtDate(c.next_touch) : '—'}</div></div>
      <div class="info-item"><div class="lbl">Fecha de retoque</div><div class="val">
        ${c.next_retoque ? fmtDate(c.next_retoque) : '—'}
        ${c.stage === 'Cliente activo' ? `<button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="editRetoque('${c.id}','${c.next_retoque||''}')">✏️</button>` : ''}
      </div></div>
      ${c.loss_reason ? `<div class="info-item"><div class="lbl">Motivo de pérdida</div><div class="val" style="color:var(--danger)">${c.loss_reason}</div></div>` : ''}
      <div class="info-item" style="grid-column:1/-1"><div class="lbl">Notas</div>
        <div class="val" style="color:var(--text-secondary);white-space:pre-wrap">${c.notes || '—'}</div>
      </div>
    </div>

    <div style="margin-bottom:16px">
      <div class="section-title">Cambiar etapa</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${['Nuevo','Contactado','Presupuestado','Sesión agendada','Cliente activo','Perdido'].map(s =>
          `<button class="btn btn-sm ${s === c.stage ? 'btn-primary' : 'btn-secondary'}"
            onclick="changeStage('${c.id}','${s}')">${s}</button>`
        ).join('')}
      </div>
    </div>

    <div>
      <div class="section-title">Temperatura</div>
      <div style="display:flex;gap:8px">
        ${['Caliente','Tibio','Frío'].map(t =>
          `<button class="btn btn-sm ${t === c.temperature ? 'btn-primary' : 'btn-secondary'}"
            onclick="changeTemp('${c.id}','${t}')">${t}</button>`
        ).join('')}
      </div>
    </div>
  `;
}

function renderTimelinePanel(c) {
  const interactions = c.interactions || [];
  const addForm = `
    <div class="card" style="margin-bottom:16px">
      <div class="section-title">Agregar interacción</div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <select id="new-int-type" class="form-select" style="flex:1;min-width:120px">
          <option>Nota</option><option>Llamada</option><option>WhatsApp</option><option>Email</option><option>Visita</option>
        </select>
        <select id="new-int-dir" class="form-select" style="flex:1;min-width:120px">
          <option value="Interno">Interno</option><option value="Entrante">Entrante</option><option value="Saliente">Saliente</option>
        </select>
      </div>
      <textarea id="new-int-content" class="form-textarea" style="margin-top:8px" placeholder="Escribe la nota o descripción..."></textarea>
      <div style="margin-top:8px;text-align:right">
        <button class="btn btn-primary btn-sm" onclick="addInteraction('${c.id}')">Guardar</button>
      </div>
    </div>
  `;

  // Mensaje inicial destacado
  const initialMsg = c.initial_message ? `
    <div class="initial-message-box">
      <div class="lbl">💬 Mensaje inicial del cliente</div>
      <div class="msg">${c.initial_message}</div>
    </div>
  ` : '';

  const timeline = interactions.length ? interactions.map(i => `
    <div class="timeline-item">
      <div class="timeline-dot">${interactionIcon(i.type)}</div>
      <div class="timeline-content">
        <div class="timeline-type">${i.type} · ${i.direction}</div>
        <div class="timeline-text">${i.content}</div>
        <div class="timeline-date">${fmtDateTime(i.created_at)}</div>
      </div>
    </div>
  `).join('') : '<div class="empty-state"><p>Sin interacciones aún.</p></div>';

  document.getElementById('panel-timeline').innerHTML = addForm + initialMsg + `<div class="timeline">${timeline}</div>`;
}

function renderSessionsPanel(c) {
  const sessions = c.sessions || [];
  const addForm = `
    <div class="card" style="margin-bottom:16px">
      <div class="section-title">Registrar sesión</div>
      <div class="form-grid" style="margin-top:8px">
        <div class="form-group">
          <label class="form-label">Fecha</label>
          <input type="date" id="sess-date" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select id="sess-type" class="form-select">
            <option>Sesión inicial</option><option>Retoque</option><option>Consulta</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Monto cobrado ($)</label>
          <input type="number" id="sess-price" class="form-input" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">Estado de pago</label>
          <select id="sess-payment" class="form-select">
            <option value="Pagado">Pagado</option>
            <option value="Señado">Señado</option>
            <option value="Pendiente">Pendiente</option>
          </select>
        </div>
      </div>
      <textarea id="sess-notes" class="form-textarea" style="margin-top:8px" placeholder="Notas de la sesión..."></textarea>
      <div style="margin-top:8px;text-align:right">
        <button class="btn btn-primary btn-sm" onclick="addSession('${c.id}')">Guardar sesión</button>
      </div>
    </div>
  `;

  const totalPagado   = sessions.filter(s => s.payment_status === 'Pagado').reduce((a, s) => a + (s.price || 0), 0);
  const totalPendiente = sessions.filter(s => s.payment_status !== 'Pagado').reduce((a, s) => a + (s.price || 0), 0);

  const resumen = sessions.length ? `
    <div class="sessions-totals">
      <div class="sessions-total-item">
        <div class="lbl">Sesiones</div>
        <div class="val">${sessions.length}</div>
      </div>
      <div class="sessions-total-item">
        <div class="lbl">Cobrado (Pagado)</div>
        <div class="val" style="color:var(--accent)">${fmtCurrency(totalPagado)}</div>
      </div>
      ${totalPendiente > 0 ? `<div class="sessions-total-item">
        <div class="lbl">Pendiente (Señado + Pend.)</div>
        <div class="val" style="color:var(--danger)">${fmtCurrency(totalPendiente)}</div>
      </div>` : ''}
    </div>
  ` : '';

  const statusColors = { 'Pagado': 'pay-pagado', 'Señado': 'pay-senado', 'Pendiente': 'pay-pendiente' };

  const list = sessions.length ? sessions.map(s => `
    <div class="session-item">
      <div>
        <div class="session-date">Sesión #${s.session_number || '?'} — ${fmtDate(s.date)}</div>
        <div class="session-type">${s.type}${s.notes ? ` · ${s.notes}` : ''}</div>
      </div>
      <div style="text-align:right">
        <div class="session-price">${fmtCurrency(s.price)}</div>
        <div class="session-paid ${statusColors[s.payment_status] || ''}">${s.payment_status || (s.paid ? 'Pagado' : 'Pendiente')}</div>
      </div>
    </div>
  `).join('') : '<div class="empty-state"><p>Sin sesiones registradas.</p></div>';

  document.getElementById('panel-sessions').innerHTML = addForm + resumen + `<div class="session-list">${list}</div>`;
}

function renderPhotosPanel(c) {
  const photos = c.photos || [];
  const uploadForm = `
    <div class="card" style="margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <input type="file" id="photo-file" accept="image/*" style="display:none" onchange="uploadPhoto('${c.id}')">
      <select id="photo-type" class="form-select" style="width:140px">
        <option>Antes</option><option>Después</option><option>Proceso</option>
      </select>
      <button class="btn btn-secondary" onclick="document.getElementById('photo-file').click()">📎 Subir foto</button>
    </div>
  `;
  const grid = photos.length ? `<div class="photos-grid">${photos.map(p => `
    <div class="photo-item">
      <img src="/uploads/${p.filename}" alt="${p.type}" loading="lazy">
      <div class="photo-type-label">${p.type}</div>
      <button class="photo-del" onclick="deletePhoto('${p.id}','${c.id}')">✕</button>
    </div>
  `).join('')}</div>` : '<div class="empty-state"><p>Sin fotos aún.</p></div>';
  document.getElementById('panel-photos').innerHTML = uploadForm + grid;
}

// ─── ACCIONES ─────────────────────────────────────────────────────────────────

async function changeStage(id, stage) {
  if (stage === 'Perdido') {
    openLossModal(id, stage);
    return;
  }
  try {
    await api.leads.update(id, { stage });
    const c = await api.leads.get(id);
    currentClientData = c;
    renderDetailModal(c);
    loadPipeline();
    toast(`Etapa: ${stage}`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function changeTemp(id, temperature) {
  try {
    await api.leads.update(id, { temperature });
    const c = await api.leads.get(id);
    currentClientData = c;
    renderDetailModal(c);
    toast(`Temperatura: ${temperature}`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function addInteraction(clientId) {
  const type    = document.getElementById('new-int-type').value;
  const dir     = document.getElementById('new-int-dir').value;
  const content = document.getElementById('new-int-content').value.trim();
  if (!content) return toast('Escribe un contenido', 'error');
  try {
    await api.interactions.add(clientId, { type, direction: dir, content });
    const c = await api.leads.get(clientId);
    currentClientData = c;
    renderDetailModal(c);
    activateTab('timeline');
    toast('Interacción guardada', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function addSession(clientId) {
  const date           = document.getElementById('sess-date').value;
  const type           = document.getElementById('sess-type').value;
  const price          = parseFloat(document.getElementById('sess-price').value) || null;
  const payment_status = document.getElementById('sess-payment').value;
  const notes          = document.getElementById('sess-notes').value.trim();
  if (!date) return toast('Ingresa una fecha', 'error');
  try {
    await api.interactions.addSession(clientId, { date, type, price, payment_status, notes });
    const c = await api.leads.get(clientId);
    currentClientData = c;
    renderDetailModal(c);
    activateTab('sessions');
    toast('Sesión registrada', 'success');
    loadDashboard();

    // Auto-sugerir fecha de retoque si el cliente es activo y no tiene una
    if (c.stage === 'Cliente activo' && !c.next_retoque) {
      const suggestion = await api.interactions.retoqueSuggestion(clientId);
      if (suggestion) {
        const ok = confirm(`¿Querés registrar la fecha estimada de retoque como ${fmtDate(suggestion)}? (3 años desde esta sesión)`);
        if (ok) {
          await api.leads.update(clientId, { next_retoque: suggestion });
          toast('Fecha de retoque registrada', 'success');
          loadDashboard();
        }
      }
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function uploadPhoto(clientId) {
  const file = document.getElementById('photo-file').files[0];
  const type = document.getElementById('photo-type').value;
  if (!file) return;
  try {
    await api.photos.upload(clientId, file, type);
    const c = await api.leads.get(clientId);
    currentClientData = c;
    renderDetailModal(c);
    activateTab('photos');
    toast('Foto subida', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deletePhoto(photoId, clientId) {
  if (!confirm('¿Eliminar esta foto?')) return;
  try {
    await api.photos.delete(photoId);
    const c = await api.leads.get(clientId);
    currentClientData = c;
    renderDetailModal(c);
    activateTab('photos');
    toast('Foto eliminada', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function editRetoque(id, current) {
  const val = prompt('Fecha estimada de retoque (AAAA-MM-DD):', current || '');
  if (val === null) return;
  try {
    await api.leads.update(id, { next_retoque: val || null });
    const c = await api.leads.get(id);
    currentClientData = c;
    renderDetailModal(c);
    toast('Fecha de retoque actualizada', 'success');
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function activateTab(tab) {
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.detail-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
}

// ─── MODAL MOTIVO DE PÉRDIDA ──────────────────────────────────────────────────

let _lossClientId = null;
let _lossStage = null;
let _lossReason = null;

function openLossModal(clientId, stage) {
  _lossClientId = clientId;
  _lossStage = stage;
  _lossReason = null;
  document.querySelectorAll('.loss-option').forEach(b => b.classList.remove('selected'));
  document.getElementById('loss-reason-other').style.display = 'none';
  document.getElementById('loss-reason-other').value = '';
  document.getElementById('modal-loss').classList.add('open');
}

function selectLossReason(btn, reason) {
  document.querySelectorAll('.loss-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  _lossReason = reason;
  const otherInput = document.getElementById('loss-reason-other');
  otherInput.style.display = reason === 'Otro' ? 'block' : 'none';
}

function cancelLoss() {
  document.getElementById('modal-loss').classList.remove('open');
  _lossClientId = null;
  renderPipeline();
}

async function confirmLoss() {
  if (!_lossReason) return toast('Seleccioná un motivo', 'error');
  let reason = _lossReason;
  if (reason === 'Otro') {
    const other = document.getElementById('loss-reason-other').value.trim();
    if (!other) return toast('Especificá el motivo', 'error');
    reason = other;
  }
  try {
    await api.leads.update(_lossClientId, { stage: 'Perdido', loss_reason: reason });
    document.getElementById('modal-loss').classList.remove('open');
    toast('Lead marcado como perdido', 'info');
    loadPipeline();
    loadDashboard();
    if (currentClientId === _lossClientId) {
      const c = await api.leads.get(_lossClientId);
      currentClientData = c;
      renderDetailModal(c);
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}
