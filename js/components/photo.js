// Placeholders SVG de carro (fotos simuladas) e assinaturas.
// url: "placeholder:car:<angle>:<phase>:<cor>" | "placeholder:signature:<n>" | dataURL (assinatura desenhada)
import { esc } from './format.js';

const PAINT = { Preto: '#27272a', Branco: '#f4f4f5', Prata: '#c4c4c8', Cinza: '#71717a', Vermelho: '#b91c1c', Azul: '#1e40af', Verde: '#166534' };
const ANGLE_LABEL = { front: 'Frente', rear: 'Traseira', left: 'Lateral esquerda', right: 'Lateral direita', masked: 'Mascarado', detail: 'Detalhe' };
const PHASE_LABEL = { before: 'antes', during: 'durante', after: 'depois' };
export const CAMERA_OPTIONS = ['front', 'rear', 'left', 'right', 'masked', 'detail'];
export function angleLabel(a) { return ANGLE_LABEL[a] || a; }
export function phaseLabel(p) { return PHASE_LABEL[p] || p; }

export function carSvg(angle = 'left', phase = 'before', color = 'Prata') {
  const paint = PAINT[color] || PAINT.Prata;
  const bg = phase === 'after' ? '#eef6ff' : phase === 'during' ? '#f5f5f4' : '#f4f1ea';
  let body;
  if (angle === 'front' || angle === 'rear') {
    body = `<rect x="38" y="38" width="84" height="40" rx="10" fill="${paint}" stroke="#18181b" stroke-width="1.5"/>
      <path d="M50 38 L58 20 H102 L110 38 Z" fill="${paint}" stroke="#18181b" stroke-width="1.5"/>
      <path d="M60 36 L65 24 H95 L100 36 Z" fill="#bfdbfe" opacity=".85"/>
      <rect x="44" y="50" width="18" height="8" rx="3" fill="${angle === 'front' ? '#fef9c3' : '#ef4444'}" stroke="#18181b"/>
      <rect x="98" y="50" width="18" height="8" rx="3" fill="${angle === 'front' ? '#fef9c3' : '#ef4444'}" stroke="#18181b"/>
      <rect x="66" y="62" width="28" height="9" rx="2" fill="#fff" stroke="#18181b"/>
      <rect x="40" y="78" width="14" height="10" rx="2" fill="#18181b"/><rect x="106" y="78" width="14" height="10" rx="2" fill="#18181b"/>`;
  } else if (angle === 'detail') {
    body = `<circle cx="80" cy="52" r="30" fill="#3f3f46" stroke="#18181b" stroke-width="2"/><circle cx="80" cy="52" r="18" fill="#a1a1aa"/>
      ${[0, 72, 144, 216, 288].map((r) => `<rect x="77" y="26" width="6" height="18" rx="2" fill="#d4d4d8" transform="rotate(${r} 80 52)"/>`).join('')}<circle cx="80" cy="52" r="5" fill="#27272a"/>`;
  } else {
    const flip = angle === 'right' ? 'transform="translate(160 0) scale(-1 1)"' : '';
    body = `<g ${flip}><path d="M18 66 L22 50 Q26 44 36 43 L56 42 L70 28 Q74 25 82 25 L108 25 Q116 25 121 31 L132 43 L142 46 Q148 48 148 56 L148 66 Z" fill="${paint}" stroke="#18181b" stroke-width="1.5"/>
      <path d="M62 42 L73 31 L93 31 L93 42 Z M98 42 L98 31 L113 31 Q117 31 120 35 L126 42 Z" fill="#bfdbfe" opacity=".85"/>
      <circle cx="46" cy="68" r="11" fill="#18181b"/><circle cx="46" cy="68" r="5" fill="#a1a1aa"/>
      <circle cx="122" cy="68" r="11" fill="#18181b"/><circle cx="122" cy="68" r="5" fill="#a1a1aa"/>
      ${angle === 'masked' ? '<rect x="58" y="44" width="70" height="4" fill="#facc15" opacity=".9"/><rect x="20" y="54" width="10" height="5" fill="#facc15"/><rect x="138" y="50" width="9" height="5" fill="#facc15"/>' : ''}</g>`;
  }
  const dirt = phase === 'before' ? [[40, 70], [60, 74], [110, 72], [128, 64], [90, 76], [30, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${3 + (x % 3)}" fill="#92400e" opacity=".35"/>`).join('') : '';
  const shine = phase === 'after' ? '<path d="M118 16 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#fff" stroke="#93c5fd"/><path d="M34 26 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" fill="#fff" stroke="#93c5fd"/>' : '';
  return `<svg class="car" viewBox="0 0 160 100" role="img" aria-label="Foto simulada: ${esc(angleLabel(angle))}, ${esc(phaseLabel(phase))}"><rect width="160" height="100" fill="${bg}"/><rect y="84" width="160" height="16" fill="#e7e5e4"/>${body}${dirt}${shine}</svg>`;
}

const SIGS = [
  'M10 40 C 30 10, 40 60, 60 30 S 90 20, 100 40 S 130 50, 150 25',
  'M12 35 Q 25 5 38 38 T 64 30 Q 80 50 96 22 T 140 36',
  'M8 42 C 20 20, 34 20, 40 40 C 46 58, 70 10, 86 34 S 120 44, 150 30',
  'M14 30 L 30 44 Q 52 8 70 40 Q 88 60 104 24 Q 118 6 148 40',
];
export function signatureSvg(n = 1) {
  return `<svg viewBox="0 0 160 60" class="sig-img" role="img" aria-label="Assinatura do cliente (simulada)"><path d="${SIGS[(n - 1) % SIGS.length]}" fill="none" stroke="#1e3a8a" stroke-width="2" stroke-linecap="round"/><path d="M10 52 H150" stroke="#d4d4d8"/></svg>`;
}

/** Renderiza qualquer url de anexo. */
export function renderAttachmentUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:')) return `<img src="${esc(url)}" alt="Assinatura desenhada" class="sig-img">`;
  const [, kind, a, b, c] = url.split(':');
  if (kind === 'car') return carSvg(a, b, c);
  if (kind === 'signature') return signatureSvg(Number(a));
  return '';
}
export function parseCarUrl(url) { const [, , angle, phase, color] = String(url).split(':'); return { angle, phase, color }; }
