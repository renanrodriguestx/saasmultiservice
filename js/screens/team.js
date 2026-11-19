// Cadastros › Equipe (C3). Só owner. Convite, papel, desativar com reatribuição.
import * as store from '../store.js';
import { t, tx, ga } from '../i18n.js';
import { icon } from '../components/icons.js';
import { esc, duration, dateTime } from '../components/format.js';
import { avatar, drawer } from '../components/wo.js';

const ROLES = ['owner', 'manager', 'admin', 'operator'];
const STATUS = { active: ['ok', 'Ativo'], invited: ['warn', 'Convite pendente'], inactive: ['', 'Desativado'] };

export function renderTeam({ orgId, state }) {
  const all = store.getAllMembers(orgId).sort((a, b) => ROLES.indexOf(a.role_key) - ROLES.indexOf(b.role_key) || a.profile.name.localeCompare(b.profile.name));
  const head = `<div class="page-head"><div><h1>${tx('nav.team')}</h1><p>Quem trabalha na organização, com qual papel. Produtividade individual só aparece para ${esc(t('role.owner', { lower: true }))} e ${esc(t('role.manager', { lower: true }))}.</p></div>
    <button class="btn btn-primary" data-action="team-invite" data-fk="team-invite">+ Convidar</button></div>`;
  if (!all.length) return `${head}<div class="card"><div class="empty">${icon('users')}<strong>Só você por aqui</strong><p>Convide a equipe: cada pessoa recebe um link no celular ou e-mail.</p></div></div>`;
  return `${head}<div class="card table-wrap" style="overflow:auto"><table class="table" data-ann="team"><thead><tr><th>Nome</th><th>Papel</th><th>Status</th><th style="text-align:right">${esc(t('entity.service', { plural: true }))} em aberto</th><th style="text-align:right">Realizados (28 d)</th><th style="text-align:right">Tempo médio</th><th></th></tr></thead><tbody>
    ${all.map((m) => { const st = store.getMemberStats(orgId, m.user_id); const [c, l] = STATUS[m.status] || STATUS.active; return `<tr>
      <td><button class="btn btn-ghost" style="padding:0 4px" data-action="team-open" data-id="${m.id}">${avatar(m.profile)} ${esc(m.profile.name)}</button>${m.user_id === state.meId ? ' <span class="subtle">(você)</span>' : ''}</td>
      <td><label class="sr-only" for="role-${m.id}">Papel de ${esc(m.profile.name)}</label><select class="select" style="width:auto" id="role-${m.id}" data-change="team-role" data-id="${m.id}" ${m.status === 'inactive' ? 'disabled' : ''}>${ROLES.map((r) => `<option value="${r}" ${m.role_key === r ? 'selected' : ''}>${esc(t('role.' + r))}</option>`).join('')}</select></td>
      <td><span class="badge ${c}">${l}</span></td><td style="text-align:right">${st.open}</td><td style="text-align:right">${st.done}</td><td style="text-align:right">${st.avgMin != null ? duration(st.avgMin) : '—'}</td>
      <td class="nowrap">${m.status === 'invited' ? `<button class="btn btn-sm" data-action="team-accept" data-id="${m.id}">Simular aceite</button>` : m.status === 'active' ? `<button class="btn btn-sm btn-ghost" data-action="team-deactivate" data-id="${m.id}">Desativar</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="table-cards">${all.map((m) => `<button class="pick" data-action="team-open" data-id="${m.id}">${avatar(m.profile)}<span class="grow"><strong>${esc(m.profile.name)}</strong><br><span class="subtle" style="font-size:12px">${esc(t('role.' + m.role_key))} · ${(STATUS[m.status] || STATUS.active)[1]}</span></span>${icon('chevronRight', 'sm')}</button>`).join('')}</div>`;
}

export function inviteDrawer(orgId, m) {
  const d = m.d, e = m.errors || {};
  const body = `<div class="stack">
    <div class="field"><label for="iv-name">Nome<span class="req">*</span></label><input class="input" id="iv-name" data-iv="name" data-fk="iv-name" value="${esc(d.name)}" ${e.name ? 'aria-invalid="true"' : ''}>${e.name ? `<span class="field-error">${esc(e.name)}</span>` : ''}</div>
    <div class="field"><label for="iv-contact">Celular ou e-mail<span class="req">*</span></label><input class="input" id="iv-contact" data-iv="contact" value="${esc(d.contact)}" ${e.contact ? 'aria-invalid="true"' : ''}>${e.contact ? `<span class="field-error">${esc(e.contact)}</span>` : '<span class="hint">O convite chega por aqui.</span>'}</div>
    <div class="field"><label for="iv-role">Papel</label><select class="select" id="iv-role" data-iv="role">${ROLES.map((r) => `<option value="${r}" ${d.role === r ? 'selected' : ''}>${esc(t('role.' + r))}</option>`).join('')}</select><span class="hint">${esc(t('role.operator'))} entra direto no app de campo.</span></div></div>`;
  return drawer('Convidar para a equipe', body, `<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="team-invite-send" data-fk="iv-send">Enviar convite</button>`);
}

export function memberDrawer(orgId, m) {
  const mem = store.getAllMembers(orgId).find((x) => x.id === m.memberId);
  const st = store.getMemberStats(orgId, mem.user_id);
  const open = store.getOpenWorkFor(orgId, mem.user_id);
  const body = `<div class="stack">
    <div class="row">${avatar(mem.profile, 'lg')}<div><strong>${esc(mem.profile.name)}</strong><div class="subtle" style="font-size:13px">${esc(t('role.' + mem.role_key))} · ${(STATUS[mem.status] || STATUS.active)[1]}${mem.invited_at ? ` · convidado em ${dateTime(mem.invited_at)}` : ''}</div></div></div>
    <div class="grid grid-3" style="gap:8px" data-ann="productivity"><div class="response-block"><div class="subtle" style="font-size:12px">Realizados (28 d)</div><div class="kpi-value" style="font-size:22px">${st.done}</div></div><div class="response-block"><div class="subtle" style="font-size:12px">Em aberto</div><div class="kpi-value" style="font-size:22px">${st.open}</div></div><div class="response-block"><div class="subtle" style="font-size:12px">Tempo médio</div><div class="kpi-value" style="font-size:22px">${st.avgMin != null ? duration(st.avgMin) : '—'}</div></div></div>
    <button class="btn" style="align-self:flex-start" data-action="drill" data-op="${mem.user_id}" data-status="all" data-days="28" data-origin="${esc(mem.profile.name)} · últimos 28 dias">Ver ${esc(tx('nav.services_done').toLowerCase())}</button>
    ${open.items.length || open.wos.length ? `<section class="stack-sm"><h3 style="font-size:15px">Em aberto agora</h3>${open.items.map((i) => { const w = store.getWorkOrder(orgId, i.work_order_id); return `<div class="row"><span class="grow">${esc(store.getCatalogItem(orgId, i.catalog_item_id).name)} · #${w.number}</span><button class="btn btn-sm btn-ghost" data-action="open-wo" data-id="${w.id}">Abrir</button></div>`; }).join('')}${open.wos.map((v) => `<div class="row"><span class="grow">Responsável por #${v.wo.number} (${esc(v.stage.label)})</span><button class="btn btn-sm btn-ghost" data-action="open-wo" data-id="${v.wo.id}">Abrir</button></div>`).join('')}</section>` : ''}</div>`;
  return drawer(esc(mem.profile.name), body, `<button class="btn" data-action="close-modal">Fechar</button>`);
}

export function reassignDrawer(orgId, m) {
  const mem = store.getAllMembers(orgId).find((x) => x.id === m.memberId);
  const open = store.getOpenWorkFor(orgId, mem.user_id);
  const targets = store.getMembers(orgId).filter((x) => x.user_id !== mem.user_id && (x.role_key === 'operator' || x.role_key === 'manager'));
  const body = `<div class="stack"><div class="alert warn" role="alert">${icon('alert')}<p>${esc(m.message)}</p></div>
    <ul style="margin:0;padding-left:18px;font-size:14px">${open.items.map((i) => `<li>${esc(store.getCatalogItem(orgId, i.catalog_item_id).name)} · #${store.getWorkOrder(orgId, i.work_order_id).number}</li>`).join('')}${open.wos.map((v) => `<li>Responsável por #${v.wo.number}</li>`).join('')}</ul>
    <div class="field"><label for="ra-to">Passar tudo para</label><select class="select" id="ra-to" data-ra="to"><option value="">Escolha…</option>${targets.map((x) => `<option value="${x.user_id}" ${m.to === x.user_id ? 'selected' : ''}>${esc(x.profile.name)} · ${esc(t('role.' + x.role_key))}</option>`).join('')}</select>${m.error ? `<span class="field-error">${esc(m.error)}</span>` : ''}</div>
    <p class="subtle" style="font-size:12px">Cada troca fica no histórico do ${esc(t('entity.service', { lower: true }))} e d${ga('entity.work_order')} ${esc(t('entity.work_order', { lower: true }))}.</p></div>`;
  return drawer(`Reatribuir e desativar ${esc(mem.profile.name.split(' ')[0])}`, body, `<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="team-reassign" data-fk="ra-ok">Reatribuir e desativar</button>`);
}
