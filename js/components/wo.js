// Componentes da OS: card do kanban, modal grande (abas + trilho), "Mover etapa", formulário em modal,
// e as ações por serviço (D15: responsável e status por item).
import * as store from '../store.js';
import { t, tx, gender } from '../i18n.js';
import { icon } from './icons.js';
import { esc, dateTime, money, initials, relHours, date, time, scheduledAt, duration } from './format.js';
import { renderFormFields, renderFieldValues } from './fields.js';
import { renderAttachmentUrl, phaseLabel } from './photo.js';

const MILESTONE = { todo: ['A fazer', ''], started: ['Em andamento', 'info'], finished: ['Concluído', 'ok'], canceled: ['Cancelado', 'danger'] };
export function milestoneBadge(m) { const [l, c] = MILESTONE[m] || [m, '']; return `<span class="badge ${c}" data-ann="column-milestone">${l}</span>`; }
const SVC_STATUS = { todo: ['', 'clock'], started: ['info', 'play'], done: ['ok', 'check'], not_done: ['danger', 'x'] };
export function svcStatusBadge(st) { const [c, ic] = SVC_STATUS[st] || ['', 'clock']; return `<span class="badge ${c}" data-ann="svc-status">${icon(ic, 'sm')} ${tx('svc.status.' + st)}</span>`; }
const SOURCE = { manual: 'Criad{g} manualmente', checkin: 'Check-in no app', recurrence: 'Recorrência', portal: 'Portal do cliente', network: 'Rede' };
export const sourceLabel = (s) => (SOURCE[s] || s).replace('{g}', gender('entity.work_order') === 'f' ? 'a' : 'o');

export function deadlineBadge(v) {
  const d = v.deadline;
  if (d.state === 'late') return `<span class="badge danger" data-ann="card-deadline">${icon('alert', 'sm')} ${tx('card.late')} · ${relHours(d.ms)}</span>`;
  if (d.state === 'soon') return `<span class="badge warn" data-ann="card-deadline">${icon('clock', 'sm')} ${tx('card.due_soon', { h: relHours(d.ms) })}</span>`;
  if (d.state === 'ok') return `<span class="badge" data-ann="card-deadline">${icon('calendar', 'sm')} ${dateTime(v.wo.due_at)}</span>`;
  return '';
}
export function avatar(profile, cls = '') { return `<span class="avatar ${cls}" title="${esc(profile?.name || '')}" aria-hidden="true">${esc(initials(profile?.name))}</span>`; }
export const vehicleLine = (v) => v.asset ? `${esc(v.asset.attributes.brand)} ${esc(v.asset.attributes.model)} · <span class="mono">${esc(v.asset.attributes.plate)}</span>` : '—';
export function evidenceText(ev) {
  const parts = [];
  if (ev.photos) parts.push(`${icon('camera', 'sm')} ${ev.photos} foto${ev.photos === 1 ? '' : 's'}`);
  if (ev.checklistTotal) parts.push(`${icon('checkCircle', 'sm')} checklist ${ev.checklistYes}/${ev.checklistTotal}`);
  if (ev.signatures) parts.push(`${icon('pen', 'sm')} assinatura`);
  if (ev.required) parts.push(ev.answeredRequired >= ev.required ? `<span style="color:var(--ok)">${icon('check', 'sm')} ${ev.answeredRequired}/${ev.required} obrigatórios</span>` : `<span style="color:var(--warn)">${icon('alert', 'sm')} ${ev.answeredRequired}/${ev.required} obrigatórios</span>`);
  return parts.length ? `<span class="ev" data-ann="svc-evidence">${parts.join('<span class="subtle">·</span>')}</span>` : '<span class="subtle" style="font-size:13px">Sem evidências</span>';
}

// ---------- Card (sem botões: o card inteiro abre o modal) ----------
export function woCard(v, { draggable = false, showSub = true } = {}) {
  const services = v.services.map((i) => i.catalog.name);
  const products = v.items.filter((i) => i.kind === 'product').length;
  const doneSvc = v.services.filter((i) => i.exec_status === 'done' || i.exec_status === 'not_done').length;
  const people = [...new Set(v.services.map((i) => i.assignee_id).filter(Boolean))].map((id) => store.getProfile(id));
  return `<article class="wo-card" style="--cat:${esc(v.category?.color || '')}" ${draggable ? 'draggable="true"' : ''} data-wo="${v.wo.id}" tabindex="0" role="button"
      aria-label="${esc(t('entity.work_order'))} ${v.wo.number}, ${esc(v.customer.name)}, ${esc(v.stage?.label || '')}. Enter abre e permite mover." data-action="open-wo" data-id="${v.wo.id}" data-fk="card-${v.wo.id}">
    <div class="top"><span class="num">#${v.wo.number}</span><span class="dot" style="background:${esc(v.category?.color)}" data-ann="card-category" title="${esc(v.category?.name)}"></span><span class="subtle" style="font-size:12px">${esc(v.category?.name || '')}</span>
      ${v.wo.source === 'checkin' ? `<span class="badge" style="margin-left:auto" title="${esc(sourceLabel('checkin'))}" data-ann="wo-source">check-in</span>` : ''}</div>
    <div class="customer ellipsis" data-ann="card-customer">${esc(v.customer.name)}</div>
    <div class="vehicle ellipsis" data-ann="card-vehicle">${vehicleLine(v)}</div>
    <div class="services" data-ann="card-services">${services.map(esc).join(' + ')}${products ? ` <span class="subtle">+ ${products} ${t('entity.product', { count: products, lower: true })}</span>` : ''}
      ${v.services.length > 1 || doneSvc ? `<span class="subtle" style="font-size:12px"> · ${doneSvc}/${v.services.length}</span>` : ''}</div>
    ${showSub && v.subStage ? `<div><span class="badge info" data-ann="card-subflow">${icon('layers', 'sm')} ${esc(tx('card.in_subflow', { flow: v.subWorkflow.name, stage: v.subStage.label }))}</span></div>` : ''}
    <div class="foot">
      <span class="row" data-ann="card-operator">${people.length ? people.map((p) => avatar(p)).join('') + `<span style="font-size:13px">${esc(people.map((p) => p.name.split(' ')[0]).join(', '))}</span>` : `<span class="subtle" style="font-size:13px">${tx('card.no_operator')}</span>`}</span>
      <span class="grow"></span>${deadlineBadge(v)}
    </div>
  </article>`;
}

// ---------- Próxima ação do atendimento ----------
export function nextAction(orgId, v) {
  const ns = store.nextStep(orgId, v.wo.id);
  if (!ns) return null;
  if (ns.type === 'complete_subflow') { const ret = store.getStage(orgId, v.stage.return_stage_id); return { ns, label: `Concluir ${v.subWorkflow.name} e voltar para ${ret.label}`, target: '__complete' }; }
  return { ns, label: `Mover para ${ns.to.label}`, target: ns.to.id };
}

// ---------- Modal da OS ----------
export function woModal(orgId, m, { canAssign }) {
  const v = store.getWorkOrderView(orgId, m.woId);
  if (!v) return dialog('Não encontrado', `<div class="empty">${icon('alert')}<strong>Não encontrado</strong><p>Não existe nesta organização.</p></div>`, '');
  const tab = m.tab || 'data';
  const resp = store.getResponses(orgId, v.wo.id);
  const hist = store.getHistory(orgId, v.wo.id);
  const ihist = store.getItemHistoryByWo(orgId, v.wo.id);
  const tabs = [['data', 'Resumo'], ['forms', `${t('entity.form', { plural: true })} e fotos`, resp.length], ['items', 'Itens e pagamento', v.items.length], ['history', tx('wo.tab.history'), hist.length + ihist.length]];
  let body = '';
  if (tab === 'data') body = summaryTab(orgId, v, canAssign);
  if (tab === 'forms') body = formsTab(orgId, v, resp);
  if (tab === 'items') body = itemsTab(orgId, v);
  if (tab === 'history') body = historyTab(orgId, v, hist, ihist);
  const na = v.milestone !== 'canceled' ? nextAction(orgId, v) : null;
  const cta = `${na ? `<button class="btn btn-primary btn-block" style="min-height:44px" data-action="wo-advance" data-id="${v.wo.id}" data-fk="wo-advance" data-ann="move-stage">${icon('move', 'sm')} ${esc(na.label)}</button>` : ''}
      ${v.milestone !== 'canceled' ? `<button class="btn btn-block" data-action="open-move" data-id="${v.wo.id}" data-ann="move-stage" data-fk="wo-other">Outra ${t('entity.stage', { lower: true })}…</button>` : ''}`;
  const head = `<div class="wo-head">
      <div class="row" style="align-items:flex-start">
        <div class="grow stack-sm" style="min-width:0">
          <div class="row-wrap"><span class="mono subtle">#${v.wo.number}</span>${milestoneBadge(v.milestone)}<span class="badge" data-ann="column">${esc(v.stage?.label)}</span>${v.subStage ? `<span class="badge info" data-ann="card-subflow">${icon('layers', 'sm')} ${esc(v.subWorkflow.name)}: ${esc(v.subStage.label)}</span>` : ''}</div>
          <h2 id="dlg-title" style="font-size:20px"><a href="#cliente-${v.customer.id.replace(/_/g, '-')}" data-action="close-modal-nav" style="text-decoration:none" data-ann="card-customer">${esc(v.customer.name)}</a></h2>
          <div class="muted" data-ann="card-vehicle">${vehicleLine(v)}</div>
        </div>
        <button class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar" data-fk="wo-close">${icon('x')}</button>
      </div>
      ${progress(orgId, v)}
    </div>`;
  const tabsHtml = `<div class="tabs" role="tablist" aria-label="Seções">${tabs.map(([k, l, c]) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-action="wo-tab" data-tab="${k}" data-fk="tab-${k}">${l}${c != null ? `<span class="count subtle">${c}</span>` : ''}</button>`).join('')}</div>`;
  return `<div class="overlay" data-action="overlay-close"><div class="dialog xl" role="dialog" aria-modal="true" aria-labelledby="dlg-title" data-size-probe>
    ${head}
    <div class="wo-layout">
      <section class="wo-main">${tabsHtml}<div class="scroll" role="tabpanel">${body}</div></section>
      <aside class="wo-rail" aria-label="Ações e situação">${rail(orgId, v, cta)}</aside>
    </div>
    ${cta ? `<div class="mobile-cta stack-sm">${cta}</div>` : ''}
  </div></div>`;
}

function progress(orgId, v) {
  const main = store.getMainWorkflow(orgId);
  const stages = store.getStages(orgId, main.id);
  const ci = stages.findIndex((s) => s.id === v.stage?.id);
  if (v.milestone === 'canceled') return '';
  return `<div class="progress" aria-label="Progresso nas ${esc(t('entity.stage', { plural: true, lower: true }))}" data-ann="column">${stages.map((s, i) => {
    const skip = s.opens_workflow_id && !v.usesSubflow;
    const cls = skip ? 'skip' : i < ci ? 'done' : i === ci ? 'cur' : '';
    let sub = '';
    if (s.opens_workflow_id && !skip) {
      const ss = store.getStages(orgId, s.opens_workflow_id);
      const si = v.subStage ? ss.findIndex((x) => x.id === v.subStage.id) : (i < ci ? ss.length : -1);
      sub = `<div class="sub" title="${esc(store.getWorkflow(orgId, s.opens_workflow_id).name)}">${ss.map((x, j) => `<span class="${j < si ? 'done' : j === si ? 'cur' : ''}" title="${esc(x.label)}"></span>`).join('')}</div>`;
    }
    return `<div class="step ${cls}" ${i === ci ? 'aria-current="step"' : ''}><span class="bar"></span>${sub}<span class="ellipsis">${esc(s.label)}${i === ci && v.subStage ? `: ${esc(v.subStage.label)}` : ''}</span></div>`;
  }).join('')}</div>`;
}

function rail(orgId, v, cta) {
  const pending = store.getPendingForms(orgId, v.wo.id).filter((p) => p.required && !p.answered);
  const openSvc = v.services.filter((i) => i.exec_status === 'todo' || i.exec_status === 'started');
  const pays = store.getPayments(orgId, { woId: v.wo.id });
  const paid = pays.reduce((s, p) => s + p.amount, 0);
  const lead = v.lead;
  const people = [...new Set(v.services.map((i) => i.assignee_id).filter(Boolean))].filter((id) => id !== lead?.user_id);
  return `
    <div class="rail-sec rail-cta">${cta || '<p class="muted">Sem ação disponível.</p>'}</div>
    <div class="rail-sec" data-ann="form-blocked"><span class="field-label">Pendências</span>
      ${pending.length || openSvc.length ? `${pending.map((p) => `<div class="row"><span class="badge warn">${icon('file', 'sm')} ${esc(p.form.name)}</span><button class="btn btn-sm" data-action="open-form" data-id="${v.wo.id}" data-form="${p.form_id}" data-stage="${p.stage.id}">Preencher</button></div>`).join('')}
        ${openSvc.length ? `<div class="row-wrap" style="font-size:13px">${icon('clock', 'sm')} ${openSvc.length} ${t('entity.service', { count: openSvc.length, lower: true })} por fazer: ${esc(openSvc.map((i) => i.catalog.name).join(', '))}</div>` : ''}`
      : `<span class="badge ok" style="align-self:flex-start">${icon('check', 'sm')} Nada pendente</span>`}</div>
    <div class="rail-sec" data-ann="card-deadline"><span class="field-label">Prazo</span>${deadlineBadge(v) || '<span class="subtle">—</span>'}
      <span style="font-size:13px">Agendado: ${dateTime(scheduledAt(v.wo))}<br>Entrega prometida: ${dateTime(v.wo.due_at)}</span></div>
    <div class="rail-sec" data-ann="card-operator"><span class="field-label">Equipe</span>
      ${lead ? `<div class="row">${avatar(lead.profile)}<span>${esc(lead.profile.name)} <span class="subtle">· responsável</span></span></div>` : `<span class="subtle">${tx('card.no_operator')}</span>`}
      ${people.map((id) => `<div class="row">${avatar(store.getProfile(id))}<span>${esc(store.getProfile(id).name)} <span class="subtle">· ${t('entity.service', { lower: true })}</span></span></div>`).join('')}
      <span class="subtle" style="font-size:12px">${esc(t('role.manager'))}: ${esc(store.getProfile(v.wo.responsible_id)?.name || '—')}</span></div>
    <div class="rail-sec" data-ann="wo-payments"><span class="field-label">Valor</span><span class="kpi-value" style="font-size:22px">${money(v.total)}</span>
      ${paid >= v.total && paid > 0 ? `<span class="badge ok" style="align-self:flex-start">${icon('check', 'sm')} Pago</span>` : paid > 0 ? `<span class="badge warn" style="align-self:flex-start">Pago ${money(paid)}</span>` : `<span class="badge" style="align-self:flex-start">Sem ${t('entity.payment', { lower: true })} registrado</span>`}</div>
    <div class="rail-sec" data-ann="customer-contact"><span class="field-label">Contato</span><span>${icon('phoneCall', 'sm')} ${esc(v.customer.phone)}</span>
      <span class="subtle" style="font-size:12px" data-ann="wo-source">${esc(sourceLabel(v.wo.source))} · ${dateTime(v.wo.created_at)}</span></div>`;
}

export function serviceRows(orgId, v, { canAssign, actions = true, onlyUser = null } = {}) {
  const ops = store.getMembers(orgId).filter((m) => m.role_key === 'operator' || m.role_key === 'manager');
  const list = v.services.filter((i) => !onlyUser || i.assignee_id === onlyUser);
  if (!list.length) return `<p class="muted">Nenhum ${t('entity.service', { lower: true })}.</p>`;
  return `<div class="stack-sm" data-ann="wo-services">${list.map((i) => {
    const cat = store.getCategory(orgId, i.catalog.category_id);
    const ev = store.itemEvidence(orgId, i);
    const act = !actions ? '' : i.exec_status === 'todo' ? `<button class="btn btn-sm" data-action="item-act" data-item="${i.id}" data-act="start" data-fk="ia-${i.id}">${icon('play', 'sm')} Iniciar</button>`
      : i.exec_status === 'started' ? `<button class="btn btn-sm" data-action="item-act" data-item="${i.id}" data-act="finish" data-fk="ia-${i.id}">${icon('check', 'sm')} Finalizar</button>` : '';
    const nd = actions && (i.exec_status === 'todo' || i.exec_status === 'started') ? `<button class="btn btn-sm btn-ghost" data-action="item-notdone" data-item="${i.id}">Não realizado</button>` : '';
    const who = canAssign && (i.exec_status === 'todo' || i.exec_status === 'started')
      ? `<label class="sr-only" for="as-${i.id}">Responsável por ${esc(i.catalog.name)}</label><select class="select" id="as-${i.id}" data-change="item-assign" data-item="${i.id}" data-fk="as-${i.id}" data-ann="svc-assignee">${ops.map((o) => `<option value="${o.user_id}" ${o.user_id === i.assignee_id ? 'selected' : ''}>${esc(o.profile.name)}</option>`).join('')}${i.assignee_id && !ops.some((o) => o.user_id === i.assignee_id) ? `<option selected>${esc(i.assignee?.name || '—')}</option>` : ''}</select>`
      : `<span class="row" data-ann="svc-assignee">${avatar(i.assignee)}${esc(i.assignee?.name || '—')}</span>`;
    return `<div class="svc-row" style="--cat:${esc(cat?.color)}">
      <div class="stack-sm" style="min-width:0"><strong>${esc(i.catalog.name)}</strong><span class="subtle" style="font-size:12px">${esc(cat?.name || '')} · ${money(i.qty * i.unit_price - i.discount)}${i.catalog.avg_duration_min ? ` · previsto ${duration(i.catalog.avg_duration_min)}` : ''}</span></div>
      <div class="acts">${svcStatusBadge(i.exec_status)}${act}${nd}</div>
      <div class="meta">${who}${evidenceText(ev)}
        ${i.started_at ? `<span class="subtle">${i.finished_at ? `${time(i.started_at)}–${time(i.finished_at)}, ${date(i.finished_at)}` : `desde ${dateTime(i.started_at)}`}</span>` : ''}
        ${i.not_done_reason ? `<span class="badge danger">Motivo: ${esc(i.not_done_reason)}</span>` : ''}
        ${ev.responses.length ? `<button class="btn btn-sm btn-ghost" data-action="open-svc" data-item="${i.id}">Ver comprovação</button>` : ''}</div>
    </div>`;
  }).join('')}</div>`;
}

function summaryTab(orgId, v, canAssign) {
  const at = store.getAssetType(orgId, v.asset.asset_type_id);
  const loc = { unit: `No ${t('entity.unit', { lower: true })}`, customer_site: `No ${t('entity.customer', { lower: true })}`, both: `No ${t('entity.unit', { lower: true })} ou no ${t('entity.customer', { lower: true })}` };
  const products = v.items.filter((i) => i.kind === 'product');
  return `<div class="stack" style="gap:20px">
    ${v.wo.notes ? `<div class="alert info">${icon('info')}<p>${esc(v.wo.notes)}</p></div>` : ''}
    <section class="stack-sm"><h3 style="font-size:15px">${tx('wo.services')}</h3>${serviceRows(orgId, v, { canAssign })}
      ${products.length ? `<p class="muted" style="font-size:13px">${esc(t('entity.product', { plural: true }))}: ${products.map((p) => esc(p.catalog.name)).join(', ')}</p>` : ''}</section>
    <div class="grid grid-2">
      <section class="response-block" data-ann="asset-fields"><div class="field-label" style="margin-bottom:8px">${esc(at.name)}</div>${renderFieldValues(at.fields, v.asset.attributes)}</section>
      <section class="response-block"><dl class="kv">
        <dt>Local</dt><dd data-ann="service-location">${esc([...new Set(v.services.map((s) => loc[s.catalog.service_location] || '—'))].join(' · '))}</dd>
        <dt>Origem</dt><dd data-ann="wo-source">${esc(sourceLabel(v.wo.source))}</dd>
        <dt>Criad${gender('entity.work_order') === 'f' ? 'a' : 'o'}</dt><dd>${dateTime(v.wo.created_at)} · ${esc(store.getProfile(v.wo.created_by)?.name || '—')}</dd>
      </dl></section>
    </div></div>`;
}

function responseBlock(orgId, r) {
  const f = store.getForm(orgId, r.form_id);
  const fields = store.getFormFields(orgId, r.form_id, r.form_version);
  const st = store.getStage(orgId, r.stage_id);
  const photos = fields.filter((x) => x.type === 'photo' && r.answers[x.key]).map((x) => ({ x, att: store.getAttachment(orgId, r.answers[x.key]) })).filter((p) => p.att);
  const others = fields.filter((x) => x.type !== 'photo');
  const offline = Math.abs(new Date(r.synced_at) - new Date(r.client_created_at)) > 90e3;
  return `<section class="response-block stack"><div class="row-wrap"><strong>${esc(f.name)}</strong>${st ? `<span class="badge">${esc(st.label)}</span>` : ''}${(r.form_version || 1) < (f.version || 1) ? `<span class="badge" title="Respondido numa versão anterior do formulário">versão ${r.form_version}</span>` : ''}
    <span class="subtle" style="font-size:12px">${dateTime(r.client_created_at)} · ${esc(store.getProfile(r.submitted_by)?.name || '—')}${offline ? ` · enviado ${time(r.synced_at)} (fila offline)` : ''}</span></div>
    ${photos.length ? `<div class="photos">${photos.map(({ x, att }) => `<figure class="photo" style="margin:0">${renderAttachmentUrl(att.url)}<figcaption>${esc(x.label)} · ${phaseLabel(att.phase)}</figcaption></figure>`).join('')}</div>` : ''}
    ${others.length ? renderFieldValues(others, r.answers, { attachment: (id) => store.getAttachment(orgId, id) }) : ''}</section>`;
}
export { responseBlock };

function formsTab(orgId, v, resp) {
  const woResp = resp.filter((r) => !r.work_order_item_id);
  const pendingStage = store.getPendingForms(orgId, v.wo.id).filter((p) => !p.answered);
  const svcBlocks = v.services.map((i) => {
    const r = resp.filter((x) => x.work_order_item_id === i.id);
    const next = i.exec_status === 'todo' ? 'service_start' : i.exec_status === 'started' ? 'service_finish' : null;
    const pend = next ? store.getServiceBindings(orgId, i.catalog_item_id, next).filter((b) => !r.some((x) => x.form_id === b.form_id)) : [];
    if (!r.length && !pend.length) return '';
    return `<div class="stack-sm"><h4 style="font-size:14px">${esc(i.catalog.name)} <span class="subtle" style="font-weight:400">· ${esc(i.assignee?.name || '—')}</span></h4>
      ${r.map((x) => responseBlock(orgId, x)).join('')}
      ${pend.map((b) => `<div class="row"><span class="badge ${b.required ? 'warn' : ''}">${b.required ? 'Obrigatório' : 'Opcional'}</span><span>${esc(b.form.name)} <span class="subtle">· para ${b.moment === 'service_start' ? 'iniciar' : 'finalizar'}</span></span></div>`).join('')}</div>`;
  }).filter(Boolean);
  if (!resp.length && !pendingStage.length && !svcBlocks.length) return `<div class="empty">${icon('file')}<strong>${tx('wo.no_forms')}</strong><p>Aparecem aqui quando ${t('role.operator', { lower: true })} responde no app.</p></div>`;
  return `<div class="stack" style="gap:24px" data-ann="wo-forms">
    <section class="stack-sm"><h3 style="font-size:15px">D${gender('entity.work_order') === 'f' ? 'a' : 'o'} ${t('entity.work_order', { lower: true })}</h3>
      ${woResp.map((r) => responseBlock(orgId, r)).join('') || '<p class="muted">Nenhum respondido ainda.</p>'}
      ${pendingStage.map((p) => `<div class="row"><span class="badge ${p.required ? 'warn' : ''}">${p.required ? 'Obrigatório' : 'Opcional'}</span><span>${esc(p.form.name)} · ${esc(p.stage.label)}</span><button class="btn btn-sm" data-action="open-form" data-id="${v.wo.id}" data-form="${p.form_id}" data-stage="${p.stage.id}">Preencher</button></div>`).join('')}</section>
    ${svcBlocks.length ? `<section class="stack" style="gap:16px"><h3 style="font-size:15px">D${gender('entity.service') === 'f' ? 'as' : 'os'} ${t('entity.service', { plural: true, lower: true })}</h3>${svcBlocks.join('')}</section>` : ''}
  </div>`;
}

function itemsTab(orgId, v) {
  const pays = store.getPayments(orgId, { woId: v.wo.id });
  const methods = Object.fromEntries((store.getOrganization(orgId).config.payment_methods || []).map((m) => [m.key, m.label]));
  return `<div class="stack"><table class="table" data-ann="wo-items"><thead><tr><th>Item</th><th>Tipo</th><th style="text-align:right">Qtd</th><th style="text-align:right">Valor</th></tr></thead><tbody>
    ${v.items.map((i) => `<tr><td><span class="dot" style="background:${esc(store.getCategory(orgId, i.catalog.category_id)?.color)}"></span> ${esc(i.catalog.name)}</td><td>${i.kind === 'service' ? t('entity.service') : t('entity.product')}</td><td style="text-align:right">${i.qty}</td><td style="text-align:right" class="tabular">${money(i.qty * i.unit_price - i.discount)}${i.discount ? `<div class="subtle" style="font-size:12px">desconto ${money(i.discount)}</div>` : ''}</td></tr>`).join('')}
    <tr><td colspan="3"><strong>${tx('wo.total')}</strong></td><td style="text-align:right" class="tabular"><strong>${money(v.total)}</strong></td></tr></tbody></table>
    <p class="subtle" style="font-size:12px">Preço copiado do catálogo no momento da criação: mudar o catálogo não altera este valor.</p>
    <div data-ann="wo-payments"><h3 style="margin-bottom:8px;font-size:15px">${tx('wo.payments')}</h3>${pays.length ? pays.map((p) => `<div class="row"><span class="badge ok">${icon('check', 'sm')} ${esc(methods[p.method] || p.method)}</span><span class="tabular">${money(p.amount)}</span><span class="subtle">${dateTime(p.at)} · ${esc(store.getProfile(p.registered_by)?.name)}</span></div>`).join('') : `<p class="muted">${tx('wo.no_payments')}</p>`}</div></div>`;
}

function historyTab(orgId, v, hist, ihist) {
  const main = store.getMainWorkflow(orgId);
  const entries = [
    ...hist.map((h) => ({ at: h.at, kind: 'wo', h })),
    ...ihist.map((h) => ({ at: h.at, kind: 'item', h })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return `<ol class="timeline" data-ann="wo-history" aria-label="Histórico">${entries.map(({ kind, h }) => {
    if (kind === 'item') {
      const it = h.work_order_item_id ? store.getItem(orgId, h.work_order_item_id) : null;
      const name = it ? store.getCatalogItem(orgId, it.catalog_item_id).name : t('entity.work_order');
      const who = (id) => esc(store.getProfile(id)?.name || '—');
      let text;
      if (h.event === 'assigned') text = h.from_value ? `<strong>${esc(name)}</strong>: responsável trocado de ${who(h.from_value)} para ${who(h.to_value)}` : `<strong>${esc(name)}</strong>: atribuído a ${who(h.to_value)}`;
      else if (h.event === 'lead_reassigned') text = `Responsável d${gender('entity.work_order') === 'f' ? 'a' : 'o'} ${t('entity.work_order', { lower: true })}: ${who(h.from_value)} → ${who(h.to_value)}`;
      else text = `<strong>${esc(name)}</strong>: ${esc(tx('svc.status.' + h.to_value).toLowerCase())}${h.payload?.reason ? ` <span class="subtle">(${esc(h.payload.reason)})</span>` : ''}`;
      const ms = h.to_value === 'done' ? 'finished' : h.to_value === 'started' ? 'started' : h.to_value === 'not_done' ? 'canceled' : 'todo';
      return `<li class="sub"><span class="tl-dot ${ms}"></span><div>${text}</div><div class="subtle" style="font-size:12px">${dateTime(h.at)} · ${esc(store.getProfile(h.by_user_id)?.name || '—')} · ${t('entity.service', { lower: true })}</div></li>`;
    }
    const wf = store.getWorkflow(orgId, h.workflow_id);
    const sub = h.workflow_id !== main.id;
    const from = h.from_stage_id ? store.getStage(orgId, h.from_stage_id) : null;
    const to = h.to_stage_id ? store.getStage(orgId, h.to_stage_id) : null;
    let text;
    if (h.payload?.event === 'created') text = `Criad${gender('entity.work_order') === 'f' ? 'a' : 'o'} em <strong>${esc(to.label)}</strong> <span class="subtle">· ${esc(sourceLabel(h.payload.source || 'manual'))}</span>`;
    else if (h.payload?.event === 'subflow_entered') text = `Entrou no ${t('entity.subflow', { lower: true })} <strong>${esc(wf.name)}</strong> em <strong>${esc(to.label)}</strong>`;
    else if (h.payload?.event === 'subflow_completed') text = `Concluiu o ${t('entity.subflow', { lower: true })} <strong>${esc(wf.name)}</strong> (última etapa: ${esc(from.label)})`;
    else if (h.payload?.via === 'subflow_return') text = `Voltou ao ${t('entity.workflow', { lower: true })} principal: <strong>${esc(from.label)}</strong> → <strong>${esc(to.label)}</strong>`;
    else text = `${from ? `${esc(from.label)} → ` : ''}<strong>${esc(to?.label || '—')}</strong>`;
    if (h.payload?.reason) text += ` <span class="subtle">(${esc(h.payload.reason)})</span>`;
    return `<li class="${sub ? 'sub' : ''}"><span class="tl-dot ${h.milestone}"></span><div>${text}</div>
      <div class="subtle" style="font-size:12px">${dateTime(h.at)} · ${esc(store.getProfile(h.by_user_id)?.name || '—')} · ${esc(wf.name)} · marco <span class="mono">${h.milestone}</span></div></li>`;
  }).join('')}</ol>`;
}

// ---------- Diálogo Mover etapa ----------
export function defaultMoveTarget(orgId, woId) {
  const next = store.nextStep(orgId, woId);
  return next?.type === 'move' ? next.to.id : next?.type === 'complete_subflow' ? '__complete' : null;
}
export function blockedAlert(orgId, woId, err, sel) {
  if (!err) return '';
  let extra = '';
  if (err.code === 'missing_form') extra = `<div><button class="btn btn-primary btn-sm" data-action="open-form" data-id="${woId}" data-form="${err.missing.formId}" data-stage="${err.missing.stageId}" ${err.missing.itemId ? `data-item="${err.missing.itemId}" data-then-item="${err.missing.moment === 'service_start' ? 'start' : 'finish'}"` : `data-then="${esc(sel || '')}"`}>${icon('file', 'sm')} ${esc(tx('move.fill_now', { form: err.missing.formName }))}</button></div>`;
  if (err.code === 'services_pending') extra = `<div><button class="btn btn-sm" data-action="open-wo" data-id="${woId}">Ver ${t('entity.service', { plural: true, lower: true })}</button></div>`;
  return `<div class="alert ${err.code === 'missing_form' || err.code === 'services_pending' ? 'warn' : 'danger'}" role="alert" data-ann="form-blocked">${icon('alert')}<div class="stack-sm"><strong>${tx('move.blocked_title')}</strong><p>${esc(err.message)}</p>${extra}</div></div>`;
}
export function moveDialog(orgId, m) {
  const v = store.getWorkOrderView(orgId, m.woId);
  const inSub = !!v.subStage;
  const wfId = inSub ? v.subState.workflow_id : v.mainState.workflow_id;
  const stages = store.getStages(orgId, wfId);
  const curId = inSub ? v.subStage.id : v.stage.id;
  const sel = m.selected || defaultMoveTarget(orgId, v.wo.id);
  const plan = sel === '__complete' ? store.planCompleteSubflow(orgId, v.wo.id) : sel ? store.planMove(orgId, v.wo.id, sel) : null;
  const err = m.error || (plan && !plan.ok ? plan : null);
  const opts = stages.map((s) => {
    const cur = s.id === curId;
    const skip = s.opens_workflow_id && !v.services.some((i) => i.catalog.subflow_workflow_id === s.opens_workflow_id);
    return `<button type="button" class="stage-option" role="radio" aria-checked="${sel === s.id}" data-action="move-select" data-stage="${s.id}" ${cur ? 'disabled' : ''} data-fk="opt-${s.id}">
      <span class="grow"><strong>${esc(s.label)}</strong>${cur ? ` <span class="badge">${tx('move.current')}</span>` : ''}${skip ? ` <span class="subtle" style="font-size:12px">· ${tx('kanban.skips')}</span>` : ''}${s.opens_workflow_id && !skip ? ` <span class="badge info">${icon('layers', 'sm')} abre ${esc(store.getWorkflow(orgId, s.opens_workflow_id).name)}</span>` : ''}</span>
      ${milestoneBadge(s.milestone)}</button>`;
  }).join('');
  const completeOpt = inSub ? (() => { const ret = store.getStage(orgId, v.stage.return_stage_id); return `<button type="button" class="stage-option" role="radio" aria-checked="${sel === '__complete'}" data-action="move-select" data-stage="__complete"><span class="grow"><strong>Concluir ${esc(v.subWorkflow.name)}</strong> <span class="subtle" style="font-size:12px">· volta para "${esc(ret.label)}" no ${t('entity.workflow', { lower: true })} principal</span></span>${icon('chevronRight')}</button>`; })() : '';
  const body = `<div class="stack"><p class="muted">${inSub ? `Está no ${t('entity.subflow', { lower: true })} <strong>${esc(v.subWorkflow.name)}</strong>. Escolha a próxima ${t('entity.stage', { lower: true })} dele.` : `Escolha a ${t('entity.stage', { lower: true })} de destino.`}</p>
    <div class="stack-sm" role="radiogroup" aria-label="${esc(t('entity.stage', { plural: true }))}">${opts}${completeOpt}</div>${blockedAlert(orgId, v.wo.id, err, sel)}</div>`;
  const foot = `<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="move-confirm" ${plan && plan.ok ? '' : 'disabled aria-disabled="true"'} data-fk="move-confirm">${icon('move', 'sm')} ${tx('move.confirm')}</button>`;
  return dialog(`${tx('move.title')} · #${v.wo.number} ${esc(v.customer.name)}`, body, foot, 'sm');
}

// ---------- Formulário em modal (atendimento ou serviço) ----------
export function formDialog(orgId, m) {
  const v = store.getWorkOrderView(orgId, m.woId);
  const form = store.getForm(orgId, m.formId);
  const fields = store.getFormFields(orgId, m.formId);
  const st = store.getStage(orgId, m.stageId);
  const item = m.itemId ? v.items.find((i) => i.id === m.itemId) : null;
  const phase = item ? (m.thenItem === 'finish' ? 'after' : 'during') : st?.milestone === 'todo' ? 'before' : /final|finaliz|inspe/i.test(form.name) ? 'after' : 'during';
  const body = `<div class="stack"><p class="muted">${esc(form.description || '')} ${item ? `${t('entity.service')}: <strong>${esc(item.catalog.name)}</strong>.` : st ? `${t('entity.stage')}: <strong>${esc(st.label)}</strong>.` : ''}</p>
    ${m.error ? `<div class="alert danger" role="alert">${icon('alert')}<p>${esc(m.error)}</p></div>` : ''}
    ${renderFormFields(fields, m.draft, { errors: m.errors || [], vehicleColor: v.asset.attributes.color, phase, idPrefix: 'mf' })}</div>`;
  const foot = `<button class="btn" data-action="form-cancel">Cancelar</button><button class="btn btn-primary" data-action="form-submit" data-fk="form-submit">${icon('check', 'sm')} Enviar${m.thenItem ? ` e ${m.thenItem === 'start' ? 'iniciar' : 'finalizar'}` : m.then ? ' e mover' : ''}</button>`;
  return dialog(`${esc(form.name)} · #${v.wo.number}`, body, foot);
}

export function notDoneDialog(orgId, m) {
  const it = store.getItem(orgId, m.itemId);
  const name = store.getCatalogItem(orgId, it.catalog_item_id).name;
  const body = `<div class="stack"><p class="muted">"${esc(name)}" fica registrado como não realizado, com o motivo, no histórico e no Painel. ${t('entity.work_order')} pode seguir sem ele.</p>
    <div class="field"><label for="nd-reason">Motivo <span class="req">*</span></label><textarea class="textarea" id="nd-reason" data-input="nd-reason" data-fk="nd-reason" ${m.error ? 'aria-invalid="true"' : ''}>${esc(m.reason || '')}</textarea>
    ${m.error ? `<span class="field-error">${icon('alert', 'sm')} ${esc(m.error)}</span>` : '<span class="hint">Ex.: cliente desistiu, peça sem condição de polimento.</span>'}</div></div>`;
  return dialog(`Não realizado · ${esc(name)}`, body, `<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="notdone-confirm" data-fk="nd-ok">Confirmar</button>`, 'sm');
}

export function dialog(title, body, foot, size = '') {
  return `<div class="overlay" data-action="overlay-close"><div class="dialog ${size}" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
    <div class="dialog-head"><h2 id="dlg-title" class="grow" style="font-size:18px">${title}</h2><button class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar">${icon('x')}</button></div>
    <div class="dialog-body">${body}</div>${foot ? `<div class="dialog-foot">${foot}</div>` : ''}</div></div>`;
}
export function drawer(title, body, foot, { wide = false, sub = '' } = {}) {
  return `<div class="drawer-wrap" data-action="overlay-close"><div class="drawer ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
    <div class="dialog-head"><div class="grow"><h2 id="dlg-title" style="font-size:18px">${title}</h2>${sub ? `<p class="muted" style="font-size:13px">${sub}</p>` : ''}</div><button class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar">${icon('x')}</button></div>
    <div class="dialog-body">${body}</div>${foot ? `<div class="dialog-foot">${foot}</div>` : ''}</div></div>`;
}
export { date };
