// Roteamento por hash simples (#nome), com guarda por papel.
// O host de artifacts só repassa hashes com letras, dígitos e hífen, então ids viram "cus-001".
const MGMT = ['owner', 'manager', 'admin'];
export const ROUTES = {
  painel: { roles: MGMT },
  kanban: { roles: MGMT },
  subfluxo: { roles: MGMT },
  servicos: { roles: MGMT },
  clientes: { roles: MGMT },
  cliente: { roles: MGMT },
  catalogo: { roles: MGMT },
  formularios: { roles: MGMT },
  formulario: { roles: MGMT },
  equipe: { roles: ['owner'] },
  'meu-dia': { roles: ['operator', 'owner', 'manager', 'admin'] },
  cockpit: { roles: ['platform_admin'] },
};
const HOME = { owner: 'painel', manager: 'kanban', admin: 'kanban', operator: 'meu-dia', platform_admin: 'cockpit' };
export const homeFor = (role) => HOME[role];
const PARAM = ['subfluxo', 'cliente', 'formulario'];

export function parseHash(hash = location.hash) {
  const h = hash.replace(/^#/, '');
  for (const name of PARAM) {
    if (h.startsWith(name + '-')) {
      const raw = h.slice(name.length + 1).replace(/-/g, '_');
      return { name, param: name === 'subfluxo' ? 'wf_' + raw : raw };
    }
  }
  return { name: h || '', param: null };
}
export function toHash(name, param) {
  if (name === 'subfluxo') return '#subfluxo-' + String(param).replace(/^wf_/, '').replace(/_/g, '-');
  if (PARAM.includes(name) && param) return `#${name}-` + String(param).replace(/_/g, '-');
  return '#' + name;
}
export function allowed(role, name) { return !!ROUTES[name] && ROUTES[name].roles.includes(role); }
/** Guarda: rota inexistente ou proibida para o papel vai para a home do papel. */
export function resolve(role, hash) {
  const r = parseHash(hash);
  if (allowed(role, r.name)) return { ...r, redirected: false };
  return { name: homeFor(role), param: null, redirected: !!r.name, denied: r.name && ROUTES[r.name] ? r.name : null };
}
/** Permissões de ação (matriz do doc 05). */
const CAN = {
  'catalog.edit': ['owner', 'admin'],
  'forms.edit': ['owner', 'admin'],
  'team.manage': ['owner'],
  'customer.edit': ['owner', 'manager', 'admin'],
  'wo.create': ['owner', 'manager', 'admin'],
  'wo.assign': ['owner', 'manager', 'admin'],
};
export const can = (role, action) => (CAN[action] || []).includes(role);
