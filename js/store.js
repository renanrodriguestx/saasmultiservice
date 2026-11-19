// store.js — estado + "consultas" que imitam o banco.
// Regras: toda consulta recebe orgId e filtra por org_id; o histórico da OS é só inserção
// (não existe função que altere ou apague work_order_history; as linhas são congeladas).

import organizations from '../data/organizations.js';
import units from '../data/units.js';
import profiles from '../data/profiles.js';
import memberships from '../data/memberships.js';
import customers from '../data/customers.js';
import customer_assets from '../data/customer_assets.js';
import asset_types from '../data/asset_types.js';
import catalog_categories from '../data/catalog_categories.js';
import catalog_items from '../data/catalog_items.js';
import workflows from '../data/workflows.js';
import workflow_stages from '../data/workflow_stages.js';
import work_orders from '../data/work_orders.js';
import work_order_assignees from '../data/work_order_assignees.js';
import work_order_items from '../data/work_order_items.js';
import work_order_flow_state from '../data/work_order_flow_state.js';
import work_order_history from '../data/work_order_history.js';
import forms from '../data/forms.js';
import form_fields from '../data/form_fields.js';
import form_bindings from '../data/form_bindings.js';
import form_responses from '../data/form_responses.js';
import work_order_attachments from '../data/work_order_attachments.js';
import payments_registered from '../data/payments_registered.js';
import work_order_item_history from '../data/work_order_item_history.js';
import audit_log from '../data/audit_log.js';
import { orgConfigs } from '../config/org-config.js';
import { t, gender } from './i18n.js';
// "este atendimento" / "esta visita": mensagens humanas usam a terminologia da organização
const este = (cap = false) => { const w = (gender('entity.work_order') === 'f' ? 'esta' : 'este') + ' ' + t('entity.work_order', { lower: true }); return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w; };

const clone = (rows) => rows.map((r) => JSON.parse(JSON.stringify(r)));
const db = {
  organizations: clone(organizations), units: clone(units), profiles: clone(profiles), memberships: clone(memberships),
  customers: clone(customers), customer_assets: clone(customer_assets), asset_types: clone(asset_types),
  catalog_categories: clone(catalog_categories), catalog_items: clone(catalog_items),
  workflows: clone(workflows), workflow_stages: clone(workflow_stages),
  work_orders: clone(work_orders), work_order_assignees: clone(work_order_assignees), work_order_items: clone(work_order_items),
  work_order_flow_state: clone(work_order_flow_state),
  work_order_history: clone(work_order_history).map((r) => Object.freeze(r)),
  forms: clone(forms), form_fields: clone(form_fields), form_bindings: clone(form_bindings), form_responses: clone(form_responses),
  work_order_attachments: clone(work_order_attachments), payments_registered: clone(payments_registered),
  work_order_item_history: clone(work_order_item_history).map((r) => Object.freeze(r)),
  audit_log: clone(audit_log).map((r) => Object.freeze(r)),
  usage_events: [], // instrumentação (regra 6): só o servidor escreve; o tenant não lê
};
// Platform admins vivem em tabela própria (doc 13, seção 3), não em memberships.
const platform_admins = [{ user_id: 'usr_platform' }];

// ---------- Relógio simulado ----------
// Os dados foram gerados em torno de 10/11/2026 14:00 (São Paulo). O relógio do protótipo começa
// nesse instante e avança em tempo real, para que prazos e "atrasado" façam sentido em qualquer data.
export const REF_TIME = Date.UTC(2026, 10, 10, 17, 0);
const BOOT = Date.now();
export function now() { return new Date(REF_TIME + (Date.now() - BOOT)); }

// ---------- Eventos ----------
const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn()); }
let seq = 1000;
const newId = (p) => `${p}_n${++seq}`;
export function track(orgId, userId, event, props = {}) {
  db.usage_events.push({ id: newId('evt'), org_id: orgId, user_id: userId, event, props, at: now().toISOString() });
}
export function getUsageEventsForDebug() { return db.usage_events.slice(); }

// ---------- Tenancy ----------
const byOrg = (table, orgId) => db[table].filter((r) => r.org_id === orgId);
export function getOrganization(orgId) {
  const row = db.organizations.find((o) => o.id === orgId);
  const cfg = orgConfigs[orgId];
  if (!row && !cfg) return null;
  return { ...(row || { id: orgId, name: cfg.brand.display_name, status: 'trial', primary_color: cfg.brand.primary_color }), config: cfg };
}
export function listOrganizationIds() { return Object.keys(orgConfigs); }
export function getUnits(orgId) { return byOrg('units', orgId); }
export function getProfile(userId) { return db.profiles.find((p) => p.id === userId) || null; }
/** Membros ativos (convites pendentes e desativados ficam de fora). */
export function getMembers(orgId) {
  return byOrg('memberships', orgId).filter((m) => m.active && (m.status || 'active') === 'active').map((m) => ({ ...m, profile: getProfile(m.user_id) }));
}
export function getAllMembers(orgId) { return byOrg('memberships', orgId).map((m) => ({ ...m, status: m.status || (m.active ? 'active' : 'inactive'), profile: getProfile(m.user_id) })); }
export function getMembership(orgId, userId) { return byOrg('memberships', orgId).find((m) => m.user_id === userId) || null; }
export function getMembersByRole(orgId, role) { return getMembers(orgId).filter((m) => m.role_key === role); }
export function isPlatformAdmin(userId) { return platform_admins.some((p) => p.user_id === userId); }

// ---------- Catálogo ----------
export function getCatalogCategories(orgId) { return byOrg('catalog_categories', orgId).sort((a, b) => a.position - b.position); }
export function getCatalogItems(orgId, { kind, active } = {}) { return byOrg('catalog_items', orgId).filter((i) => (!kind || i.kind === kind) && (active === undefined || !!i.active === active)); }
export function getCatalogItem(orgId, id) { return byOrg('catalog_items', orgId).find((i) => i.id === id) || null; }
export function getCategory(orgId, id) { return byOrg('catalog_categories', orgId).find((c) => c.id === id) || null; }

// ---------- Fluxos ----------
export function getWorkflows(orgId) { return byOrg('workflows', orgId).filter((w) => w.active); }
export function getWorkflow(orgId, id) { return byOrg('workflows', orgId).find((w) => w.id === id) || null; }
export function getMainWorkflow(orgId) { return getWorkflows(orgId).find((w) => w.kind === 'main') || null; }
export function getStages(orgId, workflowId, { includeCanceled = false } = {}) {
  return byOrg('workflow_stages', orgId)
    .filter((s) => s.workflow_id === workflowId && !s.archived_at && (includeCanceled || s.milestone !== 'canceled'))
    .sort((a, b) => a.position - b.position);
}
export function getStage(orgId, id) { return byOrg('workflow_stages', orgId).find((s) => s.id === id) || null; }

// ---------- Clientes e ativos ----------
export function getCustomers(orgId, { q = '' } = {}) {
  const list = byOrg('customers', orgId);
  const n = norm(q);
  if (!n) return list.slice().sort((a, b) => a.name.localeCompare(b.name));
  return list.filter((c) => {
    if (norm(c.name).includes(n) || c.phone.replace(/\D/g, '').includes(n.replace(/\D/g, '') || '§')) return true;
    return getAssetsByCustomer(orgId, c.id).some((a) => norm(a.attributes.plate || '').includes(n.replace(/[^a-z0-9]/g, '')));
  }).sort((a, b) => a.name.localeCompare(b.name));
}
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export function getCustomer(orgId, id) { return byOrg('customers', orgId).find((c) => c.id === id) || null; }
export function getAssetsByCustomer(orgId, customerId) { return byOrg('customer_assets', orgId).filter((a) => a.customer_id === customerId); }
export function getAsset(orgId, id) { return byOrg('customer_assets', orgId).find((a) => a.id === id) || null; }
export function getAssetType(orgId, id) { return byOrg('asset_types', orgId).find((a) => a.id === id) || null; }

// ---------- Ordens de serviço ----------
export function getWorkOrder(orgId, id) { return byOrg('work_orders', orgId).find((w) => w.id === id) || null; }
export function getWorkOrderItems(orgId, woId) { return byOrg('work_order_items', orgId).filter((i) => i.work_order_id === woId); }
export function getAssignees(orgId, woId) {
  return byOrg('work_order_assignees', orgId).filter((a) => a.work_order_id === woId)
    .sort((a, b) => (a.role_in_os === 'lead' ? -1 : 1) - (b.role_in_os === 'lead' ? -1 : 1))
    .map((a) => ({ ...a, profile: getProfile(a.user_id) }));
}
export function getFlowStates(orgId, woId) { return byOrg('work_order_flow_state', orgId).filter((f) => f.work_order_id === woId); }
export function getHistory(orgId, woId) {
  return byOrg('work_order_history', orgId).filter((h) => h.work_order_id === woId).sort((a, b) => a.at.localeCompare(b.at));
}
export function getWorkOrders(orgId, { assigneeId, customerId } = {}) {
  let list = byOrg('work_orders', orgId);
  if (assigneeId) { const mine = new Set(byOrg('work_order_assignees', orgId).filter((a) => a.user_id === assigneeId).map((a) => a.work_order_id)); list = list.filter((w) => mine.has(w.id)); }
  if (customerId) list = list.filter((w) => w.customer_id === customerId);
  return list;
}
/** Agrupa as OS pela etapa atual em um fluxo (main ou sub). */
export function getWorkOrdersByStage(orgId, workflowId, opts = {}) {
  const ids = new Set(getWorkOrders(orgId, opts).map((w) => w.id));
  const map = new Map(getStages(orgId, workflowId, { includeCanceled: true }).map((s) => [s.id, []]));
  for (const fs of byOrg('work_order_flow_state', orgId)) {
    if (fs.workflow_id !== workflowId || !ids.has(fs.work_order_id) || !map.has(fs.current_stage_id)) continue;
    map.get(fs.current_stage_id).push(getWorkOrderView(orgId, fs.work_order_id));
  }
  return map;
}

/** Visão enriquecida usada por cards, modais e app do operador. */
export function getWorkOrderView(orgId, woId) {
  const wo = getWorkOrder(orgId, woId);
  if (!wo) return null;
  const customer = getCustomer(orgId, wo.customer_id);
  const asset = getAsset(orgId, wo.asset_id);
  const items = getWorkOrderItems(orgId, wo.id).map((i) => ({ ...i, catalog: getCatalogItem(orgId, i.catalog_item_id), assignee: i.assignee_id ? getProfile(i.assignee_id) : null }));
  const services = items.filter((i) => i.kind === 'service');
  const main = services.slice().sort((a, b) => b.unit_price - a.unit_price)[0] || items[0];
  const category = main ? getCategory(orgId, main.catalog.category_id) : null;
  const states = getFlowStates(orgId, wo.id);
  const mainWf = getMainWorkflow(orgId);
  const mainState = states.find((s) => s.workflow_id === mainWf.id) || null;
  const subState = states.find((s) => s.workflow_id !== mainWf.id) || null;
  const stage = mainState ? getStage(orgId, mainState.current_stage_id) : null;
  const subStage = subState ? getStage(orgId, subState.current_stage_id) : null;
  const assignees = getAssignees(orgId, wo.id);
  const lead = assignees.find((a) => a.role_in_os === 'lead') || null;
  const total = items.reduce((s, i) => s + i.qty * i.unit_price - (i.discount || 0), 0);
  const milestone = stage ? stage.milestone : 'todo';
  return {
    wo, customer, asset, items, services, category, mainState, subState, stage, subStage,
    subWorkflow: subState ? getWorkflow(orgId, subState.workflow_id) : null,
    assignees, lead, total, milestone, deadline: deadlineOf(wo, milestone),
    usesSubflow: services.some((i) => i.catalog.subflow_workflow_id),
  };
}
export function deadlineOf(wo, milestone) {
  if (!wo.due_at || milestone === 'finished' || milestone === 'canceled') return { state: 'none' };
  const diff = new Date(wo.due_at) - now();
  if (diff < 0) return { state: 'late', ms: -diff };
  if (diff < 24 * 3600e3) return { state: 'soon', ms: diff };
  return { state: 'ok', ms: diff };
}

// ---------- Formulários ----------
export function getForms(orgId, { all = false } = {}) { return byOrg('forms', orgId).filter((f) => all || f.active !== false); }
export function getForm(orgId, id) { return byOrg('forms', orgId).find((f) => f.id === id) || null; }
/** Campos de um formulário. Sem versão: a versão atual. Respostas antigas leem os campos da versão delas. */
export function getFormFields(orgId, formId, version) {
  const form = getForm(orgId, formId);
  const v = version || form?.version || 1;
  return byOrg('form_fields', orgId).filter((f) => f.form_id === formId && (f.form_version || 1) === v).sort((a, b) => a.position - b.position);
}
export function getResponses(orgId, woId) { return byOrg('form_responses', orgId).filter((r) => r.work_order_id === woId).sort((a, b) => a.created_at.localeCompare(b.created_at)); }
export function getAttachment(orgId, id) { return byOrg('work_order_attachments', orgId).find((a) => a.id === id) || null; }
/** Formulários ligados a uma etapa para esta OS (serviço × etapa × momento). */
export function getBindingsFor(orgId, woId, stageId) {
  const itemIds = new Set(getWorkOrderItems(orgId, woId).map((i) => i.catalog_item_id));
  const seen = new Set();
  return byOrg('form_bindings', orgId)
    .filter((b) => (b.scope || 'stage') === 'stage' && b.stage_id === stageId && (!b.catalog_item_id || itemIds.has(b.catalog_item_id)))
    .filter((b) => { const k = b.form_id + b.moment; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((b) => ({ ...b, form: getForm(orgId, b.form_id) }));
}
/** Formulários de escopo serviço (D16) para um item do catálogo. */
export function getServiceBindings(orgId, catalogItemId, moment) {
  return byOrg('form_bindings', orgId).filter((b) => b.scope === 'service' && b.catalog_item_id === catalogItemId && (!moment || b.moment === moment)).map((b) => ({ ...b, form: getForm(orgId, b.form_id) }));
}
export function getItemResponses(orgId, itemId) { return byOrg('form_responses', orgId).filter((r) => r.work_order_item_id === itemId).sort((a, b) => a.created_at.localeCompare(b.created_at)); }
/** Evidências de um serviço: respostas ligadas a ele, fotos e checklist. */
export function itemEvidence(orgId, item) {
  const resp = getItemResponses(orgId, item.id);
  let photos = 0, sig = 0, yes = 0, yn = 0;
  for (const r of resp) {
    for (const f of getFormFields(orgId, r.form_id, r.form_version)) {
      const v = r.answers[f.key];
      if (v === undefined || v === null || v === '') continue;
      if (f.type === 'photo') photos++; else if (f.type === 'signature') sig++; else if (f.type === 'yes_no') { yn++; if (v === true) yes++; }
    }
  }
  const req = byOrg('form_bindings', orgId).filter((b) => b.scope === 'service' && b.catalog_item_id === item.catalog_item_id && b.required);
  const answeredReq = req.filter((b) => resp.some((r) => r.form_id === b.form_id)).length;
  return { responses: resp, photos, signatures: sig, checklistYes: yes, checklistTotal: yn, required: req.length, answeredRequired: answeredReq };
}
export function getPendingForms(orgId, woId) {
  const v = getWorkOrderView(orgId, woId);
  const out = [];
  for (const s of [v.stage, v.subStage].filter(Boolean)) {
    for (const b of getBindingsFor(orgId, woId, s.id)) {
      const answered = getResponses(orgId, woId).some((r) => r.form_id === b.form_id && r.stage_id === s.id);
      out.push({ ...b, stage: s, answered });
    }
  }
  return out;
}

// ---------- Pagamentos ----------
export function getPayments(orgId, { woId, customerId } = {}) {
  let list = byOrg('payments_registered', orgId);
  if (woId) list = list.filter((p) => p.work_order_id === woId);
  if (customerId) { const ids = new Set(getWorkOrders(orgId, { customerId }).map((w) => w.id)); list = list.filter((p) => ids.has(p.work_order_id)); }
  return list.sort((a, b) => b.at.localeCompare(a.at));
}

// =====================================================================
// Movimentação (D6, D7, D8, D9)
// =====================================================================
// planMove valida e devolve os efeitos sem aplicar. ctx descreve o estado da OS
// (do servidor, ou "efetivo" no aparelho quando há fila offline).

export function serverCtx(orgId, woId) {
  const v = getWorkOrderView(orgId, woId);
  return {
    mainStageId: v.mainState?.current_stage_id || null,
    subStageId: v.subState?.current_stage_id || null,
    subCompleted: getHistory(orgId, woId).some((h) => h.payload?.event === 'subflow_completed'),
    answered: new Set(getResponses(orgId, woId).flatMap((r) => [r.form_id + '@' + r.stage_id, ...(r.work_order_item_id ? [r.form_id + '@item:' + r.work_order_item_id] : [])])),
    items: new Map(getWorkOrderItems(orgId, woId).filter((i) => i.kind === 'service').map((i) => [i.id, i.exec_status])),
  };
}
const OPEN_ITEM = (st) => st === 'todo' || st === 'started';

function missingForms(orgId, woId, stage, moments, ctx) {
  return getBindingsFor(orgId, woId, stage.id)
    .filter((b) => b.required && moments.includes(b.moment) && !ctx.answered.has(b.form_id + '@' + stage.id))
    .map((b) => ({ formId: b.form_id, stageId: stage.id, formName: b.form.name, moment: b.moment, stageLabel: stage.label }));
}

/**
 * @returns {ok:true, effects:[...], summary} | {ok:false, code, message, missing?}
 */
export function planMove(orgId, woId, toStageId, ctx = serverCtx(orgId, woId)) {
  const v = getWorkOrderView(orgId, woId);
  if (!v) return { ok: false, code: 'not_found', message: `Não encontramos ${este()} nesta organização.` };
  const to = getStage(orgId, toStageId);
  if (!to) return { ok: false, code: 'bad_stage', message: 'Etapa inexistente nesta organização.' };
  const mainWf = getMainWorkflow(orgId);
  const from = getStage(orgId, ctx.mainStageId);
  const subItem = v.services.find((i) => i.catalog.subflow_workflow_id);

  // --- Movimento dentro de um subfluxo ---
  if (to.workflow_id !== mainWf.id) {
    const subFrom = getStage(orgId, ctx.subStageId);
    if (!subFrom || subFrom.workflow_id !== to.workflow_id) return { ok: false, code: 'not_in_subflow', message: `${este(true)} não está no subfluxo ${getWorkflow(orgId, to.workflow_id).name}.` };
    if (subFrom.id === to.id) return { ok: false, code: 'same', message: 'Já está nesta etapa.' };
    if (to.position > subFrom.position) {
      const passed = getStages(orgId, to.workflow_id).filter((s) => s.position >= subFrom.position && s.position < to.position);
      for (const s of passed) { const m = missingForms(orgId, woId, s, ['on_start', 'on_finish'], ctx); if (m.length) return blocked(m[0]); }
      const m2 = missingForms(orgId, woId, to, ['on_enter'], ctx); if (m2.length) return blocked(m2[0]);
    }
    return { ok: true, effects: [{ type: 'sub', workflowId: to.workflow_id, from: subFrom.id, to: to.id }], summary: { kind: 'sub', stage: to } };
  }

  // --- Movimento no fluxo principal ---
  if (from && from.id === to.id) return { ok: false, code: 'same', message: 'Já está nesta etapa.' };
  if (ctx.subStageId) {
    const sub = getStage(orgId, ctx.subStageId);
    return { ok: false, code: 'in_subflow', message: `Está no subfluxo ${getWorkflow(orgId, sub.workflow_id).name}, na etapa "${sub.label}". Avance pelo quadro do ${getWorkflow(orgId, sub.workflow_id).name}: ao concluir a última etapa, volta sozinho para "${getStage(orgId, from.return_stage_id)?.label}".` };
  }
  if (to.opens_workflow_id && !v.services.some((i) => i.catalog.subflow_workflow_id === to.opens_workflow_id)) {
    return { ok: false, code: 'no_subflow_item', message: `"${to.label}" é só para quem tem um ${t('entity.service', { lower: true })} que usa esse ${t('entity.subflow', { lower: true })}. Nenhum item d${este()} usa: segue direto para a próxima ${t('entity.stage', { lower: true })}.` };
  }
  if (to.milestone === 'canceled') return { ok: true, effects: [{ type: 'main', from: from?.id || null, to: to.id }], summary: { kind: 'main', stage: to } };
  const forward = !from || to.position > from.position;
  if (forward && from) {
    const stages = getStages(orgId, mainWf.id);
    const passed = stages.filter((s) => s.position >= from.position && s.position < to.position);
    // Etapa que abre subfluxo no meio do caminho: quem tem item do subfluxo não pode pular
    const opener = stages.find((s) => s.opens_workflow_id && s.position > from.position && s.position < to.position);
    if (opener && subItem && !ctx.subCompleted) {
      return { ok: false, code: 'must_pass_subflow', message: `${este(true)} tem "${subItem.catalog.name}", então precisa passar por "${opener.label}" antes de "${to.label}".` };
    }
    for (const s of passed) {
      if (s.opens_workflow_id) continue; // formulários do subfluxo são validados dentro dele
      const m = missingForms(orgId, woId, s, ['on_start', 'on_finish'], ctx); if (m.length) return blocked(m[0]);
    }
    const m2 = missingForms(orgId, woId, to, ['on_enter'], ctx); if (m2.length) return blocked(m2[0]);
    // D15: chegar a um marco "finished" exige todos os serviços realizados (ou não realizados com motivo)
    if (to.milestone === 'finished' && from.milestone !== 'finished') {
      const pend = v.services.filter((i) => OPEN_ITEM(ctx.items.get(i.id)));
      if (pend.length) return { ok: false, code: 'services_pending', pending: pend.map((i) => i.id), message: `Para ir para "${to.label}", tod${gender('entity.service') === 'f' ? 'as' : 'os'} ${t('entity.service', { plural: true, lower: true })} precisam estar realizad${gender('entity.service') === 'f' ? 'as' : 'os'}. Falta: ${pend.map((i) => `${i.catalog.name} (${getProfile(i.assignee_id)?.name.split(' ')[0] || 'sem responsável'})`).join(', ')}. Se algum não vai ser feito, marque como não realizado com o motivo.` };
    }
  }
  const effects = [{ type: 'main', from: from?.id || null, to: to.id }];
  if (to.opens_workflow_id) {
    const first = getStages(orgId, to.opens_workflow_id)[0];
    effects.push({ type: 'sub_enter', workflowId: to.opens_workflow_id, to: first.id, parentStageId: to.id });
  }
  return { ok: true, effects, summary: { kind: 'main', stage: to, entersSub: !!to.opens_workflow_id } };

  function blocked(m) {
    const form = getForm(orgId, m.formId);
    const when = m.moment === 'on_start' ? `Para iniciar o trabalho (sair de "${m.stageLabel}")` : m.moment === 'on_finish' ? `Para concluir "${m.stageLabel}"` : `Para entrar em "${m.stageLabel}"`;
    return { ok: false, code: 'missing_form', missing: m, message: `${when}, falta preencher "${m.formName}". Ele é obrigatório aqui: ${form.description ? form.description.charAt(0).toLowerCase() + form.description.slice(1) : 'a empresa definiu que esta etapa só avança com ele.'}` };
  }
}

/** Concluir o subfluxo: OS volta ao fluxo principal na etapa de retorno. É a mesma OS. */
export function planCompleteSubflow(orgId, woId, ctx = serverCtx(orgId, woId)) {
  const sub = getStage(orgId, ctx.subStageId);
  if (!sub) return { ok: false, code: 'not_in_subflow', message: 'Não há subfluxo ativo.' };
  const stages = getStages(orgId, sub.workflow_id);
  const last = stages[stages.length - 1];
  if (sub.id !== last.id) return { ok: false, code: 'not_last', message: `Ainda faltam etapas: está em "${sub.label}". O subfluxo termina em "${last.label}".` };
  const m = missingForms(orgId, woId, last, ['on_start', 'on_finish'], ctx);
  if (m.length) return { ok: false, code: 'missing_form', missing: m[0], message: `Para concluir "${last.label}", falta preencher "${m[0].formName}". Ele é obrigatório nesta etapa.` };
  const parent = getStage(orgId, ctx.mainStageId);
  const ret = getStage(orgId, parent.return_stage_id);
  const subItems = getWorkOrderItems(orgId, woId).filter((i) => i.kind === 'service' && getCatalogItem(orgId, i.catalog_item_id)?.subflow_workflow_id === sub.workflow_id && OPEN_ITEM(ctx.items.get(i.id)));
  if (subItems.length) return { ok: false, code: 'services_pending', pending: subItems.map((i) => i.id), message: `Para concluir ${getWorkflow(orgId, sub.workflow_id).name}, ${subItems.map((i) => `"${getCatalogItem(orgId, i.catalog_item_id).name}"`).join(', ')} precisa estar realizado. Finalize o ${t('entity.service', { lower: true })} (com o formulário de finalização) e tente de novo.` };
  return { ok: true, effects: [{ type: 'sub_exit', workflowId: sub.workflow_id, from: sub.id, returnStageId: ret.id }, { type: 'main', from: parent.id, to: ret.id, via: 'subflow_return' }], summary: { kind: 'return', stage: ret, workflow: getWorkflow(orgId, sub.workflow_id) } };
}

/** Próximo passo natural (usado pelo app do operador e pelo botão "Avançar"). */
export function nextStep(orgId, woId, ctx = serverCtx(orgId, woId)) {
  const mainWf = getMainWorkflow(orgId);
  if (ctx.subStageId) {
    const sub = getStage(orgId, ctx.subStageId);
    const stages = getStages(orgId, sub.workflow_id);
    const i = stages.findIndex((s) => s.id === sub.id);
    if (i === stages.length - 1) return { type: 'complete_subflow', stage: sub };
    return { type: 'move', to: stages[i + 1], from: sub };
  }
  const v = getWorkOrderView(orgId, woId);
  const stages = getStages(orgId, mainWf.id);
  const cur = getStage(orgId, ctx.mainStageId);
  if (!cur || cur.milestone === 'canceled') return null;
  let i = stages.findIndex((s) => s.id === cur.id) + 1;
  while (i < stages.length) {
    const s = stages[i];
    if (s.opens_workflow_id && (ctx.subCompleted || !v.services.some((x) => x.catalog.subflow_workflow_id === s.opens_workflow_id))) { i++; continue; }
    return { type: 'move', to: s, from: cur };
  }
  return null;
}

function applyEffects(orgId, woId, effects, byUserId, at) {
  const atIso = (at || now()).toISOString();
  for (const e of effects) {
    if (e.type === 'main' || e.type === 'sub') {
      const wfId = e.type === 'main' ? getMainWorkflow(orgId).id : e.workflowId;
      const fs = db.work_order_flow_state.find((f) => f.org_id === orgId && f.work_order_id === woId && f.workflow_id === wfId);
      fs.current_stage_id = e.to; fs.entered_at = atIso;
      insertHistory(orgId, { work_order_id: woId, workflow_id: wfId, from_stage_id: e.from, to_stage_id: e.to, by_user_id: byUserId, at: atIso, payload: e.via ? { via: e.via } : {} });
    } else if (e.type === 'sub_enter') {
      db.work_order_flow_state.push({ id: newId('wfs'), org_id: orgId, work_order_id: woId, workflow_id: e.workflowId, current_stage_id: e.to, entered_at: atIso, created_at: atIso });
      insertHistory(orgId, { work_order_id: woId, workflow_id: e.workflowId, from_stage_id: null, to_stage_id: e.to, by_user_id: byUserId, at: atIso, payload: { event: 'subflow_entered', parent_stage_id: e.parentStageId } });
    } else if (e.type === 'sub_exit') {
      const idx = db.work_order_flow_state.findIndex((f) => f.org_id === orgId && f.work_order_id === woId && f.workflow_id === e.workflowId);
      if (idx > -1) db.work_order_flow_state.splice(idx, 1); // estado é "onde está agora"; o caminho fica no histórico
      insertHistory(orgId, { work_order_id: woId, workflow_id: e.workflowId, from_stage_id: e.from, to_stage_id: null, by_user_id: byUserId, at: atIso, payload: { event: 'subflow_completed', return_stage_id: e.returnStageId } });
    }
  }
  const wo = db.work_orders.find((w) => w.org_id === orgId && w.id === woId);
  wo.updated_at = atIso;
}

/** ÚNICA forma de escrever no histórico: inserção. Linha congelada. */
function insertHistory(orgId, row) {
  const stageForMilestone = getStage(orgId, row.to_stage_id || row.from_stage_id);
  const entry = Object.freeze({ id: newId('woh'), org_id: orgId, ...row, milestone: stageForMilestone.milestone, created_at: now().toISOString() });
  db.work_order_history.push(entry);
  return entry;
}

export function moveWorkOrder(orgId, woId, toStageId, byUserId, { at } = {}) {
  const plan = planMove(orgId, woId, toStageId);
  if (!plan.ok) { track(orgId, byUserId, 'wo_move_blocked', { code: plan.code }); return plan; }
  applyEffects(orgId, woId, plan.effects, byUserId, at);
  track(orgId, byUserId, 'wo_stage_changed', { to: toStageId });
  emit();
  return plan;
}
export function completeSubflow(orgId, woId, byUserId, { at } = {}) {
  const plan = planCompleteSubflow(orgId, woId);
  if (!plan.ok) return plan;
  applyEffects(orgId, woId, plan.effects, byUserId, at);
  track(orgId, byUserId, 'wo_subflow_completed', {});
  emit();
  return plan;
}

// ---------- Respostas de formulário + anexos ----------
/** draft: { answers: {fieldKey: valor | {placeholder:'car:front:before:Preto'} | {signature:dataURL}} } */
export function validateAnswers(orgId, formId, answers) {
  const fields = getFormFields(orgId, formId);
  const missing = fields.filter((f) => f.required && (answers[f.key] === undefined || answers[f.key] === null || answers[f.key] === ''));
  return missing.length ? { ok: false, message: `Faltam campos obrigatórios: ${missing.map((f) => f.label).join(', ')}.`, missing: missing.map((f) => f.key) } : { ok: true };
}
export function submitFormResponse(orgId, { woId, formId, stageId, itemId = null, answers, byUserId, clientCreatedAt }) {
  const fields = getFormFields(orgId, formId);
  const form = getForm(orgId, formId);
  const val = validateAnswers(orgId, formId, answers);
  if (!val.ok) return val;
  const respId = newId('fr');
  const at = now().toISOString();
  const stored = {};
  const phase = itemId && form && /finaliz/i.test(form.name) ? 'after' : phaseFor(orgId, stageId);
  for (const f of fields) {
    const val = answers[f.key];
    if (val === undefined) continue;
    if (f.type === 'photo' || f.type === 'signature') {
      const att = { id: newId('att'), org_id: orgId, work_order_id: woId, item_id: itemId, form_response_id: respId, field_key: f.key, type: f.type, phase: f.type === 'signature' ? 'before' : phase, url: val.url, taken_at: clientCreatedAt || at, created_at: at };
      db.work_order_attachments.push(att);
      stored[f.key] = att.id;
    } else stored[f.key] = val;
  }
  const resp = { id: respId, org_id: orgId, work_order_id: woId, work_order_item_id: itemId, form_id: formId, form_version: form.version || 1, stage_id: stageId, answers: stored, submitted_by: byUserId, client_created_at: clientCreatedAt || at, synced_at: at, created_at: at };
  db.form_responses.push(resp);
  track(orgId, byUserId, 'form_submitted', { form_id: formId });
  emit();
  return { ok: true, response: resp };
}
function phaseFor(orgId, stageId) {
  const s = getStage(orgId, stageId);
  if (!s) return 'during';
  if (s.milestone === 'todo') return 'before';
  const stages = getStages(orgId, s.workflow_id);
  return s.id === stages[stages.length - 1].id || stages.find((x) => x.milestone === 'finished' && x.position === s.position + 1) ? 'after' : 'during';
}

// =====================================================================
// Fila offline (D13): o aparelho guarda as ações e envia quando a conexão volta.
// =====================================================================
const device = { offline: false, queue: [], flushing: null, conflicts: [] };
export function isOffline() { return device.offline; }
export function getQueue() { return device.queue.slice(); }
export function getFlushState() { return device.flushing; }
export function getConflicts() { return device.conflicts.slice(); }
export function setOffline(orgId, userId, value) {
  device.offline = value;
  emit();
  if (!value && device.queue.length) return flushQueue(orgId, userId);
  return Promise.resolve(null);
}
export function enqueue(op) {
  device.queue.push({ id: newId('q'), client_created_at: now().toISOString(), ...op });
  emit();
}
/** Resumo da fila: cada ação (formulário ou mudança de etapa) é um item; fotos são contadas à parte. */
export function queueSummary(ops = device.queue) {
  const forms = ops.filter((o) => o.type === 'form');
  const photos = forms.reduce((n, o) => n + Object.values(o.answers).filter((v) => v && v.url && String(v.url).startsWith('placeholder:car')).length, 0);
  const creates = ops.filter((o) => o.type === 'create_wo').length;
  return { items: ops.length, forms: forms.length, photos, creates, moves: ops.length - forms.length - creates };
}
async function flushQueue(orgId, userId) {
  const ops = device.queue.slice();
  const total = ops.length;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    device.flushing = { i: i + 1, n: total };
    emit();
    await new Promise((r) => setTimeout(r, 450));
    let res;
    if (op.type === 'form') res = submitFormResponse(orgId, { ...op, clientCreatedAt: op.client_created_at });
    else if (op.type === 'move') res = moveWorkOrder(orgId, op.woId, op.toStageId, op.byUserId, { at: new Date(op.client_created_at) });
    else if (op.type === 'complete_subflow') res = completeSubflow(orgId, op.woId, op.byUserId, { at: new Date(op.client_created_at) });
    else if (op.type === 'item') res = itemAction(orgId, op.itemId, op.action, op.byUserId, { at: new Date(op.client_created_at), reason: op.reason });
    else if (op.type === 'create_wo') res = createWorkOrder(orgId, op.data, op.byUserId, { id: op.woId, at: new Date(op.client_created_at) });
    device.queue.splice(device.queue.findIndex((q) => q.id === op.id), 1);
    if (res && res.ok === false) device.conflicts.push({ op, message: res.message });
  }
  device.flushing = null;
  track(orgId, userId, 'offline_queue_flushed', { items: total });
  device.lastFlush = { n: total, at: now().toISOString(), conflicts: device.conflicts.length };
  emit();
  return device.lastFlush;
}
export function getLastFlush() { return device.lastFlush || null; }
export function dismissConflicts() { device.conflicts = []; emit(); }

/** Estado "efetivo" no aparelho: servidor + ações ainda na fila. */
export function effectiveCtx(orgId, woId) {
  const ctx = serverCtx(orgId, woId);
  for (const op of device.queue.filter((q) => q.woId === woId)) {
    if (op.type === 'form') { ctx.answered.add(op.formId + '@' + op.stageId); if (op.itemId) ctx.answered.add(op.formId + '@item:' + op.itemId); }
    else if (op.type === 'item') { const p = planItem(orgId, op.itemId, op.action, ctx); if (p.ok) ctx.items.set(op.itemId, p.to); }
    else if (op.type === 'create_wo') continue;
    else {
      const plan = op.type === 'move' ? planMove(orgId, woId, op.toStageId, ctx) : planCompleteSubflow(orgId, woId, ctx);
      if (!plan.ok) continue;
      for (const e of plan.effects) {
        if (e.type === 'main') ctx.mainStageId = e.to;
        if (e.type === 'sub') ctx.subStageId = e.to;
        if (e.type === 'sub_enter') ctx.subStageId = e.to;
        if (e.type === 'sub_exit') { ctx.subStageId = null; ctx.subCompleted = true; }
      }
    }
  }
  return ctx;
}

// =====================================================================
// Recorrência e análises (painel que ensina)
// =====================================================================
const HISTORY_DONE = (orgId, woId) => getHistory(orgId, woId).filter((h) => h.milestone === 'finished' && h.workflow_id === getMainWorkflow(orgId).id)[0];
export function finishedAt(orgId, woId) { const h = HISTORY_DONE(orgId, woId); return h ? new Date(h.at) : null; }

/** Próxima revisão: último serviço recorrente concluído + recurrence_days. */
export function getNextRecurrence(orgId, customerId) {
  const done = [];
  for (const wo of getWorkOrders(orgId, { customerId })) {
    const f = finishedAt(orgId, wo.id);
    if (!f) continue;
    for (const it of getWorkOrderItems(orgId, wo.id)) {
      const c = getCatalogItem(orgId, it.catalog_item_id);
      if (c?.recurrence_days) done.push({ wo, item: c, at: f });
    }
  }
  if (!done.length) return null;
  done.sort((a, b) => b.at - a.at);
  const last = done[0];
  const due = new Date(+last.at + last.item.recurrence_days * 86400e3);
  const scheduled = getWorkOrders(orgId, { customerId }).find((w) => {
    const v = getWorkOrderView(orgId, w.id);
    return v.milestone === 'todo' && v.items.some((i) => i.catalog.recurrence_days) && new Date(w.scheduled_date) >= last.at;
  });
  return { last, due, days: Math.round((due - now()) / 86400e3), scheduled: scheduled || null };
}

/** Minutos de expediente entre a e b (horário da organização). */
export function workMinutesBetween(orgId, a, b) {
  const org = getOrganization(orgId);
  const bh = org.settings?.business_hours || { open: '08:00', close: '18:00', days: [1, 2, 3, 4, 5, 6] };
  const [oh, om] = bh.open.split(':').map(Number); const [ch, cm] = bh.close.split(':').map(Number);
  const OFF = 3 * 3600e3; // America/Sao_Paulo (sem horário de verão)
  let t = +a, end = +b, total = 0;
  while (t < end) {
    const d = new Date(t - OFF);
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + OFF;
    const open = dayStart + (oh * 60 + om) * 60e3, close = dayStart + (ch * 60 + cm) * 60e3;
    if (bh.days.includes(d.getUTCDay())) total += Math.max(0, Math.min(end, close) - Math.max(t, open));
    t = dayStart + 24 * 3600e3;
  }
  return total / 60e3;
}

/** Base de análises: OS concluídas (marco finished) na janela. */
export function getFinishedInWindow(orgId, days = 28) {
  const from = new Date(+now() - days * 86400e3);
  return getWorkOrders(orgId).map((w) => ({ w, f: finishedAt(orgId, w.id) })).filter((x) => x.f && x.f >= from && x.f <= now()).map((x) => ({ ...getWorkOrderView(orgId, x.w.id), finished_at: x.f }));
}
/** D15: serviços contam pela execução (item realizado na janela); produtos, pela OS concluída na janela.
 *  É a mesma base de getServiceExecutions, então o drill-down do Painel bate. */
export function getServiceStats(orgId, days = 28) {
  const list = getFinishedInWindow(orgId, days);
  const map = new Map();
  const add = (it, cat) => {
    const row = map.get(it.catalog_item_id) || { item: cat, category: getCategory(orgId, cat.category_id), count: 0, revenue: 0, byAssignee: new Map() };
    row.count += it.qty; row.revenue += it.qty * it.unit_price - (it.discount || 0);
    if (it.assignee_id) row.byAssignee.set(it.assignee_id, (row.byAssignee.get(it.assignee_id) || 0) + it.qty);
    map.set(it.catalog_item_id, row);
  };
  const execs = getServiceExecutions(orgId, { days, status: 'done' });
  for (const x of execs) add(x.item, x.item.catalog);
  for (const v of list) for (const it of v.items) if (it.kind === 'product') add(it, it.catalog);
  const rows = [...map.values()];
  const byAssignee = new Map();
  for (const x of execs) if (x.item.assignee_id) byAssignee.set(x.item.assignee_id, (byAssignee.get(x.item.assignee_id) || 0) + x.item.qty);
  const totals = { orders: list.length, revenue: list.reduce((s, v) => s + v.total, 0), serviceCount: execs.reduce((s, x) => s + x.item.qty, 0), serviceRevenue: rows.filter((r) => r.item.kind === 'service').reduce((s, r) => s + r.revenue, 0) };
  return { rows, totals, list, byAssignee };
}
/** Tempo médio por etapa, em minutos de expediente, a partir do histórico imutável. */
export function getStageDurations(orgId, workflowId, days = 28) {
  const list = getFinishedInWindow(orgId, days);
  const acc = new Map(getStages(orgId, workflowId).map((s) => [s.id, { stage: s, total: 0, n: 0 }]));
  for (const v of list) {
    const h = getHistory(orgId, v.wo.id).filter((x) => x.workflow_id === workflowId);
    for (let i = 0; i < h.length; i++) {
      const cur = h[i]; if (!cur.to_stage_id || !acc.has(cur.to_stage_id)) continue;
      const next = h[i + 1]; if (!next) continue;
      const a = acc.get(cur.to_stage_id);
      a.total += workMinutesBetween(orgId, new Date(cur.at), new Date(next.at)); a.n += 1;
    }
  }
  return [...acc.values()].map((a) => ({ stage: a.stage, avg: a.n ? a.total / a.n : null, n: a.n }));
}
export function getLateWorkOrders(orgId) {
  return getWorkOrders(orgId).map((w) => getWorkOrderView(orgId, w.id)).filter((v) => v.deadline.state === 'late');
}

// =====================================================================
// D15 · Execução por serviço (responsável e status por item)
// =====================================================================
const ITEM_LABEL = { start: 'iniciar', finish: 'finalizar', not_done: 'marcar como não realizado' };
export function getItem(orgId, itemId) { return byOrg('work_order_items', orgId).find((i) => i.id === itemId) || null; }
export function getItemHistory(orgId, itemId) { return byOrg('work_order_item_history', orgId).filter((h) => h.work_order_item_id === itemId).sort((a, b) => a.at.localeCompare(b.at)); }
export function getItemHistoryByWo(orgId, woId) { return byOrg('work_order_item_history', orgId).filter((h) => h.work_order_id === woId).sort((a, b) => a.at.localeCompare(b.at)); }

/** Valida uma ação de serviço sem aplicar. ctx = serverCtx/effectiveCtx da OS. */
export function planItem(orgId, itemId, action, ctx) {
  const it = getItem(orgId, itemId);
  if (!it || it.kind !== 'service') return { ok: false, code: 'not_found', message: `${t('entity.service')} não encontrado nesta organização.` };
  ctx = ctx || serverCtx(orgId, it.work_order_id);
  const cat = getCatalogItem(orgId, it.catalog_item_id);
  const cur = ctx.items.get(itemId) || it.exec_status;
  const stage = getStage(orgId, ctx.mainStageId);
  if (stage?.milestone === 'canceled') return { ok: false, code: 'canceled', message: `${este(true)} foi cancelad${gender('entity.work_order') === 'f' ? 'a' : 'o'}.` };
  const missing = (moment) => getServiceBindings(orgId, it.catalog_item_id, moment).filter((b) => b.required && !ctx.answered.has(b.form_id + '@item:' + itemId));
  if (action === 'start') {
    if (cur !== 'todo') return { ok: false, code: 'state', message: `"${cat.name}" já foi iniciado.` };
    if (stage?.milestone === 'todo') return { ok: false, code: 'wo_not_started', message: `Ainda não dá para iniciar "${cat.name}": ${este()} está em "${stage.label}". O trabalho começa quando o veículo sai de "${stage.label}".` };
    const m = missing('service_start');
    if (m.length) return { ok: false, code: 'missing_form', missing: { formId: m[0].form_id, formName: m[0].form.name, itemId, moment: 'service_start', stageId: ctx.subStageId || ctx.mainStageId }, message: `Para iniciar "${cat.name}", falta preencher "${m[0].form.name}". ${m[0].form.description || ''}` };
    return { ok: true, to: 'started' };
  }
  if (action === 'finish') {
    if (cur !== 'started') return { ok: false, code: 'state', message: cur === 'todo' ? `Inicie "${cat.name}" antes de finalizar.` : `"${cat.name}" já foi finalizado.` };
    const m = missing('service_finish');
    if (m.length) return { ok: false, code: 'missing_form', missing: { formId: m[0].form_id, formName: m[0].form.name, itemId, moment: 'service_finish', stageId: ctx.subStageId || ctx.mainStageId }, message: `Para dar "${cat.name}" como realizado, falta preencher "${m[0].form.name}". ${m[0].form.description || ''}` };
    return { ok: true, to: 'done' };
  }
  if (action === 'not_done') {
    if (!OPEN_ITEM(cur)) return { ok: false, code: 'state', message: `"${cat.name}" já foi encerrado.` };
    return { ok: true, to: 'not_done' };
  }
  return { ok: false, code: 'bad_action', message: 'Ação inválida.' };
}
export function itemAction(orgId, itemId, action, byUserId, { at, reason } = {}) {
  if (action === 'not_done' && !String(reason || '').trim()) return { ok: false, code: 'reason', message: 'Diga o motivo: ele aparece no histórico e no Painel.' };
  const plan = planItem(orgId, itemId, action);
  if (!plan.ok) return plan;
  const it = db.work_order_items.find((i) => i.org_id === orgId && i.id === itemId);
  const atIso = (at || now()).toISOString();
  const from = it.exec_status;
  it.exec_status = plan.to;
  if (plan.to === 'started') it.started_at = atIso;
  if (plan.to === 'done' || plan.to === 'not_done') it.finished_at = atIso;
  if (plan.to === 'not_done') it.not_done_reason = reason;
  insertItemHistory(orgId, { work_order_id: it.work_order_id, work_order_item_id: itemId, event: 'status', from_value: from, to_value: plan.to, by_user_id: byUserId, at: atIso, payload: reason ? { reason } : {} });
  track(orgId, byUserId, 'wo_item_' + plan.to, { item: it.catalog_item_id });
  emit();
  return { ...plan, item: it };
}
export function reassignItem(orgId, itemId, userId, byUserId) {
  const it = db.work_order_items.find((i) => i.org_id === orgId && i.id === itemId);
  if (!it) return { ok: false, message: 'Serviço não encontrado.' };
  if (!getMembers(orgId).some((m) => m.user_id === userId)) return { ok: false, message: 'Essa pessoa não é membro ativo desta organização.' };
  if (it.assignee_id === userId) return { ok: true };
  insertItemHistory(orgId, { work_order_id: it.work_order_id, work_order_item_id: itemId, event: 'assigned', from_value: it.assignee_id, to_value: userId, by_user_id: byUserId, at: now().toISOString(), payload: {} });
  it.assignee_id = userId;
  emit();
  return { ok: true };
}
/** Só insert, linha congelada. */
function insertItemHistory(orgId, row) {
  const e = Object.freeze({ id: newId('wih'), org_id: orgId, ...row, created_at: now().toISOString() });
  db.work_order_item_history.push(e);
  return e;
}

/** Serviços realizados (e em execução): uma linha por serviço. Base do drill-down do Painel. */
export function getServiceExecutions(orgId, { days, from, status, assigneeId, catalogItemId, categoryId, pendingEvidence, formId } = {}) {
  const lim = from ? new Date(from) : days ? new Date(+now() - days * 86400e3) : null;
  const out = [];
  for (const it of byOrg('work_order_items', orgId)) {
    if (it.kind !== 'service') continue;
    if (status && status !== 'all' && it.exec_status !== status) continue;
    if (assigneeId && it.assignee_id !== assigneeId) continue;
    if (catalogItemId && it.catalog_item_id !== catalogItemId) continue;
    const cat = getCatalogItem(orgId, it.catalog_item_id);
    if (categoryId && cat.category_id !== categoryId) continue;
    const ref = it.finished_at || it.started_at;
    if (lim) { if (!ref || new Date(ref) < lim || new Date(ref) > now()) continue; }
    const item = { ...it, catalog: cat, assignee: it.assignee_id ? getProfile(it.assignee_id) : null };
    const ev = itemEvidence(orgId, it);
    if (pendingEvidence && ev.answeredRequired >= ev.required) continue;
    if (formId && !ev.responses.some((r) => r.form_id === formId)) continue;
    const wo = getWorkOrder(orgId, it.work_order_id);
    out.push({ item, wo, customer: getCustomer(orgId, wo.customer_id), asset: getAsset(orgId, wo.asset_id), category: getCategory(orgId, cat.category_id), evidence: ev, minutes: it.started_at && it.finished_at ? workMinutesBetween(orgId, new Date(it.started_at), new Date(it.finished_at)) : null });
  }
  return out.sort((a, b) => String(b.item.finished_at || b.item.started_at || '').localeCompare(String(a.item.finished_at || a.item.started_at || '')));
}

// =====================================================================
// D17 · Novo atendimento (portas de entrada: manual, check-in, recorrência)
// =====================================================================
export function getOpenWorkOrderForAsset(orgId, assetId) {
  const main = getMainWorkflow(orgId);
  return getWorkOrders(orgId).find((w) => {
    if (w.asset_id !== assetId) return false;
    const fs = byOrg('work_order_flow_state', orgId).find((f) => f.work_order_id === w.id && f.workflow_id === main.id);
    const st = fs && getStage(orgId, fs.current_stage_id);
    return st && !['finished', 'canceled'].includes(st.milestone);
  }) || null;
}
/** Prazo sugerido: soma das durações em horas de expediente a partir do início. */
export function addWorkMinutes(orgId, start, minutes) {
  const org = getOrganization(orgId);
  const bh = org.settings?.business_hours || { open: '08:00', close: '18:00', days: [1, 2, 3, 4, 5, 6] };
  const [oh, om] = bh.open.split(':').map(Number); const [ch, cm] = bh.close.split(':').map(Number);
  const OFF = 3 * 3600e3;
  let tm = +start, rem = minutes;
  for (let guard = 0; rem > 0 && guard < 400; guard++) {
    const d = new Date(tm - OFF);
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + OFF;
    const open = dayStart + (oh * 60 + om) * 60e3, close = dayStart + (ch * 60 + cm) * 60e3;
    if (!bh.days.includes(d.getUTCDay()) || tm >= close) { tm = dayStart + 24 * 3600e3 + (oh * 60 + om) * 60e3; continue; }
    if (tm < open) tm = open;
    const step = Math.min(rem, (close - tm) / 60e3);
    tm += step * 60e3; rem -= step;
  }
  return new Date(tm);
}
export function validateNewWorkOrder(orgId, data) {
  const errors = {};
  if (!data.customerId && !data.newCustomer) errors.customer = `Escolha ${art('entity.customer')} ${t('entity.customer', { lower: true })} ou cadastre um novo.`;
  if (!data.assetId && !data.newAsset) errors.asset = `Escolha o ${t('entity.asset', { lower: true })} ou cadastre um novo.`;
  if (!(data.items || []).some((x) => getCatalogItem(orgId, x.catalogItemId)?.kind === 'service')) errors.items = `Escolha pelo menos um ${t('entity.service', { lower: true })}.`;
  if (data.assetId) { const open = getOpenWorkOrderForAsset(orgId, data.assetId); if (open) errors.duplicate = { woId: open.id, number: open.number }; }
  if (data.newCustomer) { const e = validateCustomer(data.newCustomer); if (Object.keys(e).length) errors.newCustomer = e; }
  if (data.newAsset) { const at = byOrg('asset_types', orgId)[0]; const miss = at.fields.filter((f) => f.required && !String(data.newAsset[f.key] ?? '').trim()); if (miss.length) errors.newAsset = `Faltam: ${miss.map((f) => f.label).join(', ')}.`; }
  return errors;
}
const art = (k) => (gender(k) === 'f' ? 'a' : 'o');
/** Cria a OS com itens (preço copiado do catálogo), equipe, estado do fluxo e histórico. id pode vir do aparelho (fila offline). */
export function createWorkOrder(orgId, data, byUserId, { id, at } = {}) {
  const errors = validateNewWorkOrder(orgId, data);
  if (Object.keys(errors).length) {
    const msg = errors.duplicate ? `Este ${t('entity.asset', { lower: true })} já tem ${gender('entity.work_order') === 'f' ? 'uma' : 'um'} ${t('entity.work_order', { lower: true })} em aberto (#${errors.duplicate.number}). ${gender('entity.work_order') === 'f' ? 'Ela' : 'Ele'} é únic${art('entity.work_order')} no quadro: continue por lá.` : Object.values(errors).map((e) => (typeof e === 'string' ? e : '')).filter(Boolean).join(' ') || 'Revise os campos destacados.';
    return { ok: false, code: errors.duplicate ? 'duplicate' : 'invalid', errors, message: msg };
  }
  const atIso = (at || now()).toISOString();
  let customerId = data.customerId, assetId = data.assetId;
  if (data.newCustomer) customerId = createCustomer(orgId, data.newCustomer, byUserId, { silent: true }).customer.id;
  if (data.newAsset) assetId = createAsset(orgId, customerId, data.newAsset, byUserId, { silent: true }).asset.id;
  const main = getMainWorkflow(orgId);
  const stages = getStages(orgId, main.id);
  const startStage = data.startStageId ? getStage(orgId, data.startStageId) : stages[0];
  const woId = id || newId('wo');
  const number = Math.max(1000, ...byOrg('work_orders', orgId).map((w) => w.number)) + 1;
  const sched = data.scheduledAt ? new Date(data.scheduledAt) : now();
  const svcMin = (data.items || []).reduce((s, x) => s + (getCatalogItem(orgId, x.catalogItemId)?.avg_duration_min || 0), 0);
  const due = data.dueAt ? new Date(data.dueAt) : addWorkMinutes(orgId, sched, svcMin + 60);
  const lead = data.leadId || null;
  const shift = (d) => new Date(+d - 3 * 3600e3).toISOString();
  const wo = { id: woId, org_id: orgId, number, customer_id: customerId, asset_id: assetId, address_id: null, origin_unit_id: getUnits(orgId)[0]?.id || null, executor_unit_id: getUnits(orgId)[0]?.id || null, responsible_id: data.responsibleId || 'usr_manager', scheduled_date: shift(sched).slice(0, 10), scheduled_time: shift(sched).slice(11, 16), due_at: due.toISOString(), source: data.source || 'manual', check_in_at: startStage.milestone === 'todo' && startStage.position > 1 ? atIso : null, check_out_at: null, notes: data.notes || null, created_at: atIso, created_by: byUserId, updated_at: atIso };
  db.work_orders.push(wo);
  if (lead) db.work_order_assignees.push({ id: newId('woa'), org_id: orgId, work_order_id: woId, user_id: lead, role_in_os: 'lead', created_at: atIso });
  for (const x of data.items) {
    const c = getCatalogItem(orgId, x.catalogItemId);
    const itemId = newId('woi');
    const assignee = c.kind === 'service' ? (x.assigneeId || lead) : null;
    db.work_order_items.push({ id: itemId, org_id: orgId, work_order_id: woId, catalog_item_id: c.id, kind: c.kind, qty: x.qty || 1, unit_price: c.base_price, discount: 0, result: null, block_reason: null, notes: null, assignee_id: assignee, exec_status: c.kind === 'service' ? 'todo' : null, started_at: null, finished_at: null, not_done_reason: null, created_at: atIso });
    if (c.kind === 'service') insertItemHistory(orgId, { work_order_id: woId, work_order_item_id: itemId, event: 'assigned', from_value: null, to_value: assignee, by_user_id: byUserId, at: atIso, payload: {} });
    if (assignee && assignee !== lead && !db.work_order_assignees.some((a) => a.work_order_id === woId && a.user_id === assignee)) db.work_order_assignees.push({ id: newId('woa'), org_id: orgId, work_order_id: woId, user_id: assignee, role_in_os: 'helper', created_at: atIso });
  }
  db.work_order_flow_state.push({ id: newId('wfs'), org_id: orgId, work_order_id: woId, workflow_id: main.id, current_stage_id: startStage.id, entered_at: atIso, created_at: atIso });
  insertHistory(orgId, { work_order_id: woId, workflow_id: main.id, from_stage_id: null, to_stage_id: startStage.id, by_user_id: byUserId, at: atIso, payload: { event: 'created', source: wo.source } });
  track(orgId, byUserId, 'wo_created', { source: wo.source });
  emit();
  return { ok: true, wo };
}

// =====================================================================
// Clientes e ativos: criar e editar (audit_log com before/after)
// =====================================================================
export function validateCustomer(c) {
  const e = {};
  if (!String(c.name || '').trim() || String(c.name).trim().length < 3) e.name = 'Informe o nome completo.';
  const digits = String(c.phone || '').replace(/\D/g, '');
  if (!(digits.length === 10 || digits.length === 11)) e.phone = 'Telefone com DDD, ex.: (11) 91234-5678.';
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) e.email = 'E-mail inválido. Confira se tem @ e domínio, ex.: nome@gmail.com.';
  return e;
}
export function formatPhone(p) { const d = String(p || '').replace(/\D/g, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : p; }
/** Só insert, linha congelada. */
function audit(orgId, userId, action, entity, entityId, before, after) {
  const e = Object.freeze({ id: newId('aud'), org_id: orgId, user_id: userId, action, entity, entity_id: entityId, payload: { before, after }, at: now().toISOString(), created_at: now().toISOString() });
  db.audit_log.push(e);
  return e;
}
export function getAuditLog(orgId, { entity, entityId } = {}) { return byOrg('audit_log', orgId).filter((a) => (!entity || a.entity === entity) && (!entityId || a.entity_id === entityId)).sort((a, b) => b.at.localeCompare(a.at)); }
function diff(before, patch) {
  const b = {}, a = {};
  for (const k of Object.keys(patch)) if (JSON.stringify(before[k]) !== JSON.stringify(patch[k])) { b[k] = before[k] ?? null; a[k] = patch[k]; }
  return [b, a];
}
export function createCustomer(orgId, data, byUserId, { silent } = {}) {
  const e = validateCustomer(data); if (Object.keys(e).length) return { ok: false, errors: e, message: 'Revise os campos destacados.' };
  const c = { id: newId('cus'), org_id: orgId, unit_id: getUnits(orgId)[0]?.id || null, type: 'PF', name: data.name.trim(), document: data.document || '', email: data.email || '', phone: formatPhone(data.phone), status: 'active', created_at: now().toISOString() };
  db.customers.push(c);
  audit(orgId, byUserId, 'create', 'customers', c.id, null, { name: c.name, phone: c.phone });
  if (!silent) emit();
  return { ok: true, customer: c };
}
export function updateCustomer(orgId, id, patch, byUserId) {
  const c = db.customers.find((x) => x.org_id === orgId && x.id === id);
  if (!c) return { ok: false, message: `${t('entity.customer')} não encontrado nesta organização.` };
  const next = { ...c, ...patch, phone: formatPhone(patch.phone ?? c.phone) };
  const e = validateCustomer(next); if (Object.keys(e).length) return { ok: false, errors: e, message: 'Revise os campos destacados.' };
  const [b, a] = diff(c, { name: next.name, phone: next.phone, email: next.email, document: next.document });
  if (!Object.keys(a).length) return { ok: true, unchanged: true };
  Object.assign(c, a);
  audit(orgId, byUserId, 'update', 'customers', id, b, a);
  emit();
  return { ok: true };
}
export function createAsset(orgId, customerId, attrs, byUserId, { silent } = {}) {
  const at = byOrg('asset_types', orgId)[0];
  const miss = at.fields.filter((f) => f.required && !String(attrs[f.key] ?? '').trim());
  if (miss.length) return { ok: false, message: `Faltam: ${miss.map((f) => f.label).join(', ')}.` };
  const a = { id: newId('ast'), org_id: orgId, customer_id: customerId, asset_type_id: at.id, address_id: null, attributes: { ...attrs, plate: String(attrs.plate || '').toUpperCase() }, created_at: now().toISOString() };
  db.customer_assets.push(a);
  audit(orgId, byUserId, 'create', 'customer_assets', a.id, null, a.attributes);
  if (!silent) emit();
  return { ok: true, asset: a };
}
export function updateAsset(orgId, assetId, attrs, byUserId) {
  const a = db.customer_assets.find((x) => x.org_id === orgId && x.id === assetId);
  if (!a) return { ok: false, message: 'Não encontrado nesta organização.' };
  const at = getAssetType(orgId, a.asset_type_id);
  const next = { ...a.attributes, ...attrs, plate: String(attrs.plate ?? a.attributes.plate).toUpperCase() };
  const miss = at.fields.filter((f) => f.required && !String(next[f.key] ?? '').trim());
  if (miss.length) return { ok: false, message: `Faltam: ${miss.map((f) => f.label).join(', ')}.` };
  const [b, af] = diff(a.attributes, next);
  if (!Object.keys(af).length) return { ok: true, unchanged: true };
  a.attributes = next;
  audit(orgId, byUserId, 'update', 'customer_assets', assetId, b, af);
  emit();
  return { ok: true };
}

// =====================================================================
// Cadastros: catálogo, formulários (com versão), equipe
// =====================================================================
export function isCatalogItemUsed(orgId, id) { return byOrg('work_order_items', orgId).some((i) => i.catalog_item_id === id); }
export function countItemUses(orgId, id, days = 28) { return getServiceExecutions(orgId, { days, catalogItemId: id, status: 'done' }).length; }
export function saveCatalogItem(orgId, data, byUserId) {
  const e = {};
  if (!String(data.name || '').trim()) e.name = 'Dê um nome.';
  if (!(Number(data.base_price) >= 0) || data.base_price === '' || data.base_price === null) e.base_price = 'Preço inválido.';
  if (data.kind === 'service' && !(Number(data.avg_duration_min) > 0)) e.avg_duration_min = 'Duração em minutos, maior que zero.';
  if (!data.category_id) e.category_id = 'Escolha uma categoria.';
  if (Object.keys(e).length) return { ok: false, errors: e, message: 'Revise os campos destacados.' };
  const fields = ['name', 'description', 'category_id', 'base_price', 'avg_duration_min', 'recurrence_days', 'service_location', 'subflow_workflow_id', 'sku'];
  const clean = Object.fromEntries(fields.filter((k) => k in data).map((k) => [k, ['base_price', 'avg_duration_min', 'recurrence_days'].includes(k) ? (data[k] === '' || data[k] === null ? null : Number(data[k])) : (data[k] === '' ? null : data[k])]));
  if (data.id) {
    const it = db.catalog_items.find((x) => x.org_id === orgId && x.id === data.id);
    const [b, a] = diff(it, clean);
    if (Object.keys(a).length) { Object.assign(it, a); audit(orgId, byUserId, 'update', 'catalog_items', it.id, b, a); }
    emit(); return { ok: true, item: it };
  }
  const it = { id: newId(data.kind === 'service' ? 'svc' : 'prd'), org_id: orgId, kind: data.kind, unit: 'un', track_stock: false, active: true, recurrence_days: null, service_location: data.kind === 'service' ? 'unit' : null, subflow_workflow_id: null, avg_duration_min: null, sku: null, description: '', ...clean, created_at: now().toISOString() };
  db.catalog_items.push(it);
  audit(orgId, byUserId, 'create', 'catalog_items', it.id, null, clean);
  emit(); return { ok: true, item: it };
}
export function setCatalogItemActive(orgId, id, active, byUserId) {
  const it = db.catalog_items.find((x) => x.org_id === orgId && x.id === id);
  audit(orgId, byUserId, 'update', 'catalog_items', id, { active: it.active }, { active });
  it.active = active; emit(); return { ok: true };
}
export function deleteCatalogItem(orgId, id, byUserId) {
  if (isCatalogItemUsed(orgId, id)) return { ok: false, code: 'in_use', message: `Este item já foi usado em ${t('entity.work_order', { plural: true, lower: true })}. Para não apagar o histórico nem mudar o Painel, ele só pode ser desativado.` };
  const idx = db.catalog_items.findIndex((x) => x.org_id === orgId && x.id === id);
  const it = db.catalog_items[idx];
  db.catalog_items.splice(idx, 1);
  for (let i = db.form_bindings.length - 1; i >= 0; i--) if (db.form_bindings[i].org_id === orgId && db.form_bindings[i].catalog_item_id === id) db.form_bindings.splice(i, 1);
  audit(orgId, byUserId, 'delete', 'catalog_items', id, { name: it.name }, null);
  emit(); return { ok: true };
}
/** "Evidências exigidas": substitui os vínculos de escopo serviço de um item. */
export function setServiceBindings(orgId, catalogItemId, list, byUserId) {
  const before = getServiceBindings(orgId, catalogItemId).map((b) => ({ form_id: b.form_id, moment: b.moment, required: b.required }));
  for (let i = db.form_bindings.length - 1; i >= 0; i--) { const b = db.form_bindings[i]; if (b.org_id === orgId && b.scope === 'service' && b.catalog_item_id === catalogItemId) db.form_bindings.splice(i, 1); }
  for (const x of list) db.form_bindings.push({ id: newId('fb'), org_id: orgId, form_id: x.form_id, scope: 'service', catalog_item_id: catalogItemId, stage_id: null, moment: x.moment, required: !!x.required, created_at: now().toISOString() });
  audit(orgId, byUserId, 'update', 'form_bindings', catalogItemId, before, list);
  emit(); return { ok: true };
}
export function saveCategory(orgId, data, byUserId) {
  if (!String(data.name || '').trim()) return { ok: false, message: 'Dê um nome à categoria.' };
  if (data.id) { const c = db.catalog_categories.find((x) => x.org_id === orgId && x.id === data.id); const [b, a] = diff(c, { name: data.name, color: data.color }); Object.assign(c, a); audit(orgId, byUserId, 'update', 'catalog_categories', c.id, b, a); emit(); return { ok: true, category: c }; }
  const c = { id: newId('cat'), org_id: orgId, name: data.name, color: data.color, position: byOrg('catalog_categories', orgId).length + 1, created_at: now().toISOString() };
  db.catalog_categories.push(c); audit(orgId, byUserId, 'create', 'catalog_categories', c.id, null, { name: c.name, color: c.color }); emit(); return { ok: true, category: c };
}
/** Distância de cor (RGB ponderado) até as cores de status; < 70 = perto demais. */
export function colorNearStatus(hex) {
  const STATUS = { verde: '#15803d', âmbar: '#b45309', vermelho: '#b91c1c', azul: '#1d4ed8' };
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  let best = null;
  for (const [name, s] of Object.entries(STATUS)) { const [R, G, B] = rgb(s); const d = Math.sqrt(2 * (r - R) ** 2 + 4 * (g - G) ** 2 + 3 * (b - B) ** 2); if (!best || d < best.d) best = { name, d }; }
  return best.d < 110 ? best : null;
}

export function getFormResponsesCount(orgId, formId, days = 28) { const lim = +now() - days * 86400e3; return byOrg('form_responses', orgId).filter((r) => r.form_id === formId && new Date(r.created_at) >= lim).length; }
export function getFormBindings(orgId, formId) { return byOrg('form_bindings', orgId).filter((b) => b.form_id === formId).map((b) => ({ ...b, item: b.catalog_item_id ? getCatalogItem(orgId, b.catalog_item_id) : null, stage: b.stage_id ? getStage(orgId, b.stage_id) : null })); }
export function getFormResponses(orgId, formId) { return byOrg('form_responses', orgId).filter((r) => r.form_id === formId).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
const FIELD_TYPES = ['photo', 'text', 'yes_no', 'number', 'option', 'signature'];
export function validateFormDraft(draft) {
  const e = [];
  if (!String(draft.name || '').trim()) e.push('Dê um nome ao formulário.');
  if (!draft.fields.length) e.push('Adicione pelo menos um campo.');
  draft.fields.forEach((f, i) => {
    if (!String(f.label || '').trim()) e.push(`Campo ${i + 1}: falta o rótulo.`);
    if (!FIELD_TYPES.includes(f.type)) e.push(`Campo ${i + 1}: tipo inválido.`);
    if (f.type === 'option' && (f.options || []).filter((o) => String(o).trim()).length < 2) e.push(`Campo ${i + 1} ("${f.label}"): uma pergunta de opção precisa de pelo menos 2 opções.`);
  });
  return e;
}
/** Salvar formulário. Se já houver respostas na versão atual e os campos mudaram, nasce uma nova versão:
 *  as respostas antigas continuam lidas com os campos da versão delas. */
export function saveForm(orgId, draft, byUserId) {
  const errs = validateFormDraft(draft);
  if (errs.length) return { ok: false, errors: errs, message: errs[0] };
  const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'campo';
  const mkFields = (formId, version) => { const used = new Set(); return draft.fields.map((f, i) => { let key = f.key || slug(f.label); while (used.has(key)) key += '_' + (i + 1); used.add(key); return { id: `${formId}_v${version}_${key}`, org_id: orgId, form_id: formId, form_version: version, position: i + 1, key, type: f.type, label: f.label.trim(), required: !!f.required, options: f.type === 'option' ? f.options.map((o) => String(o).trim()).filter(Boolean) : null, created_at: now().toISOString() }; }); };
  if (!draft.id) {
    const form = { id: newId('form'), org_id: orgId, name: draft.name.trim(), description: draft.description || '', template_origin: 'custom', version: 1, active: true, created_at: now().toISOString() };
    db.forms.push(form); db.form_fields.push(...mkFields(form.id, 1));
    audit(orgId, byUserId, 'create', 'forms', form.id, null, { name: form.name, fields: draft.fields.length });
    track(orgId, byUserId, 'form_created', {}); emit(); return { ok: true, form, newVersion: false };
  }
  const form = db.forms.find((f) => f.org_id === orgId && f.id === draft.id);
  const cur = getFormFields(orgId, form.id);
  const sig = (arr) => JSON.stringify(arr.map((f) => [f.key, f.type, f.label, !!f.required, f.options || null]));
  const nextFields = mkFields(form.id, form.version);
  const fieldsChanged = sig(cur) !== sig(nextFields);
  const hasResponses = byOrg('form_responses', orgId).some((r) => r.form_id === form.id && (r.form_version || 1) === form.version);
  const meta = { name: draft.name.trim(), description: draft.description || '' };
  let newVersion = false;
  if (fieldsChanged && hasResponses) {
    const v = form.version + 1;
    db.form_fields.push(...mkFields(form.id, v));
    form.version = v; newVersion = true;
  } else if (fieldsChanged) {
    for (let i = db.form_fields.length - 1; i >= 0; i--) { const f = db.form_fields[i]; if (f.org_id === orgId && f.form_id === form.id && (f.form_version || 1) === form.version) db.form_fields.splice(i, 1); }
    db.form_fields.push(...nextFields);
  }
  const [b, a] = diff(form, meta); Object.assign(form, a);
  audit(orgId, byUserId, 'update', 'forms', form.id, { ...b, ...(fieldsChanged ? { version: newVersion ? form.version - 1 : form.version } : {}) }, { ...a, ...(fieldsChanged ? { fields: draft.fields.length, version: form.version } : {}) });
  emit(); return { ok: true, form, newVersion };
}
/** Vínculo de escopo etapa (formulário do atendimento). */
export function setStageBinding(orgId, { formId, stageId, moment, required, remove, bindingId }, byUserId) {
  if (remove) { const i = db.form_bindings.findIndex((b) => b.org_id === orgId && b.id === bindingId); if (i > -1) { audit(orgId, byUserId, 'delete', 'form_bindings', bindingId, { ...db.form_bindings[i] }, null); db.form_bindings.splice(i, 1); } emit(); return { ok: true }; }
  const b = { id: newId('fb'), org_id: orgId, form_id: formId, scope: 'stage', catalog_item_id: null, stage_id: stageId, moment, required: !!required, created_at: now().toISOString() };
  db.form_bindings.push(b); audit(orgId, byUserId, 'create', 'form_bindings', b.id, null, { form_id: formId, stage_id: stageId, moment, required }); emit(); return { ok: true };
}

/** Equipe */
export function inviteMember(orgId, { name, contact, role }, byUserId) {
  const e = {};
  if (!String(name || '').trim()) e.name = 'Informe o nome.';
  if (!String(contact || '').trim()) e.contact = 'Informe celular ou e-mail para enviar o convite.';
  if (!['owner', 'manager', 'admin', 'operator'].includes(role)) e.role = 'Escolha um papel.';
  if (Object.keys(e).length) return { ok: false, errors: e, message: 'Revise os campos destacados.' };
  const p = { id: newId('usr'), org_id: null, name: name.trim(), phone: contact.includes('@') ? null : contact, email: contact.includes('@') ? contact : null, avatar: null, created_at: now().toISOString() };
  db.profiles.push(p);
  const m = { id: newId('mem'), org_id: orgId, user_id: p.id, unit_id: null, role_key: role, active: false, status: 'invited', invited_at: now().toISOString(), created_at: now().toISOString() };
  db.memberships.push(m);
  audit(orgId, byUserId, 'create', 'memberships', m.id, null, { name: p.name, role, status: 'invited' });
  emit(); return { ok: true, member: m };
}
export function acceptInvite(orgId, membershipId) {
  const m = db.memberships.find((x) => x.org_id === orgId && x.id === membershipId);
  m.status = 'active'; m.active = true;
  audit(orgId, m.user_id, 'update', 'memberships', m.id, { status: 'invited' }, { status: 'active' });
  emit(); return { ok: true };
}
export function changeRole(orgId, membershipId, role, byUserId) {
  const m = db.memberships.find((x) => x.org_id === orgId && x.id === membershipId);
  if (m.role_key === 'owner' && role !== 'owner' && getMembers(orgId).filter((x) => x.role_key === 'owner').length <= 1) return { ok: false, message: 'Esta é a única pessoa dona da organização. Promova outra pessoa a dona antes de trocar este papel.' };
  audit(orgId, byUserId, 'update', 'memberships', m.id, { role_key: m.role_key }, { role_key: role });
  m.role_key = role; emit(); return { ok: true };
}
/** O que impede desativar: serviços abertos atribuídos e atendimentos abertos em que é responsável. */
export function getOpenWorkFor(orgId, userId) {
  const openItems = byOrg('work_order_items', orgId).filter((i) => i.kind === 'service' && i.assignee_id === userId && OPEN_ITEM(i.exec_status) && !['finished', 'canceled'].includes(getWorkOrderView(orgId, i.work_order_id).milestone));
  const leadWos = byOrg('work_order_assignees', orgId).filter((a) => a.user_id === userId && a.role_in_os === 'lead').map((a) => getWorkOrderView(orgId, a.work_order_id)).filter((v) => !['finished', 'canceled'].includes(v.milestone));
  return { items: openItems, wos: leadWos };
}
export function deactivateMember(orgId, membershipId, byUserId) {
  const m = db.memberships.find((x) => x.org_id === orgId && x.id === membershipId);
  if (m.user_id === byUserId) return { ok: false, code: 'self', message: 'Você não pode desativar a si mesmo.' };
  if (m.role_key === 'owner' && getMembers(orgId).filter((x) => x.role_key === 'owner').length <= 1) return { ok: false, code: 'last_owner', message: 'Não dá para desativar a única pessoa dona da organização.' };
  const open = getOpenWorkFor(orgId, m.user_id);
  if (open.items.length || open.wos.length) return { ok: false, code: 'open_work', open, message: `${getProfile(m.user_id).name.split(' ')[0]} tem ${open.items.length} ${t('entity.service', { count: open.items.length, lower: true })} em aberto e é responsável por ${open.wos.length} ${t('entity.work_order', { count: open.wos.length, lower: true })} em aberto. Reatribua antes de desativar, para nada ficar sem dono.` };
  audit(orgId, byUserId, 'update', 'memberships', m.id, { status: m.status || 'active' }, { status: 'inactive' });
  m.status = 'inactive'; m.active = false; emit(); return { ok: true };
}
export function reassignOpenWork(orgId, fromUserId, toUserId, byUserId) {
  const open = getOpenWorkFor(orgId, fromUserId);
  for (const it of open.items) reassignItem(orgId, it.id, toUserId, byUserId);
  for (const v of open.wos) {
    const a = db.work_order_assignees.find((x) => x.org_id === orgId && x.work_order_id === v.wo.id && x.user_id === fromUserId && x.role_in_os === 'lead');
    if (a) { a.user_id = toUserId; insertItemHistory(orgId, { work_order_id: v.wo.id, work_order_item_id: null, event: 'lead_reassigned', from_value: fromUserId, to_value: toUserId, by_user_id: byUserId, at: now().toISOString(), payload: {} }); }
  }
  audit(orgId, byUserId, 'update', 'reassignment', fromUserId, { user: fromUserId }, { user: toUserId, items: open.items.length, wos: open.wos.length });
  emit(); return { ok: true, moved: open.items.length + open.wos.length };
}
export function getMemberStats(orgId, userId, days = 28) {
  const done = getServiceExecutions(orgId, { days, status: 'done', assigneeId: userId });
  const mins = done.map((x) => x.minutes).filter((x) => x != null);
  return { done: done.length, open: getOpenWorkFor(orgId, userId).items.length, avgMin: mins.length ? mins.reduce((s, x) => s + x, 0) / mins.length : null };
}
