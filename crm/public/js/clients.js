// ─── CLIENTES LIST + MODALES ──────────────────────────────────────────────────

let clientsData = [];
let currentClientId = null;
let currentDetailTab = 'info';

// ─── LISTA DE CLIENTES ────────────────────────────────────────────────────────

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
      <div class="empty-icon">👤</div>
      <p>No hay clientes que coincidan con los filtros.</p>
    </div>`;
    return;
  }
  grid.innerHTML = clientsData.map(c => `
    <div class="client-card" onclick="openClientDetail('${c.id}')">
      <div class="cc-actions">
        <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="event.stopPropagation();openEditModal('${c.id}')">✏️</button>
        <button class="btn btn-ghost btn-icon btn-sm" title="Eliminar" onclick="event.stopPropagation();deleteClient('${c.id}')">🗑</button>
      </div>
      <div class="cc-name">${c.name}</div>
      <div class="cc-phone">${c.phone || 'Sin teléfono'} ${c.email ? '· ' + c.email : ''}</div>
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
  const stage       = document.getElementById('filter-stage').value;
  const origin      = document.getElementById('filter-origin').value;
  const temperature = document.getElementById('filter-temp').value;
  const from        = document.getElementById('filter-from').value;
  const to          = document.getElementById('filter-to').value;
  const search      = document.getElementById('global-search').value;

  const params = {};
  if (stage) params.stage = stage;
  if (origin) params.origin = origin;
  if (temperature) params.temperature = temperature;
  if (from) params.from = from;
  if (to) params.to = to;
  if (search) params.search = search;

  loadClients(params);
}

// ─── MODAL CREAR / EDITAR ─────────────────────────────────────────────────────

function openCreateModal() {
  currentClientId = null;
  document.getElementById('modal-form-title').textContent = 'Nuevo lead';
  document.getElementById('client-form').reset();
  document.getElementById('modal-form').classList.add('open');
}

async function openEditModal(id) {
  currentClientId = id;
  document.getElementById('modal-form-title').textContent = 'Editar cliente';
  try {
    const c = await api.leads.get(id);
    const f = document.getElementById('client-form');
    f.elements['name'].value        = c.name || '';
    f.elements['phone'].value       = c.phone || '';
    f.elements['email'].value       = c.email || '';
    f.elements['origin'].value      = c.origin || 'Otro';
    f.elements['campaign'].value    = c.campaign || '';
    f.elements['stage'].value       = c.stage || 'Nuevo';
    f.elements['temperature'].value = c.temperature || 'Tibio';
    f.elements['budget'].value      = c.budget || '';
    f.elements['next_touch'].value  = c.next_touch || '';
    f.elements['notes'].value       = c.notes || '';
    document.getElementById('modal-form').classList.add('open');
  } catch (err) {
    toast('Error cargando datos del cliente', 'error');
  }
}

function closeFormModal() {
  document.getElementById('modal-form').classList.remove('open');
  currentClientId = null;
}

async function submitClientForm(e) {
  e.preventDefault();
  const f = e.target;
  const data = {
    name:        f.elements['name'].value.trim(),
    phone:       f.elements['phone'].value.trim(),
    email:       f.elements['email'].value.trim(),
    origin:      f.elements['origin'].value,
    campaign:    f.elements['campaign'].value.trim(),
    stage:       f.elements['stage'].value,
    temperature: f.elements['temperature'].value,
    budget:      parseFloat(f.elements['budget'].value) || null,
    next_touch:  f.elements['next_touch'].value || null,
    notes:       f.elements['notes'].value.trim(),
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
    loadClients();
    loadPipeline();
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ─── DETALLE DE CLIENTE ───────────────────────────────────────────────────────

async function openClientDetail(id) {
  try {
    const c = await api.leads.get(id);
    currentClientId = id;
    currentDetailTab = 'info';
    renderDetailModal(c);
    document.getElementById('modal-detail').classList.add('open');
  } catch (err) {
    toast('Error cargando cliente', 'error');
  }
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.remove('open');
}

function renderDetailModal(c) {
  // Header
  document.getElementById('detail-avatar').textContent   = initials(c.name);
  document.getElementById('detail-name').textContent     = c.name;
  document.getElementById('detail-sub').textContent      = [c.phone, c.email].filter(Boolean).join(' · ') || 'Sin contacto';
  document.getElementById('detail-badges').innerHTML     = `
    ${tempBadge(c.temperature)}
    <span class="badge badge-origin">${c.origin}</span>
    <span class="badge badge-stage">${c.stage}</span>
    ${c.campaign ? `<span class="badge" style="background:var(--bg-elevated);color:var(--text-muted)">📣 ${c.campaign}</span>` : ''}
  `;
  document.getElementById('detail-edit-btn').onclick = () => { closeDetailModal(); openEditModal(c.id); };
  document.getElementById('detail-delete-btn').onclick = () => { closeDetailModal(); deleteClient(c.id); };

  // Tabs
  switchDetailTab('info', c);
}

function switchDetailTab(tab, clientData) {
  currentDetailTab = tab;
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.detail-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));

  if (clientData) {
    renderInfoPanel(clientData);
    renderTimelinePanel(clientData);
    renderSessionsPanel(clientData);
    renderPhotosPanel(clientData);
  }
}

function renderInfoPanel(c) {
  document.getElementById('panel-info').innerHTML = `
    <div class="info-grid">
      <div class="info-item"><div class="lbl">Nombre</div><div class="val">${c.name}</div></div>
      <div class="info-item"><div class="lbl">Teléfono</div><div class="val">${c.phone || '—'}
        ${c.phone ? `<a href="https://wa.me/${c.phone.replace(/\D/g,'')}" target="_blank" style="color:var(--accent);margin-left:8px;font-size:12px">WhatsApp ↗</a>` : ''}
      </div></div>
      <div class="info-item"><div class="lbl">Email</div><div class="val">${c.email || '—'}</div></div>
      <div class="info-item"><div class="lbl">Origen</div><div class="val">${c.origin}</div></div>
      <div class="info-item"><div class="lbl">Campaña</div><div class="val">${c.campaign || '—'}</div></div>
      <div class="info-item"><div class="lbl">Presupuesto</div><div class="val text-accent">${fmtCurrency(c.budget)}</div></div>
      <div class="info-item"><div class="lbl">Próximo contacto</div><div class="val">${c.next_touch ? fmtDate(c.next_touch) : '—'}</div></div>
      <div class="info-item"><div class="lbl">Ingresó</div><div class="val">${fmtDateTime(c.created_at)}</div></div>
      <div class="info-item" style="grid-column:1/-1"><div class="lbl">Notas</div>
        <div class="val" style="color:var(--text-secondary);white-space:pre-wrap">${c.notes || '—'}</div>
      </div>
    </div>
    <div style="margin-top:16px">
      <div class="section-title">Cambiar etapa</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${['Nuevo','Contactado','Presupuestado','Sesión agendada','Cliente activo','Perdido'].map(s =>
          `<button class="btn btn-sm ${s === c.stage ? 'btn-primary' : 'btn-secondary'}"
            onclick="changeStage('${c.id}','${s}')">${s}</button>`
        ).join('')}
      </div>
    </div>
    <div style="margin-top:16px">
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

  document.getElementById('panel-timeline').innerHTML = addForm + `<div class="timeline">${timeline}</div>`;
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
          <label class="form-label">Precio ($)</label>
          <input type="number" id="sess-price" class="form-input" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">Pagado</label>
          <select id="sess-paid" class="form-select">
            <option value="1">Sí</option><option value="0">No</option>
          </select>
        </div>
      </div>
      <textarea id="sess-notes" class="form-textarea" style="margin-top:8px" placeholder="Notas de la sesión..."></textarea>
      <div style="margin-top:8px;text-align:right">
        <button class="btn btn-primary btn-sm" onclick="addSession('${c.id}')">Guardar sesión</button>
      </div>
    </div>
  `;

  const list = sessions.length ? sessions.map(s => `
    <div class="session-item">
      <div>
        <div class="session-date">${fmtDate(s.date)}</div>
        <div class="session-type">${s.type}</div>
      </div>
      <div style="text-align:right">
        <div class="session-price">${fmtCurrency(s.price)}</div>
        <div class="session-paid">${s.paid ? '✓ Pagado' : 'Pendiente'}</div>
      </div>
    </div>
  `).join('') : '<div class="empty-state"><p>Sin sesiones registradas.</p></div>';

  document.getElementById('panel-sessions').innerHTML = addForm + `<div class="session-list">${list}</div>`;
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

// ─── ACCIONES DETALLE ─────────────────────────────────────────────────────────

async function changeStage(id, stage) {
  try {
    await api.leads.update(id, { stage });
    const c = await api.leads.get(id);
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
    renderDetailModal(c);
    switchDetailTab('timeline', c);
    toast('Interacción guardada', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function addSession(clientId) {
  const date  = document.getElementById('sess-date').value;
  const type  = document.getElementById('sess-type').value;
  const price = parseFloat(document.getElementById('sess-price').value) || null;
  const paid  = document.getElementById('sess-paid').value === '1';
  const notes = document.getElementById('sess-notes').value.trim();
  if (!date) return toast('Ingresa una fecha', 'error');
  try {
    await api.interactions.addSession(clientId, { date, type, price, paid, notes });
    const c = await api.leads.get(clientId);
    renderDetailModal(c);
    switchDetailTab('sessions', c);
    toast('Sesión registrada', 'success');
    loadDashboard();
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
    renderDetailModal(c);
    switchDetailTab('photos', c);
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
    renderDetailModal(c);
    switchDetailTab('photos', c);
    toast('Foto eliminada', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}
