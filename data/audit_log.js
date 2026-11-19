// Tabela `audit_log` — só insert; before/after de toda alteração (doc 13 §3)
// Gerado por gerador determinístico (seed 20261110). Data de referência: 10/11/2026 14:00 (America/Sao_Paulo).
export default [
  {"id":"aud_0001","org_id":"org_reflexo","user_id":"usr_manager","action":"update","entity":"customers","entity_id":"cus_018","payload":{"before":{"phone":"(11) 98765-4321"},"after":{"phone":"(11) 99709-3605"}},"at":"2026-11-04T18:12:00.000Z","created_at":"2026-11-04T18:12:00.000Z"},
  {"id":"aud_0002","org_id":"org_reflexo","user_id":"usr_owner","action":"update","entity":"catalog_items","entity_id":"svc_wash_l2","payload":{"before":{"base_price":280},"after":{"base_price":300}},"at":"2026-10-01T12:30:00.000Z","created_at":"2026-10-01T12:30:00.000Z"}
];
