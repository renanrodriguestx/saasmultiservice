// Kanban do fluxo principal (Bloco 2) e quadro do subfluxo (Bloco 3).
import * as store from '../store.js';
import { t, tx, art } from '../i18n.js';
import { icon } from '../components/icons.js';
import { esc } from '../components/format.js';
import { woCard, milestoneBadge } from '../components/wo.js';
import { toHash, can } from '../router.js';

const openCount = (orgId, wfId) => [...store.getWorkOrdersByStage(orgId, wfId).entries()].filter(([sid]) => !['canceled', 'finished'].includes(store.getStage(orgId, sid)?.milestone)).reduce((n, [, l]) => n + l.length, 0);
/** Seletor de fluxo (padrão "pipe/project switcher"): título da página + menu agrupado. */
function flowSwitcher(orgId, active, menu) {
  const wfs = store.getWorkflows(orgId);
  const main = store.getMainWorkflow(orgId);
  const q = (menu.q || '').toLowerCase();
  const match = (w) => !q || w.name.toLowerCase().includes(q);
  const item = (w) => {
    const parent = w.kind === 'sub' ? store.getStages(orgId, main.id).find((s) => s.opens_workflow_id === w.id) : null;
    return `<a class="menu-item" role="menuitem" href="${w.kind === 'main' ? toHash('kanban') : toHash('subfluxo', w.id)}" ${w.id === active.id ? 'aria-current="true"' : ''} data-action="flow-pick">
      ${w.kind === 'sub' ? icon('layers', 'sm') : icon('kanban', 'sm')}<span class="grow">${esc(w.name)}${parent ? `<br><span class="subtle" style="font-size:12px">abre em ${esc(parent.label)}</span>` : ''}</span><span class="badge">${openCount(orgId, w.id)}</span></a>`;
  };
  const mains = wfs.filter((w) => w.kind === 'main' && match(w)), subs = wfs.filter((w) => w.kind === 'sub' && match(w));
  return `<div class="flow-switch" data-ann="flow-tabs">
    <button type="button" data-action="flow-menu" aria-haspopup="menu" aria-expanded="${!!menu.open}" data-fk="flow-btn"><h1>${active.kind === 'sub' ? `${t('entity.subflow')}: ` : ''}${esc(active.name)}</h1>${icon('chevronDown')}</button>
    ${menu.open ? `<div class="flow-menu" role="menu" aria-label="${esc(t('entity.workflow', { plural: true }))}">
      ${wfs.length > 7 ? `<div style="padding:4px"><input class="input" placeholder="Buscar ${esc(t('entity.workflow', { lower: true }))}" data-input="flow-q" data-fk="flow-q" value="${esc(menu.q || '')}"></div>` : ''}
      ${mains.length ? `<div class="grp">${esc(t('entity.workflow', { plural: true }))}</div>${mains.map(item).join('')}` : ''}
      ${subs.length ? `<div class="grp">${esc(t('entity.subflow', { plural: true }))}</div>${subs.map(item).join('')}` : ''}
      ${!mains.length && !subs.length ? '<p class="muted" style="padding:10px">Nada encontrado.</p>' : ''}
    </div>` : ''}</div>`;
}

function filtersBar(orgId, f) {
  const ops = store.getExecutors(orgId);
  const cats = store.getCatalogCategories(orgId).filter((c) => store.getCatalogItems(orgId, { kind: 'service' }).some((i) => i.category_id === c.id));
  const active = f.op || f.cat || f.late;
  return `<div class="filters" role="group" aria-label="Filtros" data-ann="filters">
    <label class="sr-only" for="f-op">${esc(t('role.operator'))}</label>
    <select class="select" id="f-op" data-change="filter-op" data-fk="f-op"><option value="">${tx('kanban.filter.operator')}</option>${ops.map((m) => `<option value="${m.user_id}" ${f.op === m.user_id ? 'selected' : ''}>${esc(m.profile.name)}</option>`).join('')}</select>
    <label class="sr-only" for="f-cat">Categoria</label>
    <select class="select" id="f-cat" data-change="filter-cat" data-fk="f-cat"><option value="">${tx('kanban.filter.category')}</option>${cats.map((c) => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <button class="toggle" aria-pressed="${f.late}" data-action="filter-late" data-fk="f-late">${icon('alert', 'sm')} ${tx('kanban.filter.late')}</button>
    ${active ? `<button class="btn btn-ghost btn-sm" data-action="filter-clear">${tx('kanban.filter.clear')}</button>` : ''}
  </div>`;
}
function applyFilters(list, f) {
  return list.filter((v) => (!f.op || v.assignees.some((a) => a.user_id === f.op) || v.services.some((i) => i.assignee_id === f.op)) && (!f.cat || v.items.some((i) => i.catalog.category_id === f.cat)) && (!f.late || v.deadline.state === 'late'));
}
const sortCards = (list) => list.sort((a, b) => (a.deadline.state === 'late' ? -1 : 0) - (b.deadline.state === 'late' ? -1 : 0) || a.wo.due_at.localeCompare(b.wo.due_at));
// Etapas "finished" mostram só os últimos 7 dias para o quadro não crescer sem fim.
function trimFinished(stage, list) {
  if (stage.milestone !== 'finished') return { list, hidden: 0 };
  const lim = +store.now() - 7 * 86400e3;
  const keep = list.filter((v) => new Date(v.mainState.entered_at) >= lim);
  return { list: keep, hidden: list.length - keep.length };
}

export function renderKanban({ orgId, state }) {
  const wf = store.getMainWorkflow(orgId);
  if (!wf) return emptyOrg();
  const stages = store.getStages(orgId, wf.id);
  const byStage = store.getWorkOrdersByStage(orgId, wf.id);
  const f = state.filters;
  const canCreate = can(state.role, 'wo.create');
  const canceled = store.getStages(orgId, wf.id, { includeCanceled: true }).filter((s) => s.milestone === 'canceled').reduce((n, s) => n + (byStage.get(s.id)?.length || 0), 0);
  const cols = stages.map((s) => {
    const all = byStage.get(s.id) || [];
    const { list: trimmed, hidden } = trimFinished(s, all);
    const list = sortCards(applyFilters(trimmed, f));
    return { s, list, hidden, total: all.length };
  });
  const anyCards = cols.some((c) => c.list.length);
  const colHtml = cols.map(({ s, list, hidden }) => {
    const sub = s.opens_workflow_id ? store.getWorkflow(orgId, s.opens_workflow_id) : null;
    const ret = s.return_stage_id ? store.getStage(orgId, s.return_stage_id) : null;
    return `<section class="column" data-stage="${s.id}" aria-labelledby="col-${s.id}">
      <div class="column-head"><h3 id="col-${s.id}" data-ann="column">${esc(s.label)}</h3><span class="count" aria-label="${list.length} cards">${list.length}</span><span class="milestone-tag" data-ann="column-milestone">${esc(s.milestone)}</span>
        ${canCreate && s.id === stages[0].id ? `<button class="col-add" data-action="new-wo" data-stage="${s.id}" aria-label="${esc(tx('wo.new'))} em ${esc(s.label)}" title="${esc(tx('wo.new'))}" data-ann="wo-new">+</button>` : ''}</div>
      ${sub ? `<div class="column-sub" data-ann="column-polish">${icon('layers', 'sm')} Abre o ${t('entity.subflow', { lower: true })} ${esc(sub.name)} → volta para ${esc(ret?.label)}. <a href="${toHash('subfluxo', sub.id)}">${tx('kanban.open_subflow')}</a></div>` : ''}
      ${hidden ? `<div class="column-sub">Últimos 7 dias · ${hidden} mais antig${hidden === 1 ? 'o' : 'os'} no histórico</div>` : ''}
      <div class="column-body">${list.length ? list.map((v) => woCard(v, { draggable: true })).join('') : `<div class="column-empty">${tx(f.op || f.cat || f.late ? 'kanban.empty_filtered' : 'kanban.empty_column')}</div>`}</div>
    </section>`;
  }).join('');
  const mobile = cols.map(({ s, list }) => `<details class="stage-group" ${list.length && s.milestone !== 'finished' ? 'open' : ''}>
      <summary><span data-ann="column">${esc(s.label)}</span><span class="count subtle">${list.length}</span>${canCreate && s.id === stages[0].id ? `<button class="col-add" data-action="new-wo" aria-label="${esc(tx('wo.new'))}">+</button>` : ''}<span class="grow"></span>${s.opens_workflow_id ? `<span class="badge info">${icon('layers', 'sm')} ${t('entity.subflow')}</span>` : ''}${icon('chevronDown', 'sm')}</summary>
      <div class="group-body">${s.opens_workflow_id ? `<a class="btn btn-sm" href="${toHash('subfluxo', s.opens_workflow_id)}">${icon('layers', 'sm')} ${tx('kanban.open_subflow')} ${esc(store.getWorkflow(orgId, s.opens_workflow_id).name)}</a>` : ''}
      ${list.length ? list.map((v) => woCard(v)).join('') : `<div class="column-empty">${tx('kanban.empty_column')}</div>`}</div></details>`).join('');
  return `<div class="page-head"><div>${flowSwitcher(orgId, wf, state.flowMenu)}<p>${tx('kanban.subtitle')}</p></div>
      <div class="row-wrap">${canceled ? `<span class="badge">${tx('kanban.canceled_hidden', { n: canceled })}</span>` : ''}
      ${canCreate ? `<button class="btn btn-primary" data-action="new-wo" data-fk="new-wo" data-ann="wo-new">+ ${tx('wo.new')}</button>` : ''}</div></div>
    ${filtersBar(orgId, f)}
    ${!anyCards && (f.op || f.cat || f.late) ? `<div class="card"><div class="empty">${icon('filter')}<strong>${tx('kanban.empty_filtered')}</strong><button class="btn" data-action="filter-clear">${tx('kanban.filter.clear')}</button></div></div>` : ''}
    <div class="board" aria-label="${esc(t('entity.workflow'))} ${esc(wf.name)}">${colHtml}</div>
    <div class="board-mobile">${mobile}</div>`;
}

export function renderSubflow({ orgId, state }, workflowId) {
  const wf = store.getWorkflow(orgId, workflowId);
  if (!wf || wf.kind !== 'sub') return `<div class="card"><div class="empty">${icon('alert')}<strong>${t('entity.subflow')} não encontrado</strong><p>Ele não existe nesta organização.</p><a class="btn" href="${toHash('kanban')}">Voltar ao quadro</a></div></div>`;
  const main = store.getMainWorkflow(orgId);
  const parent = store.getStages(orgId, main.id).find((s) => s.opens_workflow_id === wf.id);
  const ret = parent ? store.getStage(orgId, parent.return_stage_id) : null;
  const stages = store.getStages(orgId, wf.id);
  const byStage = store.getWorkOrdersByStage(orgId, wf.id);
  const f = state.filters;
  const last = stages[stages.length - 1];
  const cols = stages.map((s) => ({ s, list: sortCards(applyFilters(byStage.get(s.id) || [], f)) }));
  const card = (v, s) => woCard(v, { draggable: true, showSub: false }) .replace('</article>', s.id === last.id ? `<button class="btn btn-sm btn-primary" data-action="complete-subflow" data-id="${v.wo.id}" style="margin-top:4px">${icon('check', 'sm')} Concluir e voltar para ${esc(ret?.label)}</button></article>` : '</article>');
  const colHtml = cols.map(({ s, list }) => `<section class="column" data-stage="${s.id}" aria-labelledby="col-${s.id}">
      <div class="column-head"><h3 id="col-${s.id}" data-ann="column">${esc(s.label)}</h3><span class="count">${list.length}</span><span class="milestone-tag" data-ann="column-milestone">${esc(s.milestone)}</span></div>
      <div class="column-body">${list.length ? list.map((v) => card(v, s)).join('') : `<div class="column-empty">${tx('kanban.empty_column')}</div>`}</div></section>`).join('');
  const mobile = cols.map(({ s, list }) => `<details class="stage-group" open><summary><span>${esc(s.label)}</span><span class="count subtle">${list.length}</span><span class="grow"></span>${icon('chevronDown', 'sm')}</summary>
      <div class="group-body">${list.length ? list.map((v) => card(v, s)).join('') : `<div class="column-empty">${tx('kanban.empty_column')}</div>`}</div></details>`).join('');
  return `<div class="page-head"><div><nav class="breadcrumb" aria-label="Caminho"><a href="${toHash('kanban')}">${esc(main.name)}</a>${icon('chevronRight', 'sm')}<span>${esc(wf.name)}</span></nav>
      ${flowSwitcher(orgId, wf, state.flowMenu)}
      <p data-ann="column-polish">Abre a partir de "${esc(parent?.label)}". Ao concluir "${esc(last.label)}", ${art('entity.work_order')} ${t('entity.work_order', { lower: true })} volta para "${esc(ret?.label)}" no ${t('entity.workflow', { lower: true })} principal. É ${art('entity.work_order')} mesm${art('entity.work_order')} ${t('entity.work_order', { lower: true })}, não uma cópia.</p></div></div>
    ${filtersBar(orgId, f)}
    <div class="board">${colHtml}</div><div class="board-mobile">${mobile}</div>`;
}

function emptyOrg() {
  return `<div class="card"><div class="empty">${icon('kanban')}<strong>Nenhum ${t('entity.workflow', { lower: true })} configurado</strong><p>Esta organização ainda não definiu as fases da operação. No onboarding (passo 5), o preset sugere um fluxo.</p></div></div>`;
}
