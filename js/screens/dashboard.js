// Bloco 6 — Painel que ensina. Todo número é calculado a partir dos dados (store);
// cada indicador tem uma linha de leitura gerada a partir dos mesmos números.
import * as store from '../store.js';
import { t, tx, gender } from '../i18n.js';
const g = () => (gender('entity.work_order') === 'f' ? 'a' : 'o');
import { icon } from '../components/icons.js';
import { esc, money, pct, duration, plural, relHours } from '../components/format.js';

const DAYS = 28;

/** drill(r) → atributos data-* de um link para Serviços realizados já filtrado (o número tem que bater). */
function bars(rows, { value, label, fmt, color, title, drill }) {
  const max = Math.max(...rows.map(value), 1);
  return `<div class="bars" role="list">${rows.map((r) => {
    const d = drill ? drill(r) : null;
    const tag = d ? 'button' : 'div';
    return `<${tag} class="bar-row" role="listitem" title="${esc(title ? title(r) : `${label(r)}: ${fmt(value(r))}`)}${d ? ' · clique para ver a lista' : ''}" ${d ? `data-action="drill" ${Object.entries(d).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')} data-ann="drilldown"` : ''}>
    <span class="row ellipsis">${color ? `<span class="dot" style="background:${esc(color(r))}" aria-hidden="true"></span>` : ''}<span class="ellipsis">${esc(label(r))}</span></span>
    <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="display:block;width:${Math.max(2, (value(r) / max) * 100)}%"></span></span>
    <span class="tabular" style="font-size:13px">${fmt(value(r))}${d ? ` ${icon('chevronRight', 'sm')}` : ''}</span></${tag}>`;
  }).join('')}</div>`;
}
const reading = (html) => `<p class="reading" data-ann="dash-reading">${icon('lightbulb', 'sm')}<span>${html}</span></p>`;
const card = (ann, title, sub, body) => `<section class="card card-pad" data-ann="${ann}" aria-labelledby="h-${ann}"><div class="row" style="margin-bottom:12px"><h3 id="h-${ann}" class="grow" style="font-size:15px">${title}</h3>${sub ? `<span class="subtle" style="font-size:12px">${sub}</span>` : ''}</div>${body}</section>`;

export function renderDashboard({ orgId }) {
  const stats = store.getServiceStats(orgId, DAYS);
  const head = `<div class="page-head"><div><h1>${tx('dash.title')}</h1><p>${tx('dash.subtitle')}</p></div></div>`;
  if (!stats.totals.orders) {
    return `${head}<div class="card"><div class="empty">${icon('dashboard')}<strong>Ainda sem números para mostrar</strong><p>O painel começa a ensinar quando ${g() === 'a' ? 'uma' : 'um'} ${t('entity.work_order', { lower: true })} chega a um marco de conclusão. Finalize ${g() === 'a' ? 'a primeira' : 'o primeiro'} e volte aqui.</p></div></div>`;
  }
  const services = stats.rows.filter((r) => r.item.kind === 'service');
  const svcCount = stats.totals.serviceCount;
  const svcRevenue = services.reduce((s, r) => s + r.revenue, 0);
  const byCount = services.slice().sort((a, b) => b.count - a.count);
  const byRevenue = services.slice().sort((a, b) => b.revenue - a.revenue);
  const productsRevenue = stats.rows.filter((r) => r.item.kind === 'product').reduce((s, r) => s + r.revenue, 0);

  // 1. Mais realizados
  const top = byCount[0];
  const topCountShare = top.count / svcCount, topRevShare = top.revenue / svcRevenue;
  const r1 = topRevShare < topCountShare
    ? `<strong>${esc(top.item.name)}</strong> é ${pct(topCountShare)} dos ${t('entity.service', { plural: true, lower: true })} feitos, mas ${pct(topRevShare)} da receita de ${t('entity.service', { plural: true, lower: true })}.`
    : `<strong>${esc(top.item.name)}</strong> é o mais feito (${pct(topCountShare)}) e também responde por ${pct(topRevShare)} da receita.`;

  // 2. Receita por serviço — serviços que passam pelo subfluxo
  const sub = services.filter((r) => r.item.subflow_workflow_id);
  const subRev = sub.reduce((s, r) => s + r.revenue, 0), subCnt = sub.reduce((s, r) => s + r.count, 0);
  const subWf = sub[0] ? store.getWorkflow(orgId, sub[0].item.subflow_workflow_id) : null;
  const r2 = subWf ? `Os ${t('entity.service', { plural: true, lower: true })} que passam pelo ${esc(subWf.name.toLowerCase())} são ${pct(subCnt / svcCount)} do volume e ${pct(subRev / svcRevenue)} da receita. ${byRevenue[0] !== top ? `Quem mais fatura é <strong>${esc(byRevenue[0].item.name)}</strong> (${money(byRevenue[0].revenue)}).` : ''}` : `<strong>${esc(byRevenue[0].item.name)}</strong> lidera a receita com ${money(byRevenue[0].revenue)}.`;

  // 3. Ticket médio
  const ticket = stats.totals.revenue / stats.totals.orders;
  const withSub = stats.list.filter((v) => v.usesSubflow), without = stats.list.filter((v) => !v.usesSubflow);
  const avg = (l) => (l.length ? l.reduce((s, v) => s + v.total, 0) / l.length : 0);
  const tWith = avg(withSub), tWithout = avg(without);
  const withProducts = stats.list.filter((v) => v.items.some((i) => i.kind === 'product')).length;
  const r3 = withSub.length && without.length
    ? `Com ${esc(subWf.name.toLowerCase())}, o ticket médio é ${money(tWith)}; sem, ${money(tWithout)} (${(tWith / tWithout).toFixed(1).replace('.', ',')}×). Só ${pct(withProducts / stats.totals.orders)} d${g()}s ${t('entity.work_order', { plural: true, lower: true })} levaram ${t('entity.product', { lower: true })}: espaço para oferecer na entrega.`
    : `Ticket médio de ${money(ticket)} em ${plural(stats.totals.orders, t('entity.work_order', { lower: true }), t('entity.work_order', { plural: true, lower: true }))}.`;

  // 4. Tempo por etapa (principal + subfluxo)
  const main = store.getMainWorkflow(orgId);
  const mainAll = store.getStageDurations(orgId, main.id, DAYS).filter((x) => x.avg != null);
  const entry = store.getStages(orgId, main.id)[0];
  const mainT = mainAll.filter((x) => x.stage.id !== entry.id); // etapa de entrada = espera até o carro chegar, não é trabalho
  const subT = subWf ? store.getStageDurations(orgId, subWf.id, DAYS).filter((x) => x.avg != null) : [];
  const subTotal = subT.reduce((s, x) => s + x.avg, 0);
  const work = mainT.filter((x) => x.stage.milestone !== 'finished' && !x.stage.opens_workflow_id);
  const slowest = work.slice().sort((a, b) => b.avg - a.avg)[0];
  const subTop = subT.slice().sort((a, b) => b.avg - a.avg)[0];
  const subSecond = subT.slice().sort((a, b) => b.avg - a.avg)[1];
  const waiting = mainT.find((x) => x.stage.milestone === 'finished');
  const r4 = [
    subTop ? `No ${esc(subWf.name.toLowerCase())}, <strong>${esc(subTop.stage.label.toLowerCase())}</strong> leva ${pct(subTop.avg / subTotal)} do tempo${subSecond ? ` e ${esc(subSecond.stage.label.toLowerCase())}, ${pct(subSecond.avg / subTotal)}` : ''}.` : '',
    waiting ? `Depois de pronto, o carro espera em média ${duration(waiting.avg)} em "${esc(waiting.stage.label)}": ${waiting.avg > 120 ? 'avisar o cliente mais cedo libera o box.' : 'bom giro.'}` : '',
  ].filter(Boolean).join(' ');

  // 5. Atrasados
  const late = store.getLateWorkOrders(orgId);
  const lateBy = new Map();
  for (const v of late) { const k = v.stage.label; lateBy.set(k, (lateBy.get(k) || 0) + 1); }
  const lateTop = [...lateBy.entries()].sort((a, b) => b[1] - a[1])[0];
  const r5 = late.length ? `${lateTop[1]} de ${late.length} atrasad${g()}${late.length === 1 ? '' : 's'} est${lateTop[1] === 1 ? 'á' : 'ão'} em <strong>${esc(lateTop[0])}</strong>.${late.some((v) => v.subStage) ? ` No ${t('entity.subflow', { lower: true })}: ${esc([...new Set(late.filter((v) => v.subStage).map((v) => v.subStage.label))].join(', '))}.` : ''}` : `Nenhum${g() === 'a' ? 'a' : ''} ${t('entity.work_order', { lower: true })} atrasad${g()} agora.`;

  const kpi = (ann, label, value, extra = '', drill = null) => `<section class="card card-pad stack-sm" data-ann="${ann}"><span class="muted" style="font-size:13px">${label}</span><span class="kpi-value">${value}</span>${extra}${drill ? `<button class="btn btn-sm btn-ghost" style="align-self:flex-start;padding:0" data-action="drill" ${Object.entries(drill).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>Ver lista ${icon('chevronRight', 'sm')}</button>` : ''}</section>`;
  const kpis = `<div class="grid grid-4 kpis" style="margin-bottom:16px">
    ${kpi('dash-revenue', 'Receita (28 dias)', money(stats.totals.revenue), `<span class="subtle" style="font-size:12px">${money(svcRevenue)} ${t('entity.service', { plural: true, lower: true })} · ${money(productsRevenue)} ${t('entity.product', { plural: true, lower: true })}</span>`)}
    ${kpi('dash-ticket', 'Ticket médio', money(ticket), `<span class="subtle" style="font-size:12px">${plural(stats.totals.orders, t('entity.work_order', { lower: true }) + ' concluíd' + g(), t('entity.work_order', { plural: true, lower: true }) + ' concluíd' + g() + 's')}</span>`)}
    ${kpi('dash-services', `${t('entity.service', { plural: true })} feitos`, String(svcCount), `<span class="subtle" style="font-size:12px">${services.length} tipos diferentes</span>`, { origin: 'todos · últimos 28 dias · realizados' })}
    ${kpi('dash-late', `Atrasad${g()}s agora`, String(late.length), late.length ? `<span class="badge danger" style="align-self:flex-start">${icon('alert', 'sm')} prazo vencido</span>` : `<span class="badge ok" style="align-self:flex-start">${icon('check', 'sm')} em dia</span>`, late.length ? { late: '1' } : null)}
  </div>`;

  const drillItem = (r) => ({ item: r.item.id, origin: `${r.item.name} · últimos 28 dias · realizados` });
  const people = [...stats.byAssignee.entries()].map(([id, n]) => ({ id, n, p: store.getProfile(id) })).sort((a, b) => b.n - a.n);
  const topP = people[0];
  const c1 = card('dash-services', `${t('entity.service', { plural: true })} mais realizados`, 'quantidade · clique para ver', bars(byCount, { value: (r) => r.count, label: (r) => r.item.name, fmt: (n) => String(n), color: (r) => r.category.color, drill: drillItem }) + reading(r1)
    + `<div class="field-label" style="margin:16px 0 8px">Quem mais fez</div>${bars(people, { value: (x) => x.n, label: (x) => x.p?.name || '—', fmt: (n) => String(n), drill: (x) => ({ op: x.id, origin: `${x.p?.name || ''} · últimos 28 dias · realizados` }) })}`
    + (topP ? reading(`<strong>${esc(topP.p.name.split(' ')[0])}</strong> fez ${pct(topP.n / svcCount)} dos ${t('entity.service', { plural: true, lower: true })} realizados no período.`) : ''));
  const c2 = card('dash-revenue', `Receita por ${t('entity.service', { lower: true })}`, 'R$ em 28 dias', bars(byRevenue, { value: (r) => r.revenue, label: (r) => r.item.name, fmt: money, color: (r) => r.category.color, title: (r) => `${r.item.name}: ${money(r.revenue)} (${pct(r.revenue / svcRevenue)})`, drill: drillItem }) + reading(r2));
  const c3 = card('dash-ticket', 'Ticket médio', '', `<div class="grid grid-2" style="gap:12px">
      <div class="stack-sm"><span class="muted" style="font-size:13px">Com ${esc(subWf?.name.toLowerCase() || '')}</span><span class="kpi-value" style="font-size:24px">${money(tWith)}</span><span class="subtle" style="font-size:12px">${plural(withSub.length, t('entity.work_order', { lower: true }), t('entity.work_order', { plural: true, lower: true }))}</span></div>
      <div class="stack-sm"><span class="muted" style="font-size:13px">Sem ${esc(subWf?.name.toLowerCase() || '')}</span><span class="kpi-value" style="font-size:24px">${money(tWithout)}</span><span class="subtle" style="font-size:12px">${plural(without.length, t('entity.work_order', { lower: true }), t('entity.work_order', { plural: true, lower: true }))}</span></div></div>` + reading(r3));
  const c4 = card('dash-stage-time', `Tempo médio por ${t('entity.stage', { lower: true })}`, 'horas de expediente', `
      <div class="field-label" style="margin-bottom:8px">${esc(main.name)} <span class="subtle" style="font-weight:400">(sem "${esc(entry.label)}", que é a espera até a chegada)</span></div>${bars(mainT, { value: (x) => x.avg, label: (x) => x.stage.label, fmt: duration, title: (x) => `${x.stage.label}: ${duration(x.avg)} em média (${x.n} passagens)` })}
      ${subT.length ? `<div class="field-label" style="margin:16px 0 8px">${icon('layers', 'sm')} ${t('entity.subflow')} ${esc(subWf.name)}</div>${bars(subT, { value: (x) => x.avg, label: (x) => x.stage.label, fmt: (m) => `${duration(m)} · ${pct(m / subTotal)}`, title: (x) => `${x.stage.label}: ${duration(x.avg)} (${pct(x.avg / subTotal)} do ${subWf.name})` })}` : ''}` + reading(r4 || 'Sem passagens suficientes no período.'));
  const c5 = card('dash-late', `${t('entity.work_order', { plural: true })} atrasad${g()}s`, 'prazo de entrega vencido', late.length ? `<div>${late.sort((a, b) => b.deadline.ms - a.deadline.ms).map((v) => `<button class="list-row" data-action="open-wo" data-id="${v.wo.id}" style="padding-left:0;padding-right:0"><span class="badge danger">${icon('alert', 'sm')} ${relHours(v.deadline.ms)}</span><span class="grow stack-sm"><strong>${esc(v.customer.name)}</strong><span class="subtle" style="font-size:12px">#${v.wo.number} · ${esc(v.asset.attributes.model)} · ${esc(v.subStage ? `${v.stage.label}: ${v.subStage.label}` : v.stage.label)} · ${esc(v.lead?.profile.name.split(' ')[0] || '')}</span></span>${icon('chevronRight', 'sm')}</button>`).join('')}</div>` + reading(r5) : `<div class="empty" style="padding:16px">${icon('checkCircle')}<strong>Tudo no prazo</strong></div>`);
  return `${head}${kpis}<div class="grid grid-2">${c1}${c2}${c4}<div class="stack">${c3}${c5}</div></div>`;
}
