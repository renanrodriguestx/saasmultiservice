// Tabela `workflow_stages` — cada etapa aponta para um marco fixo (D6)
// Gerado por gerador determinístico (seed 20261110). Data de referência: 10/11/2026 14:00 (America/Sao_Paulo).
export default [
  {"id":"st_scheduled","org_id":"org_reflexo","workflow_id":"wf_main","position":1,"label":"Agendado","milestone":"todo","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"st_received","org_id":"org_reflexo","workflow_id":"wf_main","position":2,"label":"Recebido","milestone":"todo","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"st_washing","org_id":"org_reflexo","workflow_id":"wf_main","position":3,"label":"Lavagem","milestone":"started","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"st_polishing","org_id":"org_reflexo","workflow_id":"wf_main","position":4,"label":"Polimento","milestone":"started","opens_workflow_id":"wf_polish","return_stage_id":"st_inspection","archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"st_inspection","org_id":"org_reflexo","workflow_id":"wf_main","position":5,"label":"Inspeção final","milestone":"started","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"st_waiting","org_id":"org_reflexo","workflow_id":"wf_main","position":6,"label":"Aguardando cliente","milestone":"finished","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"st_delivered","org_id":"org_reflexo","workflow_id":"wf_main","position":7,"label":"Entregue","milestone":"finished","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"st_canceled","org_id":"org_reflexo","workflow_id":"wf_main","position":99,"label":"Cancelado","milestone":"canceled","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"sp_masking","org_id":"org_reflexo","workflow_id":"wf_polish","position":1,"label":"Mascaramento","milestone":"started","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"sp_test","org_id":"org_reflexo","workflow_id":"wf_polish","position":2,"label":"Teste de pintura","milestone":"started","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"sp_correction","org_id":"org_reflexo","workflow_id":"wf_polish","position":3,"label":"Correção","milestone":"started","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"sp_finishing","org_id":"org_reflexo","workflow_id":"wf_polish","position":4,"label":"Acabamento","milestone":"started","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"},
  {"id":"sp_unmask","org_id":"org_reflexo","workflow_id":"wf_polish","position":5,"label":"Remoção da máscara","milestone":"started","opens_workflow_id":null,"return_stage_id":null,"archived_at":null,"created_at":"2026-09-11T15:00:00.000Z"}
];
