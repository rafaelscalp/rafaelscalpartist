// ─── UTILIDADES GLOBALES ──────────────────────────────────────────────────────

// Toast notifications
function toast(msg, type = 'success', duration = 3500) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || '•'}</span> <span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, duration);
}

// Formatear fecha
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Formatear fecha + hora
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
         d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// Formatear pesos argentinos
function fmtCurrency(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

// Initiales del nombre
function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Tiempo relativo
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `hace ${days}d`;
  return fmtDate(iso);
}

// Icono de tipo de interacción
function interactionIcon(type) {
  const map = { 'Llamada': '📞', 'WhatsApp': '💬', 'Email': '✉️', 'Visita': '🏠', 'Nota': '📝', 'Sistema': '⚙️' };
  return map[type] || '•';
}

// Color temperatura
function tempBadge(t) {
  const cls = { 'Caliente': 'caliente', 'Tibio': 'tibio', 'Frío': 'frio' };
  return `<span class="badge badge-${cls[t] || 'tibio'}">${t || 'Tibio'}</span>`;
}

// Confirmar acción destructiva
function confirm(msg) {
  return window.confirm(msg);
}

// Debounce
function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
