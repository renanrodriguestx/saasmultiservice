// Formatação e utilitários de HTML (pt-BR, America/Sao_Paulo).
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attr = esc;
const TZ = 'America/Sao_Paulo';
const fDate = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const fDay = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' });
const fTime = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fLong = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' });
const fMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fMoney2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const date = (d) => (d ? fDate.format(new Date(d)) : '—');
export const day = (d) => (d ? fDay.format(new Date(d)).replace('.', '') : '—');
export const time = (d) => (d ? fTime.format(new Date(d)) : '—');
export const dateTime = (d) => (d ? `${day(d)}, ${time(d)}` : '—');
export const longDay = (d) => fLong.format(new Date(d));
export const money = (v) => fMoney.format(v || 0);
export const money2 = (v) => fMoney2.format(v || 0);
export const pct = (v) => `${Math.round(v * 100)}%`;
export const initials = (name) => String(name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export function duration(min) {
  if (min == null) return '—';
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 10) return `${h.toFixed(1).replace('.', ',')} h`;
  return `${Math.round(h)} h`;
}
export function relHours(ms) {
  const h = ms / 3600e3;
  if (ms < 59.5 * 60e3) return `${Math.max(1, Math.round(ms / 60e3))} min`;
  if (h < 1.5) return '1 h';
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} dias`;
}
export function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }
/** Data do agendamento (campos date+time) para Date */
export function scheduledAt(wo) { return new Date(`${wo.scheduled_date}T${wo.scheduled_time}:00-03:00`); }
export function sameLocalDay(a, b) { return date(a) === date(b); }
