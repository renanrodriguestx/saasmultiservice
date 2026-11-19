// App do operador (D4): "o que eu faço agora", uma ação principal por tela.
// D15: o detailer vê os SERVIÇOS dele (agrupados por veículo) + as etapas dos atendimentos de que é responsável.
// D17: "Receber veículo" (check-in) cria o atendimento. D13: tudo funciona com a fila offline.
import * as store from '../store.js';
import { t, tx, gender } from '../i18n.js';
import { icon } from '../components/icons.js';
import { esc, time, longDay, scheduledAt, sameLocalDay, plural, money, duration } from '../components/format.js';
import { renderFormFields } from '../components/fields.js';
import { deadlineBadge, svcStatusBadge, avatar } from '../components/wo.js';
import { state, render, toast, userId } from '../app.js';

const art = () => (gender('role.operator') === 'f' ? 'a' : 'o');
const art2 = () => (gender('entity.work_order') === 'f' ? 'a' : 'o');

// ---------- Derivações (estado efetivo no aparelho: servidor + fila) ----------
function viewWithCtx(orgId, woId) {
  const v = store.getWorkOrderView(orgId, woId);
  if (!v) return null;
  const ctx = store.effectiveCtx(orgId, woId);
  const stage = store.getStage(orgId, ctx.mainStageId);
  const subStage = ctx.subStageId ? store.getStage(orgId, ctx.subStageId) : null;
  const pending = store.getQueue().filter((q) => q.woId === woId);
  const services = v.services.map((i) => ({ ...i, exec_status: ctx.items.get(i.id) || i.exec_status }));
  return { ...v, services, ctx, stage, subStage, milestone: stage?.milestone, deadline: store.deadlineOf(v.wo, stage?.milestone), pending };
}
/** Ação de etapa do atendimento (só para o responsável), rótulo derivado do marco (D6). */
export function actionFor(orgId, v) {
  if (v.milestone === 'finished' || v.milestone === 'canceled') return null;
  const ns = store.nextStep(orgId, v.wo.id, v.ctx);
  if (!ns) return null;
  if (ns.type === 'complete_subflow') {
    const ret = store.getStage(orgId, v.stage.return_stage_id);
    return { kind: 'wo', ns, label: `Concluir ${ns.stage.label}`, hint: `Fecha o ${t('entity.subflow', { lower: true })} e volta para "${ret.label}".` };
  }
  const { from, to } = ns;
  if (to.milestone === 'finished' && from.milestone === 'finished') return null; // entrega é com a gestão
  let label;
  if (from.milestone === 'todo' && to.milestone === 'todo') label = `Registrar: ${to.label}`;
  else if (from.milestone === 'todo' && to.milestone === 'started') label = 'Iniciar trabalho';
  else if (to.milestone === 'finished') label = `Finalizar ${t('entity.work_order', { lower: true })}`;
  else label = `Concluir ${from.label}`;
  const hint = `Etapa d${art2()} ${t('entity.work_order', { lower: true })} · próxima: ${to.label}${to.opens_workflow_id ? ` (começa em ${store.getStages(orgId, to.opens_workflow_id)[0].label})` : ''}.`;
  return { kind: 'wo', ns, label, hint };
}
/** Tarefas do usuário num atendimento: serviços dele + etapa (se responsável). Ordem = prioridade. */
function tasksFor(orgId, v, uid) {
  const out = [];
  const isLead = v.lead?.user_id === uid;
  for (const i of v.services.filter((x) => x.assignee_id === uid)) {
    if (i.exec_status === 'started') out.push({ kind: 'item', item: i, act: 'finish', label: `Finalizar ${i.catalog.name}`, prio: 0 });
    else if (i.exec_status === 'todo') out.push({ kind: 'item', item: i, act: 'start', label: `Iniciar ${i.catalog.name}`, prio: v.milestone === 'todo' ? 9 : 1, waiting: v.milestone === 'todo' });
  }
  if (isLead) { const a = actionFor(orgId, v); if (a) out.push({ ...a, prio: v.milestone === 'todo' ? 2 : 3 }); }
  return out.sort((a, b) => a.prio - b.prio);
}
function myDay(orgId, uid) {
  const today = store.now();
  const ids = new Set([...store.getWorkOrders(orgId, { assigneeId: uid }).map((w) => w.id), ...store.getServiceExecutions(orgId, { assigneeId: uid, status: 'all' }).map((x) => x.wo.id)]);
  const list = [...ids].map((id) => viewWithCtx(orgId, id)).filter((v) => v && v.milestone !== 'canceled').map((v) => ({ v, tasks: tasksFor(orgId, v, uid) }));
  const active = list.filter(({ v, tasks }) => tasks.length && (v.milestone === 'started' || sameLocalDay(scheduledAt(v.wo), today) || tasks.some((x) => x.kind === 'item' && x.act === 'finish')));
  active.sort((a, b) => Math.min(...a.tasks.map((x) => x.prio)) - Math.min(...b.tasks.map((x) => x.prio)) || scheduledAt(a.v.wo) - scheduledAt(b.v.wo));
  const done = list.filter(({ v, tasks }) => !tasks.length && (v.services.some((i) => i.assignee_id === uid && i.exec_status === 'done' && (v.pending.length || sameLocalDay(i.finished_at || today, today))) || (v.milestone === 'finished' && sameLocalDay(v.mainState.entered_at, today))));
  return { active, done };
}

// ---------- Telas ----------
export function renderOperator({ orgId }) {
  const uid = state.operatorId;
  const isMember = store.getMembersByRole(orgId, 'operator').some((m) => m.user_id === uid);
  const profile = isMember ? store.getProfile(uid) : null;
  let inner;
  if (!profile) inner = `<div class="op-body"><div class="empty" style="margin-top:40px">${icon('user')}<strong>Nenhum ${t('role.operator', { lower: true })} nesta organização</strong><p>Convide a equipe em Cadastros › Equipe.</p></div></div>`;
  else if (state.op.screen === 'wo') inner = woScreen(orgId, uid, state.op.woId);
  else if (state.op.screen === 'form') inner = formScreen(orgId, uid);
  else if (state.op.screen === 'checkin') inner = checkinScreen(orgId, uid);
  else inner = dayScreen(orgId, uid, profile);
  const n = store.now();
  return `<div class="phone-stage">
    <div class="phone" data-ann="op-app" aria-label="App d${art()} ${esc(t('role.operator', { lower: true }))}">
      <div class="phone-status" aria-hidden="true"><span>${time(n)}</span><span class="row">${store.isOffline() ? icon('wifiOff', 'sm') : icon('wifi', 'sm')}</span></div>
      <div class="phone-screen">${inner}</div>
    </div>
    <aside class="phone-side stack">
      <div class="card card-pad stack-sm"><strong>App d${art()} ${esc(t('role.operator', { lower: true }))} (D4, D15)</strong>
      <p class="muted" style="font-size:13px">Mostra os ${esc(t('entity.service', { plural: true, lower: true }))} de ${esc(profile?.name.split(' ')[0] || 'cada um')}, agrupados por ${esc(t('entity.asset', { lower: true }))}, e as etapas d${art2()}s ${esc(t('entity.work_order', { plural: true, lower: true }))} de que é responsável. Uma ação principal por tela.</p></div>
      <div class="card card-pad stack-sm" data-ann="offline"><strong>Fila offline (D13)</strong>
      <p class="muted" style="font-size:13px">Use "${tx('op.offline_sim')}": formulários, ${esc(t('entity.service', { plural: true, lower: true }))} e até o check-in ficam no aparelho e sobem em ordem ao reconectar. A gestão só vê depois do envio.</p></div>
    </aside></div>`;
}

function headBar(orgId, title, backAction) {
  const off = store.isOffline();
  const q = store.getQueue();
  const qs = store.queueSummary(q);
  const fl = store.getFlushState();
  const conflicts = store.getConflicts();
  const detail = [qs.creates ? plural(qs.creates, 'check-in', 'check-ins') : '', qs.forms ? plural(qs.forms, t('entity.form', { lower: true }), t('entity.form', { plural: true, lower: true })) : '', qs.photos ? plural(qs.photos, 'foto', 'fotos') : '', qs.moves ? plural(qs.moves, 'ação', 'ações') : ''].filter(Boolean).join(' · ');
  return `<header class="op-head">
    <div class="row">${backAction ? `<button class="btn btn-ghost btn-icon" data-action="${backAction}" aria-label="${tx('op.back')}" style="width:44px;height:44px" data-fk="op-back">${icon('arrowLeft')}</button>` : ''}
      <div class="grow" style="min-width:0">${title}</div>
      <span class="conn ${off ? 'off' : 'on'}" role="status">${off ? icon('wifiOff', 'sm') + ' Sem conexão' : icon('wifi', 'sm') + ' Online'}</span></div>
    <div class="row"><button class="btn btn-sm ${off ? 'btn-primary' : ''}" data-action="op-toggle-offline" data-ann="offline" data-fk="op-off" style="min-height:44px">${off ? icon('wifi', 'sm') + ' ' + tx('op.online_sim') : icon('wifiOff', 'sm') + ' ' + tx('op.offline_sim')}</button></div>
    ${fl ? `<div class="queue-pill" role="status" data-ann="offline"><span class="spinner"></span> ${tx('op.queue_sending', { i: fl.i, n: fl.n })}</div>` : q.length ? `<div class="queue-pill" role="status" data-ann="offline">${icon('upload', 'sm')}<span><strong>${tx('op.queue', { n: qs.items, items: qs.items === 1 ? 'item' : 'itens' })}</strong><br><span style="font-weight:400">${detail}</span></span></div>` : ''}
    ${conflicts.length ? `<div class="alert danger" role="alert">${icon('alert')}<div class="stack-sm">${conflicts.map((c) => `<p>${esc(c.message)}</p>`).join('')}<button class="btn btn-sm" data-action="op-dismiss-conflicts">Entendi</button></div></div>` : ''}
  </header>`;
}

function taskButton(orgId, v, task, big = false) {
  if (task.waiting) return `<button class="btn ${big ? 'btn-lg' : ''} btn-block" disabled aria-disabled="true">${esc(task.label)}</button><p class="muted" style="font-size:12px;text-align:center">Aguardando ${art2()} ${esc(t('entity.work_order', { lower: true }))} começar (está em "${esc(v.stage.label)}").</p>`;
  const attrs = task.kind === 'item' ? `data-action="op-svc" data-item="${task.item.id}" data-act="${task.act}" data-id="${v.wo.id}"` : `data-action="op-act" data-id="${v.wo.id}"`;
  return `<button class="btn ${big ? 'btn-primary btn-lg' : ''} btn-block" style="min-height:44px" ${attrs} data-fk="t-${task.kind}-${task.item?.id || v.wo.id}">${task.kind === 'item' ? icon(task.act === 'finish' ? 'check' : 'play', 'sm') : icon('move', 'sm')} ${esc(task.label)}</button>`;
}
function vehicleHead(v) {
  return `<strong>${esc(v.asset.attributes.model)} <span class="mono subtle" style="font-weight:400">${esc(v.asset.attributes.plate)}</span></strong>`;
}

function dayScreen(orgId, uid, profile) {
  const { active, done } = myDay(orgId, uid);
  const creates = store.getQueue().filter((q) => q.type === 'create_wo' && q.byUserId === uid);
  const title = `<div style="font-size:12px" class="muted">${esc(longDay(store.now()))}</div><h2 style="font-size:18px">${tx('op.hello', { name: esc(profile.name.split(' ')[0]) })}</h2>`;
  const receive = `<button class="btn btn-block" style="min-height:44px" data-action="op-checkin" data-fk="op-checkin" data-ann="wo-source">${icon('car', 'sm')} ${tx('op.receive')}</button>`;
  const queued = creates.length ? `<h3 style="font-size:14px">Na fila do aparelho</h3>${creates.map((c) => `<div class="op-item" style="--cat:var(--warn)"><div class="grow stack-sm"><strong>Check-in: ${esc(c.label || '')}</strong><span class="badge warn" style="align-self:flex-start">${icon('upload', 'sm')} aguardando envio</span></div></div>`).join('')}` : '';
  if (!active.length && !done.length) {
    return `${headBar(orgId, title)}<div class="op-body">${receive}${queued}<div class="empty" style="margin-top:32px">${icon('checkCircle')}<strong>${tx('op.empty_title')}</strong><p>${tx('op.empty_body')}</p></div></div>`;
  }
  let body = receive + queued;
  const first = active.find(({ tasks }) => tasks.some((x) => !x.waiting));
  if (first) {
    const task = first.tasks.find((x) => !x.waiting);
    body += `<section class="op-next" data-ann="op-next" aria-labelledby="next-h"><span class="eyebrow" id="next-h">${tx('op.next_action')}</span>
      <button class="op-item" style="--cat:${esc(first.v.category?.color)};border-width:1px 1px 1px 4px" data-action="op-open" data-id="${first.v.wo.id}">
        <div class="grow stack-sm">${vehicleHead(first.v)}<span class="muted" style="font-size:13px">${esc(first.v.customer.name)}</span>
        <span class="row-wrap"><span class="badge ${first.v.milestone === 'started' ? 'info' : ''}">${esc(first.v.subStage ? `${first.v.stage.label}: ${first.v.subStage.label}` : first.v.stage.label)}</span>${deadlineBadge(first.v)}${first.v.pending.length ? `<span class="badge warn">${icon('upload', 'sm')} na fila</span>` : ''}</span></div>${icon('chevronRight')}</button>
      ${taskButton(orgId, first.v, task, true)}${task.hint ? `<p class="muted" style="font-size:12px;text-align:center">${esc(task.hint)}</p>` : ''}
    </section>`;
  }
  const rest = active.filter((x) => x !== first);
  const vcard = ({ v, tasks }) => `<button class="op-item" style="--cat:${esc(v.category?.color)}" data-action="op-open" data-id="${v.wo.id}" data-fk="op-${v.wo.id}">
      <div class="grow stack-sm">${vehicleHead(v)}
      <span class="muted" style="font-size:13px">${v.milestone === 'todo' ? `${time(scheduledAt(v.wo))} · ` : ''}${esc(v.subStage ? `${v.stage.label}: ${v.subStage.label}` : v.stage.label)}</span>
      ${tasks.length ? `<span style="font-size:13px">${tasks.map((x) => esc(x.label)).join(' · ')}</span>` : ''}
      ${v.pending.length ? `<span class="badge warn" style="align-self:flex-start">${icon('upload', 'sm')} aguardando envio</span>` : ''}</div>${deadlineBadge(v)}${icon('chevronRight')}</button>`;
  if (rest.length) body += `<h3 style="font-size:14px;margin-top:8px">${tx('op.later')}</h3>${rest.map(vcard).join('')}`;
  if (done.length) body += `<h3 style="font-size:14px;margin-top:8px">${tx('op.done_today')}</h3>${done.map(vcard).join('')}`;
  return `${headBar(orgId, title)}<div class="op-body">${body}</div>`;
}

function woScreen(orgId, uid, woId) {
  const v = viewWithCtx(orgId, woId);
  const mine = v && (v.assignees.some((a) => a.user_id === uid) || v.services.some((i) => i.assignee_id === uid));
  if (!mine) return `${headBar(orgId, '<strong>Sem acesso</strong>', 'op-home')}<div class="op-body"><div class="empty">${icon('alert')}<strong>Sem acesso</strong><p>Est${art2() === 'a' ? 'a' : 'e'} ${esc(t('entity.work_order', { lower: true }))} não tem nada atribuído a você.</p></div></div>`;
  const tasks = tasksFor(orgId, v, uid);
  const main = store.getMainWorkflow(orgId);
  const stages = store.getStages(orgId, main.id).filter((s) => !s.opens_workflow_id || v.usesSubflow);
  const curIdx = stages.findIndex((s) => s.id === v.stage.id);
  const subStages = v.subStage ? store.getStages(orgId, v.subStage.workflow_id) : [];
  const subIdx = subStages.findIndex((s) => s.id === v.subStage?.id);
  const at = store.getAssetType(orgId, v.asset.asset_type_id);
  const primary = tasks.find((x) => !x.waiting);
  const title = `<div style="font-size:12px" class="muted">#${v.wo.number} · ${esc(v.customer.name)}</div><h2 style="font-size:18px">${esc(v.asset.attributes.brand)} ${esc(v.asset.attributes.model)}</h2>`;
  const svcList = v.services.map((i) => {
    const isMine = i.assignee_id === uid;
    const ev = store.itemEvidence(orgId, i);
    const task = tasks.find((x) => x.kind === 'item' && x.item.id === i.id);
    return `<div class="svc-row" style="--cat:${esc(store.getCategory(orgId, i.catalog.category_id)?.color)}">
      <div class="stack-sm" style="min-width:0"><strong>${esc(i.catalog.name)}</strong><span class="subtle" style="font-size:12px">${isMine ? 'Seu' : `${esc(store.getProfile(i.assignee_id)?.name.split(' ')[0] || '—')}`}${i.catalog.avg_duration_min ? ` · previsto ${duration(i.catalog.avg_duration_min)}` : ''}${ev.photos ? ` · ${ev.photos} foto${ev.photos === 1 ? '' : 's'}` : ''}</span></div>
      <div class="acts">${svcStatusBadge(i.exec_status)}</div>
      ${isMine && task && task !== primary ? `<div class="meta" style="display:block">${taskButton(orgId, v, task)}</div>` : ''}</div>`;
  }).join('');
  const body = `
    <div class="card card-pad stack">
      <div class="row-wrap"><span class="mono" style="font-size:16px;font-weight:600" data-ann="asset-fields">${esc(v.asset.attributes.plate)}</span><span class="badge">${esc(v.asset.attributes.color || '')}</span>${deadlineBadge(v)}</div>
      ${v.asset.attributes.notes ? `<div class="alert info" style="padding:8px 12px">${icon('info', 'sm')}<p style="font-size:13px">${esc(at.fields.find((f) => f.key === 'notes')?.label || '')}: ${esc(v.asset.attributes.notes)}</p></div>` : ''}
      ${v.wo.notes ? `<p class="muted" style="font-size:13px">${esc(v.wo.notes)}</p>` : ''}
    </div>
    <div class="stack-sm" data-ann="wo-services"><div class="field-label">${esc(t('entity.service', { plural: true }))}</div>${svcList}</div>
    <div class="card card-pad stack-sm"><div class="field-label">${esc(t('entity.stage', { plural: true }))} d${art2()} ${esc(t('entity.work_order', { lower: true }))}${v.lead ? ` · responsável: ${esc(v.lead.user_id === uid ? 'você' : v.lead.profile.name.split(' ')[0])}` : ''}</div>
      <div class="steps-dots" aria-hidden="true">${stages.map((s, i) => `<span class="${i < curIdx ? 'done' : i === curIdx ? 'cur' : ''}"></span>`).join('')}</div>
      <p><strong>${esc(v.stage.label)}</strong> <span class="subtle">· ${curIdx + 1} de ${stages.length}</span></p>
      ${v.subStage ? `<div class="steps-dots" aria-hidden="true" style="margin-top:6px">${subStages.map((s, i) => `<span class="${i < subIdx ? 'done' : i === subIdx ? 'cur' : ''}"></span>`).join('')}</div><p data-ann="card-subflow">${icon('layers', 'sm')} ${esc(store.getWorkflow(orgId, v.subStage.workflow_id).name)}: <strong>${esc(v.subStage.label)}</strong> <span class="subtle">· ${subIdx + 1} de ${subStages.length}</span></p>` : ''}
      ${tasks.find((x) => x.kind === 'wo') && tasks.find((x) => x.kind === 'wo') !== primary ? taskButton(orgId, v, tasks.find((x) => x.kind === 'wo')) : ''}
    </div>
    ${v.pending.length ? `<div class="queue-pill">${icon('upload', 'sm')} ${plural(v.pending.length, 'ação', 'ações')} deste ${esc(t('entity.work_order', { lower: true }))} na fila do aparelho</div>` : ''}
    <div class="card card-pad"><a class="row" style="text-decoration:none;min-height:44px" href="tel:${esc(v.customer.phone.replace(/\D/g, ''))}">${icon('phoneCall')} <span>${esc(v.customer.phone)}</span></a></div>`;
  const foot = primary ? `<div class="op-foot stack-sm" data-ann="op-next">${taskButton(orgId, v, primary, true)}${primary.hint ? `<p class="muted" style="font-size:12px;text-align:center">${esc(primary.hint)}</p>` : ''}</div>`
    : `<div class="op-foot"><div class="alert ok">${icon('checkCircle')}<p>${tasks.length ? 'Aguardando o início do trabalho.' : 'Nada pendente para você aqui.'}</p></div></div>`;
  return `${headBar(orgId, title, 'op-home')}<div class="op-body">${body}</div>${foot}`;
}

function formScreen(orgId) {
  const o = state.op;
  const v = viewWithCtx(orgId, o.woId);
  const form = store.getForm(orgId, o.formId);
  const fields = store.getFormFields(orgId, o.formId);
  const st = store.getStage(orgId, o.stageId);
  const item = o.itemId ? v.services.find((i) => i.id === o.itemId) : null;
  const phase = item ? (o.thenItem === 'finish' ? 'after' : 'during') : st?.milestone === 'todo' ? 'before' : /finaliz|inspe/i.test(form.name) ? 'after' : 'during';
  const filled = fields.filter((f) => o.draft.answers[f.key] !== undefined && o.draft.answers[f.key] !== '').length;
  const title = `<div style="font-size:12px" class="muted">${esc(v.asset.attributes.model)} · ${esc(v.asset.attributes.plate)}${item ? ` · ${esc(item.catalog.name)}` : ''}</div><h2 style="font-size:18px">${esc(form.name)}</h2>`;
  const body = `<p class="muted" style="font-size:13px" data-ann="form-blocked">${esc(form.description || '')} Obrigatório para ${item ? (o.thenItem === 'finish' ? 'finalizar' : 'iniciar') + ' o ' + esc(t('entity.service', { lower: true })) : 'seguir'}.</p>
    <p class="subtle" style="font-size:12px">${filled} de ${fields.length} campos preenchidos</p>
    ${o.error ? `<div class="alert danger" role="alert">${icon('alert')}<p>${esc(o.error)}</p></div>` : ''}
    ${renderFormFields(fields, o.draft, { errors: o.errors || [], vehicleColor: v.asset.attributes.color, phase, idPrefix: 'of' })}`;
  const label = o.thenItem ? `Enviar e ${o.thenItem === 'finish' ? 'finalizar' : 'iniciar'}` : 'Enviar e seguir';
  return `${headBar(orgId, title, 'op-form-cancel')}<div class="op-body">${body}</div>
    <div class="op-foot"><button class="btn btn-primary btn-lg btn-block" data-action="op-form-submit" data-fk="op-submit">${icon('check')} ${label}</button></div>`;
}

// ---------- Check-in (D17: porta de entrada pelo app) ----------
function checkinScreen(orgId, uid) {
  const c = state.op.ci;
  const main = store.getMainWorkflow(orgId);
  const arrived = store.getStages(orgId, main.id).find((s, i) => i > 0 && s.milestone === 'todo') || store.getStages(orgId, main.id)[0];
  const title = `<div style="font-size:12px" class="muted">Passo ${c.step} de 3</div><h2 style="font-size:18px">${tx('op.receive')}</h2>`;
  let body = '', foot = '';
  if (c.step === 1) {
    const res = c.q.trim().length >= 2 ? store.getCustomers(orgId, { q: c.q }).slice(0, 5) : [];
    const sel = c.assetId ? store.getAsset(orgId, c.assetId) : null;
    const open = sel ? store.getOpenWorkOrderForAsset(orgId, sel.id) : null;
    body = c.newMode ? `<div class="stack-sm"><p class="muted" style="font-size:13px">Cadastro rápido. A recepção completa depois.</p>
        ${[['name', 'Nome do ' + t('entity.customer', { lower: true }), 'text'], ['phone', 'Telefone', 'tel']].map(([k, l, ty]) => `<div class="field"><label for="ci-${k}">${l}<span class="req">*</span></label><input class="input" id="ci-${k}" type="${ty}" data-ci="newCustomer.${k}" data-fk="ci-${k}" value="${esc(c.newCustomer[k] || '')}"></div>`).join('')}
        ${[['plate', 'Placa'], ['brand', 'Marca'], ['model', 'Modelo']].map(([k, l]) => `<div class="field"><label for="ci-a-${k}">${l}<span class="req">*</span></label><input class="input" id="ci-a-${k}" data-ci="newAsset.${k}" data-fk="ci-a-${k}" value="${esc(c.newAsset[k] || '')}"></div>`).join('')}
        <button class="btn btn-sm btn-ghost" data-action="ci-newmode" data-v="0">Buscar cadastrado</button></div>`
      : `<div class="search"><label class="sr-only" for="ci-q">Placa ou nome</label>${icon('search', 'sm')}<input class="input" id="ci-q" placeholder="Placa ou nome" data-ci="q" data-rerender="1" data-fk="ci-q" value="${esc(c.q)}" autocomplete="off"></div>
        ${sel ? `<div class="pick" aria-pressed="true"><span class="check">${icon('check', 'sm')}</span><span class="grow">${esc(sel.attributes.model)} <span class="mono">${esc(sel.attributes.plate)}</span><br><span class="subtle" style="font-size:12px">${esc(store.getCustomer(orgId, sel.customer_id).name)}</span></span></div>` : ''}
        ${open ? `<div class="alert warn" role="alert">${icon('alert')}<p>Este ${esc(t('entity.asset', { lower: true }))} já tem ${art2() === 'a' ? 'uma' : 'um'} ${esc(t('entity.work_order', { lower: true }))} aberto (#${open.number}). Peça para a recepção.</p></div>` : ''}
        <div class="pick-list">${res.map((cu) => store.getAssetsByCustomer(orgId, cu.id).map((a) => `<button class="pick" aria-pressed="${c.assetId === a.id}" data-action="ci-pick" data-a="${a.id}" data-c="${cu.id}"><span class="grow"><strong>${esc(a.attributes.model)}</strong> <span class="mono">${esc(a.attributes.plate)}</span><br><span class="subtle" style="font-size:12px">${esc(cu.name)}</span></span></button>`).join('')).join('')}</div>
        <button class="btn btn-sm btn-ghost" data-action="ci-newmode" data-v="1">Não encontrou? Cadastrar</button>`;
    foot = `<button class="btn btn-primary btn-lg btn-block" data-action="ci-next" data-fk="ci-next">Continuar</button>`;
  } else if (c.step === 2) {
    const items = store.getCatalogItems(orgId, { kind: 'service', active: true });
    body = `<p class="muted" style="font-size:13px">Quais ${esc(t('entity.service', { plural: true, lower: true }))} o ${esc(t('entity.customer', { lower: true }))} pediu?</p><div class="stack-sm">${items.map((i) => `<button class="pick" aria-pressed="${c.items.includes(i.id)}" data-action="ci-item" data-item="${i.id}"><span class="check">${c.items.includes(i.id) ? icon('check', 'sm') : ''}</span><span class="grow">${esc(i.name)}<br><span class="subtle" style="font-size:12px">${money(i.base_price)} · ${duration(i.avg_duration_min)}</span></span></button>`).join('')}</div>`;
    foot = `<button class="btn btn-primary btn-lg btn-block" data-action="ci-next" data-fk="ci-next">Continuar</button>`;
  } else {
    const b = store.getBindingsFor(orgId, '__none__', arrived.id).find((x) => x.required) || store.getBindingsFor(orgId, '__none__', arrived.id)[0];
    if (!b) body = `<p class="muted">Nenhum ${esc(t('entity.form', { lower: true }))} exigido na chegada.</p>`;
    else {
      const fields = store.getFormFields(orgId, b.form_id);
      const color = c.assetId ? store.getAsset(orgId, c.assetId).attributes.color : 'Prata';
      body = `<p class="muted" style="font-size:13px" data-ann="form-blocked">${esc(b.form.name)}: ${esc(b.form.description || '')}</p>${renderFormFields(fields, c.draft, { errors: c.errors || [], vehicleColor: color, phase: 'before', idPrefix: 'ci' })}`;
    }
    foot = `<button class="btn btn-primary btn-lg btn-block" data-action="ci-submit" data-fk="ci-submit">${icon('check')} Registrar chegada</button>`;
  }
  return `${headBar(orgId, title, c.step > 1 ? 'ci-back' : 'op-home')}<div class="op-body">${c.error ? `<div class="alert danger" role="alert">${icon('alert')}<p>${esc(c.error)}</p></div>` : ''}${body}</div><div class="op-foot">${foot}</div>`;
}

// ---------- Ações ----------
function performWo(orgId, v, ns) {
  if (store.isOffline()) {
    store.enqueue(ns.type === 'complete_subflow' ? { type: 'complete_subflow', woId: v.wo.id, byUserId: userId() } : { type: 'move', woId: v.wo.id, toStageId: ns.to.id, byUserId: userId() });
    toast(tx('op.saved_offline'), 'info'); return;
  }
  const r = ns.type === 'complete_subflow' ? store.completeSubflow(orgId, v.wo.id, userId()) : store.moveWorkOrder(orgId, v.wo.id, ns.to.id, userId());
  if (!r.ok) { toast(r.message, 'warn'); return; }
  toast(ns.type === 'complete_subflow' ? tx('move.subflow_returned', { flow: r.summary.workflow.name, stage: r.summary.stage.label }) : `${r.summary.stage.label}. Registrado.`);
}
function performItem(orgId, woId, itemId, act) {
  if (store.isOffline()) { store.enqueue({ type: 'item', woId, itemId, action: act, byUserId: userId() }); toast(tx('op.saved_offline'), 'info'); return; }
  const r = store.itemAction(orgId, itemId, act, userId());
  if (!r.ok) { toast(r.message, 'warn'); return; }
  toast(`${store.getCatalogItem(orgId, r.item.catalog_item_id).name}: ${tx('svc.status.' + r.to).toLowerCase()}.`);
}
function goForm(woId, missing, extra) {
  state.op = { screen: 'form', woId, formId: missing.formId, stageId: missing.stageId, returnTo: state.op.screen === 'day' ? 'day' : 'wo', draft: { answers: {}, camera: null }, errors: [], ...extra };
  render(); document.querySelector('.phone-screen')?.scrollTo(0, 0);
}
function actWo(woId) {
  const orgId = state.orgId;
  const v = viewWithCtx(orgId, woId);
  const a = actionFor(orgId, v);
  if (!a) return;
  const plan = a.ns.type === 'complete_subflow' ? store.planCompleteSubflow(orgId, woId, v.ctx) : store.planMove(orgId, woId, a.ns.to.id, v.ctx);
  if (!plan.ok && plan.code === 'missing_form') return goForm(woId, plan.missing, {});
  if (!plan.ok) { toast(plan.message, 'warn'); return; }
  performWo(orgId, v, a.ns);
}
function actItem(woId, itemId, act) {
  const orgId = state.orgId;
  const v = viewWithCtx(orgId, woId);
  const plan = store.planItem(orgId, itemId, act, v.ctx);
  if (!plan.ok && plan.code === 'missing_form') return goForm(woId, plan.missing, { itemId, thenItem: act });
  if (!plan.ok) { toast(plan.message, 'warn'); return; }
  performItem(orgId, woId, itemId, act);
}
const setPath = (obj, path, val) => { const ks = path.split('.'); let o = obj; ks.slice(0, -1).forEach((k) => { o = o[k]; }); o[ks[ks.length - 1]] = val; };
export function operatorInput(el) {
  if (!el.dataset.ci || state.op.screen !== 'checkin') return false;
  setPath(state.op.ci, el.dataset.ci, el.value);
  if (el.dataset.rerender) render();
  return true;
}

export const operatorActions = {
  'op-open': (el) => { state.op = { screen: 'wo', woId: el.dataset.id }; render(); document.querySelector('.phone-screen')?.scrollTo(0, 0); },
  'op-home': () => { state.op = { screen: 'day', woId: null }; render(); },
  'op-act': (el) => actWo(el.dataset.id),
  'op-svc': (el) => actItem(el.dataset.id, el.dataset.item, el.dataset.act),
  'op-form-cancel': () => { state.op = { screen: state.op.returnTo === 'wo' ? 'wo' : 'day', woId: state.op.woId }; render(); },
  'op-form-submit': () => {
    const orgId = state.orgId;
    const o = state.op;
    const val = store.validateAnswers(orgId, o.formId, o.draft.answers);
    if (!val.ok) { o.errors = val.missing; o.error = val.message; render(); document.querySelector('.phone-screen')?.scrollTo(0, 0); return; }
    const payload = { woId: o.woId, formId: o.formId, stageId: o.stageId, itemId: o.itemId || null, answers: o.draft.answers, byUserId: userId() };
    if (store.isOffline()) store.enqueue({ type: 'form', ...payload }); else store.submitFormResponse(orgId, payload);
    state.op = { screen: 'wo', woId: o.woId };
    if (o.itemId) actItem(o.woId, o.itemId, o.thenItem); else actWo(o.woId);
    render();
  },
  'op-toggle-offline': async () => {
    const goingOnline = store.isOffline();
    const res = await store.setOffline(state.orgId, userId(), !goingOnline);
    if (goingOnline && res) toast(tx('op.queue_flushed', { n: res.n, items: res.n === 1 ? 'item' : 'itens' }) + (res.conflicts ? ` ${res.conflicts} com conflito: veja o aviso.` : ''));
  },
  'op-dismiss-conflicts': () => store.dismissConflicts(),
  // Check-in
  'op-checkin': () => { state.op = { screen: 'checkin', ci: { step: 1, q: '', assetId: null, customerId: null, newMode: false, newCustomer: {}, newAsset: {}, items: [], draft: { answers: {}, camera: null }, errors: [] } }; render(); },
  'ci-newmode': (el) => { state.op.ci.newMode = el.dataset.v === '1'; state.op.ci.assetId = null; render(); },
  'ci-pick': (el) => { Object.assign(state.op.ci, { assetId: el.dataset.a, customerId: el.dataset.c, error: null }); render(); },
  'ci-item': (el) => { const l = state.op.ci.items; const i = l.indexOf(el.dataset.item); if (i > -1) l.splice(i, 1); else l.push(el.dataset.item); state.op.ci.error = null; render(); },
  'ci-back': () => { state.op.ci.step -= 1; state.op.ci.error = null; render(); },
  'ci-next': () => {
    const c = state.op.ci, orgId = state.orgId;
    if (c.step === 1) {
      if (c.newMode) { const e = store.validateCustomer({ name: c.newCustomer.name, phone: c.newCustomer.phone }); if (Object.keys(e).length || !c.newAsset.plate || !c.newAsset.brand || !c.newAsset.model) { c.error = Object.values(e)[0] || 'Preencha placa, marca e modelo.'; render(); return; } }
      else if (!c.assetId) { c.error = `Escolha o ${t('entity.asset', { lower: true })} ou cadastre.`; render(); return; }
      else if (store.getOpenWorkOrderForAsset(orgId, c.assetId)) { c.error = `Este ${t('entity.asset', { lower: true })} já tem ${art2() === 'a' ? 'uma' : 'um'} ${t('entity.work_order', { lower: true })} em aberto.`; render(); return; }
    }
    if (c.step === 2 && !c.items.length) { c.error = `Escolha pelo menos um ${t('entity.service', { lower: true })}.`; render(); return; }
    c.step += 1; c.error = null; render(); document.querySelector('.phone-screen')?.scrollTo(0, 0);
  },
  'ci-submit': () => {
    const c = state.op.ci, orgId = state.orgId, uid = userId();
    const main = store.getMainWorkflow(orgId);
    const arrived = store.getStages(orgId, main.id).find((s, i) => i > 0 && s.milestone === 'todo') || store.getStages(orgId, main.id)[0];
    const b = store.getBindingsFor(orgId, '__none__', arrived.id).find((x) => x.required);
    if (b) { const val = store.validateAnswers(orgId, b.form_id, c.draft.answers); if (!val.ok) { c.errors = val.missing; c.error = val.message; render(); document.querySelector('.phone-screen')?.scrollTo(0, 0); return; } }
    const woId = 'wo_c' + Math.random().toString(36).slice(2, 10); // id gerado no aparelho (idempotência da fila)
    const data = { customerId: c.newMode ? null : c.customerId, assetId: c.newMode ? null : c.assetId, newCustomer: c.newMode ? { name: c.newCustomer.name, phone: c.newCustomer.phone } : null, newAsset: c.newMode ? { ...c.newAsset, year: '', color: '', notes: '' } : null, items: c.items.map((id) => ({ catalogItemId: id })), leadId: uid, startStageId: arrived.id, source: 'checkin', scheduledAt: store.now().toISOString() };
    const label = c.newMode ? `${c.newAsset.model} ${String(c.newAsset.plate).toUpperCase()}` : (() => { const a = store.getAsset(orgId, c.assetId); return `${a.attributes.model} ${a.attributes.plate}`; })();
    const formOp = b ? { woId, formId: b.form_id, stageId: arrived.id, itemId: null, answers: c.draft.answers, byUserId: uid } : null;
    if (store.isOffline()) {
      store.enqueue({ type: 'create_wo', woId, data, byUserId: uid, label });
      if (formOp) store.enqueue({ type: 'form', ...formOp });
      state.op = { screen: 'day' }; toast(tx('op.saved_offline'), 'info'); render(); return;
    }
    const r = store.createWorkOrder(orgId, data, uid, { id: woId });
    if (!r.ok) { c.error = r.message; render(); return; }
    if (formOp) store.submitFormResponse(orgId, formOp);
    toast(`Chegada registrada: #${r.wo.number} em ${arrived.label}.`);
    state.op = { screen: 'wo', woId }; render();
  },
};
