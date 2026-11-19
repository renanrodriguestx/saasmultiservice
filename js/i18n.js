// t(): rótulos de papel e entidade vêm SEMPRE da terminologia da organização (org-config.js).
// tx(): textos de interface do sistema (pt-BR) que podem citar a terminologia por template.
//
// Sintaxe de template em UI:
//   {entity.work_order}       singular              → "Atendimento"
//   {entity.work_order|p}     plural                → "Atendimentos"
//   {entity.work_order|l}     singular minúsculo    → "atendimento"
//   {entity.work_order|pl}    plural minúsculo      → "atendimentos"
//   {entity.work_order?Nenhum:Nenhuma}  concordância de gênero (m:f)
//   {$nome}                   parâmetro

import { orgConfigs, DEFAULT_ORG_ID } from '../config/org-config.js';

let currentOrgId = DEFAULT_ORG_ID;
export function setI18nOrg(orgId) { currentOrgId = orgId; }
export function getOrgConfig(orgId = currentOrgId) { return orgConfigs[orgId]; }

function term(key) {
  const cfg = orgConfigs[currentOrgId];
  const v = cfg && cfg.terminology[key];
  if (!v) { console.warn('[i18n] chave de terminologia ausente:', key); return { singular: key, plural: key, gender: 'm' }; }
  return v;
}

/** t('role.operator') · t('entity.work_order', {plural:true}) · t('entity.customer', {count: 3}) · {lower:true} */
export function t(key, opts = {}) {
  const v = term(key);
  const plural = opts.plural || (typeof opts.count === 'number' && opts.count !== 1);
  let s = plural ? v.plural : v.singular;
  if (opts.lower) s = s.charAt(0).toLowerCase() + s.slice(1);
  return s;
}
export function gender(key) { return term(key).gender; }
/** 'o' | 'a' para concordância simples ("novo/nova", "do/da"). */
export const ga = (key) => (term(key).gender === 'f' ? 'a' : 'o');
/** Artigo definido: o/a/os/as */
export function art(key, plural = false) { const g = gender(key); return (g === 'f' ? 'a' : 'o') + (plural ? 's' : ''); }

// Textos de sistema (pt-BR). Nenhum rótulo de entidade/papel escrito aqui: só via template.
const UI = {
  'nav.dashboard': 'Painel',
  'nav.kanban': '{entity.work_order|p}',
  'nav.customers': '{entity.customer|p}',
  'nav.my_day': 'Meu dia',
  'nav.cockpit': 'Cockpit',
  'nav.section.operation': 'Operação',
  'nav.section.management': 'Gestão',
  'nav.section.registry': 'Cadastros',
  'nav.services_done': '{entity.service|p} realizad{entity.service?o:a}s',
  'nav.catalog': '{entity.service|p} e {entity.product|pl}',
  'nav.forms': '{entity.form|p}',
  'nav.team': 'Equipe',
  'nav.more': 'Mais',
  'wo.new': 'Nov{entity.work_order?o:a} {entity.work_order|l}',
  'wo.services': '{entity.service|p}',
  'svc.status.todo': 'A fazer',
  'svc.status.started': 'Em andamento',
  'svc.status.done': 'Realizado',
  'svc.status.not_done': 'Não realizado',
  'op.receive': 'Receber veículo',
  'shell.role': 'Ver como',
  'shell.annotate': 'Modo anotação',
  'shell.annotate_on': 'Modo anotação ligado: clique em um elemento com contorno para ver de onde vem o dado.',
  'shell.sim_date': 'Data simulada',
  'shell.tenant': 'Organização',
  'shell.as_operator': '{role.operator}',
  'kanban.title': '{entity.work_order|p}',
  'kanban.subtitle': 'Onde cada {entity.asset|l} está e o que falta para avançar. Arraste o card ou abra-o para mover.',
  'kanban.filter.operator': 'Todos os {role.operator|pl}',
  'kanban.filter.category': 'Todas as categorias',
  'kanban.filter.late': 'Só atrasad{entity.work_order?o:a}s',
  'kanban.filter.clear': 'Limpar filtros',
  'kanban.empty_column': 'Nenhum{entity.work_order?:a} {entity.work_order|l} nesta {entity.stage|l}',
  'kanban.empty_filtered': 'Nenhum{entity.work_order?:a} {entity.work_order|l} com estes filtros',
  'kanban.open_subflow': 'Abrir quadro',
  'kanban.canceled_hidden': '{$n} cancelad{entity.work_order?o:a}(s) fora do quadro',
  'kanban.skips': 'Só para {entity.work_order|pl} com item que usa o {entity.subflow|l}',
  'card.in_subflow': 'Em {$flow}: {$stage}',
  'card.late': 'Atrasad{entity.work_order?o:a}',
  'card.due_soon': 'Vence em {$h}',
  'card.no_operator': 'Sem {role.operator|l}',
  'move.title': 'Mover {entity.stage|l}',
  'move.current': '{entity.stage} atual',
  'move.confirm': 'Mover para esta {entity.stage|l}',
  'move.fill_now': 'Preencher "{$form}" agora',
  'move.blocked_title': 'Não dá para mover ainda',
  'move.done': '{entity.work_order} #{$num} movid{entity.work_order?o:a} para {$stage}.',
  'move.subflow_entered': 'Entrou no {entity.subflow|l} {$flow}, {entity.stage|l} {$stage}.',
  'move.subflow_returned': '{entity.subflow} {$flow} concluído. Voltou para {$stage}.',
  'wo.tab.data': 'Dados',
  'wo.tab.items': 'Itens',
  'wo.tab.forms': '{entity.form|p}',
  'wo.tab.history': 'Histórico',
  'wo.responsible': 'Responsável',
  'wo.assignees': '{role.operator|p}',
  'wo.scheduled': 'Agendado para',
  'wo.due': 'Prazo de entrega',
  'wo.current_stage': '{entity.stage} atual',
  'wo.no_forms': 'Nenhum {entity.form|l} respondido ainda.',
  'wo.pending_forms': '{entity.form|p} esperados',
  'wo.total': 'Total',
  'wo.payments': '{entity.payment|p} registrados',
  'wo.no_payments': 'Nenhum {entity.payment|l} registrado.',
  'customers.title': '{entity.customer|p}',
  'customers.search': 'Buscar por nome, telefone ou placa',
  'customers.empty': 'Nenhum {entity.customer|l} encontrado para "{$q}".',
  'customers.col.name': 'Nome',
  'customers.col.phone': 'Telefone',
  'customers.col.assets': '{entity.asset|p}',
  'customers.col.last': 'Último {entity.work_order|l}',
  'customers.col.next_review': 'Próxima revisão',
  'customer.contact': 'Contato',
  'customer.assets': '{entity.asset|p}',
  'customer.history': 'Histórico de {entity.work_order|pl}',
  'customer.no_history': 'Nenhum{entity.work_order?:a} {entity.work_order|l} ainda.',
  'customer.review': 'Recorrência',
  'customer.no_review': 'Nenhum {entity.service|l} recorrente feito ainda.',
  'customer.payments': '{entity.payment|p} registrados',
  'customer.back': 'Voltar para {entity.customer|pl}',
  'customer.not_found': '{entity.customer} não encontrado. Ele pode ter sido removido ou o link está errado.',
  'op.hello': 'Olá, {$name}',
  'op.my_day': 'Meu dia',
  'op.next_action': 'Próxima ação',
  'op.empty_title': 'Nenhum{entity.work_order?:a} {entity.work_order|l} para hoje',
  'op.empty_body': 'Quando {role.manager?o:a} {role.manager|l} te atribuir {entity.work_order?um:uma} {entity.work_order|l}, {entity.work_order?ele:ela} aparece aqui.',
  'op.later': 'Depois',
  'op.done_today': 'Concluíd{entity.work_order?o:a}s hoje',
  'op.offline_sim': 'Simular sem conexão',
  'op.online_sim': 'Reconectar',
  'op.queue': '{$n} {$items} aguardando envio',
  'op.queue_sending': 'Enviando {$i} de {$n}…',
  'op.queue_flushed': '{$n} {$items} enviados. Nada se perdeu.',
  'op.saved_offline': 'Salvo no aparelho. Será enviado quando a conexão voltar.',
  'op.back': 'Voltar',
  'op.camera': 'Câmera (simulada)',
  'op.camera_hint': 'Escolha uma foto de exemplo. No app real, a câmera abre aqui e a foto é comprimida no aparelho (D13).',
  'dash.title': 'Painel',
  'dash.subtitle': 'Últimos 28 dias, calculado a partir d{entity.work_order?o:a}s {entity.work_order|pl} concluíd{entity.work_order?o:a}s (marco "finished").',
  'cockpit.title': 'Cockpit da plataforma',
};

export function tx(key, params = {}) {
  const s = UI[key];
  if (s == null) { console.warn('[i18n] texto ausente:', key); return key; }
  return render(s, params);
}

export function render(s, params = {}) {
  return s.replace(/\{([^}]*)\}/g, (_, expr) => {
    if (expr.startsWith('$')) return params[expr.slice(1)] ?? '';
    const q = expr.indexOf('?');
    if (q > -1) {
      const key = expr.slice(0, q); const [m, f] = expr.slice(q + 1).split(':');
      return gender(key) === 'f' ? (f ?? '') : (m ?? '');
    }
    const [rawKey, mod = ''] = expr.split('|');
    const key = rawKey.replace(/^entity\.role\./, 'role.');
    return t(key, { plural: mod.includes('p'), lower: mod.includes('l') });
  });
}
