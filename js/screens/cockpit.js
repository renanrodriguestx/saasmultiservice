// Cockpit da plataforma — fase futura. Só 3 KPIs agregados FICTÍCIOS.
// Regra 7: o cockpit lê org_daily_metrics (agregado), nunca dados brutos dos tenants.
import { icon } from '../components/icons.js';
import { tx } from '../i18n.js';

const ORG_DAILY_METRICS_MOCK = { orgs_active: 2, orgs_trial: 2, wo_finished_7d: 61, weekly_active_users: 9 };

export function renderCockpit() {
  const m = ORG_DAILY_METRICS_MOCK;
  const k = (label, value, sub) => `<section class="card card-pad stack-sm" data-ann="cockpit"><span class="muted" style="font-size:13px">${label}</span><span class="kpi-value">${value}</span><span class="subtle" style="font-size:12px">${sub}</span></section>`;
  return `<div class="page-head"><div><h1>${tx('cockpit.title')}</h1><p>Fase futura. Números fictícios, só para mostrar o lugar desta tela.</p></div><span class="badge">${icon('info', 'sm')} Fase 2</span></div>
    <div class="grid grid-3">${k('Organizações', m.orgs_active, `${m.orgs_trial} em trial`)}${k('Concluídos na semana (todas)', m.wo_finished_7d, 'soma de org_daily_metrics.os_finished')}${k('Usuários ativos na semana', m.weekly_active_users, 'soma de org_daily_metrics.active_users')}</div>
    <div class="cockpit-note" style="margin-top:16px" data-ann="cockpit"><strong>Por que só isso?</strong> O cockpit lê apenas a tabela agregada <span class="mono">org_daily_metrics</span> (job noturna). Ele nunca abre dados de clientes, veículos ou ordens dos tenants. Acesso a um tenant específico só por "modo suporte", com consentimento e log de auditoria.</div>`;
}
