// app.js — bootstrap, shell, estado de interface e delegação de eventos.
import * as store from './store.js';
import { t, tx, setI18nOrg, gender } from './i18n.js';
import { resolve, toHash, homeFor, can, allowed } from './router.js';
import { installAnnotate, annotationPanel } from './annotate.js';
import { icon } from './components/icons.js';
import { esc, longDay, time, initials } from './components/format.js';
import { woModal, moveDialog, formDialog, notDoneDialog, defaultMoveTarget, nextAction } from './components/wo.js';
import { newWoDrawer, newWoDraft, newWoPayload } from './components/newwo.js';
import { hydrateSignatures } from './components/fields.js';
import { renderKanban, renderSubflow } from './screens/kanban.js';
import { renderOperator, operatorActions, operatorInput } from './screens/operator.js';
import { renderCustomers, renderCustomer, defaultCf, editCustomerDrawer, editAssetDrawer } from './screens/customers.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderCockpit } from './screens/cockpit.js';
import { renderServices, svcDrawer, defaultSx } from './screens/services.js';
import { renderCatalog, catItemDrawer, categoriesDrawer, defaultCatState } from './screens/catalog.js';
import { renderForms, renderFormDetail, initBuilder } from './screens/forms.js';
import { renderTeam, inviteDrawer, memberDrawer, reassignDrawer } from './screens/team.js';
import { DEFAULT_ORG_ID } from '../config/org-config.js';

const USER_BY_ROLE = { owner: 'usr_owner', manager: 'usr_manager', admin: 'usr_admin', platform_admin: 'usr_platform' };
const ROLES = ['owner', 'manager', 'admin', 'operator', 'platform_admin'];
export const state = {
  orgId: DEFAULT_ORG_ID,
  role: 'owner',
  operatorId: 'usr_lucas',
  route: { name: 'painel', param: null },
  ann: { on: false, key: null },
  proto: { open: false, hidden: false },
  flowMenu: { open: false, q: '' },
  moreOpen: false,
  modal: null,
  filters: { op: '', cat: '', late: false },
  sx: defaultSx(),
  cf: defaultCf(),
  hf: { cat: '', kind: '' },
  catS: defaultCatState(),
  fb: null,
  custQ: '',
  showAudit: false,
  op: { screen: 'day', woId: null },
  toasts: [],
  notice: null,
};
export const userId = () => (state.role === 'operator' ? state.operatorId : USER_BY_ROLE[state.role]);
const root = document.getElementById('app');

// ---------- Marca do tenant ----------
function applyBrand() {
  const org = store.getOrganization(state.orgId);
  const c = org.config.brand.primary_color;
  const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrastWhite = 1.05 / (lum(c) + 0.05);
  const mix = (hex, w) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - w) + 255 * w).toString(16).padStart(2, '0')).join('');
  const s = document.documentElement.style;
  s.setProperty('--brand', c);
  s.setProperty('--brand-fg', contrastWhite >= 4.5 ? '#ffffff' : '#09090b');
  s.setProperty('--brand-soft', mix(c, 0.93));
  document.title = `${org.config.brand.display_name} · protótipo`;
}

// ---------- Toasts ----------
export function toast(msg, kind = 'ok') {
  const id = Math.random().toString(36).slice(2);
  state.toasts.push({ id, msg, kind });
  render();
  setTimeout(() => { state.toasts = state.toasts.filter((x) => x.id !== id); render(); }, 4200);
}

// ---------- Shell ----------
function navItems() {
  const r = state.role;
  const op = [['painel', 'dashboard', tx('nav.dashboard')], ['kanban', 'kanban', tx('nav.kanban')], ['servicos', 'checkCircle', tx('nav.services_done')], ['clientes', 'users', tx('nav.customers')]].filter(([k]) => allowed(r, k));
  const reg = [['catalogo', 'layers', tx('nav.catalog')], ['formularios', 'file', tx('nav.forms')], ['equipe', 'user', tx('nav.team')]].filter(([k]) => allowed(r, k));
  return { op, reg };
}
function protoPill() {
  if (state.proto.hidden) return '';
  const orgIds = store.listOrganizationIds();
  const ops = store.getMembersByRole(state.orgId, 'operator');
  const p = state.proto;
  return `<div class="proto ${state.role === 'operator' ? 'op-mode' : ''}" data-ann-ignore>
    ${p.open ? `<div class="proto-panel" role="dialog" aria-label="Ferramentas do protótipo">
      <div class="row"><strong class="grow">Protótipo</strong><button class="btn btn-ghost btn-icon btn-sm" data-action="proto-toggle" aria-label="Fechar">${icon('x', 'sm')}</button></div>
      ${orgIds.length > 1 ? `<div class="field"><label class="field-label" for="tenant">${tx('shell.tenant')}</label><select id="tenant" class="select" data-change="tenant" data-fk="tenant">${orgIds.map((id) => `<option value="${id}" ${id === state.orgId ? 'selected' : ''}>${esc(store.getOrganization(id).config.brand.display_name)}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label class="field-label" for="role">${tx('shell.role')}</label><select id="role" class="select" data-change="role" data-fk="role">${ROLES.map((r) => `<option value="${r}" ${r === state.role ? 'selected' : ''}>${esc(t('role.' + r))}</option>`).join('')}</select></div>
      ${state.role === 'operator' && ops.length ? `<div class="field"><label class="field-label" for="opsel">${esc(t('role.operator'))}</label><select id="opsel" class="select" data-change="operator" data-fk="opsel">${ops.map((m) => `<option value="${m.user_id}" ${m.user_id === state.operatorId ? 'selected' : ''}>${esc(m.profile.name)}</option>`).join('')}</select></div>` : ''}
      <div class="hint" data-ann="sim-date">${icon('calendar', 'sm')} ${tx('shell.sim_date')}: ${esc(longDay(store.now()))}, ${time(store.now())}</div>
      <button class="btn btn-sm ann-toggle" aria-pressed="${state.ann.on}" data-action="ann-toggle" data-fk="ann">${icon('eye', 'sm')} ${tx('shell.annotate')}: ${state.ann.on ? 'ligado' : 'desligado'}</button>
      <button class="btn btn-sm" data-action="proto-restore">Restaurar dados de exemplo</button>
      <button class="btn btn-sm btn-ghost" data-action="proto-hide">Ocultar para teste <span class="subtle">(volta com Alt+Shift+P)</span></button>
    </div>` : ''}
    <button class="proto-pill" data-action="proto-toggle" aria-expanded="${p.open}" data-fk="proto-pill" title="Ferramentas do protótipo">${icon('sparkle', 'sm')}<span class="lbl">Protótipo · ${esc(t('role.' + state.role))}</span></button></div>`;
}
function shell(content) {
  const org = store.getOrganization(state.orgId);
  const cfg = org.config;
  const { op, reg } = navItems();
  const nav = op.length + reg.length > 0;
  const cur = { subfluxo: 'kanban', cliente: 'clientes', formulario: 'formularios' }[state.route.name] || state.route.name;
  const link = ([k, ic, l], cls = 'nav-item') => `<a class="${cls}" href="${toHash(k)}" ${cur === k ? 'aria-current="page"' : ''} data-ann="nav-labels">${icon(ic)}<span>${esc(l)}</span></a>`;
  const me = store.getProfile(userId());
  const meName = state.role === 'platform_admin' ? (me?.name || 'Plataforma') : me?.name || '—';
  const bottom = [...op, ...reg].slice(0, 4);
  const more = [...op, ...reg].slice(4);
  return `
  <header class="topbar">
    <div class="brand" data-ann="brand"><span class="brand-mark" aria-hidden="true">${esc(cfg.brand.short)}</span><span class="ellipsis hide-sm">${esc(cfg.brand.display_name)}</span></div>
    <span class="spacer"></span>
    <div class="user-chip" data-ann="role-switch"><span class="avatar" aria-hidden="true">${esc(initials(meName))}</span><span class="who"><strong class="ellipsis">${esc(meName)}</strong><span>${esc(t('role.' + state.role))}</span></span></div>
  </header>
  <div>
    ${state.ann.on && !state.proto.hidden ? `<div class="ann-banner" data-ann-ignore>${icon('info', 'sm')} ${tx('shell.annotate_on')}</div>` : ''}
    ${state.notice ? `<div class="alert warn" role="status" style="margin:12px 16px 0">${icon('alert')}<p>${esc(state.notice)}</p></div>` : ''}
    <div class="body ${nav ? '' : 'no-nav'}">
      ${nav ? `<nav class="sidebar" aria-label="Navegação principal"><div class="nav-section">${tx('nav.section.operation')}</div>${op.map((x) => link(x)).join('')}${reg.length ? `<div class="nav-section">${tx('nav.section.registry')}</div>${reg.map((x) => link(x)).join('')}` : ''}</nav>` : ''}
      <main class="main" id="main" tabindex="-1">${content}</main>
    </div>
  </div>
  ${nav ? `<nav class="bottom-nav" aria-label="Navegação principal">${bottom.map((x) => link(x)).join('')}${more.length ? `<button class="nav-item" data-action="more-toggle" aria-expanded="${state.moreOpen}" ${more.some(([k]) => k === cur) ? 'aria-current="page"' : ''}>${icon('layers')}<span>${tx('nav.more')}</span></button>` : ''}</nav>` : ''}
  ${state.moreOpen ? `<div class="more-sheet" data-action="more-toggle"><div class="panel stack-sm" data-stop>${more.map((x) => link(x, 'nav-item')).join('')}</div></div>` : ''}
  ${protoPill()}
  ${state.ann.on && state.ann.key ? annotationPanel(state.ann.key) : ''}
  <div class="toasts" aria-live="polite">${state.toasts.map((x) => `<div class="toast">${icon(x.kind === 'ok' ? 'checkCircle' : x.kind === 'warn' ? 'alert' : 'info')}<span>${esc(x.msg)}</span></div>`).join('')}</div>`;
}

function screen() {
  state.meId = userId();
  const ctx = { orgId: state.orgId, state, userId: userId() };
  try {
    switch (state.route.name) {
      case 'painel': return renderDashboard(ctx);
      case 'kanban': return renderKanban(ctx);
      case 'subfluxo': return renderSubflow(ctx, state.route.param);
      case 'servicos': return renderServices(ctx);
      case 'clientes': return renderCustomers(ctx);
      case 'cliente': return renderCustomer(ctx, state.route.param);
      case 'catalogo': return renderCatalog(ctx);
      case 'formularios': return renderForms(ctx);
      case 'formulario': return renderFormDetail(ctx, state.route.param);
      case 'equipe': return renderTeam(ctx);
      case 'meu-dia': return renderOperator(ctx);
      case 'cockpit': return renderCockpit(ctx);
      default: return '';
    }
  } catch (err) {
    console.error(err);
    return `<div class="alert danger" role="alert">${icon('alert')}<div><strong>Algo deu errado ao montar esta tela.</strong><p>${esc(err.message)}</p></div></div>`;
  }
}

function modal() {
  const m = state.modal;
  if (!m) return '';
  const o = state.orgId;
  try {
    switch (m.type) {
      case 'wo': return woModal(o, m, { canAssign: can(state.role, 'wo.assign') });
      case 'move': return moveDialog(o, m);
      case 'form': return formDialog(o, m);
      case 'notdone': return notDoneDialog(o, m);
      case 'new-wo': return newWoDrawer(o, m);
      case 'svc': return svcDrawer(o, m);
      case 'edit-customer': return editCustomerDrawer(o, m);
      case 'edit-asset': return editAssetDrawer(o, m);
      case 'cat-item': return catItemDrawer(o, m, state.role);
      case 'categories': return categoriesDrawer(o, m);
      case 'invite': return inviteDrawer(o, m);
      case 'member': return memberDrawer(o, m);
      case 'reassign': return reassignDrawer(o, m);
      default: return '';
    }
  } catch (err) { console.error(err); return ''; }
}

let lastTrigger = null;
export function render() {
  const a = document.activeElement;
  const fk = a?.dataset?.fk;
  // sem data-fk: lembra o botão pela ação + alvo, para o foco não "pular" depois do re-render
  const sig = !fk && a?.dataset?.action ? ['action', 'item', 'id', 'tab', 'stage', 'i', 'key', 'v', 'c', 'a'].filter((k) => a.dataset[k] != null).map((k) => `[data-${k}="${CSS.escape(a.dataset[k])}"]`).join('') : null;
  const sel = a && 'selectionStart' in a && a.type !== 'number' && a.type !== 'email' && a.type !== 'date' && a.type !== 'time' ? [a.selectionStart, a.selectionEnd] : null;
  const phoneScroll = document.querySelector('.phone-screen')?.scrollTop;
  const scrolls = [...document.querySelectorAll('.wo-main .scroll, .drawer .dialog-body, .dialog-body')].map((x) => x.scrollTop);
  root.innerHTML = shell(screen()) + modal();
  document.body.classList.toggle('annotating', state.ann.on);
  const draftOwner = activeDraftOwner();
  if (draftOwner) hydrateSignatures(root, draftOwner.draft, (k, v) => { draftOwner.draft.answers[k] = v; });
  if (phoneScroll != null && document.querySelector('.phone-screen')) document.querySelector('.phone-screen').scrollTop = phoneScroll;
  [...document.querySelectorAll('.wo-main .scroll, .drawer .dialog-body, .dialog-body')].forEach((x, i) => { if (scrolls[i] != null) x.scrollTop = scrolls[i]; });
  const dlg = root.querySelector('.dialog, .drawer');
  const scope = dlg || root;
  const el = fk ? scope.querySelector(`[data-fk="${CSS.escape(fk)}"]`) : sig ? scope.querySelector(sig) : null;
  if (el) {
    el.focus({ preventScroll: true });
    if (sel && 'setSelectionRange' in el) try { el.setSelectionRange(...sel); } catch { /* */ }
  } else if (dlg && !dlg.contains(document.activeElement)) {
    const pick = ['[data-action="move-confirm"]:not([disabled])', '[data-action="wo-advance"]', '.alert [data-action="open-form"]', '.tab[aria-selected="true"]', 'input, textarea, select', 'button:not([data-action="close-modal"])', 'button'].map((q) => dlg.querySelector(q)).find(Boolean);
    pick?.focus({ preventScroll: true });
  } else if (!dlg && lastTrigger) {
    root.querySelector(`[data-fk="${CSS.escape(lastTrigger)}"]`)?.focus({ preventScroll: true });
  }
  if (dlg) { if (!lastTrigger && fk && !scope.contains(document.querySelector(`[data-fk="${CSS.escape(fk)}"]`))) lastTrigger = fk; } else lastTrigger = null;
}
function activeDraftOwner() {
  if (state.role === 'operator' && state.op.screen === 'form') return state.op;
  if (state.role === 'operator' && state.op.screen === 'checkin' && state.op.ci?.step === 3) return state.op.ci;
  if (state.modal?.type === 'form') return state.modal;
  return null;
}

// ---------- Navegação ----------
function syncRoute() {
  const r = resolve(state.role, location.hash);
  state.route = { name: r.name, param: r.param };
  state.flowMenu = { open: false, q: '' };
  state.moreOpen = false;
  state.notice = r.denied ? `Esta área não está disponível para o papel "${t('role.' + state.role)}". Você foi levado para o início.` : null;
  if (r.name === 'formulario' && (!state.fb || state.fb.formId !== r.param)) state.fb = initBuilder(state.orgId, r.param);
  if (location.hash !== toHash(r.name, r.param)) history.replaceState(null, '', toHash(r.name, r.param));
  render();
  document.getElementById('main')?.focus({ preventScroll: true });
}
export function go(name, param) { state.modal = null; const h = toHash(name, param); if (location.hash === h) syncRoute(); else location.hash = h; }

// ---------- Helpers de ações ----------
const setPath = (obj, path, val) => { const ks = path.split('.'); let o = obj; ks.slice(0, -1).forEach((k) => { o = o[k] ??= {}; }); o[ks[ks.length - 1]] = val; };
function openForm(el) {
  const back = state.modal;
  state.modal = { type: 'form', woId: el.dataset.id, formId: el.dataset.form, stageId: el.dataset.stage, itemId: el.dataset.item || null, thenItem: el.dataset.thenItem || null, then: el.dataset.then || null, draft: { answers: {}, camera: null }, errors: [], back: back && back.type === 'move' ? back.back || null : back };
  render();
}
function itemAct(itemId, act) {
  const it = store.getItem(state.orgId, itemId);
  const plan = store.planItem(state.orgId, itemId, act);
  if (!plan.ok && plan.code === 'missing_form') { openForm({ dataset: { id: it.work_order_id, form: plan.missing.formId, stage: plan.missing.stageId, item: itemId, thenItem: act } }); return; }
  if (!plan.ok) { toast(plan.message, 'warn'); return; }
  const r = store.itemAction(state.orgId, itemId, act, userId());
  if (r.ok) toast(`${store.getCatalogItem(state.orgId, it.catalog_item_id).name}: ${tx('svc.status.' + r.to).toLowerCase()}.`);
}
function catDraftFrom(item) {
  return { ...item, base_price: item.base_price ?? '', avg_duration_min: item.avg_duration_min ?? '', recurrence_days: item.recurrence_days ?? '', subflow_workflow_id: item.subflow_workflow_id || '', bindings: store.getServiceBindings(state.orgId, item.id).map((b) => ({ form_id: b.form_id, moment: b.moment, required: b.required })) };
}

// ---------- Ações ----------
const actions = {
  'proto-toggle': () => { state.proto.open = !state.proto.open; render(); },
  'proto-hide': () => { state.proto = { open: false, hidden: true }; toast('Ferramentas ocultas. Para voltar: Alt+Shift+P.', 'info'); },
  'proto-restore': () => { location.hash = toHash(homeFor(state.role)); location.reload(); },
  'ann-toggle': () => { state.ann.on = !state.ann.on; state.ann.key = null; render(); },
  'ann-close': () => { state.ann.key = null; render(); },
  'more-toggle': (el, e) => { if (e.target.closest('[data-stop]') && !e.target.closest('[data-action="more-toggle"]')) return; state.moreOpen = !state.moreOpen; render(); },
  go: (el) => go(el.dataset.to, el.dataset.param),
  'flow-menu': () => { state.flowMenu.open = !state.flowMenu.open; render(); if (state.flowMenu.open) root.querySelector('.flow-menu .menu-item, .flow-menu input')?.focus(); },
  'flow-pick': () => { state.flowMenu = { open: false, q: '' }; },
  'open-wo': (el) => { state.modal = { type: 'wo', woId: el.dataset.id, tab: el.dataset.tab || 'data' }; render(); },
  'wo-tab': (el) => { state.modal.tab = el.dataset.tab; render(); },
  'close-modal': () => { const back = state.modal?.back; state.modal = back || null; render(); },
  'close-modal-nav': () => { state.modal = null; },
  'overlay-close': (el, e) => { if (e.target === el) { state.modal = null; render(); } },
  'open-move': (el) => { const back = state.modal?.type === 'wo' ? state.modal : null; state.modal = { type: 'move', woId: el.dataset.id, selected: null, back }; render(); },
  'move-select': (el) => { state.modal.selected = el.dataset.stage; state.modal.error = null; render(); },
  'move-confirm': () => confirmMove(),
  'wo-advance': (el) => {
    const v = store.getWorkOrderView(state.orgId, el.dataset.id);
    const na = nextAction(state.orgId, v);
    if (!na) return;
    const plan = na.target === '__complete' ? store.planCompleteSubflow(state.orgId, v.wo.id) : store.planMove(state.orgId, v.wo.id, na.target);
    if (!plan.ok) { state.modal = { type: 'move', woId: v.wo.id, selected: na.target, error: plan, back: state.modal }; render(); return; }
    const r = na.target === '__complete' ? store.completeSubflow(state.orgId, v.wo.id, userId()) : store.moveWorkOrder(state.orgId, v.wo.id, na.target, userId());
    announceMove(v, r);
  },
  'open-form': (el) => openForm(el),
  'form-cancel': () => { state.modal = state.modal.back || null; render(); },
  'form-submit': () => submitDesktopForm(),
  'item-act': (el) => itemAct(el.dataset.item, el.dataset.act),
  'item-notdone': (el) => { state.modal = { type: 'notdone', itemId: el.dataset.item, reason: '', back: state.modal }; render(); },
  'notdone-confirm': () => { const m = state.modal; const r = store.itemAction(state.orgId, m.itemId, 'not_done', userId(), { reason: m.reason }); if (!r.ok) { m.error = r.message; render(); return; } state.modal = m.back; toast('Registrado como não realizado.'); },
  'field-set': (el) => { const o = activeDraftOwner(); o.draft.answers[el.dataset.field] = el.dataset.bool ? el.dataset.value === 'true' : el.dataset.value; o.errors = (o.errors || []).filter((k) => k !== el.dataset.field); render(); },
  'camera-open': (el) => { activeDraftOwner().draft.camera = el.dataset.field; render(); },
  'camera-close': () => { activeDraftOwner().draft.camera = null; render(); },
  'photo-choose': (el) => { const o = activeDraftOwner(); o.draft.answers[el.dataset.field] = { url: el.dataset.url }; o.draft.camera = null; o.errors = (o.errors || []).filter((k) => k !== el.dataset.field); render(); root.querySelector(`[data-action="camera-open"][data-field="${el.dataset.field}"]`)?.focus(); },
  'sig-simulate': (el) => { const o = activeDraftOwner(); o.draft.answers[el.dataset.field] = { url: `placeholder:signature:${1 + Math.floor(Math.random() * 4)}` }; o.errors = (o.errors || []).filter((k) => k !== el.dataset.field); render(); },
  'sig-clear': (el) => { delete activeDraftOwner().draft.answers[el.dataset.field]; render(); },
  'filter-late': () => { state.filters.late = !state.filters.late; render(); },
  'filter-clear': () => { state.filters = { op: '', cat: '', late: false }; render(); },
  'complete-subflow': (el) => {
    const v = store.getWorkOrderView(state.orgId, el.dataset.id);
    const r = store.completeSubflow(state.orgId, el.dataset.id, userId());
    if (r.ok) announceMove(v, r);
    else { state.modal = { type: 'move', woId: el.dataset.id, selected: '__complete', error: r }; render(); }
  },
  'open-customer': (el) => go('cliente', el.dataset.id),
  // Novo atendimento
  'new-wo': (el) => { state.modal = { type: 'new-wo', d: newWoDraft(state.orgId, el.dataset.stage), errors: {} }; render(); },
  'nw-pick': (el) => { Object.assign(state.modal.d, { customerId: el.dataset.c, assetId: el.dataset.a }); state.modal.errors = {}; render(); },
  'nw-clear': () => { Object.assign(state.modal.d, { customerId: null, assetId: null }); render(); },
  'nw-newmode': (el) => { Object.assign(state.modal.d, { newMode: el.dataset.v === '1', customerId: null, assetId: null }); render(); },
  'nw-item': (el) => { const d = state.modal.d; const i = d.items.findIndex((x) => x.catalogItemId === el.dataset.item); if (i > -1) d.items.splice(i, 1); else d.items.push({ catalogItemId: el.dataset.item, assigneeId: '' }); state.modal.errors.items = null; render(); },
  'nw-start': (el) => { state.modal.d.startStageId = el.dataset.stage; render(); },
  'nw-submit': () => {
    const m = state.modal;
    const r = store.createWorkOrder(state.orgId, newWoPayload(state.orgId, m.d), userId());
    if (!r.ok) { m.errors = r.errors || {}; m.error = r.message; render(); return; }
    state.modal = { type: 'wo', woId: r.wo.id, tab: 'data' };
    const st = store.getStage(state.orgId, store.getFlowStates(state.orgId, r.wo.id)[0].current_stage_id);
    toast(`${t('entity.work_order')} #${r.wo.number} criad${gender('entity.work_order') === 'f' ? 'a' : 'o'} em ${st.label}.`);
  },
  // Serviços realizados
  'open-svc': (el) => { state.modal = { type: 'svc', itemId: el.dataset.item, back: state.modal?.type === 'wo' ? state.modal : null }; render(); },
  'sx-pending': () => { state.sx.pending = !state.sx.pending; render(); },
  'sx-clear': () => { state.sx = defaultSx(); render(); },
  drill: (el) => {
    const d = el.dataset;
    if (d.late) { state.filters = { op: '', cat: '', late: true }; go('kanban'); return; }
    state.sx = { ...defaultSx(), item: d.item || '', op: d.op || '', form: d.form || '', status: d.status || 'done', days: d.days != null ? Number(d.days) : 28, origin: d.origin || null };
    if (d.form && d.status === 'all') state.sx.days = 0;
    go('servicos');
  },
  // Clientes
  'cf-toggle': (el) => { state.cf[el.dataset.key] = !state.cf[el.dataset.key]; render(); },
  'cf-clear': () => { state.cf = defaultCf(); state.custQ = ''; render(); },
  'hf-set': (el) => { state.hf[el.dataset.key] = el.dataset.v; render(); },
  'toggle-audit': () => { state.showAudit = !state.showAudit; render(); },
  'edit-customer': (el) => { const c = store.getCustomer(state.orgId, el.dataset.id); state.modal = { type: 'edit-customer', id: c.id, d: { name: c.name, phone: c.phone, email: c.email, document: c.document }, errors: {} }; render(); },
  'save-customer': () => { const m = state.modal; const r = store.updateCustomer(state.orgId, m.id, m.d, userId()); if (!r.ok) { m.errors = r.errors || {}; render(); return; } state.modal = null; toast(r.unchanged ? 'Nada mudou.' : `${t('entity.customer')} atualizado.`); },
  'edit-asset': (el) => { const a = el.dataset.asset ? store.getAsset(state.orgId, el.dataset.asset) : null; state.modal = { type: 'edit-asset', customerId: el.dataset.customer, assetId: a?.id || null, d: { ...(a?.attributes || {}) } }; render(); },
  'save-asset': () => { const m = state.modal; const r = m.assetId ? store.updateAsset(state.orgId, m.assetId, m.d, userId()) : store.createAsset(state.orgId, m.customerId, m.d, userId()); if (!r.ok) { m.error = r.message; render(); return; } state.modal = null; toast(`${t('entity.asset')} salvo.`); },
  // Catálogo
  'cat-tab': (el) => { state.catS.tab = el.dataset.tab; render(); },
  'cat-open': (el) => { state.modal = { type: 'cat-item', d: catDraftFrom(store.getCatalogItem(state.orgId, el.dataset.id)), errors: {} }; render(); },
  'cat-open-from-form': (el) => { state.catS.tab = 'service'; go('catalogo'); state.modal = { type: 'cat-item', d: catDraftFrom(store.getCatalogItem(state.orgId, el.dataset.id)), errors: {} }; render(); },
  'cat-new': (el) => { const kind = el.dataset.kind; const cat = store.getCatalogCategories(state.orgId).find((c) => store.getCatalogItems(state.orgId, { kind }).some((i) => i.category_id === c.id)); state.modal = { type: 'cat-item', d: { kind, name: '', description: '', category_id: cat?.id || '', base_price: '', avg_duration_min: '', recurrence_days: '', service_location: 'unit', subflow_workflow_id: '', sku: '', active: true, bindings: [] }, errors: {} }; render(); },
  'cb-add': () => { const f = store.getForms(state.orgId)[0]; state.modal.d.bindings.push({ form_id: f?.id, moment: 'service_finish', required: true }); render(); },
  'cb-remove': (el) => { state.modal.d.bindings.splice(Number(el.dataset.i), 1); render(); },
  'cat-save': () => {
    const m = state.modal; const d = m.d;
    const keys = d.bindings.map((b) => b.form_id + b.moment);
    if (new Set(keys).size !== keys.length) { m.error = 'O mesmo formulário está repetido para o mesmo momento.'; render(); return; }
    const r = store.saveCatalogItem(state.orgId, d, userId());
    if (!r.ok) { m.errors = r.errors || {}; m.error = r.message; render(); return; }
    if (d.kind === 'service') store.setServiceBindings(state.orgId, r.item.id, d.bindings, userId());
    state.modal = null; toast(`${r.item.name}: salvo.`);
  },
  'cat-toggle-active': () => { const d = state.modal.d; store.setCatalogItemActive(state.orgId, d.id, !d.active, userId()); state.modal = null; toast(d.active ? `${d.name} desativado: some da criação, continua no histórico e no Painel.` : `${d.name} reativado.`); },
  'cat-delete': () => { const d = state.modal.d; const r = store.deleteCatalogItem(state.orgId, d.id, userId()); if (!r.ok) { state.modal.error = r.message; render(); return; } state.modal = null; toast(`${d.name} excluído.`); },
  'cat-categories': () => { state.modal = { type: 'categories', list: store.getCatalogCategories(state.orgId).map((c) => ({ ...c })) }; render(); },
  'cat-add-category': () => { state.modal.list.push({ id: null, name: 'Nova categoria', color: '#64748b' }); render(); },
  'cat-save-categories': () => { for (const c of state.modal.list) store.saveCategory(state.orgId, c, userId()); state.modal = null; toast('Categorias salvas.'); },
  // Formulários
  'fb-tab': (el) => { state.fb.tab = el.dataset.tab; render(); },
  'fb-view': (el) => { state.fb.view = el.dataset.v; render(); },
  'fb-add': (el) => { const ty = el.dataset.type; const label = { photo: 'Foto', text: 'Observação', yes_no: 'Item conferido?', number: 'Quantidade', option: 'Escolha uma opção', signature: 'Assinatura' }[ty]; state.fb.draft.fields.push({ key: '', type: ty, label, required: false, options: ty === 'option' ? ['Opção 1', 'Opção 2'] : [] }); render(); root.querySelector(`#fbl-${state.fb.draft.fields.length - 1}`)?.focus(); },
  'fb-remove': (el) => { state.fb.draft.fields.splice(Number(el.dataset.i), 1); render(); },
  'fb-move': (el) => { const f = state.fb.draft.fields; const i = Number(el.dataset.i), j = i + Number(el.dataset.d); [f[i], f[j]] = [f[j], f[i]]; render(); },
  'fb-save': () => {
    const fb = state.fb;
    const r = store.saveForm(state.orgId, fb.draft, userId());
    if (!r.ok) { fb.errors = r.errors; render(); return; }
    toast(r.newVersion ? `Versão ${r.form.version} criada. As respostas antigas continuam com os campos da versão em que foram feitas.` : `${r.form.name}: salvo.`);
    state.fb = initBuilder(state.orgId, r.form.id);
    if (state.route.param !== r.form.id) go('formulario', r.form.id); else render();
  },
  'fb-bind': () => { const nb = state.fb.nb; if (!nb.stageId) { toast(`Escolha a ${t('entity.stage', { lower: true })}.`, 'warn'); return; } store.setStageBinding(state.orgId, { formId: state.fb.draft.id, stageId: nb.stageId, moment: nb.moment, required: nb.required }, userId()); toast('Ligado.'); },
  'fb-unbind': (el) => { store.setStageBinding(state.orgId, { remove: true, bindingId: el.dataset.id }, userId()); toast('Vínculo removido.'); },
  // Equipe
  'team-invite': () => { state.modal = { type: 'invite', d: { name: '', contact: '', role: 'operator' }, errors: {} }; render(); },
  'team-invite-send': () => { const m = state.modal; const r = store.inviteMember(state.orgId, m.d, userId()); if (!r.ok) { m.errors = r.errors; render(); return; } state.modal = null; toast(`Convite enviado para ${m.d.name}.`); },
  'team-accept': (el) => { store.acceptInvite(state.orgId, el.dataset.id); toast('Convite aceito: a pessoa já aparece na equipe e nos filtros.'); },
  'team-open': (el) => { state.modal = { type: 'member', memberId: el.dataset.id }; render(); },
  'team-deactivate': (el) => {
    const r = store.deactivateMember(state.orgId, el.dataset.id, userId());
    if (r.ok) { toast('Desativado.'); return; }
    if (r.code === 'open_work') { state.modal = { type: 'reassign', memberId: el.dataset.id, message: r.message, to: '' }; render(); return; }
    toast(r.message, 'warn');
  },
  'team-reassign': () => {
    const m = state.modal;
    if (!m.to) { m.error = 'Escolha para quem passar.'; render(); return; }
    const mem = store.getAllMembers(state.orgId).find((x) => x.id === m.memberId);
    const r = store.reassignOpenWork(state.orgId, mem.user_id, m.to, userId());
    const d = store.deactivateMember(state.orgId, m.memberId, userId());
    state.modal = null;
    toast(d.ok ? `${r.moved} reatribuídos e ${mem.profile.name.split(' ')[0]} desativado.` : d.message, d.ok ? 'ok' : 'warn');
  },
  ...operatorActions,
};

function confirmMove() {
  const m = state.modal;
  m.selected = m.selected || defaultMoveTarget(state.orgId, m.woId);
  if (!m.selected) return;
  const v = store.getWorkOrderView(state.orgId, m.woId);
  const r = m.selected === '__complete' ? store.completeSubflow(state.orgId, m.woId, userId()) : store.moveWorkOrder(state.orgId, m.woId, m.selected, userId());
  if (!r.ok) { m.error = r; render(); return; }
  state.modal = m.back ? { ...m.back } : null;
  announceMove(v, r);
}
export function announceMove(v, r) {
  if (r.summary.kind === 'return') toast(tx('move.subflow_returned', { flow: r.summary.workflow.name, stage: r.summary.stage.label }));
  else if (r.summary.entersSub) { const first = store.getStages(state.orgId, r.summary.stage.opens_workflow_id)[0]; toast(tx('move.subflow_entered', { flow: store.getWorkflow(state.orgId, r.summary.stage.opens_workflow_id).name, stage: first.label })); }
  else toast(tx('move.done', { num: v.wo.number, stage: r.summary.stage.label }));
}

function submitDesktopForm() {
  const m = state.modal;
  const res = store.submitFormResponse(state.orgId, { woId: m.woId, formId: m.formId, stageId: m.stageId, itemId: m.itemId, answers: m.draft.answers, byUserId: userId() });
  if (!res.ok) { m.errors = res.missing; m.error = res.message; render(); return; }
  toast(`${store.getForm(state.orgId, m.formId).name}: respondido.`);
  const back = m.back && m.back.type === 'wo' ? { ...m.back } : { type: 'wo', woId: m.woId, tab: 'data' };
  if (m.thenItem) { state.modal = back; const r = store.itemAction(state.orgId, m.itemId, m.thenItem, userId()); if (!r.ok) toast(r.message, 'warn'); else render(); return; }
  if (m.then) {
    const v = store.getWorkOrderView(state.orgId, m.woId);
    const r = m.then === '__complete' ? store.completeSubflow(state.orgId, m.woId, userId()) : store.moveWorkOrder(state.orgId, m.woId, m.then, userId());
    if (r.ok) { state.modal = back; announceMove(v, r); return; }
    state.modal = { type: 'move', woId: m.woId, selected: m.then, error: r, back }; render(); return;
  }
  state.modal = { ...back, tab: 'forms' };
  render();
}

// ---------- Delegação ----------
document.addEventListener('click', (e) => {
  if (state.flowMenu.open && !e.target.closest('.flow-switch')) { state.flowMenu.open = false; render(); }
  if (state.proto.open && !e.target.closest('.proto')) { state.proto.open = false; render(); }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName === 'A' && !['close-modal-nav', 'flow-pick'].includes(el.dataset.action)) e.preventDefault();
  fn(el, e);
});
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.shiftKey && (e.key === 'P' || e.key === 'p' || e.code === 'KeyP')) { e.preventDefault(); state.proto.hidden = !state.proto.hidden; state.proto.open = false; render(); return; }
  if (e.key === 'Escape') {
    if (state.flowMenu.open) { state.flowMenu.open = false; render(); root.querySelector('[data-fk="flow-btn"]')?.focus(); return; }
    if (state.modal?.draft?.camera) { state.modal.draft.camera = null; render(); return; }
    if (state.modal) { state.modal = state.modal.back || null; render(); return; }
    if (state.proto.open) { state.proto.open = false; render(); return; }
  }
  if (state.flowMenu.open && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
    const items = [...root.querySelectorAll('.flow-menu .menu-item')];
    const i = items.indexOf(document.activeElement);
    const n = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
    items[n]?.focus(); e.preventDefault(); return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.wo-card, tr.clickable')) { e.preventDefault(); e.target.click(); }
});
function onField(el, isChange) {
  const ds = el.dataset;
  const val = el.type === 'checkbox' ? el.checked : el.value;
  const m = state.modal;
  if (ds.draft) { const o = activeDraftOwner(); if (o) o.draft.answers[ds.draft] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value; return true; }
  if (operatorInput(el)) return true;
  if (ds.input === 'cust-q') { state.custQ = el.value; render(); return true; }
  if (ds.input === 'flow-q') { state.flowMenu.q = el.value; render(); return true; }
  if (ds.input === 'cat-q') { state.catS.q = el.value; render(); return true; }
  if (ds.input === 'nd-reason' && m) { m.reason = el.value; return true; }
  if (ds.nw && m?.type === 'new-wo') { setPath(m.d, ds.nw, val); if (ds.rerender || isChange) render(); return true; }
  if (ds.nwAssign && m?.type === 'new-wo') { const x = m.d.items.find((i) => i.catalogItemId === ds.nwAssign); if (x) x.assigneeId = val; return true; }
  if (ds.ed && m) { m.d[ds.ed] = val; return true; }
  if (ds.cd && m?.type === 'cat-item') { m.d[ds.cd] = val; if (isChange && el.tagName === 'SELECT') render(); return true; }
  if (ds.cb != null && ds.k && m?.type === 'cat-item') { m.d.bindings[Number(ds.cb)][ds.k] = val; return true; }
  if (ds.cat != null && ds.k && m?.type === 'categories') { m.list[Number(ds.cat)][ds.k] = val; if (isChange) render(); return true; }
  if (ds.fbm && state.fb) { state.fb.draft[ds.fbm] = val; return true; }
  if (ds.fbf != null && ds.k && state.fb) { const f = state.fb.draft.fields[Number(ds.fbf)]; f[ds.k] = ds.k === 'options' ? String(val).split(',').map((x) => x.trim()) : val; if (isChange && (ds.k === 'type' || ds.k === 'required' || ds.k === 'options')) render(); else if (!isChange && ds.k === 'label') { clearTimeout(onField.t); onField.t = setTimeout(render, 400); } return true; }
  if (ds.nb && state.fb) { state.fb.nb[ds.nb] = val; return true; }
  if (ds.rq && state.fb && isChange) { state.fb.rq[ds.rq] = ds.rq === 'days' ? Number(val) : val; render(); return true; }
  if (ds.iv && m?.type === 'invite') { m.d[ds.iv] = val; return true; }
  if (ds.ra && m?.type === 'reassign') { m.to = val; m.error = null; return true; }
  return false;
}
document.addEventListener('change', (e) => {
  const el = e.target;
  const k = el.dataset.change;
  if (k === 'role') { state.role = el.value; state.modal = null; state.proto.open = window.innerWidth >= 768; state.op = { screen: 'day', woId: null }; location.hash = toHash(homeFor(state.role)); syncRoute(); return; }
  if (k === 'operator') { state.operatorId = el.value; state.op = { screen: 'day', woId: null }; render(); return; }
  if (k === 'tenant') { state.orgId = el.value; setI18nOrg(state.orgId); state.filters = { op: '', cat: '', late: false }; state.sx = defaultSx(); state.cf = defaultCf(); state.modal = null; state.fb = null; state.op = { screen: 'day', woId: null }; const ops = store.getMembersByRole(state.orgId, 'operator'); if (ops[0]) state.operatorId = ops[0].user_id; applyBrand(); syncRoute(); return; }
  if (k === 'filter-op') { state.filters.op = el.value; render(); return; }
  if (k === 'filter-cat') { state.filters.cat = el.value; render(); return; }
  if (k === 'sx') { state.sx[el.dataset.key] = el.dataset.key === 'days' ? Number(el.value) : el.value; state.sx.origin = el.dataset.key === 'sort' ? state.sx.origin : null; render(); return; }
  if (k === 'cf') { state.cf[el.dataset.key] = el.value; render(); return; }
  if (k === 'cat-show') { state.catS.show = el.value; render(); return; }
  if (k === 'item-assign') { const r = store.reassignItem(state.orgId, el.dataset.item, el.value, userId()); if (r.ok) toast(`Responsável trocado para ${store.getProfile(el.value)?.name.split(' ')[0]}.`); else toast(r.message, 'warn'); return; }
  if (k === 'team-role') { const r = store.changeRole(state.orgId, el.dataset.id, el.value, userId()); if (!r.ok) { toast(r.message, 'warn'); render(); } else toast('Papel alterado.'); return; }
  onField(el, true);
});
document.addEventListener('input', (e) => { onField(e.target, false); });

// Drag-and-drop (desktop). Sempre há "Mover etapa" no modal como alternativa.
let dragId = null;
document.addEventListener('dragstart', (e) => { const c = e.target.closest?.('.wo-card[draggable="true"]'); if (!c) return; dragId = c.dataset.wo; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
document.addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.dragging, .drop-ok').forEach((x) => x.classList.remove('dragging', 'drop-ok')); });
document.addEventListener('dragover', (e) => { const col = e.target.closest?.('.column[data-stage]'); if (!col || !dragId) return; e.preventDefault(); document.querySelectorAll('.drop-ok').forEach((x) => x !== col && x.classList.remove('drop-ok')); col.classList.add('drop-ok'); });
document.addEventListener('drop', (e) => {
  const col = e.target.closest?.('.column[data-stage]');
  if (!col || !dragId) return;
  e.preventDefault();
  const id = dragId; dragId = null;
  const stageId = col.dataset.stage;
  const v = store.getWorkOrderView(state.orgId, id);
  if ((v.subStage?.id || v.stage.id) === stageId) { render(); return; }
  const r = store.moveWorkOrder(state.orgId, id, stageId, userId());
  if (r.ok) announceMove(v, r);
  else { state.modal = { type: 'move', woId: id, selected: stageId, error: r }; render(); }
});

// ---------- Boot ----------
installAnnotate(() => state.ann.on, (key) => { state.ann.key = key; render(); });
store.subscribe(() => render());
window.addEventListener('hashchange', syncRoute);
setI18nOrg(state.orgId);
applyBrand();
syncRoute();
setInterval(() => { if (!state.modal && !(state.role === 'operator' && ['form', 'checkin'].includes(state.op.screen)) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) render(); }, 60000);
