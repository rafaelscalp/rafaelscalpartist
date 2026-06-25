// ─── DASHBOARD ────────────────────────────────────────────────────────────────

async function loadDashboard() {
  try {
    const m = await api.leads.metrics();

    // Métricas principales
    document.getElementById('m-leads-month').textContent   = m.leadsThisMonth;
    document.getElementById('m-total-leads').textContent   = m.totalLeads;
    document.getElementById('m-active').textContent        = m.activeClients;
    document.getElementById('m-close-rate').textContent    = m.closeRate + '%';
    document.getElementById('m-revenue-month').textContent = fmtCurrency(m.revenueThisMonth);
    document.getElementById('m-revenue-total').textContent = fmtCurrency(m.revenueTotal);

    // Gráfico por etapa
    renderStageChart(m.byStage);

    // Gráfico por origen
    renderOriginChart(m.byOrigin);

    // Leads recientes
    renderRecentLeads(m.recentLeads);
  } catch (err) {
    console.error(err);
    toast('No se pudieron cargar las métricas', 'error');
  }
}

function renderStageChart(byStage) {
  const stagesOrder = ['Nuevo','Contactado','Presupuestado','Sesión agendada','Cliente activo','Perdido'];
  const map = Object.fromEntries(byStage.map(r => [r.stage, r.count]));
  const max = Math.max(...stagesOrder.map(s => map[s] || 0), 1);

  const el = document.getElementById('chart-stages');
  el.innerHTML = stagesOrder.map(s => {
    const count = map[s] || 0;
    const pct = (count / max * 100).toFixed(0);
    return `<div class="bar-row">
      <div class="bar-label">${s}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="bar-count">${count}</div>
    </div>`;
  }).join('');
}

function renderOriginChart(byOrigin) {
  const max = Math.max(...byOrigin.map(r => r.count), 1);
  const el = document.getElementById('chart-origins');
  el.innerHTML = byOrigin.map(o => {
    const pct = (o.count / max * 100).toFixed(0);
    return `<div class="bar-row">
      <div class="bar-label">${o.origin}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="bar-count">${o.count}</div>
    </div>`;
  }).join('') || '<p class="text-muted">Sin datos</p>';
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
