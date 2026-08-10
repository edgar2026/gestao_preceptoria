import { supabase } from '../supabase';

// ── Preceptores ──
export async function fetchPreceptores() {
  const { data, error } = await supabase
    .from('preceptores')
    .select(`
      *,
      profile:profiles!preceptores_profile_id_fkey(user_id, nome_completo, email),
      unidade:unidades(id, nome),
      profissao_ref:profissoes(id, nome),
      modalidade_ref:modalidades_pagamento(id, nome)
    `)
    .order('nome_completo');
  if (error) throw error;
  return data || [];
}

export async function fetchVinculosPratica(preceptorId) {
  const { data, error } = await supabase
    .from('vinculos_adm')
    .select(`
      *,
      semestre:semestres(codigo, data_inicio, data_fim),
      disciplina:disciplinas(nome),
      periodo:periodos(numero, nome),
      local:locais(id, nome),
      setor:setores(id, nome),
      unidade:unidades(id, nome)
    `)
    .eq('preceptor_id', preceptorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchVinculosInternato(preceptorId) {
  const { data, error } = await supabase
    .from('vinculos_internato')
    .select(`
      *,
      semestre:semestres(codigo, data_inicio, data_fim),
      internato:internatos(nome, numero),
      periodo:periodos(numero, nome),
      local:locais(id, nome),
      setor:setores(id, nome),
      unidade:unidades(id, nome)
    `)
    .eq('preceptor_id', preceptorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

const PRECEPTOR_REF_SELECT = `
  *,
  unidade:unidades!preceptores_unidade_id_fkey(id, nome),
  profissao_ref:profissoes!preceptores_profissao_id_fkey(id, nome),
  modalidade_ref:modalidades_pagamento!preceptores_modalidade_pagamento_id_fkey(id, nome)
`;

function mapPreceptorPratica(v) {
  const completo = isVinculoCompleto(v, 'adm');
  const camposFaltantes = completo ? [] : getVinculoCamposFaltantes(v, 'adm');
  return {
    ...v.preceptor,
    unidade: v.preceptor?.unidade?.nome || "-",
    profissao: v.preceptor?.profissao_ref?.nome || "-",
    modalidade: v.preceptor?.modalidade_ref?.nome || "-",
    disciplina: v.disciplina?.nome || "-",
    periodo: v.periodo?.numero ? `${v.periodo.numero}º período` : "Não informado",
    local: v.local?.nome || "-",
    valor_inicial: v.preceptor?.valor_inicial ?? null,
    vinculo_adm: v,
    vinculo_status: v.status || "-",
    vinculo_completo: completo,
    vinculo_campos_faltantes: camposFaltantes,
    regraAtiva: getRegraAtiva(v)
  };
}

function mapPreceptorInternato(v) {
  const completo = isVinculoCompleto(v, 'internato');
  const camposFaltantes = completo ? [] : getVinculoCamposFaltantes(v, 'internato');
  return {
    ...v.preceptor,
    unidade: v.preceptor?.unidade?.nome || "-",
    profissao: v.preceptor?.profissao_ref?.nome || "-",
    modalidade: v.preceptor?.modalidade_ref?.nome || "-",
    internato: v.internato?.nome || "-",
    periodo: v.periodo?.numero ? `${v.periodo.numero}º período` : "Não informado",
    local: v.local?.nome || "-",
    valor_inicial: v.preceptor?.valor_inicial ?? null,
    vinculo_internato: v,
    vinculo_status: v.status || "-",
    vinculo_completo: completo,
    vinculo_campos_faltantes: camposFaltantes,
    regraAtiva: getRegraAtiva(v)
  };
}

export async function fetchPreceptoresPratica() {
  const { data, error } = await supabase
    .from('vinculos_adm')
    .select(`
      *,
      preceptor:preceptores!vinculos_adm_preceptor_id_fkey(${PRECEPTOR_REF_SELECT}),
      semestre:semestres(codigo, data_inicio, data_fim),
      disciplina:disciplinas(nome),
      periodo:periodos(numero, nome),
      local:locais(id, nome),
      setor:setores(id, nome),
      unidade:unidades(id, nome),
      vinculo_regras:vinculo_regras_financeiras(${VINCULO_REGRA_EMBED})
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapPreceptorPratica);
}

export async function fetchPreceptoresInternato() {
  const { data, error } = await supabase
    .from('vinculos_internato')
    .select(`
      *,
      preceptor:preceptores!vinculos_internato_preceptor_id_fkey(${PRECEPTOR_REF_SELECT}),
      semestre:semestres(codigo, data_inicio, data_fim),
      internato:internatos(nome, numero),
      periodo:periodos(numero, nome),
      local:locais(id, nome),
      setor:setores(id, nome),
      unidade:unidades(id, nome),
      vinculo_regras:vinculo_regras_financeiras(${VINCULO_REGRA_EMBED})
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapPreceptorInternato);
}

export async function buscarPreceptorPorCpf(cpf, excludeId = null) {
  const raw = (cpf || '').replace(/\D/g, '');
  if (raw.length !== 11) return null;
  let q = supabase
    .from('preceptores')
    .select('id, nome_completo, cpf, status')
    .eq('cpf', raw);
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function fetchVinculoLocais(vinculoAdmId, vinculoInternatoId) {
  let q = supabase.from('vinculo_locais').select('*, local:locais(nome), setor:setores(nome)');
  if (vinculoAdmId) q = q.eq('vinculo_adm_id', vinculoAdmId);
  if (vinculoInternatoId) q = q.eq('vinculo_internato_id', vinculoInternatoId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

function normalizeCpf(v) {
  const raw = (v || '').replace(/\D/g, '');
  return raw.length === 11 ? raw : null;
}

function normalizeCnpj(v) {
  const raw = (v || '').replace(/\D/g, '');
  return raw.length === 14 ? raw : null;
}

export async function insertPreceptor(dados) {
  const { data, error } = await supabase.from('preceptores').insert({
    nome_completo: dados.nome_completo,
    cpf: normalizeCpf(dados.cpf),
    rg: dados.rg || null,
    conselho_numero: dados.conselho_numero || null,
    profissao_id: dados.profissao_id || null,
    unidade_id: dados.unidade_id || null,
    modalidade_pagamento_id: dados.modalidade_pagamento_id || null,
    cnpj: normalizeCnpj(dados.cnpj),
    razao_social: dados.razao_social || null,
    possui_vinculo_clt: dados.possui_vinculo_clt === true ? true : false,
    valor_inicial: dados.valor_inicial ?? null,
    email: dados.email || null,
    telefone: dados.telefone || null,
    observacoes: dados.observacoes || null,
    status: dados.status || 'ativo'
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updatePreceptor(id, dados) {
  const { data, error } = await supabase.from('preceptores').update({
    nome_completo: dados.nome_completo,
    cpf: normalizeCpf(dados.cpf),
    rg: dados.rg || null,
    conselho_numero: dados.conselho_numero || null,
    profissao_id: dados.profissao_id || null,
    unidade_id: dados.unidade_id || null,
    modalidade_pagamento_id: dados.modalidade_pagamento_id || null,
    cnpj: normalizeCnpj(dados.cnpj),
    razao_social: dados.razao_social || null,
    possui_vinculo_clt: dados.possui_vinculo_clt === true || dados.possui_vinculo_clt === false ? dados.possui_vinculo_clt : null,
    valor_inicial: dados.valor_inicial ?? null,
    email: dados.email || null,
    telefone: dados.telefone || null,
    observacoes: dados.observacoes || null,
    status: dados.status ?? 'ativo'
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function inativarPreceptor(id) {
  const { error: e1 } = await supabase.from('preceptores').update({ status: 'inativo' }).eq('id', id);
  if (e1) throw e1;
  await supabase.from('vinculos_adm').update({ status: 'inativo' }).eq('preceptor_id', id).eq('status', 'ativo');
  await supabase.from('vinculos_internato').update({ status: 'inativo' }).eq('preceptor_id', id).eq('status', 'ativo');
}

export async function inativarVinculoPratica(id) {
  const { error } = await supabase.from('vinculos_adm').update({ status: 'inativo' }).eq('id', id);
  if (error) throw error;
}

export async function reativarVinculoPratica(id) {
  const { error } = await supabase.from('vinculos_adm').update({ status: 'ativo' }).eq('id', id);
  if (error) throw error;
}

export async function inativarVinculoInternato(id) {
  const { error } = await supabase.from('vinculos_internato').update({ status: 'inativo' }).eq('id', id);
  if (error) throw error;
}

export async function reativarVinculoInternato(id) {
  const { error } = await supabase.from('vinculos_internato').update({ status: 'ativo' }).eq('id', id);
  if (error) throw error;
}

export async function insertVinculoPratica(dados) {
  const { data, error } = await supabase.from('vinculos_adm').insert({
    preceptor_id: dados.preceptor_id,
    semestre_id: dados.semestre_id || null,
    disciplina_id: dados.disciplina_id || null,
    periodo_id: dados.periodo_id || null,
    unidade_id: dados.unidade_id || null,
    local_id: dados.local_id || null,
    setor_id: dados.setor_id || null,
    data_inicio: dados.data_inicio || null,
    data_fim: dados.data_inicio ? (dados.data_fim || null) : null,
    status: 'ativo'
  }).select().single();
  if (error) throw error;
  return data;
}

export async function insertVinculoInternato(dados) {
  const { data, error } = await supabase.from('vinculos_internato').insert({
    preceptor_id: dados.preceptor_id,
    semestre_id: dados.semestre_id || null,
    internato_id: dados.internato_id || null,
    periodo_id: dados.periodo_id || null,
    unidade_id: dados.unidade_id || null,
    local_id: dados.local_id || null,
    setor_id: dados.setor_id || null,
    data_inicio: dados.data_inicio || null,
    data_fim: dados.data_inicio ? (dados.data_fim || null) : null,
    status: 'ativo'
  }).select().single();
  if (error) throw error;
  return data;
}

// ── Helpers: Validação de vínculo completo (liberação para Escalas) ──
export function isVinculoCompleto(v, tipoAtuacao) {
  return getVinculoCamposFaltantes(v, tipoAtuacao).length === 0;
}

export function getVinculoCamposFaltantes(v, tipoAtuacao) {
  const f = [];
  if (!v?.preceptor?.status || v.preceptor.status !== 'ativo') f.push('Preceptor inativo');
  if (!v?.preceptor?.nome_completo?.trim()) f.push('Nome completo');
  if (!v?.unidade_id) f.push('Unidade');
  if (!v?.preceptor?.profissao_id) f.push('Profissão');
  if (tipoAtuacao === 'adm') { if (!v?.disciplina_id) f.push('Disciplina'); }
  else { if (!v?.internato_id) f.push('Internato'); }
  if (!v?.periodo_id) f.push('Período');
  if (!v?.local_id) f.push('Local de atuação');
  if (!v?.semestre_id) f.push('Semestre');
  return f;
}

// Associação ativa de Regra Financeira do vínculo (histórico preservado nas inativas).
export function getRegraAtiva(v) {
  const assoc = (v?.vinculo_regras || [])
    .filter(a => a.status === 'ativo')
    .sort((a, b) => (a.created_at || '') < (b.created_at || '') ? 1 : -1)[0];
  return assoc || null;
}

const VINCULO_REGRA_EMBED = `
  id, regra_id, status, data_inicio, data_fim, justificativa, encerrado_justificativa, created_at,
  regra:regras_financeiras(
    id, nome, tipo_atuacao, forma_calculo, status, unidade_id, internato_id, disciplina_id, local_id, setor_id, preceptor_id,
    unidade:unidades(id, nome),
    internato:internatos(id, nome, numero),
    disciplina:disciplinas(id, nome),
    local:locais(id, nome),
    setor:setores(id, nome),
    preceptor:preceptores!regras_financeiras_preceptor_id_fkey(id, nome_completo),
    componentes:regra_componentes(id, descricao, tipo, valor, valor_extra, quantidade_minima, exige_presenca, status)
  )
`;

// ── Helpers ──
export function parseCurrencyBRL(v) {
  if (!v) return null;
  const s = String(v).replace(/[^\d,]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function formatCurrencyBRL(v) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Favorecidos ──

export async function updateVinculoPratica(id, dados) {
  const { data, error } = await supabase.from('vinculos_adm').update({
    semestre_id: dados.semestre_id || null,
    disciplina_id: dados.disciplina_id || null,
    periodo_id: dados.periodo_id || null,
    unidade_id: dados.unidade_id || null,
    local_id: dados.local_id || null,
    setor_id: dados.setor_id || null,
    data_inicio: dados.data_inicio || null,
    data_fim: dados.data_inicio ? (dados.data_fim || null) : null
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function updateVinculoInternato(id, dados) {
  const { data, error } = await supabase.from('vinculos_internato').update({
    semestre_id: dados.semestre_id || null,
    internato_id: dados.internato_id || null,
    periodo_id: dados.periodo_id || null,
    unidade_id: dados.unidade_id || null,
    local_id: dados.local_id || null,
    setor_id: dados.setor_id || null,
    data_inicio: dados.data_inicio || null,
    data_fim: dados.data_inicio ? (dados.data_fim || null) : null
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function fetchPeriodosByRange(min, max) {
  const { data, error } = await supabase
    .from('periodos')
    .select('*')
    .gte('numero', min)
    .lte('numero', max)
    .eq('status', 'ativo')
    .order('numero');
  if (error) throw error;
  return data || [];
}

export async function fetchDisciplinas() {
  const { data, error } = await supabase.from('disciplinas').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchDisciplinasAtivas() {
  const { data, error } = await supabase
    .from('disciplinas')
    .select('*')
    .eq('status', 'ativo')
    .order('nome');
  if (error) throw error;
  return data || [];
}

  export async function fetchInternatosAtivos() {
    const { data, error } = await supabase
      .from('internatos')
      .select('*')
      .eq('status', 'ativo')
      .order('numero');
    if (error) throw error;
    return data || [];
  }

  export async function fetchCursos() {
    const { data, error } = await supabase
      .from('cursos')
      .select('*')
      .order('nome');
    if (error) throw error;
    return data || [];
  }

export async function fetchSemestresAtivos() {
  const { data, error } = await supabase
    .from('semestres')
    .select('*')
    .eq('status', 'ativo')
    .order('codigo', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function inativarRegistro(tabela, id) {
  const { error } = await supabase.from(tabela).update({ status: 'inativo' }).eq('id', id);
  if (error) throw error;
}

// ── Locais e Setores ──
export async function fetchLocais() {
  const { data, error } = await supabase.from('locais').select('*, setores:setores(id, nome)').order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchSetores() {
   const { data, error } = await supabase.from('setores').select('*').order('nome');
   if (error) throw error;
   return data || [];
  }

export async function fetchSetoresAtivos() {
   const { data, error } = await supabase.from('setores').select('*').eq('status', 'ativo').order('nome');
   if (error) throw error;
   return data || [];
  }

export async function fetchLocaisAtivos() {
  const { data, error } = await supabase.from('locais').select('*').eq('status', 'ativo').order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchSetoresByLocal(localId) {
  if (!localId) return [];
  const { data, error } = await supabase.from('setores').select('*').eq('local_id', localId).eq('status', 'ativo').order('nome');
  if (error) throw error;
  return data || [];
}

export async function upsertVinculoLocal(dados) {
  if (dados.id) {
    const { data, error } = await supabase.from('vinculo_locais').update({
      local_id: dados.local_id,
      setor_id: dados.setor_id || null
    }).eq('id', dados.id).select().single();
    if (error) throw error;
    return data;
  }
  const insertData = {
    tipo_atuacao: dados.tipo_atuacao || 'internato',
    local_id: dados.local_id,
    setor_id: dados.setor_id || null,
    status: 'ativo'
  };
  if (dados.tipo_atuacao === 'adm') {
    insertData.vinculo_adm_id = dados.vinculo_adm_id;
  } else {
    insertData.vinculo_internato_id = dados.vinculo_internato_id;
  }
  const { data, error } = await supabase.from('vinculo_locais').insert(insertData).select().single();
  if (error) throw error;
  return data;
}

export async function insertLocal(dados) {
  const cnpjRaw = (dados.cnpj || '').replace(/\D/g, '');
  const { data, error } = await supabase.from('locais').insert({
    nome: dados.nome, tipo: dados.tipo || null, cnpj: cnpjRaw.length === 14 ? cnpjRaw : null,
    endereco: dados.endereco || null, cidade: dados.cidade || null, uf: dados.uf || null, status: 'ativo'
  }).select().single();
  if (error) throw error;
  return data;
}

export async function insertSetor(dados) {
  const { data, error } = await supabase.from('setores').insert({
    nome: dados.nome
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateLocal(id, dados) {
  const cnpjRaw = (dados.cnpj || '').replace(/\D/g, '');
  const { data, error } = await supabase.from('locais').update({
    nome: dados.nome, tipo: dados.tipo || null, cnpj: cnpjRaw.length === 14 ? cnpjRaw : null,
    endereco: dados.endereco || null, cidade: dados.cidade || null, uf: dados.uf || null
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function updateSetor(id, dados) {
  const { data, error } = await supabase.from('setores').update({ nome: dados.nome }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ── Profissões ──
export async function fetchProfissoes() {
  const { data, error } = await supabase.from('profissoes').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchProfissoesAtivas() {
  const { data, error } = await supabase.from('profissoes').select('*').eq('status', 'ativo').order('nome');
  if (error) throw error;
  return data || [];
}

export async function insertProfissao(dados) {
  const { data, error } = await supabase.from('profissoes').insert({
    nome: dados.nome, status: dados.status || 'ativo'
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateProfissao(id, dados) {
  const { data, error } = await supabase.from('profissoes').update({ nome: dados.nome, status: dados.status }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ── Disciplinas (cadastro simples) ──
export async function insertDisciplinaCadastro(dados) {
  const { data, error } = await supabase.from('disciplinas').insert({
    nome: dados.nome, status: dados.status || 'ativo'
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateDisciplinaCadastro(id, dados) {
  const { data, error } = await supabase.from('disciplinas').update({
    nome: dados.nome, status: dados.status
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ── Locais (cadastro simples) ──
export async function insertLocalCadastro(dados) {
  const { data, error } = await supabase.from('locais').insert({
    nome: dados.nome, status: 'ativo'
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateLocalCadastro(id, dados) {
  const { data, error } = await supabase.from('locais').update({
    nome: dados.nome, status: dados.status
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ── Setores (cadastro simples) ──
export async function insertSetorCadastro(dados) {
   const { data, error } = await supabase.from('setores').insert({
      nome: dados.nome
   }).select().single();
   if (error) throw error;
   return data;
  }

export async function updateSetorCadastro(id, dados) {
   const { data, error } = await supabase.from('setores').update({
      nome: dados.nome
   }).eq('id', id).select().single();
   if (error) throw error;
   return data;
  }

 // ── Internatos ──
 export async function fetchInternatos() {
   const { data, error } = await supabase.from('internatos').select('*').order('nome', { ascending: true });
   if (error) throw error;
   return data || [];
 }

  export async function insertInternato(dados) {
    const { data, error } = await supabase.from('internatos').insert({
      nome: dados.nome.trim()
    }).select().single();
    if (error) throw error;
    return data;
  }

  export async function updateInternato(id, dados) {
    const { data, error } = await supabase.from('internatos').update({
      nome: dados.nome.trim()
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

 export async function deleteInternato(id) {
   const { error } = await supabase.from('internatos').delete().eq('id', id);
   if (error) throw error;
 }

 export async function inativarInternato(id) {
   const { error } = await supabase.from('internatos').update({ status: 'inativo' }).eq('id', id);
   if (error) throw error;
 }

 export async function checkInternatoDependencies(id) {
   const deps = [];
   const { count: vincInt } = await supabase.from('vinculos_internato').select('*', { count: 'exact', head: true }).eq('internato_id', id);
   if (vincInt > 0) deps.push({ table: 'vinculos_internato', count: vincInt, label: 'vínculos Internato' });
   const { count: setores } = await supabase.from('setores').select('*', { count: 'exact', head: true }).eq('internato_id', id);
   if (setores > 0) deps.push({ table: 'setores', count: setores, label: 'setores' });
   return deps;
 }

 // ── Internato-Disciplinas (junction) ──
 export async function fetchDisciplinasByInternato(internatoId) {
   if (!internatoId) return [];
   const { data, error } = await supabase
     .from('internato_disciplinas')
     .select('disciplina:disciplinas(id, nome)')
     .eq('internato_id', internatoId);
   if (error) throw error;
   return (data || []).map(r => r.disciplina);
 }

 export async function setInternatoDisciplinas(internatoId, disciplinaIds) {
   const { error: delError } = await supabase.from('internato_disciplinas').delete().eq('internato_id', internatoId);
   if (delError) throw delError;
   if (!disciplinaIds || disciplinaIds.length === 0) return [];
   const { data, error } = await supabase.from('internato_disciplinas').insert(
     disciplinaIds.map(did => ({ internato_id: internatoId, disciplina_id: did }))
   ).select();
   if (error) throw error;
   return data || [];
 }

// ── Check duplicate name ──
export async function checkDuplicateName(table, name, excludeId = null) {
  const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
  let q = supabase.from(table).select('id, nome').ilike('nome', normalized);
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q;
  if (error) throw error;
  return data && data.length > 0;
}

// ── Períodos (cadastro auxiliar) ──
export async function fetchPeriodosCadastro() {
  const { data, error } = await supabase.from('periodos').select('*').order('numero');
  if (error) throw error;
  return data || [];
}

export async function insertPeriodoCadastro(dados) {
  const { data, error } = await supabase.from('periodos').insert({
    numero: dados.numero, status: dados.status || 'ativo'
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updatePeriodoCadastro(id, dados) {
  const { data, error } = await supabase.from('periodos').update({
    numero: dados.numero, status: dados.status
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePeriodo(id) {
  const { error } = await supabase.from('periodos').delete().eq('id', id);
  if (error) throw error;
}

export async function inativarPeriodo(id) {
  const { error } = await supabase.from('periodos').update({ status: 'inativo' }).eq('id', id);
  if (error) throw error;
}

export async function checkPeriodoDependencies(id) {
  const deps = [];
  const { count: vincAdm } = await supabase.from('vinculos_adm').select('*', { count: 'exact', head: true }).eq('periodo_id', id);
  if (vincAdm > 0) deps.push({ table: 'vinculos_adm', count: vincAdm, label: 'vínculos Prática' });
  const { count: vincInt } = await supabase.from('vinculos_internato').select('*', { count: 'exact', head: true }).eq('periodo_id', id);
  if (vincInt > 0) deps.push({ table: 'vinculos_internato', count: vincInt, label: 'vínculos Internato' });
  const { count: internatos } = await supabase.from('internatos').select('*', { count: 'exact', head: true }).eq('periodo_id', id);
  if (internatos > 0) deps.push({ table: 'internatos', count: internatos, label: 'internatos' });
  return deps;
}

// ── Semestres (cadastro auxiliar) ──
export async function fetchSemestresCadastro() {
  const { data, error } = await supabase.from('semestres').select('*').order('codigo', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function insertSemestreCadastro(dados) {
  const { data, error } = await supabase.from('semestres').insert({
    codigo: dados.codigo,
    status: dados.status || 'ativo'
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateSemestreCadastro(id, dados) {
  const { data, error } = await supabase.from('semestres').update({
    codigo: dados.codigo,
    status: dados.status
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSemestre(id) {
  const { error } = await supabase.from('semestres').delete().eq('id', id);
  if (error) throw error;
}

export async function inativarSemestre(id) {
  const { error } = await supabase.from('semestres').update({ status: 'inativo' }).eq('id', id);
  if (error) throw error;
}

export async function checkSemestreDependencies(id) {
  const deps = [];
  const { count: vincAdm } = await supabase.from('vinculos_adm').select('*', { count: 'exact', head: true }).eq('semestre_id', id);
  if (vincAdm > 0) deps.push({ table: 'vinculos_adm', count: vincAdm, label: 'vínculos Prática' });
  const { count: vincInt } = await supabase.from('vinculos_internato').select('*', { count: 'exact', head: true }).eq('semestre_id', id);
  if (vincInt > 0) deps.push({ table: 'vinculos_internato', count: vincInt, label: 'vínculos Internato' });
  return deps;
}

// ── Unidades (cadastro auxiliar) ──
export async function fetchUnidades() {
  const { data, error } = await supabase.from('unidades').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchUnidadesAtivas() {
  const { data, error } = await supabase.from('unidades').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function insertUnidade(dados) {
  const { data, error } = await supabase.from('unidades').insert({
    nome: dados.nome
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateUnidade(id, dados) {
  const { data, error } = await supabase.from('unidades').update({
    nome: dados.nome
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteUnidade(id) {
  const { error } = await supabase.from('unidades').delete().eq('id', id);
  if (error) throw error;
}

export async function checkUnidadeDependencies(id) {
  const deps = [];
  const { count: vincAdm } = await supabase.from('vinculos_adm').select('*', { count: 'exact', head: true }).eq('unidade_id', id);
  if (vincAdm > 0) deps.push({ table: 'vinculos_adm', count: vincAdm, label: 'vínculos Prática' });
  const { count: vincInt } = await supabase.from('vinculos_internato').select('*', { count: 'exact', head: true }).eq('unidade_id', id);
  if (vincInt > 0) deps.push({ table: 'vinculos_internato', count: vincInt, label: 'vínculos Internato' });
  return deps;
}

// ── Modalidades de pagamento (cadastro auxiliar) ──
export async function fetchModalidadesPagamento() {
  const { data, error } = await supabase.from('modalidades_pagamento').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchModalidadesPagamentoAtivas() {
  const { data, error } = await supabase.from('modalidades_pagamento').select('*').eq('status', 'ativo').order('nome');
  if (error) throw error;
  return data || [];
}

export async function insertModalidadePagamento(dados) {
  const nome = dados.nome.trim().replace(/\s+/g, ' ');
  const { data, error } = await supabase.from('modalidades_pagamento').insert({
    nome,
    status: dados.status || 'ativo'
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateModalidadePagamento(id, dados) {
  const nome = dados.nome.trim().replace(/\s+/g, ' ');
  const { data, error } = await supabase.from('modalidades_pagamento').update({
    nome,
    status: dados.status
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteModalidadePagamento(id) {
  const { error } = await supabase.from('modalidades_pagamento').delete().eq('id', id);
  if (error) throw error;
}

export async function inativarModalidadePagamento(id) {
  const { error } = await supabase.from('modalidades_pagamento').update({ status: 'inativo' }).eq('id', id);
  if (error) throw error;
}

export async function checkModalidadePagamentoDependencies(id) {
  const deps = [];
  const { count: preceptores } = await supabase.from('preceptores').select('*', { count: 'exact', head: true }).eq('modalidade_pagamento_id', id);
  if (preceptores > 0) deps.push({ table: 'preceptores', count: preceptores, label: 'preceptores' });
  return deps;
}

// ── Escalas: lista de preceptores com status de escala ──
export async function fetchVinculosParaEscalasPage() {
  const [resAdm, resInt] = await Promise.all([
    supabase.from('vinculos_adm').select(`
      id, preceptor_id, disciplina_id, periodo_id, unidade_id, local_id, setor_id, semestre_id, status, data_inicio, data_fim,
      preceptor:preceptores(id, nome_completo, status, profissao_id),
      disciplina:disciplinas(nome),
      periodo:periodos(numero, nome),
      unidade:unidades(id, nome),
      local:locais(id, nome),
      setor:setores(id, nome),
      semestre:semestres(codigo),
      vinculo_regras:vinculo_regras_financeiras(${VINCULO_REGRA_EMBED})
    `).eq('status', 'ativo'),
    supabase.from('vinculos_internato').select(`
      id, preceptor_id, internato_id, periodo_id, unidade_id, local_id, setor_id, semestre_id, status, data_inicio, data_fim,
      preceptor:preceptores(id, nome_completo, status, profissao_id),
      internato:internatos(nome, numero),
      periodo:periodos(numero, nome),
      unidade:unidades(id, nome),
      local:locais(id, nome),
      setor:setores(id, nome),
      semestre:semestres(codigo),
      vinculo_regras:vinculo_regras_financeiras(${VINCULO_REGRA_EMBED})
    `).eq('status', 'ativo')
  ]);
  if (resAdm.error) throw resAdm.error;
  if (resInt.error) throw resInt.error;

  const vinculos = [
    ...(resAdm.data || []).map(v => ({ ...v, tipo_atuacao: 'adm' })),
    ...(resInt.data || []).map(v => ({ ...v, tipo_atuacao: 'internato' }))
  ].filter(v => isVinculoCompleto(v, v.tipo_atuacao));

  if (vinculos.length === 0) return [];

  const vinculoIds = vinculos.map(v => v.id);
  const [resEscAdm, resEscInt] = await Promise.all([
    supabase.from('escalas').select('id, vinculo_adm_id, vinculo_internato_id, status, vinculo_local_id, data_inicio, data_fim').in('vinculo_adm_id', vinculoIds),
    supabase.from('escalas').select('id, vinculo_adm_id, vinculo_internato_id, status, vinculo_local_id, data_inicio, data_fim').in('vinculo_internato_id', vinculoIds)
  ]);

  const escalasMap = {};
  for (const e of [...(resEscAdm.data || []), ...(resEscInt.data || [])]) {
    const key = e.vinculo_adm_id || e.vinculo_internato_id;
    if (!escalasMap[key]) escalasMap[key] = [];
    escalasMap[key].push(e);
  }

  return vinculos.map(v => {
    const escs = escalasMap[v.id] || [];
    const ativas = escs.filter(e => e.status === 'ativo');
    const inativas = escs.filter(e => e.status === 'inativo');
    let escala_status = 'sem_escala';
    if (ativas.length > 0) escala_status = 'ativa';
    else if (inativas.length > 0) escala_status = 'inativa';
    const p = v.preceptor;
    const completo = isVinculoCompleto(v, v.tipo_atuacao);
    return {
      vinculo_id: v.id,
      tipo_atuacao: v.tipo_atuacao,
      preceptor_id: v.preceptor_id,
      local_id: v.local_id,
      setor_id: v.setor_id,
      vinculo_completo: completo,
      vinculo_campos_faltantes: completo ? [] : getVinculoCamposFaltantes(v, v.tipo_atuacao),
      preceptor_nome: p?.nome_completo || '-',
      modalidade_label: v.tipo_atuacao === 'adm' ? 'Prática' : 'Internato',
      unidade_nome: v.unidade?.nome || '-',
      disciplina_nome: v.disciplina?.nome || '-',
      internato_nome: v.internato?.nome || '-',
      periodo_nome: v.periodo?.numero ? `${v.periodo.numero}º período` : 'Não informado',
      local_nome: v.local?.nome || '-',
      setor_nome: v.setor?.nome || '-',
      semestre_codigo: v.semestre?.codigo || '-',
      escala_status,
      escalas: escs,
      escalas_ativas_count: ativas.length,
      escalas_total_count: escs.length,
      regraAtiva: getRegraAtiva(v)
    };
  });
}

export async function fetchVinculosLocaisParaEscalas() {
  const { data, error } = await supabase
    .from('vinculo_locais')
    .select(`
      id, tipo_atuacao, local_id, setor_id,
      local:locais(nome),
      setor:setores(nome),
      vinculo_adm:vinculos_adm(
        id, preceptor_id, semestre_id, disciplina_id, periodo_id, unidade_id, data_inicio, data_fim, status,
        preceptor:preceptores(id, nome_completo),
        disciplina:disciplinas(nome),
        periodo:periodos(numero, nome),
        unidade:unidades(id, nome),
        semestre:semestres(codigo)
      ),
      vinculo_internato:vinculos_internato(
        id, preceptor_id, semestre_id, internato_id, periodo_id, unidade_id, data_inicio, data_fim, status,
        preceptor:preceptores(id, nome_completo),
        internato:internatos(nome, numero),
        periodo:periodos(numero, nome),
        unidade:unidades(id, nome),
        semestre:semestres(codigo)
      )
    `)
    .eq('status', 'ativo');
  if (error) throw error;
  return (data || []).map(v => {
    const vinc = v.tipo_atuacao === 'adm' ? v.vinculo_adm : v.vinculo_internato;
    const preceptor = vinc?.preceptor;
    return {
      ...v,
      preceptor_nome: preceptor?.nome_completo || '-',
      atividade_nome: v.tipo_atuacao === 'adm'
        ? (vinc?.disciplina?.nome || '-')
        : (vinc?.internato?.nome || '-'),
      local_nome: v.local?.nome,
      setor_nome: v.setor?.nome,
      periodo_nome: vinc?.periodo?.numero ? `${vinc.periodo.numero}º período` : 'Não informado',
      unidade_nome: vinc?.unidade?.nome || '-',
      semestre_codigo: vinc?.semestre?.codigo || '-',
      vinculo_status: vinc?.status || '-',
      vinculo_data_inicio: vinc?.data_inicio,
      vinculo_data_fim: vinc?.data_fim,
      display_label: `${preceptor?.nome_completo || '?'} — ${v.tipo_atuacao === 'adm' ? (vinc?.disciplina?.nome || '?') : (vinc?.internato?.nome || '?')} • ${vinc?.periodo?.nome || '?'} • ${v.local?.nome || '?'} • ${v.setor?.nome || '?'}`
    };
  });
}

export async function fetchEscalasPorVinculo(vinculoAdmId, vinculoInternatoId) {
  let q = supabase.from('escalas').select(`
    *,
    itens:escalas_itens(data, dia_semana, turno),
    vinculo_local:vinculo_locais(
      id, local_id, setor_id,
      local:locais(nome),
      setor:setores(nome)
    )
  `);
  if (vinculoAdmId) q = q.eq('vinculo_adm_id', vinculoAdmId);
  if (vinculoInternatoId) q = q.eq('vinculo_internato_id', vinculoInternatoId);
  q = q.order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(e => ({
    ...e,
    itens: e.itens || [],
    local_nome: e.vinculo_local?.local?.nome || '-',
    setor_nome: e.vinculo_local?.setor?.nome || '-'
  }));
}

export async function salvarEscala(dados) {
  const itens = (dados.itens || []).map(i => ({
    data: i.data,
    turno: i.turno
  }));
  const { data, error } = await supabase.rpc('salvar_escala_completa', {
    p_tipo_atuacao: dados.tipo_atuacao,
    p_vinculo_local_id: dados.vinculo_local_id,
    p_data_inicio: dados.data_inicio,
    p_itens: itens,
    p_escala_id: dados.escala_id || null,
    p_vinculo_adm_id: dados.vinculo_adm_id || null,
    p_vinculo_internato_id: dados.vinculo_internato_id || null,
    p_data_fim: dados.data_fim || null,
    p_status: dados.status || 'ativo'
  });
  if (error) throw error;
  if (data && !data.sucesso) throw new Error(data.erro || 'Erro ao salvar escala.');
  return data;
}

export async function inativarEscala(id) {
  const { error } = await supabase.from('escalas').update({ status: 'inativo' }).eq('id', id);
  if (error) throw error;
}

export async function reativarEscala(id) {
  const { error } = await supabase.from('escalas').update({ status: 'ativo' }).eq('id', id);
  if (error) throw error;
}

// ── Presenças (Coordenador) ──
export async function fetchPreceptoresComEscalaNoDia(dataStr) {
  const { data, error } = await supabase.rpc('fetch_preceptores_com_escala_no_dia', {
    p_data: dataStr
  });
  if (error) throw error;
  return data || [];
}

export async function registrarPresencaCoordenador(dados) {
  const { data, error } = await supabase.rpc('registrar_presenca_coordenador', {
    p_escala_id: dados.escala_id,
    p_preceptor_id: dados.preceptor_id,
    p_data: dados.data,
    p_turnos: dados.turnos,
    p_registrado_por: dados.registrado_por
  });
  if (error) throw error;
  if (data && !data.sucesso) throw new Error(data.erro || 'Erro ao registrar presença.');
  return data;
}

export async function fetchPresencasConsolidadas() {
  const { data, error } = await supabase.rpc('fetch_presencas_consolidadas');
  if (error) throw error;
  return data || [];
}

export async function fetchPresencas() {
  return fetchPresencasConsolidadas();
}

const MESES_LABEL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// "2026-08" -> "Agosto/2026"
export function fmtCompetencia(comp) {
  if (!comp) return '';
  const [ano, mes] = String(comp).split('-');
  const mi = parseInt(mes, 10);
  return `${MESES_LABEL[mi - 1] || mes}/${ano}`;
}

// Presenças reais (tabela presencas) consolidadas por preceptor + competência + unidade + local.
// Nunca considera datas previstas da escala: somente registros confirmados na tabela presencas.
export async function fetchFolhaPresenca({ preceptorId = null, competencia = null, localId = null } = {}) {
  let q = supabase.from('presencas').select(`
    id, preceptor_id, escala_id, tipo_atuacao, local_id, setor_id,
    data_presenca, turno, status, origem, registrado_em,
    preceptor:preceptores(nome_completo),
    local:locais(nome),
    setor:setores(nome),
    vinculo_adm:vinculos_adm(
      unidade_id, local_id, setor_id,
      disciplina:disciplinas(nome),
      periodo:periodos(numero, nome),
      unidade:unidades(nome),
      semestre:semestres(codigo)
    ),
    vinculo_internato:vinculos_internato(
      unidade_id, local_id, setor_id,
      internato:internatos(nome),
      periodo:periodos(numero, nome),
      unidade:unidades(nome),
      semestre:semestres(codigo)
    )
  `)
    .neq('status', 'cancelada')
    .order('data_presenca', { ascending: true })
    .order('turno', { ascending: true });

  if (preceptorId) q = q.eq('preceptor_id', preceptorId);
  if (competencia) q = q.gte('data_presenca', `${competencia}-01`).lte('data_presenca', `${competencia}-31`);
  if (localId) q = q.eq('local_id', localId);

  const { data, error } = await q;
  if (error) throw error;

  const grupos = {};
  for (const pr of (data || [])) {
    const tipo = pr.tipo_atuacao === 'internato' ? 'internato' : 'adm';
    const vinc = tipo === 'adm' ? (pr.vinculo_adm || {}) : (pr.vinculo_internato || {});
    const competenciaKey = String(pr.data_presenca || '').slice(0, 7);
    if (!competenciaKey) continue;
    const unidadeId = vinc.unidade_id || 'sem-unidade';
    const unidadeNome = vinc.unidade?.nome || '-';
    const localIdKey = pr.local_id || vinc.local_id || 'sem-local';
    const localNome = pr.local?.nome || vinc.local?.nome || '-';
    const setorNome = pr.setor?.nome || vinc.setor?.nome || '';
    const key = [pr.preceptor_id, tipo, competenciaKey, unidadeId, localIdKey].join('|');
    if (!grupos[key]) {
      grupos[key] = {
        preceptor_id: pr.preceptor_id,
        preceptor_nome: pr.preceptor?.nome_completo || '-',
        tipo_atuacao: tipo,
        modalidade_label: tipo === 'adm' ? 'Prática' : 'Internato',
        competencia: competenciaKey,
        competencia_label: fmtCompetencia(competenciaKey),
        unidade_id: unidadeId,
        unidade_nome: unidadeNome,
        local_id: localIdKey,
        local_nome: localNome,
        setor_nome: setorNome,
        disciplina_nome: tipo === 'adm' ? (vinc.disciplina?.nome || '') : '',
        internato_nome: tipo === 'internato' ? (vinc.internato?.nome || '') : '',
        periodo_nome: vinc.periodo?.numero ? `${vinc.periodo.numero}º período` : 'Não informado',
        semestre_codigo: vinc.semestre?.codigo || '',
        total_turnos: 0,
        itens: []
      };
    }
    const g = grupos[key];
    g.total_turnos += 1;
    g.itens.push({
      id: pr.id,
      data_presenca: pr.data_presenca,
      turno: pr.turno,
      local_nome: pr.local?.nome || '-',
      setor_nome: pr.setor?.nome || '',
      origem: pr.origem,
      registrado_em: pr.registrado_em
    });
  }

  return Object.values(grupos).sort((a, b) =>
    String(b.competencia).localeCompare(String(a.competencia)) ||
    a.preceptor_nome.localeCompare(b.preceptor_nome)
  );
}

// ── Calendário de Presenças (Operacional) ──
export async function fetchCalendarioPresencas(ano, mes) {
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  const { data: itens, error: eiErr } = await supabase
    .from('escalas_itens')
    .select(`
      data, turno, escala_id,
      escala:escalas!inner(
        id, tipo_atuacao, vinculo_adm_id, vinculo_internato_id,
        vinculo_adm:vinculos_adm(
          preceptor_id, unidade_id, local_id, setor_id,
          preceptor:preceptores(id, nome_completo),
          unidade:unidades(nome),
          local:locais(nome),
          setor:setores(nome),
          disciplina:disciplinas(nome),
          periodo:periodos(numero, nome)
        ),
        vinculo_internato:vinculos_internato(
          preceptor_id, unidade_id, local_id, setor_id,
          preceptor:preceptores(id, nome_completo),
          unidade:unidades(nome),
          local:locais(nome),
          setor:setores(nome),
          internato:internatos(nome),
          periodo:periodos(numero, nome)
        )
      )
    `)
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .eq('escala.tipo_atuacao', 'internato');
  if (eiErr) throw eiErr;

  const { data: presencasRaw, error: prErr } = await supabase
    .from('presencas')
    .select('escala_id, preceptor_id, data_presenca, turno')
    .gte('data_presenca', dataInicio)
    .lte('data_presenca', dataFim)
    .eq('tipo_atuacao', 'internato')
    .neq('status', 'cancelada');
  if (prErr) throw prErr;

  const porData = {};
  for (const it of (itens || [])) {
    const d = it.data;
    if (!d) continue;
    const e = it.escala;
    if (!e) continue;
    const vinc = e.tipo_atuacao === 'adm' ? e.vinculo_adm : e.vinculo_internato;
    if (!vinc?.preceptor) continue;
    const p = vinc.preceptor;
    const uid = vinc.unidade?.nome || '-';
    const lid = vinc.local?.nome || '-';
    const sid = vinc.setor?.nome || '';
    const aid = e.tipo_atuacao === 'adm' ? (vinc.disciplina?.nome || '-') : (vinc.internato?.nome || '-');
    const pid = vinc.periodo?.numero ? `${vinc.periodo.numero}º período` : 'Não informado';
    const key = `${e.id}|${d}`;
    if (!porData[d]) porData[d] = {};
    if (!porData[d][key]) {
      porData[d][key] = {
        escala_id: e.id, preceptor_id: p.id, preceptor_nome: p.nome_completo,
        tipo_atuacao: e.tipo_atuacao,
        modalidade_label: e.tipo_atuacao === 'adm' ? 'Prática' : 'Internato',
        unidade_nome: uid, local_nome: lid, setor_nome: sid,
        atividade_nome: aid, periodo_nome: pid,
        turnos_previstos: [], turnos_confirmados: []
      };
    }
    if (!porData[d][key].turnos_previstos.includes(it.turno)) {
      porData[d][key].turnos_previstos.push(it.turno);
    }
  }

  const prMap = {};
  for (const pr of (presencasRaw || [])) {
    const d = pr.data_presenca;
    const k = `${pr.escala_id}|${d}`;
    if (!prMap[d]) prMap[d] = {};
    if (!prMap[d][k]) prMap[d][k] = new Set();
    prMap[d][k].add(pr.turno);
  }

  const calendario = [];
  for (const [d, precs] of Object.entries(porData)) {
    const arr = Object.values(precs).map(p => {
      const cSet = prMap[d]?.[`${p.escala_id}|${d}`] || new Set();
      const confirmados = p.turnos_previstos.filter(t => cSet.has(t));
      const pendentes = p.turnos_previstos.filter(t => !cSet.has(t));
      let status_lista = 'pendente';
      if (confirmados.length === p.turnos_previstos.length) status_lista = 'confirmada';
      else if (confirmados.length > 0) status_lista = 'parcial';
      return { ...p, turnos_confirmados: confirmados, turnos_pendentes: pendentes, status_lista };
    });
    const escalados = arr.length;
    const comConfirmacao = arr.filter(p => p.turnos_confirmados.length > 0).length;
    const totalConfirmados = arr.reduce((s, p) => s + p.turnos_confirmados.length, 0);
    const totalPrevistos = arr.reduce((s, p) => s + p.turnos_previstos.length, 0);
    calendario.push({
      data: d, escalados, com_confirmacao: comConfirmacao,
      pendentes: escalados - comConfirmacao,
      total_previstos: totalPrevistos, total_confirmados: totalConfirmados,
      preceptores: arr.sort((a, b) => a.preceptor_nome.localeCompare(b.preceptor_nome))
    });
  }

  const resumo = { total_escalados: 0, total_confirmados: 0, total_pendentes: 0 };
  for (const dia of calendario) {
    resumo.total_escalados += dia.escalados;
    resumo.total_confirmados += dia.com_confirmacao;
    resumo.total_pendentes += dia.pendentes;
  }

  return { calendario: calendario.sort((a, b) => a.data.localeCompare(b.data)), resumo };
}

// ── Ajustes ──
export async function fetchAjustes() {
  const { data, error } = await supabase
    .from('ajustes_presenca')
    .select('*, preceptor:preceptores(nome_completo)')
    .order('realizado_em', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

// ── Configurações ──
export async function fetchConfiguracoes() {
  const { data, error } = await supabase.from('configuracoes').select('*').order('chave');
  if (error) throw error;
  return data || [];
}

export async function fetchAuditLogs() {
  const { data, error } = await supabase.from('audit_logs').select('*').order('ocorrido_em', { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}

// ── Gerenciamento de Usuários (admin) ──
export async function fetchUsuarios() {
  const { data, error } = await supabase.rpc('listar_usuarios_staff');
  if (error) throw error;
  return data || [];
}

export async function criarUsuarioViaEdge({ email, password, nome_completo, telefone, roles }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão inválida. Faça login novamente.');
  let res;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password, nome_completo, telefone: telefone || null, roles }),
    });
  } catch (fetchErr) {
    throw new Error('Falha ao conectar com o servidor. Verifique sua conexão e tente novamente.');
  }
  let json;
  try {
    json = await res.json();
  } catch (parseErr) {
    throw new Error('Resposta inválida do servidor (status ' + res.status + ')');
  }
  if (!res.ok) throw new Error(json.error || json.msg || 'Erro ao criar usuário (status ' + res.status + ')');
  return json;
}

export async function atualizarUsuario(dados) {
  const { data, error } = await supabase.rpc('atualizar_usuario_staff', {
    p_profile_id: dados.profile_id,
    p_nome: dados.nome_completo,
    p_email: dados.email,
    p_telefone: dados.telefone || null,
    p_roles: dados.roles || null,
    p_ativo: dados.ativo
  });
  if (error) throw error;
  return data;
}

export async function bloquearUsuario(profileId, bloquear) {
  const { data, error } = await supabase.rpc('bloquear_usuario', {
    p_profile_id: profileId,
    p_bloquear: bloquear,
  });
  if (error) throw error;
  return data;
}

export async function inativarReativarUsuario(profileId, inativar, motivo = null) {
  const { data, error } = await supabase.rpc('inativar_reativar_usuario', {
    p_profile_id: profileId,
    p_inativar: inativar,
    p_motivo: motivo,
  });
  if (error) throw error;
  return data;
}

export async function redefinirAcessoUsuario(profileId) {
  const { data, error } = await supabase.rpc('redefinir_acesso_usuario', {
    p_profile_id: profileId,
  });
  if (error) throw error;
  return data;
}

export async function redefinirAcessoViaEdge(profileId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessao invalida. Faca login novamente.');
  let res;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ profile_id: profileId }),
    });
  } catch (fetchErr) {
    throw new Error('Falha ao conectar com o servidor. Verifique sua conexao e tente novamente.');
  }
  let json;
  try {
    json = await res.json();
  } catch (parseErr) {
    throw new Error('Resposta invalida do servidor (status ' + res.status + ')');
  }
  if (!res.ok) throw new Error(json.error || json.msg || 'Erro ao redefinir acesso (status ' + res.status + ')');
  return json;
}

export async function marcarPrimeiroAcessoConcluido(profileId) {
  const { data, error } = await supabase.rpc('marcar_primeiro_acesso_concluido', {
    p_profile_id: profileId,
  });
  if (error) throw error;
  return data;
}

export async function atualizarDadosUsuario(profileId, nome, email, telefone) {
  const { data, error } = await supabase.rpc('atualizar_dados_usuario', {
    p_profile_id: profileId,
    p_nome: nome,
    p_email: email,
    p_telefone: telefone || null,
  });
  if (error) throw error;
  return data;
}

export async function enviarRecuperacaoSenha(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  });
  if (error) throw error;
  return true;
}

// ── Helper: Status badge ──
export function statusBadge(status) {
  const map = {
    ativo: 'ok', confirmada: 'ok', concluido: 'ok', pago: 'ok', aprovado: 'ok',
    pendente: 'warn', aberta: 'info', ajustada: 'info', calculado: 'info',
    divergencia: 'bad', inativo: 'bad', cancelado: 'bad', cancelada: 'bad',
    rascunho: 'neutral', bloqueado: 'bad', revogado: 'warn'
  };
  return map[status] || 'neutral';
}

// ── Helper: Formatar data ──
export function fmtData(d) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

export function fmtTimestamp(t) {
  if (!t) return '-';
  return new Date(t).toLocaleString('pt-BR');
}

// ── Label helpers for turno, dia_semana ──
export const TURNOS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
export const DIAS_SEMANA = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
export function turnoLabel(t) { return TURNOS[t] || t; }
export function diaLabel(d) { return DIAS_SEMANA[d] || d; }

// ── Cadastros Auxiliares: Delete/Inactivate com verificacao de dependencias ──
export async function checkProfissaoDependencies(id) {
  const deps = [];
  const { count: vincAdm } = await supabase.from('vinculos_adm').select('*', { count: 'exact', head: true }).eq('profissao_id', id);
  if (vincAdm > 0) deps.push({ table: 'vinculos_adm', count: vincAdm, label: 'vínculos Prática' });
  const { count: vincInt } = await supabase.from('vinculos_internato').select('*', { count: 'exact', head: true }).eq('profissao_id', id);
  if (vincInt > 0) deps.push({ table: 'vinculos_internato', count: vincInt, label: 'vínculos Internato' });
  return deps;
}

export async function checkDisciplinaDependencies(id) {
   const deps = [];
   const { count: vincAdm } = await supabase.from('vinculos_adm').select('*', { count: 'exact', head: true }).eq('disciplina_id', id);
   if (vincAdm > 0) deps.push({ table: 'vinculos_adm', count: vincAdm, label: 'vínculos Prática' });
   const { count: intDisc } = await supabase.from('internato_disciplinas').select('*', { count: 'exact', head: true }).eq('disciplina_id', id);
   if (intDisc > 0) deps.push({ table: 'internato_disciplinas', count: intDisc, label: 'vínculos Internato-Disciplina' });
   return deps;
 }

export async function checkLocalDependencies(id) {
  const deps = [];
  const { count: setores } = await supabase.from('setores').select('*', { count: 'exact', head: true }).eq('local_id', id);
  if (setores > 0) deps.push({ table: 'setores', count: setores, label: 'setores' });
  const { count: vincLoc } = await supabase.from('vinculo_locais').select('*', { count: 'exact', head: true }).eq('local_id', id);
  if (vincLoc > 0) deps.push({ table: 'vinculo_locais', count: vincLoc, label: 'vínculos de local' });
  const { count: escalas } = await supabase.from('escalas').select('*', { count: 'exact', head: true }).eq('local_id', id);
  if (escalas > 0) deps.push({ table: 'escalas', count: escalas, label: 'escalas' });
  const { count: presencas } = await supabase.from('presencas').select('*', { count: 'exact', head: true }).eq('local_id', id);
  if (presencas > 0) deps.push({ table: 'presencas', count: presencas, label: 'presenças' });
  return deps;
}

export async function checkSetorDependencies(id) {
  const deps = [];
  const { count: vincLoc } = await supabase.from('vinculo_locais').select('*', { count: 'exact', head: true }).eq('setor_id', id);
  if (vincLoc > 0) deps.push({ table: 'vinculo_locais', count: vincLoc, label: 'vínculos de local' });
  const { count: escalas } = await supabase.from('escalas').select('*', { count: 'exact', head: true }).eq('setor_id', id);
  if (escalas > 0) deps.push({ table: 'escalas', count: escalas, label: 'escalas' });
  const { count: presencas } = await supabase.from('presencas').select('*', { count: 'exact', head: true }).eq('setor_id', id);
  if (presencas > 0) deps.push({ table: 'presencas', count: presencas, label: 'presenças' });
  return deps;
}

export async function deleteProfissao(id) {
  const { error } = await supabase.from('profissoes').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteDisciplina(id) {
  const { error } = await supabase.from('disciplinas').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteLocal(id) {
  const { error } = await supabase.from('locais').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteSetor(id) {
  const { error } = await supabase.from('setores').delete().eq('id', id);
  if (error) throw error;
}

export async function inativarProfissao(id) {
  const { error } = await supabase.from('profissoes').update({ status: 'inativo' }).eq('id', id);
  if (error) throw error;
}

export async function inativarDisciplina(id) {
  const { error } = await supabase.from('disciplinas').update({ status: 'inativo' }).eq('id', id);
  if (error) throw error;
}

export async function inativarLocal(id) {
  const { error } = await supabase.from('locais').update({ status: 'inativo' }).eq('id', id);
  if (error) throw error;
}

export async function inativarSetor(id) {
  const { error } = await supabase.from('setores').update({ status: 'inativo' }).eq('id', id);
  if (error) throw error;
}

// ── Regras Financeiras ──
export async function fetchRegrasFinanceiras() {
  const { data, error } = await supabase
    .from('regras_financeiras')
    .select(`
      *,
      unidade:unidades(id, nome),
      internato:internatos(id, nome, numero),
      disciplina:disciplinas(id, nome),
      local:locais(id, nome),
      setor:setores(id, nome),
      preceptor:preceptores!regras_financeiras_preceptor_id_fkey(id, nome_completo),
      componentes:regra_componentes(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Preceptores com vínculo Prática ativo (para o formulário de Regras Financeiras)
export async function fetchPreceptoresPraticaParaRegras() {
  const { data, error } = await supabase
    .from('vinculos_adm')
    .select('preceptor:preceptores!vinculos_adm_preceptor_id_fkey(id, nome_completo, status)')
    .eq('status', 'ativo');
  if (error) {
    console.error('[fetchPreceptoresPraticaParaRegras]', error);
    throw error;
  }
  const seen = new Set();
  const result = [];
  for (const v of (data || [])) {
    if (v.preceptor && v.preceptor.status === 'ativo' && !seen.has(v.preceptor.id)) {
      seen.add(v.preceptor.id);
      result.push(v.preceptor);
    }
  }
  return result.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'));
}

// Preceptores com vínculo Internato ativo (para o formulário de Regras Financeiras)
export async function fetchPreceptoresInternatoParaRegras() {
  const { data, error } = await supabase
    .from('vinculos_internato')
    .select('preceptor:preceptores!vinculos_internato_preceptor_id_fkey(id, nome_completo, status)')
    .eq('status', 'ativo');
  if (error) {
    console.error('[fetchPreceptoresInternatoParaRegras]', error);
    throw error;
  }
  const seen = new Set();
  const result = [];
  for (const v of (data || [])) {
    if (v.preceptor && v.preceptor.status === 'ativo' && !seen.has(v.preceptor.id)) {
      seen.add(v.preceptor.id);
      result.push(v.preceptor);
    }
  }
  return result.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'));
}

export async function checarConflitoRegraFinanceira(regra) {
  const { data, error } = await supabase.rpc('checar_conflito_regra_financeira', {
    p_regra_id: regra.id || null,
    p_tipo_atuacao: regra.tipo_atuacao || 'adm',
    p_unidade_id: regra.unidade_id || null,
    p_internato_id: regra.internato_id || null,
    p_disciplina_id: regra.disciplina_id || null,
    p_local_id: regra.local_id || null,
    p_setor_id: regra.setor_id || null,
    p_preceptor_id: regra.preceptor_id || null,
    p_data_inicio: regra.data_inicio,
    p_data_fim: regra.data_fim || null
  });

  if (error) throw error;
  return data;
}

export async function salvarRegraFinanceira(regraData, componentes) {
  const today = new Date().toISOString().split('T')[0];
  const dataInicio = regraData.data_inicio || today;

  // Verificar se a regra já foi utilizada em cálculos fechados/apuração
  let jaUtilizadaEmCalculo = false;
  if (regraData.id) {
    try {
      const { count } = await supabase
        .from('calculo_itens')
        .select('*', { count: 'exact', head: true })
        .eq('regra_id', regraData.id);
      if (count && count > 0) {
        jaUtilizadaEmCalculo = true;
      }
    } catch (e) {
      console.warn('[salvarRegraFinanceira] Erro ao checar calculo_itens:', e);
    }
  }

  const payloadRegra = {
    nome: regraData.nome,
    tipo_atuacao: regraData.tipo_atuacao || 'adm',
    unidade_id: regraData.unidade_id || null,
    internato_id: regraData.tipo_atuacao === 'internato' ? (regraData.internato_id || null) : null,
    disciplina_id: regraData.disciplina_id || null,
    local_id: regraData.local_id || null,
    setor_id: regraData.setor_id || null,
    preceptor_id: regraData.preceptor_id || null,
    data_inicio: jaUtilizadaEmCalculo ? today : dataInicio,
    data_fim: regraData.data_fim || null,
    status: regraData.status || 'ativo',
    observacoes: regraData.observacoes || null
  };

  if (regraData.status !== 'inativo') {
    const resConflito = await checarConflitoRegraFinanceira({
      ...payloadRegra,
      id: jaUtilizadaEmCalculo ? null : regraData.id
    });
    if (resConflito && resConflito.conflito) {
      const nomes = (resConflito.regras || []).map(r => `"${r.nome}"`).join(', ');
      throw new Error(`Conflito de vigência detectado com regra(s) ativa(s): ${nomes}.`);
    }
  }

  let regraSalva;
  if (regraData.id && !jaUtilizadaEmCalculo) {
    // Atualização normal da mesma versão (ainda não usada em cálculos)
    const { data, error } = await supabase
      .from('regras_financeiras')
      .update(payloadRegra)
      .eq('id', regraData.id)
      .select()
      .single();
    if (error) throw error;
    regraSalva = data;

    // Sincronizar componentes
    const idsMantidos = componentes.filter(c => c.id).map(c => c.id);
    if (idsMantidos.length > 0) {
      await supabase
        .from('regra_componentes')
        .delete()
        .eq('regra_id', regraSalva.id)
        .not('id', 'in', `(${idsMantidos.map(id => `"${id}"`).join(',')})`);
    } else {
      await supabase
        .from('regra_componentes')
        .delete()
        .eq('regra_id', regraSalva.id);
    }
  } else {
    // Se a regra antiga já foi usada em cálculo, inativa a anterior para preservar o histórico imutável
    if (jaUtilizadaEmCalculo && regraData.id) {
      await supabase
        .from('regras_financeiras')
        .update({ status: 'inativo', data_fim: today })
        .eq('id', regraData.id);
    }

    // Inserção da nova regra / nova versão
    const { data, error } = await supabase
      .from('regras_financeiras')
      .insert(payloadRegra)
      .select()
      .single();
    if (error) throw error;
    regraSalva = data;
  }

  // Gravar componentes
  const TIPOS_COM_CONDICAO = ['fixo_mensal','adicional_fixo','parcela_total','valor_dividido','por_turno_mais_fixo'];
  for (let i = 0; i < componentes.length; i++) {
    const comp = componentes[i];
    const temCondicao = TIPOS_COM_CONDICAO.includes(comp.tipo);
    const condicaoAtiva = temCondicao && comp.exige_presenca !== false;
    const compPayload = {
      regra_id: regraSalva.id,
      descricao: comp.descricao,
      tipo: comp.tipo,
      valor: comp.valor != null && comp.valor !== '' ? parseFloat(comp.valor) : null,
      valor_extra: comp.valor_extra != null && comp.valor_extra !== '' ? parseFloat(comp.valor_extra) : null,
      ordem: i + 1,
      exige_presenca: comp.exige_presenca !== false,
      quantidade_minima: condicaoAtiva && comp.quantidade_minima != null && String(comp.quantidade_minima).trim() !== '' ? parseFloat(comp.quantidade_minima) : null,
      contagem_tipo: comp.contagem_tipo || 'turnos',
      status: comp.status || 'ativo'
    };

    if (comp.id && !jaUtilizadaEmCalculo) {
      const { error } = await supabase
        .from('regra_componentes')
        .update(compPayload)
        .eq('id', comp.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('regra_componentes')
        .insert(compPayload);
      if (error) throw error;
    }
  }

  return regraSalva;
}

export async function inativarRegraFinanceira(id) {
  const { data, error } = await supabase
    .from('regras_financeiras')
    .update({ status: 'inativo' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function reativarRegraFinanceira(regra) {
  const resConflito = await checarConflitoRegraFinanceira({ ...regra, status: 'ativo' });
  if (resConflito && resConflito.conflito) {
    const nomes = (resConflito.regras || []).map(r => `"${r.nome}"`).join(', ');
    throw new Error(`Não é possível reativar. Conflito com regra(s) ativa(s): ${nomes}.`);
  }

  const { data, error } = await supabase
    .from('regras_financeiras')
    .update({ status: 'ativo' })
    .eq('id', regra.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function formatInitialValueBRL(val) {
  if (val == null || val === '') return '';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num)) return '';
  const cents = Math.round(num * 100);
  const reais = Math.floor(cents / 100);
  const centavos = Math.abs(cents % 100);
  return 'R$ ' + reais.toLocaleString('pt-BR') + ',' + String(centavos).padStart(2, '0');
}

// ── Regra financeira aplicável ao vínculo ──
export async function fetchRegrasFinanceirasAtivas(tipoAtuacao) {
  const { data, error } = await supabase
    .from('regras_financeiras')
    .select(`
      *,
      unidade:unidades(id, nome),
      internato:internatos(id, nome, numero),
      disciplina:disciplinas(id, nome),
      local:locais(id, nome),
      setor:setores(id, nome),
      preceptor:preceptores!regras_financeiras_preceptor_id_fkey(id, nome_completo),
      componentes:regra_componentes(id, descricao, tipo, valor, valor_extra, quantidade_minima, exige_presenca, status)
    `)
    .eq('status', 'ativo')
    .eq('tipo_atuacao', tipoAtuacao)
    .order('nome');
  if (error) throw error;
  return data || [];
}

// Associa a regra ao vínculo específico. Trocar/remover encerra a associação
// anterior (histórico preservado) e exige justificativa.
export async function salvarVinculoRegraFinanceira({ vinculo_adm_id, vinculo_internato_id, regra_id, justificativa }) {
  const today = new Date().toISOString().split('T')[0];
  const base = vinculo_adm_id ? { vinculo_adm_id } : { vinculo_internato_id };

  const { data: ativa, error: errAtiva } = await supabase
    .from('vinculo_regras_financeiras')
    .select('id')
    .eq('status', 'ativo')
    .match(base);
  if (errAtiva) throw errAtiva;

  if (ativa && ativa.length > 0 && !regra_id) {
    if (!justificativa) throw new Error('Justificativa obrigatória para remover a regra financeira.');
  }
  if (ativa && ativa.length > 0) {
    const { error } = await supabase
      .from('vinculo_regras_financeiras')
      .update({ status: 'inativo', data_fim: today, encerrado_justificativa: justificativa || null })
      .eq('status', 'ativo')
      .match(base);
    if (error) throw error;
  }

  if (!regra_id) return null;

  const { data, error } = await supabase
    .from('vinculo_regras_financeiras')
    .insert({ ...base, regra_id, status: 'ativo', data_inicio: today, justificativa: justificativa || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}


// ── Apuração Mensal ──

export async function fetchCompetencias(cursoId) {
  let q = supabase.from('competencias').select('*').order('ano', { ascending: false }).order('mes', { ascending: false });
  if (cursoId) q = q.eq('curso_id', cursoId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function criarCompetencia(ano, mes, cursoId) {
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${ultimoDia}`;
  const { data, error } = await supabase.from('competencias').insert({
    curso_id: cursoId, ano, mes, data_inicio: dataInicio, data_fim: dataFim, status: 'aberta'
  }).select().single();
  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabase.from('competencias').select('*').eq('curso_id', cursoId).eq('ano', ano).eq('mes', mes).single();
      return existing;
    }
    throw error;
  }
  return data;
}

export async function calcularCompetencia(competenciaId) {
  const { data: comp, error: compErr } = await supabase.from('competencias').select('*').eq('id', competenciaId).single();
  if (compErr || !comp) throw new Error('Competência não encontrada.');

  const { data: presencas, error: presErr } = await supabase
    .from('presencas')
    .select('*')
    .eq('status', 'confirmada')
    .gte('data_presenca', comp.data_inicio)
    .lte('data_presenca', comp.data_fim);
  if (presErr) throw presErr;
  if (!presencas || presencas.length === 0) throw new Error('Nenhuma presença confirmada neste período.');

  const grupos = {};
  presencas.forEach(p => {
    const key = `${p.preceptor_id}_${p.tipo_atuacao}`;
    if (!grupos[key]) grupos[key] = { preceptor_id: p.preceptor_id, tipo_atuacao: p.tipo_atuacao, presencas: [] };
    grupos[key].presencas.push(p);
  });

  const resultados = [];

  for (const key of Object.keys(grupos)) {
    const g = grupos[key];
    let vinculoId = null;
    let vinculoTable = null;

    if (g.tipo_atuacao === 'adm') {
      const { data: vinc } = await supabase.from('vinculos_adm').select('id').eq('preceptor_id', g.preceptor_id).eq('status', 'ativo').limit(1).maybeSingle();
      if (vinc) { vinculoId = vinc.id; vinculoTable = 'vinculo_adm_id'; }
    } else {
      const { data: vinc } = await supabase.from('vinculos_internato').select('id').eq('preceptor_id', g.preceptor_id).eq('status', 'ativo').limit(1).maybeSingle();
      if (vinc) { vinculoId = vinc.id; vinculoTable = 'vinculo_internato_id'; }
    }

    if (!vinculoId) {
      resultados.push({ preceptor_id: g.preceptor_id, tipo_atuacao: g.tipo_atuacao, situacao: 'Sem regra financeira', valor_calculado: 0, presencas_count: g.presencas.length, itens: [] });
      continue;
    }

    const { data: vincRegra } = await supabase.from('vinculo_regras_financeiras').select('regra_id').eq(vinculoTable, vinculoId).eq('status', 'ativo').limit(1).maybeSingle();
    if (!vincRegra) {
      resultados.push({ preceptor_id: g.preceptor_id, tipo_atuacao: g.tipo_atuacao, situacao: 'Sem regra financeira', valor_calculado: 0, presencas_count: g.presencas.length, itens: [] });
      continue;
    }

    const { data: regra } = await supabase.from('regras_financeiras').select('*').eq('id', vincRegra.regra_id).eq('status', 'ativo').maybeSingle();
    if (!regra) {
      resultados.push({ preceptor_id: g.preceptor_id, tipo_atuacao: g.tipo_atuacao, situacao: 'Sem regra financeira', valor_calculado: 0, presencas_count: g.presencas.length, itens: [] });
      continue;
    }

    const { data: componentes } = await supabase.from('regra_componentes').select('*').eq('regra_id', regra.id).eq('status', 'ativo').order('ordem');
    if (!componentes || componentes.length === 0) {
      resultados.push({ preceptor_id: g.preceptor_id, tipo_atuacao: g.tipo_atuacao, situacao: 'Regra requer configuração', valor_calculado: 0, presencas_count: g.presencas.length, regra, itens: [] });
      continue;
    }

    const itens = [];
    let totalBruto = 0;
    let situacao = 'Calculado';

    for (const c of componentes) {
      let qtd = 0;
      let vlrUnit = Number(c.valor) || 0;
      let vlrTotal = 0;
      let descricao = c.descricao;
      let regraOk = true;

      switch (c.tipo) {
        case 'por_turno': {
          qtd = g.presencas.length;
          vlrTotal = qtd * vlrUnit;
          break;
        }
        case 'fixo_mensal': {
          qtd = g.presencas.length;
          if (c.exige_presenca && c.quantidade_minima && qtd < Number(c.quantidade_minima)) {
            regraOk = false;
            vlrTotal = 0;
            descricao += ` (mín. ${c.quantidade_minima} — não atingido)`;
          } else {
            qtd = 1;
            vlrTotal = vlrUnit;
          }
          break;
        }
        case 'por_ocorrencia': {
          qtd = g.presencas.length;
          vlrTotal = qtd * vlrUnit;
          break;
        }
        case 'adicional_fixo': {
          // A presença pode liberar o adicional, mas nunca multiplica o valor fixo.
          const quantidadePresencas = g.presencas.length;
          if (c.exige_presenca && quantidadePresencas === 0) {
            regraOk = false;
            qtd = 0;
            vlrTotal = 0;
            descricao += ' (sem presença para liberação)';
          } else if (c.exige_presenca && c.quantidade_minima && quantidadePresencas < Number(c.quantidade_minima)) {
            regraOk = false;
            qtd = 0;
            vlrTotal = 0;
            descricao += ` (mín. ${c.quantidade_minima} — não atingido)`;
          } else {
            qtd = 1;
            vlrTotal = vlrUnit;
          }
          break;
        }
        case 'por_turno_mais_fixo': {
          const qtdTurnos = g.presencas.length;
          const vlrTurnos = qtdTurnos * vlrUnit;
          let vlrFixo = 0;
          if (c.valor_extra) {
            if (c.exige_presenca && c.quantidade_minima && qtdTurnos < Number(c.quantidade_minima)) {
              vlrFixo = 0;
            } else {
              vlrFixo = Number(c.valor_extra);
            }
          }
          qtd = qtdTurnos;
          vlrTotal = vlrTurnos + vlrFixo;
          descricao = c.descricao;
          break;
        }
        case 'sem_pagamento': {
          qtd = 0;
          vlrTotal = 0;
          descricao = c.descricao + ' (sem pagamento)';
          break;
        }
        case 'valor_dividido':
        case 'parcela_total': {
          qtd = 0;
          vlrTotal = 0;
          regraOk = false;
          situacao = 'Regra requer configuração';
          descricao = c.descricao + ' (tipo não suportado nesta etapa)';
          break;
        }
        default: {
          qtd = 0;
          vlrTotal = 0;
          regraOk = false;
          situacao = 'Regra requer configuração';
          descricao = c.descricao + ' (tipo desconhecido)';
        }
      }

      totalBruto += vlrTotal;
      itens.push({
        tipo: c.tipo,
        regra_id: regra.id,
        descricao,
        quantidade: qtd,
        valor_unitario: vlrUnit,
        valor_total: vlrTotal,
        referencia: {
          componente_id: c.id,
          componente_descricao: c.descricao,
          componente_tipo: c.tipo,
          competencia: `${comp.ano || ''}/${String(comp.mes || '').padStart(2, '0')}`.trim(),
          presencas_ids: g.presencas.map(p => p.id),
          regra_nome: regra.nome,
          regra_tipo_atuacao: regra.tipo_atuacao
        }
      });
    }

    if (situacao === 'Calculado' && totalBruto === 0 && componentes.some(c => c.tipo === 'sem_pagamento')) {
      situacao = 'Calculado';
    }

    resultados.push({
      preceptor_id: g.preceptor_id,
      tipo_atuacao: g.tipo_atuacao,
      situacao,
      valor_calculado: totalBruto,
      presencas_count: g.presencas.length,
      regra,
      vinculo_id: vinculoId,
      vinculo_table: vinculoTable,
      itens
    });
  }

  for (const r of resultados) {
    const { data: existing } = await supabase.from('calculos').select('id, versao').eq('competencia_id', competenciaId).eq('preceptor_id', r.preceptor_id).order('versao', { ascending: false }).limit(1).maybeSingle();

    let calcId;
    let versao = 1;

    if (existing) {
      calcId = existing.id;
      versao = existing.versao + 1;
      await supabase.from('calculo_itens').delete().eq('calculo_id', calcId);
      await supabase.from('calculos').update({
        modalidade: r.tipo_atuacao,
        total_bruto: r.valor_calculado,
        total_descontos: 0,
        total_liquido: r.valor_calculado,
        status: r.situacao === 'Calculado' ? 'calculado' : 'rascunho',
        versao,
        calculado_em: new Date().toISOString(),
        observacoes: r.situacao
      }).eq('id', calcId);
    } else {
      const { data: newCalc } = await supabase.from('calculos').insert({
        competencia_id: competenciaId,
        preceptor_id: r.preceptor_id,
        modalidade: r.tipo_atuacao,
        total_bruto: r.valor_calculado,
        total_descontos: 0,
        total_liquido: r.valor_calculado,
        status: r.situacao === 'Calculado' ? 'calculado' : 'rascunho',
        calculado_em: new Date().toISOString()
      }).select('id').single();
      calcId = newCalc.id;
    }

    if (r.itens.length > 0) {
      const TIPOS_FIXOS = new Set(['fixo_mensal', 'adicional_fixo']);
      const itensInsert = r.itens.map(it => {
        const quantidade = TIPOS_FIXOS.has(it.tipo) ? 1 : it.quantidade;
        return {
          calculo_id: calcId,
          tipo: it.tipo,
          regra_id: it.regra_id,
          descricao: it.descricao,
          quantidade,
          valor_unitario: it.valor_unitario,
          referencia: {
            ...(it.referencia || {}),
            criterio_quantidade: TIPOS_FIXOS.has(it.tipo) ? 'uma_vez_por_competencia' : 'quantidade_apurada'
          }
        };
      });
      await supabase.from('calculo_itens').insert(itensInsert);
    }
  }

  return resultados;
}

export async function fetchApuracoes(competenciaId, filtros = {}) {
  let q = supabase
    .from('calculos')
    .select(`
      id, competencia_id, preceptor_id, modalidade, status, total_bruto, total_descontos, total_liquido, versao, calculado_em, observacoes,
      preceptor:preceptores!calculos_preceptor_id_fkey(id, nome_completo, cpf)
    `)
    .eq('competencia_id', competenciaId)
    .order('created_at', { ascending: true });

  const { data, error } = await q;
  if (error) throw error;

  let results = (data || []).map(c => ({
    ...c,
    preceptor_nome: c.preceptor?.nome_completo || '-',
    preceptor_cpf: c.preceptor?.cpf || null
  }));

  if (filtros.search) {
    const s = filtros.search.toLowerCase();
    results = results.filter(r => r.preceptor_nome.toLowerCase().includes(s));
  }
  if (filtros.modalidade) {
    results = results.filter(r => r.modalidade === filtros.modalidade);
  }
  if (filtros.situacao) {
    results = results.filter(r => r.status === filtros.situacao);
  }

  return results;
}

export async function fetchDetalhesCalculo(calculoId) {
  const { data: calc, error: calcErr } = await supabase
    .from('calculos')
    .select(`
      id, competencia_id, preceptor_id, modalidade, status, total_bruto, total_descontos, total_liquido, versao, calculado_em, observacoes,
      preceptor:preceptores!calculos_preceptor_id_fkey(id, nome_completo, cpf),
      competencia:competencias(ano, mes, data_inicio, data_fim, status)
    `)
    .eq('id', calculoId)
    .single();
  if (calcErr || !calc) throw new Error('Cálculo não encontrado.');
  const atuacao = calc.modalidade || (calc.vinculo_internato_id ? 'internato' : calc.vinculo_adm_id ? 'adm' : null);
  if (!atuacao) throw new Error('Não foi possível identificar a modalidade deste cálculo.');
  calc.modalidade = atuacao;

  const { data: itens, error: itensErr } = await supabase
    .from('calculo_itens')
    .select('*')
    .eq('calculo_id', calculoId)
    .order('created_at');
  if (itensErr) throw itensErr;

  return { calculo: calc, itens: itens || [] };
}

export async function fetchResumoApuracao(competenciaId) {
  const { data } = await supabase
    .from('calculos')
    .select('id, modalidade, status, total_liquido, observacoes')
    .eq('competencia_id', competenciaId);

  const total = (data || []).length;
  const turnos = (data || []).reduce((acc, c) => acc + (c.total_bruto > 0 ? 1 : 0), 0);
  const valorTotal = (data || []).reduce((acc, c) => acc + Number(c.total_liquido || 0), 0);
  const pendencias = (data || []).filter(c => c.status === 'rascunho' || c.observacoes !== 'Calculado').length;

  return { preceptores: total, turnos, valorTotal, pendencias };
}

// ── Fila Financeira Automática ──

async function normalizarComponentesFixos(mes, ano) {
  if (!mes || !ano) return;
  const { data: competencias, error: compErr } = await supabase
    .from('competencias').select('id').eq('mes', Number(mes)).eq('ano', Number(ano));
  if (compErr) throw compErr;
  const competenciaIds = (competencias || []).map(c => c.id);
  if (!competenciaIds.length) return;

  const { data: calculos, error: calcErr } = await supabase
    .from('calculos').select('id').in('competencia_id', competenciaIds);
  if (calcErr) throw calcErr;

  for (const calculo of calculos || []) {
    const { data: itens, error: itensErr } = await supabase
      .from('calculo_itens').select('id, tipo, descricao, quantidade, valor_unitario, valor_total, referencia').eq('calculo_id', calculo.id);
    if (itensErr) throw itensErr;

    for (const item of itens || []) {
      const componenteTipo = item.referencia?.componente_tipo;
      const descricao = String(item.descricao || '').toLocaleLowerCase('pt-BR');
      const fixo = ['fixo_mensal','adicional_fixo'].includes(componenteTipo)
        || ['fixo','adicional'].includes(item.tipo)
        || descricao.includes('adicional fixo');
      if (fixo && Number(item.quantidade) !== 1) {
        const { error } = await supabase.from('calculo_itens').update({ quantidade: 1 }).eq('id', item.id);
        if (error) throw error;
      }
    }

    const { data: itensAtualizados, error: somaErr } = await supabase
      .from('calculo_itens').select('valor_total').eq('calculo_id', calculo.id);
    if (somaErr) throw somaErr;
    const totalBruto = (itensAtualizados || []).reduce((acc, item) => acc + Number(item.valor_total || 0), 0);
    const { error: totalErr } = await supabase.from('calculos').update({ total_bruto: totalBruto }).eq('id', calculo.id);
    if (totalErr) throw totalErr;
  }
}

export async function autoApurarFilaFinanceira(mes, ano) {
  const params = {};
  if (mes != null) params.p_mes = Number(mes);
  if (ano != null) params.p_ano = Number(ano);
  const { data, error } = await supabase.rpc('auto_apurar_competencia_financeira', params);
  if (error) throw error;
  await normalizarComponentesFixos(mes, ano);
  return data || [];
}

export async function buscarFilaFinanceira(filtros = {}) {
  const params = {};
  if (filtros.mes != null) params.p_mes = filtros.mes;
  if (filtros.ano != null) params.p_ano = filtros.ano;
  if (filtros.modalidade) params.p_modalidade = filtros.modalidade;
  if (filtros.situacao) params.p_situacao = filtros.situacao;
  if (filtros.search) params.p_search = filtros.search;
  const { data, error } = await supabase.rpc('buscar_fila_financeira', params);
  if (error) throw error;
  return data || [];
}

export async function atualizarChamado(calculoId, { chamadoNumero, chamadoStatus, chamadoObservacao }) {
  const { data, error } = await supabase.rpc('atualizar_chamado', {
    p_calculo_id: calculoId,
    p_chamado_numero: chamadoNumero || null,
    p_chamado_status: chamadoStatus || null,
    p_chamado_observacao: chamadoObservacao || null
  });
  if (error) throw error;
  return data;
}

export async function fetchDetalhesCalculoCompleto(calculoId) {
  const { data: calc, error: calcErr } = await supabase
    .from('calculos')
    .select(`
      id, competencia_id, preceptor_id, tipo_atuacao, modalidade, status,
      total_bruto, total_descontos, total_liquido, versao, calculado_em, observacoes,
      quantidade_presencas, vinculo_adm_id, vinculo_internato_id,
      chamado_numero, chamado_status, chamado_observacao, chamado_updated_at,
      preceptor:preceptores!calculos_preceptor_id_fkey(id, nome_completo, cpf),
      competencia:competencias(ano, mes, data_inicio, data_fim, status)
    `)
    .eq('id', calculoId)
    .single();
  if (calcErr || !calc) throw new Error('Cálculo não encontrado.');

  const { data: itens, error: itensErr } = await supabase
    .from('calculo_itens')
    .select('*')
    .eq('calculo_id', calculoId)
    .order('created_at');
  if (itensErr) throw itensErr;

  // Derivar atuação por vínculo: vinculo_internato_id = internato, vinculo_adm_id = adm
  const tipoAtuacao = calc.tipo_atuacao
    || (calc.vinculo_internato_id ? 'internato' : calc.vinculo_adm_id ? 'adm' : null);

  let vinculoContexto = null;
  if (tipoAtuacao === 'adm' && calc.vinculo_adm_id) {
    const { data: vinc } = await supabase
      .from('vinculos_adm')
      .select('id, unidade:unidades(id, nome), disciplina:disciplinas(id, nome), local:locais(id, nome), setor:setores(id, nome)')
      .eq('id', calc.vinculo_adm_id)
      .single();
    vinculoContexto = vinc;
  } else if (tipoAtuacao === 'internato' && calc.vinculo_internato_id) {
    const { data: vinc } = await supabase
      .from('vinculos_internato')
      .select('id, unidade:unidades(id, nome), internato:internatos(id, nome), local:locais(id, nome), setor:setores(id, nome)')
      .eq('id', calc.vinculo_internato_id)
      .single();
    vinculoContexto = vinc;
  }

  // Presenças: prioriza presenca_id dos itens; fallback por preceptor+vinculo+competencia
  let presencas = [];
  const presencaIds = [...new Set((itens || []).map(i => i.presenca_id).filter(Boolean))];

  if (presencaIds.length > 0) {
    const { data: pres, error: presErr } = await supabase
      .from('presencas')
      .select('id, data_presenca, turno, status, local:locais(id, nome), setor:setores(id, nome)')
      .in('id', presencaIds)
      .order('data_presenca', { ascending: true })
      .order('turno', { ascending: true });
    if (presErr) throw presErr;
    presencas = pres || [];
  }

  if (presencas.length === 0 && calc.competencia) {
    const comp = calc.competencia;
    const dataInicio = `${comp.ano}-${String(comp.mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(comp.ano, comp.mes, 0).getDate();
    const dataFim = `${comp.ano}-${String(comp.mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    let presenceQuery = supabase
      .from('presencas')
      .select('id, data_presenca, turno, status, vinculo_adm_id, vinculo_internato_id, local:locais(id, nome), setor:setores(id, nome)')
      .eq('preceptor_id', calc.preceptor_id)
      .neq('status', 'cancelada')
      .gte('data_presenca', dataInicio)
      .lte('data_presenca', dataFim)
      .order('data_presenca', { ascending: true })
      .order('turno', { ascending: true });

    if (tipoAtuacao) {
      presenceQuery = presenceQuery.eq('tipo_atuacao', tipoAtuacao);
    }
    if (tipoAtuacao === 'adm' && calc.vinculo_adm_id) {
      presenceQuery = presenceQuery.eq('vinculo_adm_id', calc.vinculo_adm_id);
    } else if (tipoAtuacao === 'internato' && calc.vinculo_internato_id) {
      presenceQuery = presenceQuery.eq('vinculo_internato_id', calc.vinculo_internato_id);
    }

    const { data: pres, error: presErr } = await presenceQuery;
    if (presErr) throw presErr;
    presencas = pres || [];
  }

  let regra = null;
  if (tipoAtuacao === 'adm' && calc.vinculo_adm_id) {
    const { data: vr } = await supabase
      .from('vinculo_regras_financeiras')
      .select('regra:regras_financeiras(id, nome, tipo_atuacao, componentes:regra_componentes(*))')
      .eq('vinculo_adm_id', calc.vinculo_adm_id)
      .eq('status', 'ativo')
      .limit(1)
      .maybeSingle();
    regra = vr?.regra || null;
  } else if (tipoAtuacao === 'internato' && calc.vinculo_internato_id) {
    const { data: vr } = await supabase
      .from('vinculo_regras_financeiras')
      .select('regra:regras_financeiras(id, nome, tipo_atuacao, componentes:regra_componentes(*))')
      .eq('vinculo_internato_id', calc.vinculo_internato_id)
      .eq('status', 'ativo')
      .limit(1)
      .maybeSingle();
    regra = vr?.regra || null;
  }

  return {
    calculo: { ...calc, tipo_atuacao: tipoAtuacao },
    itens: itens || [],
    presencas,
    vinculoContexto,
    regra
  };
}

export function apuracaoMesLabel(mes, ano) {
  if (!mes || !ano) return '-';
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${MESES[mes - 1] || mes}/${ano}`;
}

export const CHAMADO_STATUS_OPTIONS = [
  { value: 'nao_aberto', label: 'Não aberto' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'deferido', label: 'Deferido' },
  { value: 'indeferido', label: 'Indeferido' },
  { value: 'concluido', label: 'Concluído' }
];


// ── Validações financeiras ──
export async function fetchValidacoesFinanceiras({ mes, ano, status, search } = {}) {
  let query = supabase.from('calculos').select(`
    id, competencia_id, preceptor_id, modalidade, status, total_bruto, total_descontos, total_liquido, versao, calculado_em, observacoes,
    preceptor:preceptores!calculos_preceptor_id_fkey(id, nome_completo),
    competencia:competencias(id, ano, mes, data_inicio, data_fim, status),
    aprovacoes:aprovacoes(id, tipo, ordem, status, decidido_em, comentario, decidido_por)
  `).order('calculado_em', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  let rows = (data || []).map(c => {
    const aprovacao = (c.aprovacoes || []).filter(a => a.tipo === 'financeira').sort((a,b)=>(b.ordem||0)-(a.ordem||0))[0] || null;
    return { ...c, aprovacao, validacao_status: aprovacao?.status || 'pendente' };
  });
  if (mes) rows = rows.filter(r => Number(r.competencia?.mes) === Number(mes));
  if (ano) rows = rows.filter(r => Number(r.competencia?.ano) === Number(ano));
  if (status) rows = rows.filter(r => r.validacao_status === status);
  if (search) { const term=search.toLocaleLowerCase('pt-BR'); rows=rows.filter(r=>(r.preceptor?.nome_completo||'').toLocaleLowerCase('pt-BR').includes(term)); }
  return rows;
}

export async function salvarValidacaoFinanceira(calculoId, decisao, comentario, authUserId) {
  if (!['aprovado','rejeitado'].includes(decisao)) throw new Error('Decisão financeira inválida.');
  let profileId = null;
  if (authUserId) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', authUserId).maybeSingle();
    profileId = profile?.id || null;
  }
  const { data: atual, error: atualErr } = await supabase.from('aprovacoes')
    .select('id').eq('calculo_id', calculoId).eq('tipo', 'financeira').order('ordem', { ascending: false }).limit(1).maybeSingle();
  if (atualErr) throw atualErr;
  const payload = { status: decisao, decidido_por: profileId, decidido_em: new Date().toISOString(), comentario: comentario?.trim() || null };
  if (atual?.id) {
    const { data, error } = await supabase.from('aprovacoes').update(payload).eq('id', atual.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('aprovacoes').insert({ calculo_id: calculoId, tipo: 'financeira', ordem: 1, ...payload }).select().single();
  if (error) throw error;
  return data;
}

// Correção administrativa auditável. Requer a RPC descrita no prompt de banco entregue com este pacote.
export async function corrigirPresencaAdministrativa({ presencaId, novaData, novoTurno, justificativa }) {
  const { data, error } = await supabase.rpc('corrigir_presenca_administrativa', {
    p_presenca_id: presencaId,
    p_nova_data: novaData,
    p_novo_turno: novoTurno,
    p_justificativa: justificativa
  });
  if (error) throw error;
  if (data && data.sucesso === false) throw new Error(data.erro || 'Não foi possível corrigir a presença.');
  return data;
}

// Painel de pagamentos. Usa a fila financeira existente e enriquece com e-mail do cadastro.
export async function fetchPainelPagamentos({ incluirTodos = false } = {}) {
  const rows = await buscarFilaFinanceira({});
  const ids = [...new Set((rows || []).map(r => r.preceptor_id).filter(Boolean))];
  let cadastroMap = {};
  if (ids.length) {
    const { data, error } = await supabase.from('preceptores').select('id,email,profile_id,valor_inicial').in('id', ids);
    if (error) throw new Error('Não foi possível consultar o cadastro dos preceptores: ' + error.message);
    const profilesIds = [...new Set((data || []).map(p => p.profile_id).filter(Boolean))];
    let profileEmails = {};
    if (profilesIds.length) {
      const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,email').in('id', profilesIds);
      if (profileError) throw new Error('Não foi possível consultar os e-mails dos perfis: ' + profileError.message);
      profileEmails = Object.fromEntries((profiles || []).map(p => [p.id, p.email || '']));
    }
    cadastroMap = Object.fromEntries((data || []).map(p => [p.id, { email: p.email || profileEmails[p.profile_id] || '', saldo: Number(p.valor_inicial || 0) }]));
  }
  return (rows || [])
    .filter(r => r.tipo_atuacao === 'internato')
    .map(r => ({...r, preceptor_email: cadastroMap[r.preceptor_id]?.email || '', saldo_semestral: cadastroMap[r.preceptor_id]?.saldo || 0, situacao_nota: r.situacao_nota || 'nao_solicitada'}));
}

export async function registrarSolicitacaoNota(calculoId, situacao = 'preparada') {
  const { data, error } = await supabase.rpc('registrar_solicitacao_nota_fiscal', { p_calculo_id: calculoId, p_situacao: situacao });
  if (error) throw error;
  return data;
}
