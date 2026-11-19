// Configuração da organização (projeção para o frontend).
// No banco real: marca em `organizations` (name, primary_color, logo_url),
// rótulos em `org_terminology` (org_id, key, singular, plural, gender) com lista FECHADA de chaves,
// formas de pagamento em `organizations.settings`.
// Teste de aceite (5.2): troque "Atendimento" por "Serviço" abaixo e todas as telas mudam.

export const TERMINOLOGY_KEYS = [
  'role.owner', 'role.manager', 'role.admin', 'role.operator', 'role.platform_admin',
  'entity.work_order', 'entity.customer', 'entity.asset', 'entity.unit', 'entity.service',
  'entity.product', 'entity.workflow', 'entity.subflow', 'entity.stage', 'entity.form', 'entity.payment',
];

export const orgConfigs = {
  org_reflexo: {
    org_id: 'org_reflexo',
    brand: { display_name: 'Reflexo Estética Automotiva', short: 'RX', primary_color: '#6d28d9' },
    segment_label: 'Estética automotiva',
    preset_version: 'detailing@0.1',
    // gender: 'm' | 'f' — usado para concordância ("Nenhum atendimento", "Nenhuma visita")
    terminology: {
      'role.owner':          { singular: 'Dono',           plural: 'Donos',           gender: 'm' },
      'role.manager':        { singular: 'Gestor',         plural: 'Gestores',        gender: 'm' },
      'role.admin':          { singular: 'Recepção',       plural: 'Recepção',        gender: 'f' },
      'role.operator':       { singular: 'Detailer',       plural: 'Detailers',       gender: 'm' },
      'role.platform_admin': { singular: 'Plataforma',     plural: 'Plataforma',      gender: 'f' },
      'entity.work_order':   { singular: 'Atendimento',    plural: 'Atendimentos',    gender: 'm' },
      'entity.customer':     { singular: 'Cliente',        plural: 'Clientes',        gender: 'm' },
      'entity.asset':        { singular: 'Veículo',        plural: 'Veículos',        gender: 'm' },
      'entity.unit':         { singular: 'Box',            plural: 'Boxes',           gender: 'm' },
      'entity.service':      { singular: 'Serviço',        plural: 'Serviços',        gender: 'm' },
      'entity.product':      { singular: 'Produto',        plural: 'Produtos',        gender: 'm' },
      'entity.workflow':     { singular: 'Fluxo',          plural: 'Fluxos',          gender: 'm' },
      'entity.subflow':      { singular: 'Subfluxo',       plural: 'Subfluxos',       gender: 'm' },
      'entity.stage':        { singular: 'Etapa',          plural: 'Etapas',          gender: 'f' },
      'entity.form':         { singular: 'Formulário',     plural: 'Formulários',     gender: 'm' },
      'entity.payment':      { singular: 'Pagamento',      plural: 'Pagamentos',      gender: 'm' },
    },
    payment_methods: [
      { key: 'pix', label: 'Pix' },
      { key: 'card', label: 'Cartão na retirada' },
      { key: 'cash', label: 'Dinheiro' },
    ],
    modules: { products: true, multi_unit: false },
  },

  // Segunda organização MÍNIMA (exceção do escopo): só terminologia e cor, para provar que
  // trocar de tenant muda os rótulos sem código específico. Não tem dados: as telas mostram estados vazios.
  // Nome fictício. Laranja escurecido para não encostar no âmbar de status (doc 13, §3, linha "Design").
  org_solaris: {
    org_id: 'org_solaris',
    brand: { display_name: 'Solaris Aquecimento', short: 'SA', primary_color: '#9a3412' },
    segment_label: 'Solar & Aquecimento',
    preset_version: 'solar@0.1',
    terminology: {
      'role.owner':          { singular: 'Dono',           plural: 'Donos',           gender: 'm' },
      'role.manager':        { singular: 'Supervisor',     plural: 'Supervisores',    gender: 'm' },
      'role.admin':          { singular: 'Analista',       plural: 'Analistas',       gender: 'm' },
      'role.operator':       { singular: 'Técnico',        plural: 'Técnicos',        gender: 'm' },
      'role.platform_admin': { singular: 'Plataforma',     plural: 'Plataforma',      gender: 'f' },
      'entity.work_order':   { singular: 'Visita',         plural: 'Visitas',         gender: 'f' },
      'entity.customer':     { singular: 'Cliente',        plural: 'Clientes',        gender: 'm' },
      'entity.asset':        { singular: 'Equipamento',    plural: 'Equipamentos',    gender: 'm' },
      'entity.unit':         { singular: 'Base',           plural: 'Bases',           gender: 'f' },
      'entity.service':      { singular: 'Serviço',        plural: 'Serviços',        gender: 'm' },
      'entity.product':      { singular: 'Peça',           plural: 'Peças',           gender: 'f' },
      'entity.workflow':     { singular: 'Fluxo',          plural: 'Fluxos',          gender: 'm' },
      'entity.subflow':      { singular: 'Subfluxo',       plural: 'Subfluxos',       gender: 'm' },
      'entity.stage':        { singular: 'Etapa',          plural: 'Etapas',          gender: 'f' },
      'entity.form':         { singular: 'Checklist',      plural: 'Checklists',      gender: 'm' },
      'entity.payment':      { singular: 'Pagamento',      plural: 'Pagamentos',      gender: 'm' },
    },
    payment_methods: [{ key: 'pix', label: 'Pix' }, { key: 'boleto', label: 'Boleto' }],
    modules: { products: true, multi_unit: false },
  },
};

export const DEFAULT_ORG_ID = 'org_reflexo';
