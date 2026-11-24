// Cadastros › Formulários (C2): lista, construtor com versão, onde é usado e respostas.
import * as store from '../store.js';
import { t, tx, ga } from '../i18n.js';
import { icon } from '../components/icons.js';
import { esc, dateTime, date } from '../components/format.js';
import { renderFormFields, fieldTypeLabel } from '../components/fields.js';
import { renderAttachmentUrl } from '../components/photo.js';
import { can, toHash } from '../router.js';

const MOMENT = { on_enter: 'ao entrar em', on_start: 'ao iniciar o trabalho em', on_finish: 'ao concluir', service_start: 'para iniciar', service_finish: 'para finalizar' };
export function bindingText(b) {
  if (b.scope === 'service') return `${b.item?.name || '—'} · ${MOMENT[b.moment]}${b.required ? '' : ' (opcional)'}`;
  return `${MOMENT[b.moment]} "${b.stage?.label || '—'}" · tod${ga('entity.service')}s ${ga('entity.service')}s ${t('entity.service', { plural: true, lower: true })}${b.required ? '' : ' (opcional)'}`;
}

export function renderForms({ orgId, state }) {
  const edit = can(state.role, 'forms.edit');
  const forms = store.getForms(orgId);
  const head = `<div class="page-head"><div><h1>${tx('nav.forms')}</h1><p>Coringa: servem para o que você ligar. D${ga('entity.work_order')} ${esc(t('entity.work_order', { lower: true }))} (ex.: check-in) ou de ${ga('entity.service') === 'a' ? 'uma' : 'um'} ${esc(t('entity.service', { lower: true }))} (para iniciar e para dar como realizado).</p></div>
    ${edit ? `<a class="btn btn-primary" href="${toHash('formulario', 'novo')}" data-fk="form-new">+ Nov${ga('entity.form')} ${esc(t('entity.form', { lower: true }))}</a>` : ''}</div>`;
  if (!forms.length) return `${head}<div class="card"><div class="empty">${icon('file')}<strong>Nenhum ${esc(t('entity.form', { lower: true }))} ainda</strong><p>O preset traz modelos de check-in e de finalização para começar.</p></div></div>`;
  return `${head}<div class="card table-wrap" style="overflow:auto"><table class="table"><thead><tr><th>Nome</th><th>Onde é usado</th><th style="text-align:right">Campos</th><th style="text-align:right">Respostas (28 d)</th><th>Versão</th></tr></thead><tbody>
    ${forms.map((f) => { const bs = store.getFormBindings(orgId, f.id); return `<tr class="clickable" data-action="go" data-to="formulario" data-param="${f.id}" tabindex="0" data-fk="fl-${f.id}"><td><strong>${esc(f.name)}</strong><div class="subtle" style="font-size:12px">${esc(f.description || '')}</div></td>
      <td style="font-size:13px" data-ann="form-bindings">${bs.length ? `<span class="badge ${bs[0].scope === 'service' ? 'info' : ''}">${bs[0].scope === 'service' ? t('entity.service') : t('entity.work_order')}</span> ${esc(bindingText(bs[0]))}${bs.length > 1 ? ` <span class="subtle">+${bs.length - 1}</span>` : ''}` : '<span class="subtle">Não ligado a nada</span>'}</td>
      <td style="text-align:right">${store.getFormFields(orgId, f.id).length}</td><td style="text-align:right">${store.getFormResponsesCount(orgId, f.id)}</td><td>v${f.version || 1}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="table-cards">${forms.map((f) => `<a class="card card-pad stack-sm" href="${toHash('formulario', f.id)}" style="text-decoration:none"><strong>${esc(f.name)}</strong><span class="subtle" style="font-size:13px">${store.getFormFields(orgId, f.id).length} campos · ${store.getFormResponsesCount(orgId, f.id)} respostas em 28 dias</span></a>`).join('')}</div>`;
}

export function initBuilder(orgId, formId) {
  if (formId === 'novo') return { formId, tab: 'fields', draft: { id: null, name: '', description: '', fields: [{ key: '', type: 'photo', label: 'Foto do resultado', required: true, options: [] }] }, errors: [], view: 'table', rq: { days: 28, op: '' } };
  const f = store.getForm(orgId, formId);
  if (!f) return null;
  return { formId, tab: 'fields', draft: { id: f.id, name: f.name, description: f.description || '', fields: store.getFormFields(orgId, f.id).map((x) => ({ key: x.key, type: x.type, label: x.label, required: x.required, options: x.options || [] })) }, errors: [], view: 'table', rq: { days: 28, op: '' }, nb: { stageId: '', moment: 'on_start', required: true } };
}

export function renderFormDetail({ orgId, state }, formId) {
  const fb = state.fb;
  const back = `<a href="${toHash('formularios')}" class="muted" style="font-size:13px;text-decoration:none">${icon('arrowLeft', 'sm')} ${tx('nav.forms')}</a>`;
  if (!fb) return `${back}<div class="card" style="margin-top:12px"><div class="empty">${icon('alert')}<strong>${esc(t('entity.form'))} não encontrado nesta organização.</strong></div></div>`;
  const edit = can(state.role, 'forms.edit');
  const form = fb.draft.id ? store.getForm(orgId, fb.draft.id) : null;
  const isNew = !form;
  const tabs = isNew ? [['fields', 'Campos']] : [['fields', 'Campos'], ['where', 'Onde é usado'], ['responses', 'Respostas']];
  const head = `${back}<div class="page-head" style="margin-top:8px"><div><h1>${isNew ? `Nov${ga('entity.form')} ${esc(t('entity.form', { lower: true }))}` : esc(form.name)}</h1>${form ? `<p>Versão ${form.version || 1}${form.template_origin?.startsWith('preset') ? ' · veio do preset' : ''}</p>` : ''}</div>
    ${edit && fb.tab === 'fields' ? `<button class="btn btn-primary" data-action="fb-save" data-fk="fb-save">Salvar ${esc(t('entity.form', { lower: true }))}</button>` : ''}</div>
    <div class="tabs" role="tablist" style="margin-bottom:16px">${tabs.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${fb.tab === k}" data-action="fb-tab" data-tab="${k}">${l}</button>`).join('')}</div>`;
  if (fb.tab === 'where') return head + whereTab(orgId, fb, edit);
  if (fb.tab === 'responses') return head + responsesTab(orgId, fb);
  return head + builderTab(orgId, fb, edit, form);
}

function builderTab(orgId, fb, edit, form) {
  const d = fb.draft;
  const dis = edit ? '' : 'disabled';
  const hasResp = form && store.getFormResponses(orgId, form.id).some((r) => (r.form_version || 1) === (form.version || 1));
  const types = ['photo', 'text', 'yes_no', 'number', 'option', 'signature'];
  const rows = d.fields.map((f, i) => `<div class="bf-field" data-ann="form-fields">
    <div class="ord">${edit ? `<button class="btn btn-sm btn-ghost" data-action="fb-move" data-i="${i}" data-d="-1" aria-label="Subir campo ${i + 1}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn btn-sm btn-ghost" data-action="fb-move" data-i="${i}" data-d="1" aria-label="Descer campo ${i + 1}" ${i === d.fields.length - 1 ? 'disabled' : ''}>↓</button>` : ''}</div>
    <div class="body"><label class="sr-only" for="fbl-${i}">Rótulo do campo ${i + 1}</label><input class="input" id="fbl-${i}" placeholder="Pergunta ou rótulo" data-fbf="${i}" data-k="label" data-fk="fbl-${i}" value="${esc(f.label)}" ${dis}>
      <div class="row-wrap"><label class="sr-only" for="fbt-${i}">Tipo</label><select class="select" style="width:auto" id="fbt-${i}" data-fbf="${i}" data-k="type" ${dis}>${types.map((ty) => `<option value="${ty}" ${f.type === ty ? 'selected' : ''}>${fieldTypeLabel(ty)}</option>`).join('')}</select>
      <label class="row" style="font-size:13px"><input type="checkbox" data-fbf="${i}" data-k="required" ${f.required ? 'checked' : ''} ${dis}> Obrigatório</label></div>
      ${f.type === 'option' ? `<label class="sr-only" for="fbo-${i}">Opções</label><input class="input" id="fbo-${i}" placeholder="Opções separadas por vírgula" data-fbf="${i}" data-k="options" value="${esc((f.options || []).join(', '))}" ${dis}>` : ''}</div>
    <div>${edit ? `<button class="btn btn-sm btn-ghost" data-action="fb-remove" data-i="${i}" aria-label="Remover campo ${i + 1}">${icon('x', 'sm')}</button>` : ''}</div></div>`).join('');
  const preview = d.fields.map((f, i) => ({ key: `p${i}`, type: f.type, label: f.label || `Campo ${i + 1}`, required: f.required, options: f.type === 'option' ? (f.options || []).filter(Boolean) : null }));
  return `<div class="builder">
    <div class="stack">
      <div class="card card-pad stack">
        <div class="field"><label for="fb-name">Nome<span class="req">*</span></label><input class="input" id="fb-name" data-fbm="name" data-fk="fb-name" value="${esc(d.name)}" ${dis}></div>
        <div class="field"><label for="fb-desc">Para que serve</label><input class="input" id="fb-desc" data-fbm="description" placeholder="Aparece para quem preenche" value="${esc(d.description)}" ${dis}></div>
      </div>
      ${hasResp && edit ? `<div class="alert info">${icon('info')}<p>Este ${esc(t('entity.form', { lower: true }))} já tem respostas. Se você mudar os campos, nasce a versão ${(form.version || 1) + 1}; as respostas antigas continuam aparecendo com os campos da versão em que foram feitas.</p></div>` : ''}
      ${fb.errors.length ? `<div class="alert danger" role="alert">${icon('alert')}<div>${fb.errors.map((x) => `<p>${esc(x)}</p>`).join('')}</div></div>` : ''}
      <div class="stack-sm">${rows}</div>
      ${edit ? `<div class="row-wrap"><span class="subtle" style="font-size:13px">Adicionar:</span>${types.map((ty) => `<button class="btn btn-sm" data-action="fb-add" data-type="${ty}">+ ${fieldTypeLabel(ty)}</button>`).join('')}</div>
        <p class="subtle" style="font-size:12px">6 tipos de campo, sem lógica condicional (D9). Os mesmos tipos descrevem os campos d${ga('entity.asset')} ${esc(t('entity.asset', { lower: true }))} (D10).</p>` : ''}
    </div>
    <aside class="preview-pane"><div class="card card-pad stack"><div class="row"><strong class="grow">Prévia no app</strong><span class="badge">${icon('phone', 'sm')} como ${esc(t('role.operator', { lower: true }))} vê</span></div>
      <div inert style="pointer-events:none">${preview.length ? renderFormFields(preview, { answers: {}, camera: null }, { idPrefix: 'pv' }) : '<p class="muted">Adicione campos.</p>'}</div></div></aside>
  </div>`;
}

function whereTab(orgId, fb, edit) {
  const bs = store.getFormBindings(orgId, fb.draft.id);
  const main = store.getMainWorkflow(orgId);
  const stages = [...store.getStages(orgId, main.id), ...store.getWorkflows(orgId).filter((w) => w.kind === 'sub').flatMap((w) => store.getStages(orgId, w.id))];
  const svc = bs.filter((b) => b.scope === 'service'), stg = bs.filter((b) => b.scope !== 'service');
  return `<div class="grid grid-2" data-ann="form-bindings">
    <section class="card card-pad stack"><h3 style="font-size:15px">D${ga('entity.work_order')} ${esc(t('entity.work_order', { lower: true }))} (por ${esc(t('entity.stage', { lower: true }))})</h3>
      ${stg.length ? stg.map((b) => `<div class="row"><span class="grow">${esc(bindingText(b))}</span>${edit ? `<button class="btn btn-sm btn-ghost" data-action="fb-unbind" data-id="${b.id}" aria-label="Remover vínculo">${icon('x', 'sm')}</button>` : ''}</div>`).join('') : '<p class="muted">Não está ligado a nenhuma etapa.</p>'}
      ${edit ? `<div class="stack-sm" style="border-top:1px solid var(--border);padding-top:12px"><span class="field-label">Ligar a uma ${esc(t('entity.stage', { lower: true }))}</span>
        <div class="row-wrap"><label class="sr-only" for="nb-stage">Etapa</label><select class="select" style="width:auto" id="nb-stage" data-nb="stageId"><option value="">${esc(t('entity.stage'))}…</option>${stages.map((s) => `<option value="${s.id}" ${fb.nb?.stageId === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
        <label class="sr-only" for="nb-moment">Momento</label><select class="select" style="width:auto" id="nb-moment" data-nb="moment">${['on_enter', 'on_start', 'on_finish'].map((k) => `<option value="${k}" ${fb.nb?.moment === k ? 'selected' : ''}>${MOMENT[k]}</option>`).join('')}</select>
        <label class="row" style="font-size:13px"><input type="checkbox" data-nb="required" ${fb.nb?.required ? 'checked' : ''}> Obrigatório</label><button class="btn btn-sm" data-action="fb-bind">Ligar</button></div></div>` : ''}</section>
    <section class="card card-pad stack"><h3 style="font-size:15px">D${ga('entity.service')}s ${esc(t('entity.service', { plural: true, lower: true }))}</h3>
      ${svc.length ? svc.map((b) => `<div class="row"><span class="grow">${esc(bindingText(b))}</span><button class="btn btn-sm btn-ghost" data-action="cat-open-from-form" data-id="${b.catalog_item_id}">Abrir ${esc(t('entity.service', { lower: true }))}</button></div>`).join('') : '<p class="muted">Nenhum serviço exige este formulário.</p>'}
      <p class="subtle" style="font-size:12px">Para exigir em um ${esc(t('entity.service', { lower: true }))}, abra-o em ${esc(tx('nav.catalog'))} › Evidências exigidas.</p></section></div>`;
}

function responsesTab(orgId, fb) {
  const rq = fb.rq;
  const lim = rq.days ? +store.now() - rq.days * 86400e3 : 0;
  const list = store.getFormResponses(orgId, fb.draft.id).filter((r) => new Date(r.created_at) >= lim && (!rq.op || r.submitted_by === rq.op));
  const ops = store.getExecutors(orgId);
  const filters = `<div class="filters"><label class="sr-only" for="rq-days">Período</label><select class="select" id="rq-days" data-rq="days">${[[7, '7 dias'], [28, '28 dias'], [90, '90 dias'], [0, 'Todo o período']].map(([v, l]) => `<option value="${v}" ${Number(rq.days) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <label class="sr-only" for="rq-op">Quem respondeu</label><select class="select" id="rq-op" data-rq="op"><option value="">Qualquer pessoa</option>${ops.map((m) => `<option value="${m.user_id}" ${rq.op === m.user_id ? 'selected' : ''}>${esc(m.profile.name)}</option>`).join('')}</select>
    <div class="row" role="group" aria-label="Visualização"><button class="chip" aria-pressed="${fb.view === 'table'}" data-action="fb-view" data-v="table">Tabela</button><button class="chip" aria-pressed="${fb.view === 'gallery'}" data-action="fb-view" data-v="gallery">${icon('camera', 'sm')} Galeria</button></div>
    ${store.getFormBindings(orgId, fb.draft.id).some((b) => b.scope === 'service') ? `<button class="btn btn-sm" data-action="drill" data-form="${fb.draft.id}" data-status="all" data-origin="respostas de ${esc(store.getForm(orgId, fb.draft.id).name)}">Ver em ${esc(tx('nav.services_done'))}</button>` : ''}</div>
    <p class="muted" role="status" style="margin-bottom:12px">${list.length} resposta${list.length === 1 ? '' : 's'}</p>`;
  if (!list.length) return filters + `<div class="card"><div class="empty">${icon('file')}<strong>Nenhuma resposta neste período</strong></div></div>`;
  if (fb.view === 'gallery') {
    const pics = list.flatMap((r) => Object.values(r.answers).map((id) => store.getAttachment(orgId, id)).filter((a) => a && a.type === 'photo').map((a) => ({ a, r })));
    return filters + `<div class="photos" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${pics.map(({ a, r }) => { const wo = store.getWorkOrder(orgId, r.work_order_id); return `<button class="photo" style="padding:0;text-align:left" data-action="open-wo" data-id="${wo.id}" data-tab="forms">${renderAttachmentUrl(a.url)}<figcaption>#${wo.number} · ${date(r.created_at)} · ${esc(store.getProfile(r.submitted_by)?.name.split(' ')[0] || '')}</figcaption></button>`; }).join('')}</div>`;
  }
  return filters + `<div class="card table-wrap" style="overflow:auto"><table class="table"><thead><tr><th>Data</th><th>${esc(t('entity.work_order'))}</th><th>${esc(t('entity.customer'))} · ${esc(t('entity.asset'))}</th><th>Quem</th><th>${esc(t('entity.service'))} / ${esc(t('entity.stage'))}</th><th>Fotos</th><th>Versão</th></tr></thead><tbody>
    ${list.map((r) => { const wo = store.getWorkOrder(orgId, r.work_order_id); const c = store.getCustomer(orgId, wo.customer_id); const a = store.getAsset(orgId, wo.asset_id); const it = r.work_order_item_id ? store.getItem(orgId, r.work_order_item_id) : null; const photos = Object.values(r.answers).filter((id) => store.getAttachment(orgId, id)?.type === 'photo').length;
      return `<tr class="clickable" data-action="${it ? 'open-svc' : 'open-wo'}" ${it ? `data-item="${it.id}"` : `data-id="${wo.id}" data-tab="forms"`}><td class="nowrap">${dateTime(r.created_at)}</td><td class="mono">#${wo.number}</td><td>${esc(c.name)}<div class="subtle" style="font-size:12px">${esc(a.attributes.model)} ${esc(a.attributes.plate)}</div></td><td>${esc(store.getProfile(r.submitted_by)?.name || '—')}</td><td>${it ? esc(store.getCatalogItem(orgId, it.catalog_item_id).name) : esc(store.getStage(orgId, r.stage_id)?.label || '—')}</td><td>${photos ? `${icon('camera', 'sm')} ${photos}` : '—'}</td><td>v${r.form_version || 1}</td></tr>`; }).join('')}</tbody></table></div>`;
}
