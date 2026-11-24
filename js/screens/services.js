// Serviços realizados (D15): uma linha por serviço, com responsável e evidências.
// Análise diferente do quadro de atendimentos: "quem fez o quê, com a prova".
import * as store from '../store.js';
import { t, tx } from '../i18n.js';
import { icon } from '../components/icons.js';
import { esc, money, date, dateTime, time, duration } from '../components/format.js';
import { svcStatusBadge, evidenceText, avatar, responseBlock, drawer } from '../components/wo.js';

export const defaultSx = () => ({ op: '', item: '', cat: '', days: 28, status: 'done', pending: false, form: '', origin: null, sort: 'date' });

export function queryFor(orgId, sx) {
  return store.getServiceExecutions(orgId, { days: sx.days || undefined, status: sx.status, assigneeId: sx.op || undefined, catalogItemId: sx.item || undefined, categoryId: sx.cat || undefined, pendingEvidence: sx.pending, formId: sx.form || undefined });
}

export function renderServices({ orgId, state }) {
  const sx = state.sx;
  const rows = queryFor(orgId, sx);
  if (sx.sort === 'duration') rows.sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
  if (sx.sort === 'person') rows.sort((a, b) => (a.item.assignee?.name || '').localeCompare(b.item.assignee?.name || ''));
  const ops = store.getExecutors(orgId);
  const svcs = store.getCatalogItems(orgId, { kind: 'service' });
  const cats = store.getCatalogCategories(orgId).filter((c) => svcs.some((i) => i.category_id === c.id));
  const forms = store.getForms(orgId);
  const revenue = rows.reduce((s, x) => s + x.item.qty * x.item.unit_price - x.item.discount, 0);
  const mins = rows.map((x) => x.minutes).filter((m) => m != null);
  const sel = (id, key, label, opts) => `<label class="sr-only" for="${id}">${label}</label><select class="select" id="${id}" data-change="sx" data-key="${key}" data-fk="${id}">${opts}</select>`;
  const active = sx.op || sx.item || sx.cat || sx.pending || sx.form || sx.status !== 'done' || sx.days !== 28;
  const filters = `<div class="filters" role="group" aria-label="Filtros" data-ann="svc-filters">
    ${sel('sx-op', 'op', 'Responsável', `<option value="">Todos os responsáveis</option>${ops.map((m) => `<option value="${m.user_id}" ${sx.op === m.user_id ? 'selected' : ''}>${esc(m.profile.name)}</option>`).join('')}`)}
    ${sel('sx-item', 'item', t('entity.service'), `<option value="">Todos os ${esc(t('entity.service', { plural: true, lower: true }))}</option>${svcs.map((i) => `<option value="${i.id}" ${sx.item === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}`)}
    ${sel('sx-cat', 'cat', 'Categoria', `<option value="">Todas as categorias</option>${cats.map((c) => `<option value="${c.id}" ${sx.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`)}
    ${sel('sx-days', 'days', 'Período', [[7, 'Últimos 7 dias'], [28, 'Últimos 28 dias'], [90, 'Últimos 90 dias'], [0, 'Todo o período']].map(([v, l]) => `<option value="${v}" ${Number(sx.days) === v ? 'selected' : ''}>${l}</option>`).join(''))}
    ${sel('sx-status', 'status', 'Status', [['done', 'Realizados'], ['started', 'Em andamento'], ['todo', 'A fazer'], ['not_done', 'Não realizados'], ['all', 'Todos os status']].map(([v, l]) => `<option value="${v}" ${sx.status === v ? 'selected' : ''}>${l}</option>`).join(''))}
    ${sel('sx-form', 'form', t('entity.form'), `<option value="">Qualquer ${esc(t('entity.form', { lower: true }))}</option>${forms.map((f) => `<option value="${f.id}" ${sx.form === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}`)}
    <button class="chip" aria-pressed="${sx.pending}" data-action="sx-pending" data-fk="sx-pending">${icon('alert', 'sm')} Evidência obrigatória pendente</button>
    ${active ? `<button class="btn btn-ghost btn-sm" data-action="sx-clear">Limpar filtros</button>` : ''}
  </div>`;
  const head = `<div class="page-head"><div><h1>${tx('nav.services_done')}</h1><p>Uma linha por ${esc(t('entity.service', { lower: true }))}: quem fez, quando e a prova. Para acompanhar onde cada ${esc(t('entity.asset', { lower: true }))} está, use ${esc(t('entity.work_order', { plural: true }))}.</p></div></div>`;
  const origin = sx.origin ? `<div style="margin-bottom:12px"><span class="origin-chip" data-ann="drilldown">${icon('dashboard', 'sm')} Do Painel: ${esc(sx.origin)}<button data-action="sx-clear" aria-label="Remover filtro vindo do Painel">${icon('x', 'sm')}</button></span></div>` : '';
  const summary = `<div class="list-summary"><p class="muted" role="status" data-ann="svc-summary"><strong style="color:var(--fg)">${rows.length} ${esc(t('entity.service', { count: rows.length, lower: true }))}</strong> · ${money(revenue)}${mins.length ? ` · ${duration(mins.reduce((s, m) => s + m, 0) / mins.length)} em média` : ''}</p>
    <span class="muted" style="font-size:13px">Ordenar: <select class="select" style="width:auto;min-height:30px;font-size:13px" data-change="sx" data-key="sort" aria-label="Ordenar"><option value="date" ${sx.sort === 'date' ? 'selected' : ''}>mais recentes</option><option value="duration" ${sx.sort === 'duration' ? 'selected' : ''}>mais demorados</option><option value="person" ${sx.sort === 'person' ? 'selected' : ''}>responsável</option></select></span></div>`;
  if (!rows.length) return `${head}${origin}${filters}<div class="card"><div class="empty">${icon('search')}<strong>Nenhum ${esc(t('entity.service', { lower: true }))} com estes filtros</strong><p>Amplie o período ou limpe os filtros.</p>${active ? '<button class="btn" data-action="sx-clear">Limpar filtros</button>' : ''}</div></div>`;
  const ref = (x) => x.item.finished_at || x.item.started_at;
  const table = `<div class="card table-wrap" style="overflow:auto"><table class="table" data-ann="svc-table"><thead><tr><th>Data</th><th>${esc(t('entity.service'))}</th><th>Responsável</th><th>${esc(t('entity.work_order'))}</th><th>${esc(t('entity.customer'))} · ${esc(t('entity.asset'))}</th><th>Status</th><th>Evidências</th><th style="text-align:right">Duração</th></tr></thead><tbody>
    ${rows.map((x) => `<tr class="clickable" data-action="open-svc" data-item="${x.item.id}" tabindex="0" data-fk="sr-${x.item.id}"><td class="nowrap">${ref(x) ? `${date(ref(x))}<div class="subtle" style="font-size:12px">${time(ref(x))}</div>` : '<span class="subtle">—</span>'}</td>
      <td><span class="dot" style="background:${esc(x.category?.color)}"></span> ${esc(x.item.catalog.name)}</td>
      <td class="nowrap"><span class="row">${avatar(x.item.assignee)}${esc(x.item.assignee?.name.split(' ')[0] || '—')}</span></td>
      <td><button class="btn btn-sm btn-ghost mono" data-action="open-wo" data-id="${x.wo.id}">#${x.wo.number}</button></td>
      <td>${esc(x.customer.name)}<div class="subtle" style="font-size:12px">${esc(x.asset.attributes.model)} · <span class="mono">${esc(x.asset.attributes.plate)}</span></div></td>
      <td>${svcStatusBadge(x.item.exec_status)}</td><td>${evidenceText(x.evidence)}</td><td style="text-align:right" class="tabular">${x.minutes != null ? duration(x.minutes) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  const cards = `<div class="table-cards">${rows.map((x) => `<button class="card card-pad stack-sm" style="text-align:left;border-left:4px solid ${esc(x.category?.color)}" data-action="open-svc" data-item="${x.item.id}">
    <div class="row"><strong class="grow">${esc(x.item.catalog.name)}</strong>${svcStatusBadge(x.item.exec_status)}</div>
    <span class="muted" style="font-size:13px">${esc(x.item.assignee?.name || '—')} · #${x.wo.number} · ${esc(x.asset.attributes.model)} ${esc(x.asset.attributes.plate)}</span>
    <span class="row-wrap">${evidenceText(x.evidence)}<span class="subtle" style="font-size:12px">${ref(x) ? dateTime(ref(x)) : ''}</span></span></button>`).join('')}</div>`;
  return `${head}${origin}${filters}${summary}${table}${cards}`;
}

export function svcDrawer(orgId, m) {
  const it = store.getItem(orgId, m.itemId);
  if (!it) return drawer('Não encontrado', `<div class="empty">${icon('alert')}<strong>Não existe nesta organização.</strong></div>`, '');
  const cat = store.getCatalogItem(orgId, it.catalog_item_id);
  const category = store.getCategory(orgId, cat.category_id);
  const v = store.getWorkOrderView(orgId, it.work_order_id);
  const ev = store.itemEvidence(orgId, it);
  const hist = store.getItemHistory(orgId, it.id);
  const mins = it.started_at && it.finished_at ? store.workMinutesBetween(orgId, new Date(it.started_at), new Date(it.finished_at)) : null;
  const req = store.getServiceBindings(orgId, it.catalog_item_id);
  const body = `<div class="stack" style="gap:20px">
    <div class="grid grid-2" style="gap:12px">
      <div class="response-block stack-sm"><span class="field-label">Quem fez</span><span class="row">${avatar(store.getProfile(it.assignee_id))}${esc(store.getProfile(it.assignee_id)?.name || '—')}</span></div>
      <div class="response-block stack-sm"><span class="field-label">Quando</span><span>${it.started_at ? `${dateTime(it.started_at)}${it.finished_at ? ` → ${time(it.finished_at)}` : ''}` : '—'}</span>${mins != null ? `<span class="subtle" style="font-size:12px">${duration(mins)} de expediente · previsto ${duration(cat.avg_duration_min)}</span>` : ''}</div>
    </div>
    <div class="row-wrap">${svcStatusBadge(it.exec_status)}${evidenceText(ev)}${it.not_done_reason ? `<span class="badge danger">Motivo: ${esc(it.not_done_reason)}</span>` : ''}</div>
    <div class="response-block stack-sm"><span class="field-label">${esc(t('entity.work_order'))}</span>
      <span>#${v.wo.number} · ${esc(v.customer.name)} · ${esc(v.asset.attributes.brand)} ${esc(v.asset.attributes.model)} <span class="mono">${esc(v.asset.attributes.plate)}</span></span>
      <div><button class="btn btn-sm" data-action="open-wo" data-id="${v.wo.id}">Abrir ${esc(t('entity.work_order', { lower: true }))} #${v.wo.number}</button></div></div>
    <section class="stack-sm" data-ann="svc-evidence"><h3 style="font-size:15px">Comprovação</h3>
      ${ev.responses.length ? ev.responses.map((r) => responseBlock(orgId, r)).join('') : '<p class="muted">Nenhum formulário respondido para este serviço.</p>'}
      ${req.length ? `<p class="subtle" style="font-size:12px">Exigido por este ${esc(t('entity.service', { lower: true }))}: ${req.map((b) => `${esc(b.form.name)} (${b.moment === 'service_start' ? 'para iniciar' : 'para finalizar'}${b.required ? '' : ', opcional'})`).join(' · ')}</p>` : ''}</section>
    <section class="stack-sm"><h3 style="font-size:15px">Histórico do ${esc(t('entity.service', { lower: true }))}</h3>
      <ol class="timeline">${hist.map((h) => `<li><span class="tl-dot ${h.to_value === 'done' ? 'finished' : h.to_value === 'started' ? 'started' : h.to_value === 'not_done' ? 'canceled' : 'todo'}"></span><div>${h.event === 'assigned' ? `Atribuído a ${esc(store.getProfile(h.to_value)?.name || '—')}${h.from_value ? ` (antes: ${esc(store.getProfile(h.from_value)?.name || '—')})` : ''}` : esc(tx('svc.status.' + h.to_value))}</div><div class="subtle" style="font-size:12px">${dateTime(h.at)} · ${esc(store.getProfile(h.by_user_id)?.name || '—')}</div></li>`).join('')}</ol></section>
  </div>`;
  return drawer(`${esc(cat.name)}`, body, `<button class="btn" data-action="close-modal">Fechar</button>`, { wide: true, sub: `<span class="dot" style="background:${esc(category?.color)}"></span> ${esc(category?.name || '')} · ${money(it.qty * it.unit_price - it.discount)}` });
}
