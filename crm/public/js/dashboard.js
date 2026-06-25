// ─── DASHBOARD ────────────────────────────────────────────────────────────────

async function loadDashboard() {
  try {
    const m = await api.leads.metrics();

    document.getElementById('m-leads-month').textContent   = m.leadsThisMonth;
    document.getElementById('m-total-leads').textContent   = m.totalLeads;
    document.getElementById('m-active').textContent        = m.activeClients;
    document.getElementById('m-close-rate').textContent    = m.closeRate + '%';
    document.getElementById('m-revenue-month').textContent = fmtCurrency(m.revenueThisMonth);
    document.getElementById('m-revenue-total').textContent = fmtCurrency(m.revenueTotal);
    document.getElementById('m-no-contact').textContent      = m.noContactAlert;
    const pendEl = document.getElementById('m-pending-revenue');
    if (pendEl) pendEl.textContent = fmtCurrency(m.pendingRevenue);

    renderStageChart(m.byStage);
    renderOriginChart(m.byOrigin);
    renderCampaignTable(m.byCampaign);
    renderLossChart(m.lossReasons);
    renderUpcomingRetoques(m.upcomingRetoques);
    renderRecentLeads(m.recentLeads);
  } catch (err) {
    console.error(err);
    toast('No se pudieron cargar las métricas', 'error');
  }
}

function renderStageChart(byStage) {
  const order = ['Nuevo','Contactado','Presupuestado','Sesión agendada','Cliente activo','Perdido'];
  const map = Object.fromEntries(byStage.map(r => [r.stage, r.count]));
  const max = Math.max(...order.map(s => map[s] || 0), 1);
  document.getElementById('chart-stages').innerHTML = order.map(s => {
    const count = map[s] || 0;
    return `<div class="bar-row">
      <div class="bar-label">${s}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(count/max*100).toFixed(0)}%"></div></div>
      <div class="bar-count">${count}</div>
    </div>`;
  }).join('');
}

function renderOriginChart(byOrigin) {
  const max = Math.max(...byOrigin.map(r => r.count), 1);
  document.getElementById('chart-origins').innerHTML = byOrigin.map(o => `
    <div class="bar-row">
      <div class="bar-label">${o.origin}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(o.count/max*100).toFixed(0)}%"></div></div>
      <div class="bar-count">${o.count}</div>
    </div>
  `).join('') || '<p class="text-muted" style="font-size:12px">Sin datos</p>';
}

function renderCampaignTable(byCampaign) {
  const el = document.getElementById('chart-campaigns');
  if (!byCampaign || !byCampaign.length) {
    el.innerHTML = '<p class="text-muted" style="font-size:12px">Sin campañas Meta este mes</p>';
    return;
  }
  const max = Math.max(...byCampaign.map(r => r.count), 1);
  el.innerHTML = byCampaign.map(c => `
    <div class="bar-row">
      <div class="bar-label" style="width:140px;font-size:11px">${c.campaign}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(c.count/max*100).toFixed(0)}%"></div></div>
      <div class="bar-count">${c.count}</div>
    </div>
  `).join('');
}

function renderLossChart(lossReasons) {
  const el = document.getElementById('chart-loss');
  if (!lossReasons || !lossReasons.length) {
    el.innerHTML = '<p class="text-muted" style="font-size:12px">Sin pérdidas registradas este mes</p>';
    return;
  }
  const max = Math.max(...lossReasons.map(r => r.count), 1);
  el.innerHTML = lossReasons.map(r => `
    <div class="bar-row">
      <div class="bar-label" style="width:150px;font-size:11px">${r.loss_reason}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(r.count/max*100).toFixed(0)}%;background:var(--danger)"></div></div>
      <div class="bar-count">${r.count}</div>
    </div>
  `).join('');
}

function renderUpcomingRetoques(retoques) {
  const el = document.getElementById('upcoming-retoques');
  if (!retoques || !retoques.length) {
    el.innerHTML = '<p class="text-muted" style="font-size:12px">Sin retoques agendados en los próximos 90 días</p>';
    return;
  }
  const today = new Date();
  const rows = retoques.map(r => {
    const days = Math.round((new Date(r.next_retoque) - today) / (1000*60*60*24));
    let urgencyClass = 'urgency-yellow', urgencyLabel = `${days}d`;
    if (days < 30)      { urgencyClass = 'urgency-red';    }
    else if (days < 60) { urgencyClass = 'urgency-orange'; }
    return `<tr onclick="openClientDetail('${r.id}')">
      <td style="font-weight:700">${r.name}</td>
      <td style="color:var(--text-muted)">${r.phone || '—'}</td>
      <td>${fmtDate(r.next_retoque)}</td>
      <td><span class="urgency-badge ${urgencyClass}">en ${urgencyLabel}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();copyRetoqueMsgFor('${r.id}','${r.name.replace(/'/g,"\\'")}')">💬 WA</button></td>
    </tr>`;
  }).join('');
  el.innerHTML = `<table class="retoque-table">
    <thead><tr><th>Nombre</th><th>Teléfono</th><th>Fecha retoque</th><th>Días restantes</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function copyRetoqueMsgFor(clientId, nombre) {
  const primerNombre = nombre.split(' ')[0];
  const msg = `Hola ${primerNombre}, te escribo porque se está acercando la fecha de tu retoque. ¿Coordinamos un turno?`;
  navigator.clipboard.writeText(msg)
    .then(() => toast(`Mensaje para ${primerNombre} copiado ✓`, 'success'))
    .catch(() => toast('No se pudo copiar', 'error'));
}

function renderRecentLeads(leads) {
  const tbody = document.getElementById('recent-leads-body');
  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;padding:24px">Sin leads aún</td></tr>`;
    return;
  }
  tbody.innerHTML = leads.map(l => `
    <tr onclick="openClientDetail('${l.id}')" style="cursor:pointer">
      <td class="name">${l.name}</td>
      <td><span class="badge badge-origin">${l.origin}</span></td>
      <td><span class="badge badge-stage">${l.stage}</span></td>
      <td>${tempBadge(l.temperature)}</td>
      <td>${timeAgo(l.created_at)}</td>
    </tr>
  `).join('');
}
