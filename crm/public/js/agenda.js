// ─── AGENDA SEMANAL ───────────────────────────────────────────────────────────

let agendaWeekOffset = 0; // semanas desde la semana actual

function agendaGoToday()      { agendaWeekOffset = 0; loadAgenda(); }
function agendaChangeWeek(d)  { agendaWeekOffset += d; loadAgenda(); }

// Devuelve el lunes de la semana actual + offset de semanas
function getWeekRange(offset) {
  const now = new Date();
  const day = now.getDay(); // 0=dom
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  saturday.setHours(23, 59, 59, 0);
  return { monday, saturday };
}

function isoDate(d) { return d.toISOString().split('T')[0]; }

async function loadAgenda() {
  const { monday, saturday } = getWeekRange(agendaWeekOffset);
  const from = isoDate(monday);
  const to   = isoDate(saturday);

  // Label de la semana
  const label = `${monday.toLocaleDateString('es-AR', { day:'2-digit', month:'short' })} — ${saturday.toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' })}`;
  document.getElementById('agenda-week-label').textContent = label;

  try {
    const { sessions, contacts } = await api.leads.agenda(from, to);
    renderAgendaGrid(monday, sessions, contacts);
  } catch (err) {
    toast('Error cargando agenda', 'error');
  }
}

function renderAgendaGrid(monday, sessions, contacts) {
  const grid = document.getElementById('agenda-grid');
  const today = isoDate(new Date());
  const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  let html = '';

  for (let i = 0; i < 6; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateStr = isoDate(day);
    const isToday = dateStr === today;

    const daySessions = sessions.filter(s => s.date === dateStr);
    const dayContacts = contacts.filter(c => c.next_touch === dateStr);

    const sessionHtml = daySessions.map(s => `
      <div class="agenda-event sesion" onclick="openClientDetail('${s.client_id}')" title="${s.name}">
        <div class="agenda-event-name">${s.name}</div>
        <div class="agenda-event-type">${s.type}</div>
      </div>
    `).join('');

    const contactHtml = dayContacts.map(c => `
      <div class="agenda-event contacto" onclick="openClientDetail('${c.id}')" title="${c.name}">
        <div class="agenda-event-name">${c.name}</div>
        <div class="agenda-event-type">Contacto · ${c.stage}</div>
      </div>
    `).join('');

    const empty = !daySessions.length && !dayContacts.length
      ? '<div class="agenda-empty">—</div>' : '';

    html += `
      <div class="agenda-day ${isToday ? 'today' : ''}">
        <div class="agenda-day-name">${DAY_NAMES[i]}</div>
        <div class="agenda-day-date">${day.getDate()}</div>
        ${sessionHtml}${contactHtml}${empty}
      </div>
    `;
  }

  grid.innerHTML = html;
}
