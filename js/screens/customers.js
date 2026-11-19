// Clientes: lista com filtros, ficha com histórico filtrável, edição de cliente e veículo (audit_log).
import * as store from '../store.js';
import { t, tx, gender } from '../i18n.js';
import { icon } from '../components/icons.js';
import { esc, date, money, scheduledAt, plural, dateTime } from '../components/format.js';
import { renderFieldValues } from '../components/fields.js';
import { milestoneBadge, drawer } from '../components/wo.js';
import { toHash, can } from '../router.js';

export const defaultCf = () => ({ overdue: false, soon: false, open: false, idle: false, cat: '', brand: '', sort: 'name' });
function reviewBadge(r) {
  if (!r) return '<span class="subtle">—</span>';
  if (r.scheduled) return `<span class="badge info">${icon('calendar', 'sm')} Agendada ${date(scheduledAt(r.scheduled))}</span>`;
  if (r.days < 0) return `<span class="badge danger">${icon('alert', 'sm')} Vencida há ${plural(-r.days, 'dia', 'dias')}</span>`;
  if (r.days <= 30) return `<span class="badge warn">${icon('clock', 'sm')} Em ${plural(r.days, 'dia', 'dias')}</span>`;
  return `<span class="badge">${date(r.due)}</span>`;
}
/** Linha da lista com tudo que os filtros usam (exportada para os testes de contagem). */
export function customerRows(orgId) {
  const nowMs = +store.now();
  return store.getCustomers(orgId).map((c) => {
    const assets = store.getAssetsByCustomer(orgId, c.id);
    const views = store.getWorkOrders(orgId, { customerId: c.id }).map((w) => store.getWorkOrderView(orgId, w.id));
    const finished = views.map((v) => ({ v, f: store.finishedAt(orgId, v.wo.id) })).filter((x) => x.f).sort((a, b) => b.f - a.f);
    const last = finished[0]?.f || null;
    const review = store.getNextRecurrence(orgId, c.id);
    const cats = new Set(finished.flatMap((x) => x.v.services.map((s) => s.catalog.category_id)));
    return {
      c, assets, last, review, cats, views,
      overdue: !!review && !review.scheduled && review.days < 0,
      soon: !!review && !review.scheduled && review.days >= 0 && review.days <= 30,
      open: views.some((v) => !['finished', 'canceled'].includes(v.milestone)),
      idle: (last ? nowMs - +last : nowMs - +new Date(c.created_at)) > 90 * 86400e3 && !views.some((v) => !['finished', 'canceled'].includes(v.milestone)),
      brands: new Set(assets.map((a) => a.attributes.brand)),
    };
  });
}
export function applyCustomerFilters(rows, cf, q, orgId) {
  const ids = q ? new Set(store.getCustomers(orgId, { q }).map((c) => c.id)) : null;
  return rows.filter((r) => (!ids || ids.has(r.c.id)) && (!cf.overdue || r.overdue) && (!cf.soon || r.soon) && (!cf.open || r.open) && (!cf.idle || r.idle) && (!cf.cat || r.cats.has(cf.cat)) && (!cf.brand || r.brands.has(cf.brand)));
}

export function renderCustomers({ orgId, state }) {
  const q = state.custQ, cf = state.cf;
  const all = customerRows(orgId);
  const list = applyCustomerFilters(all, cf, q, orgId);
  if (cf.sort === 'last') list.sort((a, b) => (b.last || 0) - (a.last || 0));
  else if (cf.sort === 'review') list.sort((a, b) => (a.review ? +a.review.due : Infinity) - (b.review ? +b.review.due : Infinity));
  else list.sort((a, b) => a.c.name.localeCompare(b.c.name));
  const nAssets = all.reduce((n, r) => n + r.assets.length, 0);
  const head = `<div class="page-head"><div><h1>${tx('customers.title')}</h1><p>${plural(all.length, t('entity.customer', { lower: true }), t('entity.customer', { plural: true, lower: true }))} · ${plural(nAssets, t('entity.asset', { lower: true }), t('entity.asset', { plural: true, lower: true }))}</p></div></div>`;
  if (!all.length) return `${head}<div class="card"><div class="empty">${icon('users')}<strong>Nenhum ${t('entity.customer', { lower: true })} cadastrado</strong><p>No onboarding dá para importar uma planilha ou cadastrar um a um.</p></div></div>`;
  const cnt = (k) => all.filter((r) => r[k]).length;
  const chip = (k, label) => `<button class="chip" aria-pressed="${cf[k]}" data-action="cf-toggle" data-key="${k}" data-fk="cf-${k}" data-ann="customer-filters">${label} <span class="subtle" style="${cf[k] ? 'color:#fff' : ''}">${cnt(k)}</span></button>`;
  const cats = store.getCatalogCategories(orgId).filter((c) => store.getCatalogItems(orgId, { kind: 'service' }).some((i) => i.category_id === c.id));
  const brands = [...new Set(all.flatMap((r) => [...r.brands]))].sort();
  const active = cf.overdue || cf.soon || cf.open || cf.idle || cf.cat || cf.brand || q;
  const filters = `<div class="stack-sm" style="margin-bottom:16px">
    <div class="filters" style="margin-bottom:0">
      <div class="search" style="flex:1 1 280px;max-width:380px"><label class="sr-only" for="cust-q">${tx('customers.search')}</label>${icon('search', 'sm')}<input id="cust-q" class="input" type="search" placeholder="${tx('customers.search')}" value="${esc(q)}" data-input="cust-q" data-fk="cust-q" autocomplete="off"></div>
      <label class="sr-only" for="cf-cat">Já fez categoria</label><select class="select" id="cf-cat" data-change="cf" data-key="cat" data-fk="cf-cat"><option value="">Já fez categoria…</option>${cats.map((c) => `<option value="${c.id}" ${cf.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <label class="sr-only" for="cf-brand">Marca</label><select class="select" id="cf-brand" data-change="cf" data-key="brand" data-fk="cf-brand"><option value="">Marca d${gender('entity.asset') === 'f' ? 'a' : 'o'} ${esc(t('entity.asset', { lower: true }))}</option>${brands.map((b) => `<option ${cf.brand === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
      <label class="sr-only" for="cf-sort">Ordenar</label><select class="select" id="cf-sort" data-change="cf" data-key="sort" data-fk="cf-sort"><option value="name" ${cf.sort === 'name' ? 'selected' : ''}>Ordenar por nome</option><option value="last" ${cf.sort === 'last' ? 'selected' : ''}>Último ${esc(t('entity.work_order', { lower: true }))}</option><option value="review" ${cf.sort === 'review' ? 'selected' : ''}>Próxima revisão</option></select>
    </div>
    <div class="row-wrap">${chip('overdue', 'Revisão vencida')}${chip('soon', 'Revisão em até 30 dias')}${chip('open', `Com ${t('entity.work_order', { lower: true })} em aberto`)}${chip('idle', `Sem ${t('entity.work_order', { lower: true })} há 90+ dias`)}
      ${active ? `<button class="btn btn-ghost btn-sm" data-action="cf-clear">Limpar</button>` : ''}<span class="grow"></span><span class="subtle" style="font-size:13px" role="status" data-count="customers">${list.length} de ${all.length}</span></div></div>`;
  if (!list.length) return `${head}${filters}<div class="card"><div class="empty">${icon('search')}<strong>${q ? esc(tx('customers.empty', { q })) : 'Nenhum resultado com estes filtros'}</strong><p>Confira a grafia, busque pela placa ou limpe os filtros.</p></div></div>`;
  const table = `<div class="card table-wrap" style="overflow:auto"><table class="table"><thead><tr><th>${tx('customers.col.name')}</th><th>${tx('customers.col.phone')}</th><th>${tx('customers.col.assets')}</th><th>${tx('customers.col.last')}</th><th data-ann="recurrence">${tx('customers.col.next_review')}</th></tr></thead><tbody>
    ${list.map(({ c, assets, last, review, open }) => `<tr class="clickable" data-action="open-customer" data-id="${c.id}"><td><a href="${toHash('cliente', c.id)}" style="font-weight:500;text-decoration:none" data-fk="c-${c.id}">${esc(c.name)}</a>${open ? ` <span class="badge info">em aberto</span>` : ''}</td><td class="tabular nowrap">${esc(c.phone)}</td>
      <td data-ann="card-vehicle">${assets.map((a) => `${esc(a.attributes.model)} <span class="mono subtle">${esc(a.attributes.plate)}</span>`).join('<br>')}</td>
      <td class="nowrap">${last ? date(last) : '<span class="subtle">—</span>'}</td><td>${reviewBadge(review)}</td></tr>`).join('')}</tbody></table></div>`;
  const cards = `<div class="table-cards">${list.map(({ c, assets, review }) => `<a class="card card-pad stack-sm" href="${toHash('cliente', c.id)}" style="text-decoration:none"><strong>${esc(c.name)}</strong><span class="muted" style="font-size:13px">${assets.map((a) => `${esc(a.attributes.model)} · ${esc(a.attributes.plate)}`).join(' / ')}</span>${review ? `<span>${reviewBadge(review)}</span>` : ''}</a>`).join('')}</div>`;
  return `${head}${filters}${table}${cards}`;
}

export function renderCustomer({ orgId, state }, customerId) {
  const c = store.getCustomer(orgId, customerId);
  const back = `<a href="${toHash('clientes')}" class="muted" style="font-size:13px;text-decoration:none">${icon('arrowLeft', 'sm')} ${tx('customer.back')}</a>`;
  if (!c) return `${back}<div class="card" style="margin-top:12px"><div class="empty">${icon('alert')}<strong>${tx('customer.not_found')}</strong></div></div>`;
  const edit = can(state.role, 'customer.edit');
  const assets = store.getAssetsByCustomer(orgId, c.id);
  const all = store.getWorkOrders(orgId, { customerId: c.id }).map((w) => store.getWorkOrderView(orgId, w.id)).sort((a, b) => scheduledAt(b.wo) - scheduledAt(a.wo));
  const hf = state.hf;
  const wos = all.filter((v) => (!hf.cat || v.items.some((i) => i.catalog.category_id === hf.cat)) && (!hf.kind || v.items.some((i) => i.kind === hf.kind)));
  const pays = store.getPayments(orgId, { customerId: c.id });
  const methods = Object.fromEntries(store.getOrganization(orgId).config.payment_methods.map((m) => [m.key, m.label]));
  const review = store.getNextRecurrence(orgId, c.id);
  const totalPaid = pays.reduce((s, p) => s + p.amount, 0);
  const audits = store.getAuditLog(orgId, { entity: 'customers', entityId: c.id }).concat(...assets.map((a) => store.getAuditLog(orgId, { entity: 'customer_assets', entityId: a.id }))).sort((a, b) => b.at.localeCompare(a.at));
  const lastAudit = audits[0];
  const lastDone = all.map((v) => store.finishedAt(orgId, v.wo.id)).filter(Boolean).sort((a, b) => b - a)[0];
  const lastDays = lastDone ? Math.round((+store.now() - +lastDone) / 86400e3) : null;
  const fmtVal = (o) => o ? Object.entries(o).map(([k, v]) => `${k}: ${v ?? '—'}`).join(', ') : '—';
  const contact = `<section class="card card-pad stack" data-ann="customer-contact"><div class="row"><h3 class="grow">${tx('customer.contact')}</h3>${edit ? `<button class="btn btn-sm" data-action="edit-customer" data-id="${c.id}" data-fk="edit-c">${icon('pen', 'sm')} Editar</button>` : ''}</div>
    <div class="row">${icon('phoneCall', 'sm')}<span class="tabular" data-test="cust-phone">${esc(c.phone)}</span></div>
    <div class="row">${icon('mail', 'sm')}<span class="ellipsis">${esc(c.email || '—')}</span></div>
    <dl class="kv"><dt>Tipo</dt><dd>${c.type === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}</dd><dt>CPF</dt><dd class="tabular">${esc(c.document || '—')} <span class="subtle">(fictício)</span></dd><dt>Desde</dt><dd>${date(c.created_at)}</dd></dl>
    ${lastAudit ? `<div class="stack-sm" data-ann="audit-log"><span class="subtle" style="font-size:12px">Alterado por ${esc(store.getProfile(lastAudit.user_id)?.name.split(' ')[0] || '—')} em ${dateTime(lastAudit.at)}</span>
      <button class="btn btn-sm btn-ghost" style="align-self:flex-start" data-action="toggle-audit" aria-expanded="${!!state.showAudit}">${state.showAudit ? 'Ocultar' : 'Ver'} histórico de alterações (${audits.length})</button>
      ${state.showAudit ? `<ol class="timeline" style="font-size:13px">${audits.map((a) => `<li><span class="tl-dot todo"></span><div><strong>${a.action === 'create' ? 'Criado' : 'Alterado'}</strong> · ${esc(a.entity === 'customers' ? t('entity.customer') : t('entity.asset'))}</div><div class="subtle">${a.payload.before ? `antes: ${esc(fmtVal(a.payload.before))}<br>` : ''}depois: ${esc(fmtVal(a.payload.after))}</div><div class="subtle" style="font-size:12px">${dateTime(a.at)} · ${esc(store.getProfile(a.user_id)?.name || '—')}</div></li>`).join('')}</ol>` : ''}</div>` : ''}</section>`;
  const vehicles = `<section class="card card-pad stack" data-ann="asset-fields"><div class="row"><h3 class="grow">${tx('customer.assets')} <span class="subtle">${assets.length}</span></h3>${edit ? `<button class="btn btn-sm" data-action="edit-asset" data-customer="${c.id}">+ Adicionar</button>` : ''}</div>
    ${assets.length ? assets.map((a) => { const at = store.getAssetType(orgId, a.asset_type_id); return `<div class="response-block"><div class="row" style="margin-bottom:8px">${icon('car')}<strong class="grow">${esc(a.attributes.brand)} ${esc(a.attributes.model)}</strong>${edit ? `<button class="btn btn-sm btn-ghost" data-action="edit-asset" data-customer="${c.id}" data-asset="${a.id}">${icon('pen', 'sm')} Editar</button>` : ''}</div>${renderFieldValues(at.fields, a.attributes)}</div>`; }).join('') : `<p class="muted">Nenhum ${t('entity.asset', { lower: true })} cadastrado.</p>`}</section>`;
  const rec = `<section class="card card-pad stack" data-ann="recurrence"><h3>${tx('customer.review')}</h3>
    ${review ? `<div class="stack-sm"><div class="row-wrap"><strong>Próxima revisão</strong>${reviewBadge(review)}</div>
      <p class="muted" style="font-size:13px">Último: ${esc(review.last.item.name)} em ${date(review.last.at)} (#${review.last.wo.number}). A cada ${review.last.item.recurrence_days} dias → vence em ${date(review.due)}.</p>
      ${review.days < 0 && !review.scheduled ? `<div class="alert warn">${icon('lightbulb')}<p>Vale chamar ${esc(c.name.split(' ')[0])} para agendar: o prazo de recorrência de "${esc(review.last.item.name)}" já passou.</p></div>` : ''}</div>`
      : `<p class="muted">${tx('customer.no_review')}</p>`}</section>`;
  const cats = store.getCatalogCategories(orgId).filter((cc) => all.some((v) => v.items.some((i) => i.catalog.category_id === cc.id)));
  const hchip = (k, v, label) => `<button class="chip" aria-pressed="${hf[k] === v}" data-action="hf-set" data-key="${k}" data-v="${v}">${label}</button>`;
  const sumTotal = wos.reduce((s, v) => s + v.total, 0);
  const hist = `<section class="card" data-ann="wo-history"><div class="card-head"><h3>${tx('customer.history')}</h3></div>
    <div class="card-pad stack-sm" style="padding-bottom:0">
      <p class="muted" style="font-size:13px" data-test="hist-summary"><strong style="color:var(--fg)">${plural(wos.length, t('entity.work_order', { lower: true }), t('entity.work_order', { plural: true, lower: true }))}</strong> · ${money(sumTotal)}${lastDays != null ? ` · último há ${plural(lastDays, 'dia', 'dias')}` : ''}</p>
      ${all.length ? `<div class="row-wrap">${hchip('cat', '', 'Todas')}${cats.map((cc) => hchip('cat', cc.id, esc(cc.name))).join('')}<span class="subtle">|</span>${hchip('kind', '', 'Tudo')}${hchip('kind', 'service', esc(t('entity.service', { plural: true })))}${hchip('kind', 'product', esc(t('entity.product', { plural: true })))}</div>` : ''}</div>
    ${wos.length ? `<div style="margin-top:8px">${wos.map((v) => `<button class="list-row" data-action="open-wo" data-id="${v.wo.id}" data-fk="h-${v.wo.id}"><span class="dot" style="background:${esc(v.category?.color)}"></span>
      <span class="grow stack-sm"><span><strong>${esc(v.items.filter((i) => !hf.kind || i.kind === hf.kind).map((s) => s.catalog.name).join(' + '))}</strong></span><span class="subtle" style="font-size:12px">#${v.wo.number} · ${date(scheduledAt(v.wo))} · ${esc(v.asset.attributes.model)} ${esc(v.asset.attributes.plate)}</span></span>
      <span class="stack-sm" style="align-items:flex-end">${milestoneBadge(v.milestone)}<span class="tabular" style="font-size:13px">${money(v.total)}</span></span></button>`).join('')}</div>` : `<div class="empty">${icon('history')}<strong>${all.length ? 'Nada com este filtro' : tx('customer.no_history')}</strong></div>`}</section>`;
  const payHtml = `<section class="card" data-ann="wo-payments"><div class="card-head"><h3>${tx('customer.payments')}</h3><span class="tabular muted">${money(totalPaid)}</span></div>
    ${pays.length ? `<div style="margin-top:8px">${pays.map((p) => { const w = store.getWorkOrder(orgId, p.work_order_id); return `<div class="list-row"><span class="badge ok">${icon('check', 'sm')} ${esc(methods[p.method] || p.method)}</span><span class="grow subtle" style="font-size:13px">#${w.number} · ${date(p.at)}</span><span class="tabular">${money(p.amount)}</span></div>`; }).join('')}</div>` : `<p class="muted card-pad">${tx('wo.no_payments')}</p>`}</section>`;
  return `${back}<div class="page-head" style="margin-top:8px"><div><h1>${esc(c.name)}</h1><p>${plural(all.length, t('entity.work_order', { lower: true }), t('entity.work_order', { plural: true, lower: true }))} · ${plural(assets.length, t('entity.asset', { lower: true }), t('entity.asset', { plural: true, lower: true }))}</p></div></div>
    <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1.4fr)" id="cust-grid"><div class="stack">${contact}${vehicles}${rec}</div><div class="stack">${hist}${payHtml}</div></div>
    <style>@media (max-width:900px){#cust-grid{grid-template-columns:1fr!important}}</style>`;
}

// ---------- Drawers de edição ----------
export function editCustomerDrawer(orgId, m) {
  const d = m.d, e = m.errors || {};
  const f = (k, label, type = 'text', req = false, hint = '') => `<div class="field"><label for="ec-${k}">${label}${req ? '<span class="req">*</span>' : ''}</label><input class="input" id="ec-${k}" type="${type}" data-ed="${k}" data-fk="ec-${k}" value="${esc(d[k] || '')}" ${e[k] ? `aria-invalid="true" aria-describedby="ec-${k}-e"` : ''}>${e[k] ? `<span class="field-error" id="ec-${k}-e">${icon('alert', 'sm')} ${esc(e[k])}</span>` : hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  const body = `<div class="stack">${f('name', 'Nome', 'text', true)}${f('phone', 'Telefone', 'tel', true, 'Com DDD.')}${f('email', 'E-mail', 'email')}${f('document', 'CPF')}
    <p class="subtle" style="font-size:12px" data-ann="audit-log">Toda alteração fica no histórico de alterações, com o valor anterior e o novo.</p></div>`;
  return drawer(`Editar ${esc(t('entity.customer', { lower: true }))}`, body, `<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-customer" data-fk="save-c">Salvar</button>`);
}
export function editAssetDrawer(orgId, m) {
  const at = store.getAssetType(orgId, 'at_vehicle') || store.getAssetType(orgId, store.getAssetsByCustomer(orgId, m.customerId)[0]?.asset_type_id);
  const d = m.d;
  const body = `<div class="stack" data-ann="asset-fields">${at.fields.map((x) => `<div class="field"><label for="ea-${x.key}">${esc(x.label)}${x.required ? '<span class="req">*</span>' : ''}</label>
    ${x.type === 'option' ? `<select class="select" id="ea-${x.key}" data-ed="${x.key}"><option value="">—</option>${x.options.map((o) => `<option ${d[x.key] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<input class="input" id="ea-${x.key}" ${x.type === 'number' ? 'type="number"' : ''} data-ed="${x.key}" data-fk="ea-${x.key}" value="${esc(d[x.key] ?? '')}">`}</div>`).join('')}
    ${m.error ? `<div class="alert danger" role="alert">${icon('alert')}<p>${esc(m.error)}</p></div>` : ''}
    <p class="subtle" style="font-size:12px">Mesmos tipos de campo dos ${esc(t('entity.form', { plural: true, lower: true }))} (D10). ${esc(t('entity.work_order', { plural: true }))} leem o ${esc(t('entity.asset', { lower: true }))} atual; o valor anterior fica no histórico de alterações.</p></div>`;
  return drawer(m.assetId ? `Editar ${esc(t('entity.asset', { lower: true }))}` : `Adicionar ${esc(t('entity.asset', { lower: true }))}`, body, `<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-asset" data-fk="save-a">Salvar</button>`);
}
