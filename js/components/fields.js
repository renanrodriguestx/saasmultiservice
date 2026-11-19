// Motor único de campos (D9 + D10): o mesmo renderizador serve formulários de OS
// e os campos do tipo de ativo (veículo). Tipos: photo, text, yes_no, number, option, signature.
import { esc } from './format.js';
import { icon } from './icons.js';
import { carSvg, renderAttachmentUrl, CAMERA_OPTIONS, angleLabel } from './photo.js';

const TYPE_LABEL = { photo: 'Foto', text: 'Texto', yes_no: 'Sim/não', number: 'Número', option: 'Opção', signature: 'Assinatura' };
export const fieldTypeLabel = (t) => TYPE_LABEL[t] || t;

/** Formulário editável. draft.answers: valores; draft.camera: fieldKey com a câmera aberta. */
export function renderFormFields(fields, draft, { errors = [], vehicleColor = 'Prata', phase = 'before', idPrefix = 'f' } = {}) {
  return `<div class="form-grid" data-ann="form-fields">${fields.map((f) => {
    const v = draft.answers[f.key];
    const err = errors.includes(f.key);
    const id = `${idPrefix}-${f.key}`;
    const label = `<span class="field-label" id="${id}-l">${esc(f.label)}${f.required ? '<span class="req" aria-hidden="true">*</span><span class="sr-only"> (obrigatório)</span>' : ' <span class="subtle">(opcional)</span>'}</span>`;
    const errMsg = err ? `<span class="hint" style="color:var(--danger)">${icon('alert', 'sm')} Este campo é obrigatório.</span>` : '';
    let control = '';
    if (f.type === 'photo') {
      control = `<button type="button" class="photo-btn ${v ? 'filled' : ''}" data-action="camera-open" data-field="${f.key}" aria-labelledby="${id}-l" style="${err ? 'border-color:var(--danger)' : ''}">
        ${v ? renderAttachmentUrl(v.url) : `${icon('camera', 'lg')}<span>Tirar foto</span>`}</button>
        ${v ? `<button type="button" class="btn btn-sm btn-ghost" data-action="camera-open" data-field="${f.key}">Trocar foto</button>` : ''}
        ${draft.camera === f.key ? cameraPanel(f, vehicleColor, phase) : ''}`;
    } else if (f.type === 'text') {
      control = f.key === 'notes' || f.key === 'damages'
        ? `<textarea class="textarea" id="${id}" data-draft="${f.key}" aria-labelledby="${id}-l" ${err ? 'aria-invalid="true"' : ''}>${esc(v ?? '')}</textarea>`
        : `<input class="input" id="${id}" data-draft="${f.key}" value="${esc(v ?? '')}" aria-labelledby="${id}-l" ${err ? 'aria-invalid="true"' : ''}>`;
    } else if (f.type === 'number') {
      control = `<input class="input" type="number" inputmode="decimal" id="${id}" data-draft="${f.key}" value="${esc(v ?? '')}" aria-labelledby="${id}-l">`;
    } else if (f.type === 'option') {
      control = `<div class="seg" role="radiogroup" aria-labelledby="${id}-l">${(f.options || []).map((o) => `<button type="button" role="radio" aria-checked="${v === o}" aria-pressed="${v === o}" data-action="field-set" data-field="${f.key}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    } else if (f.type === 'yes_no') {
      control = `<div class="seg" role="radiogroup" aria-labelledby="${id}-l">${[['true', 'Sim'], ['false', 'Não']].map(([val, lab]) => `<button type="button" role="radio" aria-checked="${String(v) === val}" aria-pressed="${String(v) === val}" data-action="field-set" data-field="${f.key}" data-value="${val}" data-bool="1">${lab}</button>`).join('')}</div>`;
    } else if (f.type === 'signature') {
      control = `<canvas class="sig-pad" data-sig="${f.key}" aria-labelledby="${id}-l" role="img" aria-label="Área para assinatura" style="${err ? 'border-color:var(--danger)' : ''}"></canvas>
        <div class="row"><button type="button" class="btn btn-sm" data-action="sig-simulate" data-field="${f.key}">${icon('pen', 'sm')} Simular assinatura</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="sig-clear" data-field="${f.key}">Limpar</button></div>`;
    }
    return `<div class="field ${f.type === 'photo' ? 'photo-field' : ''} ${draft.camera === f.key ? 'cam-open' : ''}">${label}${control}${errMsg}</div>`;
  }).join('')}</div>`;
}

function cameraPanel(f, color, phase) {
  return `<div class="card card-pad stack" data-ann="camera" role="dialog" aria-label="Câmera simulada">
    <div class="row"><strong class="grow">Câmera (simulada)</strong><button type="button" class="btn btn-sm btn-ghost" data-action="camera-close">Cancelar</button></div>
    <p class="muted" style="font-size:13px">Escolha uma foto de exemplo. No app real a câmera abre aqui e a foto é comprimida no aparelho (D13).</p>
    <div class="cam-grid">${CAMERA_OPTIONS.map((a) => `<button type="button" data-action="photo-choose" data-field="${f.key}" data-url="placeholder:car:${a}:${phase}:${esc(color)}">${carSvg(a, phase, color)}<span>${esc(angleLabel(a))}</span></button>`).join('')}</div>
  </div>`;
}

/** Leitura (ficha / modal): mesmos campos, só exibição. */
export function renderFieldValues(fields, values, { attachment } = {}) {
  return `<dl class="kv">${fields.map((f) => {
    let v = values[f.key];
    let out;
    if (f.type === 'photo' || f.type === 'signature') {
      const att = v && attachment ? attachment(v) : null;
      out = att ? `<div style="max-width:200px">${renderAttachmentUrl(att.url)}</div>` : '<span class="subtle">—</span>';
    } else if (f.type === 'yes_no') out = v === true ? '<span class="badge ok">Sim</span>' : v === false ? '<span class="badge warn">Não</span>' : '<span class="subtle">—</span>';
    else out = v === undefined || v === null || v === '' ? '<span class="subtle">—</span>' : esc(v);
    return `<dt>${esc(f.label)}</dt><dd>${out}</dd>`;
  }).join('')}</dl>`;
}

/** Desenho de assinatura nos canvas renderizados. */
export function hydrateSignatures(root, draft, onChange) {
  root.querySelectorAll('canvas[data-sig]').forEach((cv) => {
    const key = cv.dataset.sig;
    const ratio = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * ratio; cv.height = h * ratio;
    const ctx = cv.getContext('2d');
    ctx.scale(ratio, ratio); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e3a8a';
    const val = draft.answers[key];
    if (val?.url) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, w, h); img.src = val.url.startsWith('data:') ? val.url : svgToData(renderAttachmentUrl(val.url)); }
    let drawing = false;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => { drawing = true; cv.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
    cv.addEventListener('pointermove', (e) => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); });
    cv.addEventListener('pointerup', () => { if (!drawing) return; drawing = false; onChange(key, { url: cv.toDataURL('image/png') }); });
  });
}
function svgToData(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); }
