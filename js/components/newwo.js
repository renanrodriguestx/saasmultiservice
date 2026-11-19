// Novo atendimento (D17): uma das portas de entrada, pelo "+" do quadro ou pelo botão do cabeçalho.
import * as store from '../store.js';
import { t, tx, gender } from '../i18n.js';
import { icon } from './icons.js';
import { esc, money, dateTime, duration } from './format.js';
import { drawer } from './wo.js';

const g = (k) => (gender(k) === 'f' ? 'a' : 'o');
export function newWoDraft(orgId, stageId) {
  const n = store.now();
  const local = new Date(+n - 3 * 3600e3 + 3600e3);
  const ops = store.getMembersByRole(orgId, 'operator');
  return { q: '', customerId: null, assetId: null, newMode: false, newCustomer: { name: '', phone: '', email: '' }, newAsset: {}, items: [], date: local.toISOString().slice(0, 10), time: `${String(local.getUTCHours()).padStart(2, '0')}:00`, leadId: ops[0]?.user_id || '', startStageId: stageId || null, notes: '' };
}
const schedOf = (d) => new Date(`${d.date}T${d.time || '08:00'}:00-03:00`);

export function newWoDrawer(orgId, m) {
  const d = m.d; const err = m.errors || {};
  const main = store.getMainWorkflow(orgId);
  const stages = store.getStages(orgId, main.id);
  const first = stages[0];
  const arrived = stages.find((s, i) => i > 0 && s.milestone === 'todo');
  const at = store.getAssetType(orgId, 'at_vehicle') || store.getAssetType(orgId, (store.getCustomers(orgId)[0] && store.getAssetsByCustomer(orgId, store.getCustomers(orgId)[0].id)[0]?.asset_type_id));
  const ops = store.getMembers(orgId).filter((x) => x.role_key === 'operator');
  const cust = d.customerId ? store.getCustomer(orgId, d.customerId) : null;
  const asset = d.assetId ? store.getAsset(orgId, d.assetId) : null;
  const open = asset ? store.getOpenWorkOrderForAsset(orgId, asset.id) : null;

  // 1. Cliente e veículo
  let s1;
  if (cust && asset) {
    s1 = `<div class="pick" aria-pressed="true"><span class="check">${icon('check', 'sm')}</span><span class="grow"><strong>${esc(cust.name)}</strong><br><span class="subtle" style="font-size:13px">${esc(asset.attributes.brand)} ${esc(asset.attributes.model)} · <span class="mono">${esc(asset.attributes.plate)}</span> · ${esc(cust.phone)}</span></span><button class="btn btn-sm btn-ghost" data-action="nw-clear">Trocar</button></div>
      ${open ? `<div class="alert warn" role="alert">${icon('alert')}<div class="stack-sm"><p>Este ${t('entity.asset', { lower: true })} já tem ${g('entity.work_order') === 'a' ? 'uma' : 'um'} ${t('entity.work_order', { lower: true })} em aberto: <strong>#${open.number}</strong>. Ele é único no quadro, então continue por lá.</p><div><button class="btn btn-sm" data-action="open-wo" data-id="${open.id}">Abrir #${open.number}</button></div></div></div>` : ''}`;
  } else if (d.newMode) {
    const f = (k, label, type = 'text', req = true) => `<div class="field"><label for="nwc-${k}">${label}${req ? '<span class="req">*</span>' : ''}</label><input class="input" id="nwc-${k}" type="${type}" data-nw="newCustomer.${k}" data-fk="nwc-${k}" value="${esc(d.newCustomer[k] || '')}" ${err.newCustomer?.[k] ? 'aria-invalid="true"' : ''}>${err.newCustomer?.[k] ? `<span class="field-error">${icon('alert', 'sm')} ${esc(err.newCustomer[k])}</span>` : ''}</div>`;
    s1 = `<div class="stack-sm"><div class="row"><strong class="grow">Cadastro rápido</strong><button class="btn btn-sm btn-ghost" data-action="nw-newmode" data-v="0">Buscar existente</button></div>
      <div class="grid grid-2" style="gap:12px">${f('name', 'Nome')}${f('phone', 'Telefone', 'tel')}</div>${f('email', 'E-mail', 'email', false)}
      <div class="field-label" style="margin-top:6px" data-ann="asset-fields">${esc(at.name)}</div>
      <div class="grid grid-2" style="gap:12px">${at.fields.filter((x) => x.key !== 'notes').map((x) => `<div class="field"><label for="nwa-${x.key}">${esc(x.label)}${x.required ? '<span class="req">*</span>' : ''}</label>${x.type === 'option' ? `<select class="select" id="nwa-${x.key}" data-nw="newAsset.${x.key}" data-fk="nwa-${x.key}"><option value="">—</option>${x.options.map((o) => `<option ${d.newAsset[x.key] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<input class="input" id="nwa-${x.key}" ${x.type === 'number' ? 'type="number"' : ''} data-nw="newAsset.${x.key}" data-fk="nwa-${x.key}" value="${esc(d.newAsset[x.key] || '')}">`}</div>`).join('')}</div>
      ${typeof err.newAsset === 'string' ? `<span class="field-error">${icon('alert', 'sm')} ${esc(err.newAsset)}</span>` : ''}</div>`;
  } else {
    const res = d.q.trim().length >= 2 ? store.getCustomers(orgId, { q: d.q }).slice(0, 6) : [];
    s1 = `<div class="search"><label class="sr-only" for="nw-q">Buscar ${esc(t('entity.customer', { lower: true }))} ou placa</label>${icon('search', 'sm')}<input class="input" id="nw-q" placeholder="Nome, telefone ou placa" data-nw="q" data-rerender="1" data-fk="nw-q" value="${esc(d.q)}" autocomplete="off"></div>
      ${res.length ? `<div class="pick-list">${res.map((c) => store.getAssetsByCustomer(orgId, c.id).map((a) => `<button class="pick" data-action="nw-pick" data-c="${c.id}" data-a="${a.id}"><span class="grow"><strong>${esc(c.name)}</strong><br><span class="subtle" style="font-size:13px">${esc(a.attributes.brand)} ${esc(a.attributes.model)} · <span class="mono">${esc(a.attributes.plate)}</span></span></span>${icon('chevronRight', 'sm')}</button>`).join('')).join('')}</div>`
        : d.q.trim().length >= 2 ? `<p class="muted" style="font-size:13px">Ninguém encontrado para "${esc(d.q)}".</p>` : '<p class="subtle" style="font-size:13px">Digite ao menos 2 letras.</p>'}
      <button class="btn btn-sm" data-action="nw-newmode" data-v="1">+ Cadastrar novo ${esc(t('entity.customer', { lower: true }))} e ${esc(t('entity.asset', { lower: true }))}</button>
      ${err.customer || err.asset ? `<span class="field-error">${icon('alert', 'sm')} ${esc(err.customer || err.asset)}</span>` : ''}`;
  }

  // 2. Serviços e produtos
  const cats = store.getCatalogCategories(orgId);
  const items = store.getCatalogItems(orgId, { active: true });
  const sel = new Map(d.items.map((x) => [x.catalogItemId, x]));
  const svcPick = cats.map((c) => { const list = items.filter((i) => i.category_id === c.id); if (!list.length) return ''; return `<div class="stack-sm"><span class="subtle" style="font-size:12px"><span class="dot" style="background:${esc(c.color)}"></span> ${esc(c.name)}</span>${list.map((i) => `<button class="pick" aria-pressed="${sel.has(i.id)}" data-action="nw-item" data-item="${i.id}"><span class="check">${sel.has(i.id) ? icon('check', 'sm') : ''}</span><span class="grow">${esc(i.name)}<br><span class="subtle" style="font-size:12px">${money(i.base_price)}${i.avg_duration_min ? ` · ${duration(i.avg_duration_min)}` : ''}</span></span></button>`).join('')}</div>`; }).join('');
  const chosenSvc = d.items.filter((x) => store.getCatalogItem(orgId, x.catalogItemId)?.kind === 'service');
  const total = d.items.reduce((s, x) => s + (store.getCatalogItem(orgId, x.catalogItemId)?.base_price || 0), 0);
  const mins = chosenSvc.reduce((s, x) => s + (store.getCatalogItem(orgId, x.catalogItemId)?.avg_duration_min || 0), 0);
  const assignRows = chosenSvc.length ? `<div class="stack-sm" data-ann="svc-assignee"><span class="field-label">Responsável por ${esc(t('entity.service', { lower: true }))} (padrão: o d${g('entity.work_order')} ${esc(t('entity.work_order', { lower: true }))})</span>${chosenSvc.map((x) => { const c = store.getCatalogItem(orgId, x.catalogItemId); return `<div class="row"><span class="grow">${esc(c.name)}</span><label class="sr-only" for="nwas-${c.id}">Responsável</label><select class="select" style="width:auto" id="nwas-${c.id}" data-nw-assign="${c.id}"><option value="">Mesmo d${g('entity.work_order')} ${esc(t('entity.work_order', { lower: true }))}</option>${ops.map((o) => `<option value="${o.user_id}" ${x.assigneeId === o.user_id ? 'selected' : ''}>${esc(o.profile.name)}</option>`).join('')}</select></div>`; }).join('')}</div>` : '';

  // 3. Quando + prazo sugerido
  const sched = schedOf(d);
  const due = mins ? store.addWorkMinutes(orgId, sched, mins + 60) : null;

  const step = (n, title, content) => `<section class="stack" style="gap:10px"><h3 class="step-title"><span class="n">${n}</span>${title}</h3>${content}</section>`;
  const body = `<div class="stack" style="gap:24px">
    ${step(1, `${esc(t('entity.customer'))} e ${esc(t('entity.asset', { lower: true }))}`, s1)}
    ${step(2, `${esc(t('entity.service', { plural: true }))}`, `<div class="grid grid-2" style="gap:12px">${svcPick}</div>${err.items ? `<span class="field-error">${icon('alert', 'sm')} ${esc(err.items)}</span>` : ''}
      ${d.items.length ? `<p style="font-size:14px"><strong>${money(total)}</strong> <span class="subtle">· ${d.items.length} ${d.items.length === 1 ? 'item' : 'itens'}${mins ? ` · ${duration(mins)} de trabalho` : ''}</span></p>` : ''}`)}
    ${step(3, 'Quando', `<div class="grid grid-2" style="gap:12px"><div class="field"><label for="nw-date">Data</label><input class="input" type="date" id="nw-date" data-nw="date" data-rerender="1" value="${esc(d.date)}"></div><div class="field"><label for="nw-time">Hora</label><input class="input" type="time" id="nw-time" data-nw="time" data-rerender="1" value="${esc(d.time)}"></div></div>
      ${due ? `<p class="muted" style="font-size:13px" data-ann="card-deadline">${icon('clock', 'sm')} Prazo sugerido: <strong>${dateTime(due)}</strong> (soma das durações em horas de expediente + 1 h de folga)</p>` : ''}`)}
    ${step(4, 'Quem faz', `<div class="field"><label for="nw-lead">Responsável d${g('entity.work_order')} ${esc(t('entity.work_order', { lower: true }))}</label><select class="select" id="nw-lead" data-nw="leadId"><option value="">Sem ${esc(t('role.operator', { lower: true }))} por enquanto</option>${ops.map((o) => `<option value="${o.user_id}" ${d.leadId === o.user_id ? 'selected' : ''}>${esc(o.profile.name)}</option>`).join('')}</select></div>${assignRows}`)}
    ${step(5, 'Onde entra', `<div class="stack-sm" role="radiogroup" aria-label="Onde entra no quadro">
      <button class="stage-option" role="radio" aria-checked="${(d.startStageId || first.id) === first.id}" data-action="nw-start" data-stage="${first.id}"><span class="grow"><strong>${esc(first.label)}</strong><br><span class="subtle" style="font-size:12px">Ainda vai chegar</span></span></button>
      ${arrived ? `<button class="stage-option" role="radio" aria-checked="${d.startStageId === arrived.id}" data-action="nw-start" data-stage="${arrived.id}"><span class="grow"><strong>O ${esc(t('entity.asset', { lower: true }))} já está aqui</strong><br><span class="subtle" style="font-size:12px">Entra direto em "${esc(arrived.label)}"</span></span></button>` : ''}</div>
      <div class="field"><label for="nw-notes">Observações</label><textarea class="textarea" id="nw-notes" data-nw="notes" style="min-height:60px">${esc(d.notes)}</textarea></div>`)}
    ${m.error ? `<div class="alert danger" role="alert">${icon('alert')}<p>${esc(m.error)}</p></div>` : ''}
  </div>`;
  const foot = `<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="nw-submit" data-fk="nw-submit" ${open ? 'disabled aria-disabled="true"' : ''}>Criar ${esc(t('entity.work_order', { lower: true }))}</button>`;
  return drawer(tx('wo.new'), body, foot, { sub: `Entra no ${esc(t('entity.workflow', { lower: true }))} "${esc(main.name)}". Fica registrad${g('entity.work_order')} como criad${g('entity.work_order')} manualmente.` });
}

export function newWoPayload(orgId, d) {
  return {
    customerId: d.customerId, assetId: d.assetId,
    newCustomer: d.newMode ? d.newCustomer : null, newAsset: d.newMode ? d.newAsset : null,
    items: d.items, scheduledAt: schedOf(d).toISOString(), leadId: d.leadId || null,
    startStageId: d.startStageId || null, notes: d.notes, source: 'manual',
  };
}
