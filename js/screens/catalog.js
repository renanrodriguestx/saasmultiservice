// Cadastros › Serviços e produtos (C1). Owner e admin editam; manager só lê (matriz do doc 05).
import * as store from '../store.js';
import { t, tx, ga } from '../i18n.js';
import { icon } from '../components/icons.js';
import { esc, money, duration } from '../components/format.js';
import { drawer } from '../components/wo.js';
import { can } from '../router.js';

export const defaultCatState = () => ({ tab: 'service', q: '', show: 'active' });
const LOC = { unit: () => `No ${t('entity.unit', { lower: true })}`, customer_site: () => `No ${t('entity.customer', { lower: true })}`, both: () => 'Ambos' };

export function renderCatalog({ orgId, state }) {
  const cs = state.catS;
  const edit = can(state.role, 'catalog.edit');
  const cats = store.getCatalogCategories(orgId);
  const q = cs.q.trim().toLowerCase();
  const items = store.getCatalogItems(orgId, { kind: cs.tab }).filter((i) => (cs.show === 'all' || (cs.show === 'active' ? i.active : !i.active)) && (!q || i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q)));
  const head = `<div class="page-head"><div><h1>${tx('nav.catalog')}</h1><p>${edit ? 'O que a empresa oferece. Preço novo vale para os próximos; quem já foi criado mantém o preço da época.' : 'Você pode consultar; quem edita é dono ou recepção.'}</p></div>
    ${edit ? `<div class="row-wrap"><button class="btn" data-action="cat-categories" data-fk="cat-cats">Categorias</button><button class="btn btn-primary" data-action="cat-new" data-kind="${cs.tab}" data-fk="cat-new">+ Nov${ga(cs.tab === 'service' ? 'entity.service' : 'entity.product')} ${esc(t(cs.tab === 'service' ? 'entity.service' : 'entity.product', { lower: true }))}</button></div>` : ''}</div>`;
  const tabs = `<div class="tabs" role="tablist" style="margin-bottom:16px">${[['service', t('entity.service', { plural: true })], ['product', t('entity.product', { plural: true })]].map(([k, l]) => `<button class="tab" role="tab" aria-selected="${cs.tab === k}" data-action="cat-tab" data-tab="${k}" data-fk="ct-${k}">${esc(l)} <span class="count subtle">${store.getCatalogItems(orgId, { kind: k }).length}</span></button>`).join('')}</div>`;
  const filters = `<div class="filters"><div class="search" style="flex:1 1 260px;max-width:360px"><label class="sr-only" for="cat-q">Buscar</label>${icon('search', 'sm')}<input class="input" id="cat-q" placeholder="Buscar por nome${cs.tab === 'product' ? ' ou SKU' : ''}" data-input="cat-q" data-fk="cat-q" value="${esc(cs.q)}"></div>
    <label class="sr-only" for="cat-show">Mostrar</label><select class="select" id="cat-show" data-change="cat-show" data-fk="cat-show"><option value="active" ${cs.show === 'active' ? 'selected' : ''}>Ativos</option><option value="inactive" ${cs.show === 'inactive' ? 'selected' : ''}>Inativos</option><option value="all" ${cs.show === 'all' ? 'selected' : ''}>Todos</option></select></div>`;
  if (!store.getCatalogItems(orgId).length) return `${head}<div class="card"><div class="empty">${icon('layers')}<strong>Ainda não há ${esc(t('entity.service', { plural: true, lower: true }))}</strong><p>O preset do segmento sugere uma lista pronta para revisar. Também dá para criar um a um.</p></div></div>`;
  const groups = cats.map((c) => ({ c, list: items.filter((i) => i.category_id === c.id) })).filter((g) => g.list.length);
  const body = groups.length ? groups.map(({ c, list }) => `<section class="card" style="margin-bottom:16px"><div class="card-head"><h3><span class="dot" style="background:${esc(c.color)}"></span> ${esc(c.name)}</h3><span class="subtle" style="font-size:13px">${list.length}</span></div>
    <div class="table-wrap" style="overflow:auto"><table class="table"><thead><tr><th>Nome</th><th style="text-align:right">Preço</th>${cs.tab === 'service' ? '<th>Duração</th><th>Recorrência</th><th>Local</th><th>Evidências exigidas</th><th style="text-align:right">Feitos (28 d)</th>' : '<th>SKU</th>'}<th></th></tr></thead><tbody>
    ${list.map((i) => { const ev = store.getServiceBindings(orgId, i.id); return `<tr class="clickable" data-action="cat-open" data-id="${i.id}" tabindex="0" data-fk="ci-${i.id}"><td><strong>${esc(i.name)}</strong>${i.subflow_workflow_id ? ` <span class="badge info">${icon('layers', 'sm')} ${esc(store.getWorkflow(orgId, i.subflow_workflow_id)?.name || '')}</span>` : ''}</td><td style="text-align:right" class="tabular">${money(i.base_price)}</td>
      ${cs.tab === 'service' ? `<td>${duration(i.avg_duration_min)}</td><td>${i.recurrence_days ? `a cada ${i.recurrence_days} dias` : '<span class="subtle">—</span>'}</td><td>${esc(LOC[i.service_location]?.() || '—')}</td><td data-ann="svc-evidence-req">${ev.length ? ev.map((b) => `<span class="badge">${esc(b.form.name)} · ${b.moment === 'service_start' ? 'iniciar' : 'finalizar'}</span>`).join(' ') : '<span class="subtle">—</span>'}</td><td style="text-align:right" class="tabular">${store.countItemUses(orgId, i.id)}</td>` : `<td class="mono">${esc(i.sku || '—')}</td>`}
      <td>${i.active ? '' : '<span class="badge">Inativo</span>'}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="table-cards card-pad">${list.map((i) => `<button class="pick" data-action="cat-open" data-id="${i.id}"><span class="grow"><strong>${esc(i.name)}</strong><br><span class="subtle" style="font-size:12px">${money(i.base_price)}${i.avg_duration_min ? ` · ${duration(i.avg_duration_min)}` : ''}${i.active ? '' : ' · inativo'}</span></span>${icon('chevronRight', 'sm')}</button>`).join('')}</div></section>`).join('')
    : `<div class="card"><div class="empty">${icon('search')}<strong>Nada encontrado</strong><p>Confira a busca ou o filtro de ativos.</p></div></div>`;
  return `${head}${tabs}${filters}${body}`;
}

export function catItemDrawer(orgId, m, role) {
  const edit = can(role, 'catalog.edit');
  const d = m.d, e = m.errors || {};
  const dis = edit ? '' : 'disabled';
  const cats = store.getCatalogCategories(orgId);
  const subs = store.getWorkflows(orgId).filter((w) => w.kind === 'sub');
  const forms = store.getForms(orgId);
  const inp = (k, label, type = 'text', req = false, extra = '') => `<div class="field"><label for="cf-${k}">${label}${req ? '<span class="req">*</span>' : ''}</label><input class="input" id="cf-${k}" type="${type}" data-cd="${k}" data-fk="cf-${k}" value="${esc(d[k] ?? '')}" ${dis} ${e[k] ? 'aria-invalid="true"' : ''} ${extra}>${e[k] ? `<span class="field-error">${icon('alert', 'sm')} ${esc(e[k])}</span>` : ''}</div>`;
  const isSvc = d.kind === 'service';
  const stageForms = store.getForms(orgId).flatMap((f) => store.getFormBindings(orgId, f.id).filter((b) => b.scope === 'stage').map((b) => ({ f, b })));
  const evid = isSvc ? `<section class="stack-sm" data-ann="svc-evidence-req"><h3 style="font-size:15px">Evidências exigidas</h3>
    <p class="muted" style="font-size:13px">Quais ${esc(t('entity.form', { plural: true, lower: true }))} este ${esc(t('entity.service', { lower: true }))} exige para iniciar e para dar como realizado (D16). O mesmo ${esc(t('entity.form', { lower: true }))} pode servir vários ${esc(t('entity.service', { plural: true, lower: true }))}.</p>
    ${d.bindings.map((b, i) => `<div class="row-wrap" style="gap:8px"><label class="sr-only" for="bf-${i}">Formulário</label><select class="select" style="flex:1 1 180px;width:auto" id="bf-${i}" data-cb="${i}" data-k="form_id" ${dis}>${forms.map((f) => `<option value="${f.id}" ${b.form_id === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select>
      <label class="sr-only" for="bm-${i}">Momento</label><select class="select" style="width:auto" id="bm-${i}" data-cb="${i}" data-k="moment" ${dis}><option value="service_start" ${b.moment === 'service_start' ? 'selected' : ''}>Para iniciar</option><option value="service_finish" ${b.moment === 'service_finish' ? 'selected' : ''}>Para finalizar</option></select>
      <label class="row" style="font-size:13px"><input type="checkbox" data-cb="${i}" data-k="required" ${b.required ? 'checked' : ''} ${dis}> Obrigatório</label>
      ${edit ? `<button class="btn btn-sm btn-ghost" data-action="cb-remove" data-i="${i}" aria-label="Remover vínculo">${icon('x', 'sm')}</button>` : ''}</div>`).join('') || '<p class="subtle" style="font-size:13px">Nenhum. O serviço pode ser iniciado e finalizado sem formulário.</p>'}
    ${edit ? `<button class="btn btn-sm" style="align-self:flex-start" data-action="cb-add">+ Exigir ${esc(t('entity.form', { lower: true }))}</button>` : ''}
    ${stageForms.length ? `<p class="subtle" style="font-size:12px">Também valem para tod${ga('entity.service')}s ${esc(t('entity.service', { plural: true, lower: true }))} (${esc(t('entity.form', { plural: true, lower: true }))} d${ga('entity.work_order')} ${esc(t('entity.work_order', { lower: true }))}): ${stageForms.map(({ f, b }) => `${esc(f.name)} em "${esc(b.stage?.label || '')}"`).join(' · ')}</p>` : ''}</section>` : '';
  const used = d.id && store.isCatalogItemUsed(orgId, d.id);
  const body = `<div class="stack" style="gap:16px">
    ${!edit ? `<div class="alert info">${icon('info')}<p>Somente leitura para ${esc(t('role.' + role))}.</p></div>` : ''}
    ${inp('name', 'Nome', 'text', true)}
    <div class="field"><label for="cf-description">Descrição</label><textarea class="textarea" id="cf-description" data-cd="description" ${dis} style="min-height:60px">${esc(d.description || '')}</textarea></div>
    <div class="grid grid-2" style="gap:12px">
      <div class="field"><label for="cf-category_id">Categoria<span class="req">*</span></label><select class="select" id="cf-category_id" data-cd="category_id" ${dis}><option value="">—</option>${cats.map((c) => `<option value="${c.id}" ${d.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>${e.category_id ? `<span class="field-error">${esc(e.category_id)}</span>` : ''}</div>
      ${inp('base_price', 'Preço base (R$)', 'number', true, 'min="0" step="1"')}
    </div>
    ${isSvc ? `<div class="grid grid-2" style="gap:12px">${inp('avg_duration_min', 'Duração média (min)', 'number', true, 'min="1"')}${inp('recurrence_days', 'Recorrência (dias, opcional)', 'number', false, 'min="1"')}</div>
      <div class="grid grid-2" style="gap:12px"><div class="field"><label for="cf-loc">Local do atendimento</label><select class="select" id="cf-loc" data-cd="service_location" ${dis}>${Object.entries(LOC).map(([k, f]) => `<option value="${k}" ${d.service_location === k ? 'selected' : ''}>${esc(f())}</option>`).join('')}</select></div>
      <div class="field"><label for="cf-sub">${esc(t('entity.subflow'))}</label><select class="select" id="cf-sub" data-cd="subflow_workflow_id" ${dis}><option value="">Não passa por ${esc(t('entity.subflow', { lower: true }))}</option>${subs.map((w) => `<option value="${w.id}" ${d.subflow_workflow_id === w.id ? 'selected' : ''}>Passa por ${esc(w.name)}</option>`).join('')}</select></div></div>${evid}`
      : inp('sku', 'SKU')}
    ${m.error ? `<div class="alert danger" role="alert">${icon('alert')}<p>${esc(m.error)}</p></div>` : ''}
    ${d.id ? `<p class="subtle" style="font-size:12px" data-ann="audit-log">${used ? `Já usado em ${esc(t('entity.work_order', { plural: true, lower: true }))}: pode ser desativado, não excluído.` : `Nunca usado: pode ser excluído.`}</p>` : ''}
  </div>`;
  const foot = edit ? `${d.id ? `<button class="btn ${used ? '' : 'btn-danger-text'}" data-action="${used ? 'cat-toggle-active' : 'cat-delete'}" data-fk="cat-del">${used ? (d.active ? 'Desativar' : 'Reativar') : 'Excluir'}</button><span class="grow"></span>` : ''}<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="cat-save" data-fk="cat-save">Salvar</button>`
    : `<button class="btn" data-action="close-modal">Fechar</button>`;
  return drawer(d.id ? esc(d.name || '') : `Nov${ga(isSvc ? 'entity.service' : 'entity.product')} ${esc(t(isSvc ? 'entity.service' : 'entity.product', { lower: true }))}`, body, foot, { wide: isSvc });
}

export function categoriesDrawer(orgId, m) {
  const list = m.list;
  const body = `<div class="stack">${list.map((c, i) => { const near = c.color && /^#[0-9a-f]{6}$/i.test(c.color) ? store.colorNearStatus(c.color) : null; return `<div class="stack-sm"><div class="row"><input type="color" class="color-input" aria-label="Cor de ${esc(c.name)}" data-cat="${i}" data-k="color" value="${esc(c.color)}"><label class="sr-only" for="catn-${i}">Nome</label><input class="input grow" id="catn-${i}" data-cat="${i}" data-k="name" value="${esc(c.name)}"></div>
    ${near ? `<span class="field-error" style="color:var(--warn)" data-ann="category-color">${icon('alert', 'sm')} Cor parecida com o ${esc(near.name)} de status. No card, alguém pode ler como "${near.name === 'vermelho' ? 'atrasado' : near.name === 'âmbar' ? 'atenção' : near.name === 'verde' ? 'concluído' : 'em andamento'}". Prefira outro tom (rosa, ciano, índigo, cinza).</span>` : ''}</div>`; }).join('')}
    <button class="btn btn-sm" style="align-self:flex-start" data-action="cat-add-category">+ Nova categoria</button>
    <p class="subtle" style="font-size:12px">A cor da categoria aparece na borda do card. Cores de status (verde, âmbar, vermelho, azul) são fixas do sistema.</p></div>`;
  return drawer('Categorias', body, `<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="cat-save-categories">Salvar</button>`);
}
