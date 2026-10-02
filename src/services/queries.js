import { supabase } from '../supabase.js';

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

export async function fetchVinculosInternatoPorPreceptor(preceptorId) {
  if (!preceptorId) return [];
  const { data, error } = await supabase
    .from('vinculos_internato')
    .select(`
      *,
      preceptor:preceptores!vinculos_internato_preceptor_id_fkey(id, status, nome_completo, unidade_id, profissao_id),
      semestre:semestres(codigo, data_inicio, data_fim),
      internato:internatos(nome, numero),
      periodo:periodos(numero, nome),
      local:locais(id, nome),
      setor:setores(id, nome),
      unidade:unidades(id, nome),
      modalidade_ref:modalidades_pagamento(id, nome),
      vinculo_regras:vinculo_regras_financeiras(
        id, regra_id, status, data_inicio, data_fim, justificativa, encerrado_justificativa, created_at,
        regra:regras_financeiras(
          id, nome, tipo_atuacao, forma_calculo, status,
          componentes:regra_componentes(id, descricao, tipo, valor, valor_extra, quantidade_minima, exige_presenca, status)
        )
      ),
      coordenadores:vinculo_coordenadores!vinculo_coordenadores_vinculo_internato_id_fkey(
        id, profile_id, status,
        profiles!vinculo_coordenadores_profile_id_fkey(id, nome_completo, email)
      )
    `)
    .eq('preceptor_id', preceptorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(v => {
    const coordenadoresAtivos = (v.coordenadores || [])
      .filter(c => c.status === 'ativo')
      .map(c => ({ profile_id: c.profile_id, nome_completo: c.profiles?.nome_completo, email: c.profiles?.email }));
    const vComCoordenadores = { ...v, coordenadores: coordenadoresAtivos };
    const camposFaltantes = getVinculoCamposFaltantes(vComCoordenadores, 'internato');
    const completo = camposFaltantes.length === 0;
    return {
      ...vComCoordenadores,
      vinculo_completo: completo,
      vinculo_campos_faltantes: completo ? [] : camposFaltantes,
      regraAtiva: getRegraAtiva(v)
    };
  });
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
    valor_inicial: v.valor_inicial ?? null,
    vinculo_adm: v,
    vinculo_status: v.status || "-",
    vinculo_completo: completo,
    vinculo_campos_faltantes: camposFaltantes,
    regraAtiva: getRegraAtiva(v)
  };
}

function mapVinculoCompleto(v) {
  const completo = isVinculoCompleto(v, 'internato');
  const camposFaltantes = completo ? [] : getVinculoCamposFaltantes(v, 'internato');
  const coordenadoresAtivos = (v.coordenadores || [])
    .filter(c => c.status === 'ativo')
    .map(c => ({ profile_id: c.profile_id, nome_completo: c.profiles?.nome_completo, email: c.profiles?.email }));
  return {
    ...v,
    coordenadores: coordenadoresAtivos,
    vinculo_completo: completo,
    vinculo_campos_faltantes: camposFaltantes,
    regraAtiva: getRegraAtiva(v)
  };
}

function mapPreceptorInternatoFromGroup(preceptorRef, vinculos) {
  const mappedVinculos = vinculos.map(mapVinculoCompleto);
  const vinculosCompletos = mappedVinculos.filter(v => v.vinculo_completo).length;
  const vinculosTotal = mappedVinculos.length;
  const todosInativos = mappedVinculos.every(v => v.status !== 'ativo');
  const regraAtiva = mappedVinculos.find(v => v.regraAtiva)?.regraAtiva || null;
  const dadosGeraisCompletos = isDadosGeraisCompleto(preceptorRef, preceptorRef?.modalidade_ref?.nome);
  return {
    ...preceptorRef,
    unidade: preceptorRef?.unidade?.nome || "-",
    profissao: preceptorRef?.profissao_ref?.nome || "-",
    modalidade: preceptorRef?.modalidade_ref?.nome || "-",
    valor_inicial: mappedVinculos.reduce((sum, v) => sum + Number(v.valor_inicial || 0), 0) || null,
    vinculos_internato: mappedVinculos,
    vinculos_quantidade: vinculosTotal,
    vinculos_completos: vinculosCompletos,
    vinculo_internato: mappedVinculos[0] || null,
    vinculo_status: todosInativos ? "inativo" : (mappedVinculos[0]?.status || "-"),
    vinculo_completo: vinculosCompletos === vinculosTotal && vinculosTotal > 0,
    vinculo_campos_faltantes: vinculosCompletos < vinculosTotal
      ? mappedVinculos.filter(v => !v.vinculo_completo).reduce((acc, v) => {
          v.vinculo_campos_faltantes.forEach(c => { if (!acc.includes(c)) acc.push(c); });
          return acc;
        }, [])
      : [],
    dadosGeraisCompletos,
    regraAtiva,
    modalidade_pagamento_id: preceptorRef?.modalidade_pagamento_id || null,
    cnpj: preceptorRef?.cnpj || null,
    razao_social: preceptorRef?.razao_social || null
  };
}

function mapPreceptorInternato(v) {
  const completo = isVinculoCompleto(v, 'internato');
  const camposFaltantes = completo ? [] : getVinculoCamposFaltantes(v, 'internato');
  const coordenadoresAtivos = (v.coordenadores || [])
    .filter(c => c.status === 'ativo')
    .map(c => ({ profile_id: c.profile_id, nome_completo: c.profiles?.nome_completo, email: c.profiles?.email }));
  return {
    ...v.preceptor,
    unidade: v.preceptor?.unidade?.nome || "-",
    profissao: v.preceptor?.profissao_ref?.nome || "-",
    modalidade: v.preceptor?.modalidade_ref?.nome || "-",
    internato: v.internato?.nome || "-",
    periodo: v.periodo?.numero ? `${v.periodo.numero}º período` : "Não informado",
    local: v.local?.nome || "-",
    valor_inicial: v.valor_inicial ?? null,
    vinculo_internato: v,
    vinculo_status: v.status || "-",
    vinculo_completo: completo,
    vinculo_campos_faltantes: camposFaltantes,
    regraAtiva: getRegraAtiva(v),
    coordenadores: coordenadoresAtivos,
    modalidade_pagamento_id: v.modalidade_pagamento_id || v.preceptor?.modalidade_pagamento_id || null,
    cnpj: v.cnpj || v.preceptor?.cnpj || null,
    razao_social: v.razao_social || v.preceptor?.razao_social || null
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
      vinculo_regras:vinculo_regras_financeiras(${VINCULO_REGRA_EMBED}),
      coordenadores:vinculo_coordenadores!vinculo_coordenadores_vinculo_internato_id_fkey(
        id, profile_id, status,
        profiles!vinculo_coordenadores_profile_id_fkey(id, nome_completo, email)
      )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const porPreceptor = {};
  (data || []).forEach(v => {
    const pid = v.preceptor_id;
    if (!porPreceptor[pid]) porPreceptor[pid] = { preceptor: v.preceptor, vinculos: [] };
    porPreceptor[pid].vinculos.push(v);
  });
  return Object.values(porPreceptor).map(g => mapPreceptorInternatoFromGroup(g.preceptor, g.vinculos));
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

// ── E-mails para cópia do cadastro principal do preceptor ──
// Pertencem ao cadastro (não ao vínculo). O e-mail principal
// permanece em preceptores.email, sem migração de dados.

const EMAIL_COPIA_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizarEmailCopia(valor) {
  return String(valor == null ? '' : valor).trim();
}

export function validarEmailsCopia(lista, emailPrincipal) {
  const principal = normalizarEmailCopia(emailPrincipal).toLowerCase();
  const vistos = new Set();
  for (const item of (lista || [])) {
    const email = normalizarEmailCopia(item?.email);
    if (!email) return 'Há um e-mail para cópia vazio. Preencha o endereço ou remova a linha.';
    if (!EMAIL_COPIA_RE.test(email)) {
      return `E-mail para cópia inválido: "${email}". Verifique o endereço informado.`;
    }
    const chave = email.toLowerCase();
    if (principal && chave === principal) {
      return `O e-mail "${email}" já é o e-mail principal do preceptor e não pode ser repetido como e-mail para cópia.`;
    }
    if (vistos.has(chave)) {
      return `E-mail para cópia duplicado: "${email}". Informe endereços diferentes.`;
    }
    vistos.add(chave);
  }
  return null;
}

// Monta os destinatários do Outlook Web a cada preparação, usando o
// cadastro principal ATUAL do preceptor (sem estado local antigo).
//   Para: somente o e-mail principal atual.
//   Cc: somente adicionais ATIVOS, na ordem cadastrada, sem vazios,
//       sem duplicidade e sem repetir o endereço principal.
export function montarDestinatariosOutlook(emailPrincipal, listaCopia) {
  const para = normalizarEmailCopia(emailPrincipal);
  if (!para) return { erro: 'principal_vazio' };
  if (!EMAIL_COPIA_RE.test(para)) return { erro: 'principal_invalido', email: para };

  const cc = [];
  const vistos = new Set([para.toLowerCase()]);
  for (const item of (listaCopia || [])) {
    if (!item || item.ativo === false) continue;
    const email = normalizarEmailCopia(item?.email);
    if (!email) continue;
    if (!EMAIL_COPIA_RE.test(email)) return { erro: 'copia_invalido', email };
    const chave = email.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    cc.push(email);
  }
  return { para, cc };
}

function codificarEnderecoMailto(endereco) {
  return String(endereco == null ? '' : endereco).split('@').map(encodeURIComponent).join('@');
}

// Deep link do Outlook Web.
// - Parâmetros diretos (to/cc/subject/body): formato já usado pela integração.
// - Parâmetro "mailtouri": URI mailto completo (RFC 6068), único formato que
//   carrega o Cc na integração atual do Outlook Web.
// Os dois são enviados: os diretos garantem Para/Assunto/Corpo e o mailtouri
// garante o Cc. O conteúdo do corpo não é alterado.
export function montarUrlOutlook({ para, cc = [], assunto = '', corpo = '' }) {
  const hfields = [];
  if (cc.length > 0) hfields.push(`cc=${cc.map(codificarEnderecoMailto).join(',')}`);
  hfields.push(`subject=${encodeURIComponent(assunto)}`);
  hfields.push(`body=${encodeURIComponent(corpo)}`);
  const mailtoUri = `mailto:${codificarEnderecoMailto(para)}?${hfields.join('&')}`;

  const diretos = `to=${encodeURIComponent(para)}`
    + (cc.length > 0 ? `&cc=${encodeURIComponent(cc.join(','))}` : '')
    + `&subject=${encodeURIComponent(assunto)}`
    + `&body=${encodeURIComponent(corpo)}`;

  return `https://outlook.office.com/mail/deeplink/compose?${diretos}&mailtouri=${encodeURIComponent(mailtoUri)}`;
}

export function mensagemErroDestinatariosEmail(destinatario) {
  const erro = destinatario?.erro;
  if (erro === 'principal_vazio') {
    return 'O cadastro do preceptor não possui e-mail principal. Informe o e-mail principal no cadastro para preparar o e-mail no Outlook.';
  }
  if (erro === 'principal_invalido') {
    return `O e-mail principal "${destinatario.email}" do cadastro do preceptor é inválido. Corrija o cadastro do preceptor antes de preparar o e-mail no Outlook.`;
  }
  if (erro === 'copia_invalido') {
    return `O e-mail para cópia "${destinatario.email}" do cadastro do preceptor é inválido. Corrija o cadastro do preceptor (e-mails para cópia) antes de preparar o e-mail no Outlook.`;
  }
  return 'Não foi possível montar os destinatários do e-mail. Verifique o cadastro do preceptor e tente novamente.';
}

function mensagemErroEmailsCopia(error) {
  const msg = String((error && error.message) || '');
  const bruto = `${msg} ${String((error && error.details) || '')}`;
  if (msg.includes('email_principal_repetido')) {
    return 'Este e-mail já é o e-mail principal do preceptor e não pode ser usado como e-mail para cópia.';
  }
  if (msg.includes('email_principal_duplicado_copia')) {
    return 'Este e-mail já está cadastrado como e-mail para cópia ativo do preceptor. Desative o endereço antes de alterar o e-mail principal.';
  }
  if (msg.includes('email_invalido')) return 'Informe um e-mail válido para cópia.';
  if (msg.includes('email_vazio')) return 'O e-mail para cópia não pode ficar vazio.';
  if (error && (error.code === '23505' || /duplicate key|já está cadastrado/i.test(bruto))) {
    return 'Este e-mail já está cadastrado para este preceptor.';
  }
  if (error && (error.code === '42501' || error.code === 'PGRST301' || /permission denied|row-level security/i.test(bruto))) {
    return 'Você não tem permissão para alterar os e-mails para cópia.';
  }
  if (error && error.code === '23503') return 'Preceptor não encontrado para salvar os e-mails para cópia.';
  if (/constraint|violates|foreign key|syntax error|relation |column |sqlstate/i.test(msg)) {
    return 'Não foi possível salvar os e-mails para cópia. Verifique os dados e tente novamente.';
  }
  return 'Não foi possível salvar os e-mails para cópia. Tente novamente.';
}

export async function fetchEmailsCopia(preceptorId) {
  if (!preceptorId) return [];
  const { data, error } = await supabase
    .from('preceptor_emails_copia')
    .select('id, preceptor_id, email, ativo, criado_em, atualizado_em')
    .eq('preceptor_id', preceptorId)
    .order('criado_em', { ascending: true });
  if (error) throw new Error(mensagemErroEmailsCopia(error));
  return (data || []).map((row) => ({ ...row, email: normalizarEmailCopia(row.email) }));
}

export async function salvarEmailsCopia(preceptorId, lista) {
  if (!preceptorId) return [];
  const desejados = (lista || [])
    .map((item) => ({
      id: item?.id || null,
      email: normalizarEmailCopia(item?.email),
      ativo: item?.ativo !== false
    }))
    .filter((item) => item.email);

  const existentes = await fetchEmailsCopia(preceptorId);
  const porId = new Map(existentes.map((r) => [r.id, r]));
  const porEmail = new Map(existentes.map((r) => [normalizarEmailCopia(r.email).toLowerCase(), r]));

  for (const item of desejados) {
    const chave = item.email.toLowerCase();
    const atual = item.id ? porId.get(item.id) : null;
    if (atual) {
      const detentor = porEmail.get(chave);
      if (detentor && detentor.id !== atual.id) {
        throw new Error(`Este e-mail já está cadastrado para este preceptor: "${item.email}".`);
      }
      const { error } = await supabase
        .from('preceptor_emails_copia')
        .update({ email: item.email, ativo: item.ativo })
        .eq('id', atual.id);
      if (error) throw new Error(mensagemErroEmailsCopia(error));
      continue;
    }
    const detentor = porEmail.get(chave);
    if (detentor) {
      const { error } = await supabase
        .from('preceptor_emails_copia')
        .update({ email: item.email, ativo: item.ativo })
        .eq('id', detentor.id);
      if (error) throw new Error(mensagemErroEmailsCopia(error));
    } else {
      const { error } = await supabase
        .from('preceptor_emails_copia')
        .insert({ preceptor_id: preceptorId, email: item.email, ativo: item.ativo });
      if (error) throw new Error(mensagemErroEmailsCopia(error));
    }
  }

  return fetchEmailsCopia(preceptorId);
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

export async function reativarPreceptor(id) {
  const { error } = await supabase.from('preceptores').update({ status: 'ativo' }).eq('id', id);
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
    valor_inicial: dados.valor_inicial ?? null,
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
    modalidade_pagamento_id: dados.modalidade_pagamento_id || null,
    cnpj: normalizeCnpj(dados.cnpj),
    razao_social: dados.razao_social || null,
    valor_inicial: dados.valor_inicial ?? null,
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
  if (!v?.status || v.status !== 'ativo') f.push('Vínculo inativo');
  if (!v?.preceptor?.nome_completo?.trim()) f.push('Nome completo');
  if (!v?.unidade_id && !v?.preceptor?.unidade_id) f.push('Unidade');
  if (!v?.preceptor?.profissao_id) f.push('Profissão');
  if (tipoAtuacao === 'adm') { if (!v?.disciplina_id) f.push('Disciplina'); }
  else { if (!v?.internato_id) f.push('Internato'); }
  if (!v?.periodo_id) f.push('Período');
  if (!v?.local_id) f.push('Local de atuação');
  if (!v?.semestre_id) f.push('Semestre');
  if (!v?.data_inicio) f.push('Início da vigência');
  return f;
}

export function isDadosGeraisCompleto(p, modalidadeNome) {
  if (!p?.nome_completo?.trim()) return false;
  if (!p?.profissao_id) return false;
  if (!p?.modalidade_pagamento_id) return false;
  if (modalidadeNome?.toLowerCase().includes('nfs')) {
    if (!p?.cnpj?.trim()) return false;
    if (!p?.razao_social?.trim()) return false;
  }
  return true;
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
    data_fim: dados.data_inicio ? (dados.data_fim || null) : null,
    valor_inicial: dados.valor_inicial ?? null
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
    data_fim: dados.data_inicio ? (dados.data_fim || null) : null,
    modalidade_pagamento_id: dados.modalidade_pagamento_id || null,
    cnpj: normalizeCnpj(dados.cnpj),
    razao_social: dados.razao_social || null,
    valor_inicial: dados.valor_inicial ?? null,
    status: dados.status || 'ativo'
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function verificarDuplicidadeVinculo(dados, excludeId) {
  const norm = v => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };
  const preceptorId = norm(dados.preceptor_id);
  if (!preceptorId) return false;

  let query = supabase
    .from('vinculos_internato')
    .select('id')
    .eq('preceptor_id', preceptorId)
    .eq('status', 'ativo')
    .limit(1);

  const addFilter = (col, val) => {
    const v = norm(val);
    if (v) query = query.eq(col, v);
    else query = query.is(col, null);
  };

  addFilter('internato_id', dados.internato_id);
  addFilter('periodo_id', dados.periodo_id);
  addFilter('semestre_id', dados.semestre_id);
  addFilter('local_id', dados.local_id);
  addFilter('setor_id', dados.setor_id);
  addFilter('data_inicio', dados.data_inicio);
  addFilter('data_fim', dados.data_fim);

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).length > 0;
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

// ── Coordenadores do vínculo (M:N) ──
export async function fetchCoordenadoresAtivos() {
  const { data, error } = await supabase
    .from('user_roles')
    .select('id, profile_id, role, profiles!user_roles_profile_id_fkey(id, nome_completo, email)')
    .eq('role', 'coordenador')
    .eq('ativo', true);
  if (error) throw error;
  return (data || []).map(r => ({ ...r.profiles, role_id: r.id }));
}

export async function fetchVinculoCoordenadores(vinculoInternatoId) {
  if (!vinculoInternatoId) return [];
  const { data, error } = await supabase
    .from('vinculo_coordenadores')
    .select('id, profile_id, profiles!vinculo_coordenadores_profile_id_fkey(id, nome_completo, email)')
    .eq('vinculo_internato_id', vinculoInternatoId)
    .eq('status', 'ativo');
  if (error) throw error;
  return (data || []).map(r => ({ id: r.id, profile_id: r.profile_id, ...r.profiles }));
}

export async function salvarVinculoCoordenadores(vinculoIntId, profileIds) {
  if (!vinculoIntId) return [];
  const desired = [...new Set(profileIds || [])];

  const { data: allRows, error: fetchErr } = await supabase
    .from('vinculo_coordenadores')
    .select('id, profile_id, status')
    .eq('vinculo_internato_id', vinculoIntId);
  if (fetchErr) throw fetchErr;

  const activeRows = (allRows || []).filter(r => r.status === 'ativo');
  const activeIds = activeRows.map(r => r.profile_id);
  const inactiveRows = (allRows || []).filter(r => r.status !== 'ativo');

  const toReactivate = inactiveRows.filter(r => desired.includes(r.profile_id));
  const toAdd = desired.filter(pid => !activeIds.includes(pid) && !toReactivate.some(r => r.profile_id === pid));
  const toRemove = activeRows.filter(r => !desired.includes(r.profile_id));

  if (toRemove.length > 0) {
    const { error: delErr } = await supabase
      .from('vinculo_coordenadores')
      .update({ status: 'inativo' })
      .in('id', toRemove.map(r => r.id));
    if (delErr) throw delErr;
  }

  for (const row of toReactivate) {
    const { error: reErr } = await supabase
      .from('vinculo_coordenadores')
      .update({ status: 'ativo' })
      .eq('id', row.id);
    if (reErr) throw reErr;
  }

  if (toAdd.length === 0) {
    return activeRows.filter(r => desired.includes(r.profile_id))
      .concat(toReactivate.map(r => ({ id: r.id, profile_id: r.profile_id, status: 'ativo' })));
  }

  const inserts = toAdd.map(profile_id => ({
    vinculo_internato_id: vinculoIntId,
    profile_id,
    status: 'ativo'
  }));
  const { data, error: insErr } = await supabase
    .from('vinculo_coordenadores')
    .insert(inserts)
    .select();
  if (insErr) throw insErr;

  return (data || [])
    .concat(activeRows.filter(r => desired.includes(r.profile_id)))
    .concat(toReactivate.map(r => ({ id: r.id, profile_id: r.profile_id, status: 'ativo' })));
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
      preceptor:preceptores(id, nome_completo, status, profissao_id, unidade_id, profissao_ref:profissoes!preceptores_profissao_id_fkey(id, nome)),
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
      preceptor:preceptores(id, nome_completo, status, profissao_id, unidade_id, profissao_ref:profissoes!preceptores_profissao_id_fkey(id, nome)),
      internato:internatos(nome, numero),
      periodo:periodos(numero, nome),
      unidade:unidades(id, nome),
      local:locais(id, nome),
      setor:setores(id, nome),
      semestre:semestres(codigo),
      vinculo_regras:vinculo_regras_financeiras(${VINCULO_REGRA_EMBED}),
      coordenadores:vinculo_coordenadores!vinculo_coordenadores_vinculo_internato_id_fkey(
        id, profile_id, status,
        profiles!vinculo_coordenadores_profile_id_fkey(id, nome_completo, email)
      )
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
      profissao: p?.profissao_ref?.nome || '-',
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
      regraAtiva: getRegraAtiva(v),
      coordenadores: (v.coordenadores || []).filter(c => c.status === 'ativo')
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
    itens:escalas_itens(data, dia_semana, turno, setor_id, setor:setores(nome)),
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
  return (data || []).map(e => {
    const setorLegado = e.vinculo_local?.setor?.nome || '';
    return {
      ...e,
      itens: (e.itens || []).map(i => ({
        ...i,
        setor_nome: i.setor?.nome || setorLegado
      })),
      local_nome: e.vinculo_local?.local?.nome || '-',
      setor_nome: setorLegado || '-'
    };
  });
}

export function ehMensagemConflito(mensagem) {
  return /^Conflito de (horário|escala)/i.test(String(mensagem || '').trim());
}

export async function validarConflitoEscala(dados) {
  const itens = (dados.itens || []).map(i => ({ data: i.data, turno: i.turno }));
  const { data, error } = await supabase.rpc('validar_conflito_escala_itens', {
    p_itens: itens,
    p_vinculo_adm_id: dados.vinculo_adm_id || null,
    p_vinculo_internato_id: dados.vinculo_internato_id || null,
    p_preceptor_id: dados.preceptor_id || null,
    p_escala_id: dados.escala_id || null
  });
  if (error) throw error;
  return data || { conflito: false };
}

export async function salvarEscala(dados) {
  const itens = (dados.itens || []).map(i => ({
    data: i.data,
    turno: i.turno,
    ...(i.setor_id ? { setor_id: i.setor_id } : {})
  }));
  if ((dados.status || 'ativo') === 'ativo' && itens.length > 0) {
    try {
      const validacao = await validarConflitoEscala({ ...dados, itens });
      if (validacao && validacao.conflito) {
        throw new Error(validacao.mensagem || 'Conflito de horário.');
      }
    } catch (e) {
      if (ehMensagemConflito(e && e.message)) throw e;
    }
  }
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
  if (competencia) {
    const [ano, mes] = competencia.split('-').map(Number);
    const proxMes = mes === 12 ? 1 : mes + 1;
    const proxAno = mes === 12 ? ano + 1 : ano;
    const inicioProxMes = `${proxAno}-${String(proxMes).padStart(2, '0')}-01`;
    q = q.gte('data_presenca', `${competencia}-01`).lt('data_presenca', inicioProxMes);
  }
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
        setor_nome: '',
        setores: [],
        disciplina_nome: tipo === 'adm' ? (vinc.disciplina?.nome || '') : '',
        internato_nome: tipo === 'internato' ? (vinc.internato?.nome || '') : '',
        periodo_nome: vinc.periodo?.numero ? `${vinc.periodo.numero}º período` : 'Não informado',
        semestre_codigo: vinc.semestre?.codigo || '',
        total_turnos: 0,
        itens: []
      };
    }
    const g = grupos[key];
    if (setorNome && !g.setores.includes(setorNome)) g.setores.push(setorNome);
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

  return Object.values(grupos).map(g => ({ ...g, setor_nome: g.setores.join(', ') })).sort((a, b) =>
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
      data, turno, escala_id, setor_id, setor:setores(nome),
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
    const sid = it.setor?.nome || vinc.setor?.nome || '';
    const aid = e.tipo_atuacao === 'adm' ? (vinc.disciplina?.nome || '-') : (vinc.internato?.nome || '-');
    const pid = vinc.periodo?.numero ? `${vinc.periodo.numero}º período` : 'Não informado';
    const key = `${e.id}|${d}`;
    if (!porData[d]) porData[d] = {};
    if (!porData[d][key]) {
      porData[d][key] = {
        escala_id: e.id, preceptor_id: p.id, preceptor_nome: p.nome_completo,
        tipo_atuacao: e.tipo_atuacao,
        modalidade_label: e.tipo_atuacao === 'adm' ? 'Prática' : 'Internato',
        unidade_nome: uid, local_nome: lid, setor_nome: sid, setores: [],
        atividade_nome: aid, periodo_nome: pid,
        turnos_previstos: [], turnos_confirmados: []
      };
    }
    if (sid && !porData[d][key].setores.includes(sid)) porData[d][key].setores.push(sid);
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
      const setor_nome = (p.setores && p.setores.length) ? p.setores.join(', ') : (p.setor_nome || '');
      return { ...p, setor_nome, turnos_confirmados: confirmados, turnos_pendentes: pendentes, status_lista };
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

export async function deletarUsuarioViaEdge(profileId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessao invalida. Faca login novamente.');
  let res;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`, {
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
  if (!res.ok) {
    if (json.dependencies && Array.isArray(json.dependencies)) {
      throw new Error(json.error + ': ' + json.dependencies.join('; '));
    }
    throw new Error(json.error || json.msg || 'Erro ao excluir usuario (status ' + res.status + ')');
  }
  return json;
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
  const s = String(d);
  if (s.includes('T')) return new Date(s).toLocaleDateString('pt-BR');
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');
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

export async function resolverCompetenciaIdPorCalculos(calculoIds) {
  const ids = [...new Set((calculoIds || []).filter(Boolean))];
  if (ids.length === 0) return null;
  try {
    const { data, error } = await supabase
      .from('calculos')
      .select('id, competencia_id')
      .in('id', ids);
    if (error || !data || data.length === 0) return null;
    const comp = data.find(d => d.competencia_id);
    return comp ? comp.competencia_id : null;
  } catch (e) {
    console.warn('[resolverCompetenciaIdPorCalculos]', e);
    return null;
  }
}

export async function anexarCamposFilaFinanceira(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const faltando = rows.filter(r => !r.competencia_id && r.id);
  if (faltando.length === 0) return rows;
  try {
    const { data, error } = await supabase
      .from('calculos')
      .select('id, competencia_id, vinculo_adm_id, vinculo_internato_id')
      .in('id', faltando.map(r => r.id));
    if (error || !data || data.length === 0) return rows;
    const mapa = Object.fromEntries(data.map(d => [d.id, d]));
    return rows.map(r => {
      if (r.competencia_id) return r;
      const d = mapa[r.id];
      if (!d || !d.competencia_id) return r;
      return {
        ...r,
        competencia_id: d.competencia_id,
        vinculo_adm_id: r.vinculo_adm_id ?? d.vinculo_adm_id ?? null,
        vinculo_internato_id: r.vinculo_internato_id ?? d.vinculo_internato_id ?? null
      };
    });
  } catch (e) {
    console.warn('[anexarCamposFilaFinanceira]', e);
    return rows;
  }
}

export async function verificarDesatualizacaoCompetencia(mes, ano) {
  const { data, error } = await supabase.rpc('verificar_desatualizacao_competencia', {
    p_mes: Number(mes),
    p_ano: Number(ano)
  });
  if (error) throw error;
  return data || { possui_desatualizacao: false, vinculos_desatualizados: [], vinculos_nao_calculados: [], ultima_apuracao: null, total_vinculos_com_presenca: 0, total_calculados_ok: 0 };
}


export async function fetchDetalhesCalculoCompleto(calculoId) {
  const { data: calc, error: calcErr } = await supabase
    .from('calculos')
    .select(`
      id, competencia_id, preceptor_id, tipo_atuacao, modalidade, status,
      total_bruto, total_descontos, total_liquido, versao, calculado_em, observacoes,
      quantidade_presencas, vinculo_adm_id, vinculo_internato_id,
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
      .select('id, valor_inicial, periodo:periodos(numero, nome), unidade:unidades(id, nome), disciplina:disciplinas(id, nome), local:locais(id, nome), setor:setores(id, nome)')
      .eq('id', calc.vinculo_adm_id)
      .single();
    vinculoContexto = vinc;
  } else if (tipoAtuacao === 'internato' && calc.vinculo_internato_id) {
    const { data: vinc } = await supabase
      .from('vinculos_internato')
      .select('id, valor_inicial, periodo:periodos(numero, nome), unidade:unidades(id, nome), internato:internatos(id, nome), local:locais(id, nome), setor:setores(id, nome)')
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
  let vinculoRegra = null;
  if (tipoAtuacao === 'adm' && calc.vinculo_adm_id) {
    const { data: vr } = await supabase
      .from('vinculo_regras_financeiras')
      .select('id, data_inicio, data_fim, status, regra:regras_financeiras(id, nome, tipo_atuacao, componentes:regra_componentes(*))')
      .eq('vinculo_adm_id', calc.vinculo_adm_id)
      .eq('status', 'ativo')
      .limit(1)
      .maybeSingle();
    regra = vr?.regra || null;
    vinculoRegra = vr || null;
  } else if (tipoAtuacao === 'internato' && calc.vinculo_internato_id) {
    const { data: vr } = await supabase
      .from('vinculo_regras_financeiras')
      .select('id, data_inicio, data_fim, status, regra:regras_financeiras(id, nome, tipo_atuacao, componentes:regra_componentes(*))')
      .eq('vinculo_internato_id', calc.vinculo_internato_id)
      .eq('status', 'ativo')
      .limit(1)
      .maybeSingle();
    regra = vr?.regra || null;
    vinculoRegra = vr || null;
  }

  let notaSituacao = null;
  const { data: nota } = await supabase
    .from('solicitacoes_nota_fiscal')
    .select('situacao')
    .eq('calculo_id', calculoId)
    .maybeSingle();
  notaSituacao = nota?.situacao || null;

  let revisao = null;
  const { data: rev } = await supabase
    .from('aprovacoes')
    .select('id, tipo, status, decidido_em, decidido_por, comentario, profile:profiles!aprovacoes_decidido_por_fkey(nome_completo)')
    .eq('calculo_id', calculoId)
    .eq('tipo', 'financeira')
    .order('decidido_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  revisao = rev || null;

  return {
    calculo: { ...calc, tipo_atuacao: tipoAtuacao },
    itens: itens || [],
    presencas,
    vinculoContexto,
    regra,
    vinculoRegra,
    notaSituacao,
    revisao
  };
}

export async function fetchRevisoesCompetencia(calculoIds) {
  if (!calculoIds || calculoIds.length === 0) return {};
  const { data, error } = await supabase
    .from('aprovacoes')
    .select('calculo_id, id, status, decidido_em, decidido_por, comentario, profile:profiles!aprovacoes_decidido_por_fkey(nome_completo)')
    .in('calculo_id', calculoIds)
    .eq('tipo', 'financeira');
  if (error) {
    console.warn('Erro ao buscar revisões financeiras:', error);
    return {};
  }
  const map = {};
  (data || []).forEach(rev => {
    if (!map[rev.calculo_id] || new Date(rev.decidido_em) > new Date(map[rev.calculo_id].decidido_em)) {
      map[rev.calculo_id] = rev;
    }
  });
  return map;
}

export async function salvarRevisaoFinanceira(calculoId, authUserId, comentario = null) {
  let profileId = null;
  if (authUserId) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', authUserId).maybeSingle();
    profileId = profile?.id || null;
  }
  const { data: atual, error: atualErr } = await supabase
    .from('aprovacoes')
    .select('id')
    .eq('calculo_id', calculoId)
    .eq('tipo', 'financeira')
    .order('decidido_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (atualErr) throw atualErr;

  const payload = {
    calculo_id: calculoId,
    tipo: 'financeira',
    status: 'aprovado',
    decidido_por: profileId,
    decidido_em: new Date().toISOString(),
    comentario: comentario?.trim() || null
  };

  if (atual?.id) {
    const { data, error } = await supabase.from('aprovacoes').update(payload).eq('id', atual.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('aprovacoes').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export function apuracaoMesLabel(mes, ano) {
  if (!mes || !ano) return '-';
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${MESES[mes - 1] || mes}/${ano}`;
}



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
    const { data, error } = await supabase.from('preceptores').select('id,email,profile_id,cpf,cnpj,razao_social,nome_social,conselho_tipo,conselho_numero,profissao,profissao_id').in('id', ids);
    if (error) throw new Error('Não foi possível consultar o cadastro dos preceptores: ' + error.message);
    const profilesIds = [...new Set((data || []).map(p => p.profile_id).filter(Boolean))];
    let profileEmails = {};
    if (profilesIds.length) {
      const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,email').in('id', profilesIds);
      if (profileError) throw new Error('Não foi possível consultar os e-mails dos perfis: ' + profileError.message);
      profileEmails = Object.fromEntries((profiles || []).map(p => [p.id, p.email || '']));
    }
    const profissaoIds = [...new Set((data || []).map(p => p.profissao_id).filter(Boolean))];
    let profissaoMap = {};
    if (profissaoIds.length) {
      try {
        const { data: profData } = await supabase.from('profissoes').select('id,nome').in('id', profissaoIds);
        profissaoMap = Object.fromEntries((profData || []).map(p => [p.id, p.nome || '']));
      } catch (profErr) {
        console.warn('[fetchPainelPagamentos] Falha ao carregar profissões:', profErr);
      }
    }
    cadastroMap = Object.fromEntries((data || []).map(p => [p.id, {
      email: p.email || profileEmails[p.profile_id] || '',
      cpf: p.cpf || '',
      cnpj: p.cnpj || '',
      razao_social: p.razao_social || '',
      nome_social: p.nome_social || '',
      conselho_tipo: p.conselho_tipo || '',
      conselho_numero: p.conselho_numero || '',
      profissao: profissaoMap[p.profissao_id] || p.profissao || ''
    }]));
  }
  const vinculoIds = [...new Set((rows || []).map(r => r.vinculo_internato_id).filter(Boolean))];
  let vinculoMap = {};
  if (vinculoIds.length) {
    const { data: vData } = await supabase.from('vinculos_internato').select('id,cnpj,razao_social,periodo_id,setor_id,valor_inicial').in('id', vinculoIds);
    const periodoIds = [...new Set((vData || []).map(v => v.periodo_id).filter(Boolean))];
    const setorIds = [...new Set((vData || []).map(v => v.setor_id).filter(Boolean))];
    let periodoMap = {};
    let setorMap = {};
    if (periodoIds.length) {
      const { data: pData } = await supabase.from('periodos').select('id,numero').in('id', periodoIds);
      periodoMap = Object.fromEntries((pData || []).map(p => [p.id, p.numero ? `${p.numero}º período` : '']));
    }
    if (setorIds.length) {
      const { data: sData } = await supabase.from('setores').select('id,nome').in('id', setorIds);
      setorMap = Object.fromEntries((sData || []).map(s => [s.id, s.nome || '']));
    }
    vinculoMap = Object.fromEntries((vData || []).map(v => [v.id, { cnpj: v.cnpj || '', razao_social: v.razao_social || '', periodo_nome: periodoMap[v.periodo_id] || '', setor_nome: setorMap[v.setor_id] || '', valor_inicial: v.valor_inicial }]));
  }
  const calcIds = [...new Set((rows || []).map(r => r.id).filter(Boolean))];
  let modalidadeMap = {};
  if (calcIds.length) {
    try {
      const { data: cData } = await supabase.from('calculos').select('id,modalidade').in('id', calcIds);
      modalidadeMap = Object.fromEntries((cData || []).map(c => [c.id, c.modalidade || '']));
    } catch (e) {
      console.warn('[fetchPainelPagamentos] Falha ao carregar modalidade de pagamento:', e);
    }
  }
  // Saldo semestral do vínculo: null quando não cadastrado (nunca vira 0),
  // para a lista do Dashboard exibir "Saldo não informado".
  const saldoSemestralDoVinculo = (vinculoId) => {
    const v = vinculoMap[vinculoId];
    if (!v || v.valor_inicial == null || v.valor_inicial === '') return null;
    const n = Number(v.valor_inicial);
    return Number.isFinite(n) ? n : null;
  };
  return (rows || [])
    .filter(r => r.tipo_atuacao === 'internato')
    .map(r => ({...r, preceptor_email: cadastroMap[r.preceptor_id]?.email || '', saldo_semestral: saldoSemestralDoVinculo(r.vinculo_internato_id), situacao_nota: r.situacao_nota || 'nao_solicitada', modalidade_pagamento: modalidadeMap[r.id] || '', preceptor_cpf: cadastroMap[r.preceptor_id]?.cpf || '', preceptor_cnpj: cadastroMap[r.preceptor_id]?.cnpj || '', preceptor_razao_social: cadastroMap[r.preceptor_id]?.razao_social || '', preceptor_nome_social: cadastroMap[r.preceptor_id]?.nome_social || '', preceptor_conselho_tipo: cadastroMap[r.preceptor_id]?.conselho_tipo || '', preceptor_conselho_numero: cadastroMap[r.preceptor_id]?.conselho_numero || '', preceptor_profissao: cadastroMap[r.preceptor_id]?.profissao || '', vinculo_cnpj: vinculoMap[r.vinculo_internato_id]?.cnpj || '', vinculo_razao_social: vinculoMap[r.vinculo_internato_id]?.razao_social || '', periodo_nome: vinculoMap[r.vinculo_internato_id]?.periodo_nome || '', vinculo_setor_nome: vinculoMap[r.vinculo_internato_id]?.setor_nome || ''}));
}

// ── Saldo semestral por preceptor e por vínculo (lista do Dashboard) ──
//
// Fonte única dos valores:
//   • saldo inicial  → vinculos_internato.valor_inicial, chegado à fila como `saldo_semestral`
//                      (NUNCA preceptores.valor_inicial; null = saldo não informado);
//   • valor utilizado → soma de total_bruto dos cálculos VÁLIDOS (status permitido) e
//                      ATUALIZADOS (sem marcação de desatualização) do vínculo no semestre;
//   • valor pago      → soma de total_bruto das linhas com pagamento concluído
//                      (situacao_nota = 'pago');
//   • saldo disponível = saldo inicial − valor utilizado;
//   • percentual       = valor utilizado ÷ saldo inicial × 100.
// Cada vínculo é agregado isoladamente (não se mistura saldo entre vínculos).
export const SALDO_STATUS_VALIDO = ['calculado', 'aprovado', 'fechado', 'pago'];
export const SALDO_FAIXAS = { verde: 70, amarelo: 90 };

const arred2Saldo = (v) => Math.round((Number(v) || 0) * 100) / 100;

export function chaveVinculoLinha(r) {
  if (!r) return null;
  return r.vinculo_internato_id || r.vinculo_adm_id || null;
}

// Cálculo válido (status permitido) e atualizado (sem observação de desatualização).
export function calculoSaldoValido(r) {
  if (!r) return false;
  if (!SALDO_STATUS_VALIDO.includes(r.status)) return false;
  if (r.observacoes && r.observacoes !== 'Calculado') return false;
  return true;
}

// Mapa por vínculo: saldo inicial (1 valor), utilizado e pago no semestre.
export function montarMapaSaldosVinculos(rows) {
  const mapa = new Map();
  (rows || []).forEach(r => {
    const k = chaveVinculoLinha(r);
    if (!k) return;
    let e = mapa.get(k);
    if (!e) {
      e = { chave: k, saldo_inicial: null, utilizado: 0, pago: 0 };
      mapa.set(k, e);
    }
    if (e.saldo_inicial == null && r.saldo_semestral != null && r.saldo_semestral !== '') {
      const n = Number(r.saldo_semestral);
      if (Number.isFinite(n)) e.saldo_inicial = n;
    }
    if (calculoSaldoValido(r)) e.utilizado = arred2Saldo(e.utilizado + Number(r.total_bruto || 0));
    if ((r.situacao_nota || '') === 'pago') e.pago = arred2Saldo(e.pago + Number(r.total_bruto || 0));
  });
  return mapa;
}

export function situacaoSaldo(resumo) {
  if (!resumo || !resumo.temSaldo) return 'Saldo não informado';
  if (resumo.disponivel != null && resumo.disponivel < 0) return 'Saldo excedido';
  if (resumo.disponivel != null && resumo.disponivel === 0) return 'Saldo esgotado';
  if (resumo.percentual >= SALDO_FAIXAS.amarelo) return 'Crítico';
  if (resumo.percentual >= SALDO_FAIXAS.verde) return 'Atenção';
  return 'Normal';
}

export function faixaBarraSaldo(resumo) {
  if (!resumo || !resumo.temSaldo) return 'cinza';
  if (resumo.percentual >= SALDO_FAIXAS.amarelo) return 'vermelho';
  if (resumo.percentual >= SALDO_FAIXAS.verde) return 'amarelo';
  return 'verde';
}

// Soma dos vínculos informados (preceptor) ou de um único vínculo (expansão).
export function resumoSaldoVinculos(chaves, mapa) {
  const lista = Array.isArray(chaves) ? chaves.filter(Boolean) : [];
  let saldoInicial = 0, utilizado = 0, pago = 0, temSaldo = false;
  lista.forEach(k => {
    const e = (mapa && mapa.get(k)) || null;
    if (!e) return;
    if (e.saldo_inicial != null && Number(e.saldo_inicial) > 0) {
      temSaldo = true;
      saldoInicial += Number(e.saldo_inicial);
    }
    utilizado += Number(e.utilizado || 0);
    pago += Number(e.pago || 0);
  });
  saldoInicial = arred2Saldo(saldoInicial);
  utilizado = arred2Saldo(utilizado);
  pago = arred2Saldo(pago);
  const resumo = {
    vinculos: lista.length,
    temSaldo,
    saldoInicial: temSaldo ? saldoInicial : null,
    utilizado,
    pago,
    disponivel: temSaldo ? arred2Saldo(saldoInicial - utilizado) : null,
    percentual: temSaldo && saldoInicial > 0 ? (utilizado / saldoInicial) * 100 : null
  };
  resumo.situacao = situacaoSaldo(resumo);
  resumo.faixa = faixaBarraSaldo(resumo);
  return resumo;
}

export function percentualSaldoTexto(resumo) {
  if (!resumo || !resumo.temSaldo || resumo.percentual == null) return '—';
  return `${resumo.percentual.toFixed(1).replace('.', ',')}%`;
}

export function larguraBarraSaldo(resumo) {
  if (!resumo || !resumo.temSaldo || resumo.percentual == null) return 0;
  return Math.max(0, Math.min(100, resumo.percentual));
}

// Cabeçalho do preceptor: soma dos vínculos do grupo (uma linha por preceptor+competência).
export function itensCabecalhoSaldo(resumo, turnos) {
  const r = resumo || resumoSaldoVinculos([], new Map());
  const semSaldo = 'Saldo não informado';
  return [
    { rot: 'Vínculos', valor: String(r.vinculos || 0) },
    { rot: 'Turnos', valor: String(Number(turnos || 0)) },
    { rot: 'Saldo inicial', valor: r.temSaldo ? formatCurrencyBRL(r.saldoInicial) : semSaldo, naoInformado: !r.temSaldo },
    { rot: 'Valor utilizado', valor: formatCurrencyBRL(r.utilizado) },
    { rot: 'Valor pago', valor: formatCurrencyBRL(r.pago) },
    { rot: 'Saldo disponível', valor: r.temSaldo ? formatCurrencyBRL(r.disponivel) : semSaldo, naoInformado: !r.temSaldo, excedente: !!(r.temSaldo && r.disponivel < 0) },
    { rot: 'Percentual utilizado', valor: percentualSaldoTexto(r) },
    { rot: 'Situação financeira', valor: r.situacao, faixa: r.faixa }
  ];
}

// Filtros rápidos de saldo da lista (um ativo por vez, somente sobre a lista).
export function passaFiltroSaldo(resumo, modo) {
  if (!modo) return true;
  if (modo === 'nao_informado') return !resumo || !resumo.temSaldo;
  if (!resumo || !resumo.temSaldo) return false;
  if (modo === 'acima80') return resumo.percentual > 80;
  if (modo === 'esgotado') return arred2Saldo(resumo.disponivel) <= 0;
  return true;
}

// Identificação curta do vínculo (internato/disciplina • período • unidade • local • setor).
export function identificacaoVinculoLinha(r) {
  if (!r) return 'Vínculo';
  const partes = [];
  const base = (r.internato_nome && r.internato_nome !== '-') ? r.internato_nome : (r.disciplina_nome && r.disciplina_nome !== '-' ? r.disciplina_nome : '');
  if (base) partes.push(base);
  if (r.periodo_nome) partes.push(r.periodo_nome);
  if (r.unidade_nome && r.unidade_nome !== '-') partes.push(r.unidade_nome);
  if (r.local_nome) partes.push(r.local_nome);
  if (r.setor_nome) partes.push(r.setor_nome);
  return partes.length ? partes.join(' • ') : 'Vínculo';
}

// Ranking "Utilização do saldo semestral" (gráfico do Dashboard e exportações).
// Regras:
//   • só entram vínculos com saldo informado (nunca usa preceptores.valor_inicial);
//   • ordenação decrescente por percentual utilizado;
//   • sempre aparecem os `limite` maiores e, além deles, todos os vínculos
//     acima de 80% ou com saldo esgotado;
//   • vínculos sem saldo não entram no ranking — são apenas contados.
export function montarRankingSaldoVinculos(rows, mapa, limite = 10) {
  const topo = Math.max(1, Number(limite) || 10);
  const porChave = new Map();
  (rows || []).forEach(r => {
    const k = chaveVinculoLinha(r);
    if (!k || porChave.has(k)) return;
    porChave.set(k, {
      chave: k,
      preceptor_id: r.preceptor_id || null,
      preceptor: r.preceptor_nome || 'Preceptor',
      vinculo: identificacaoVinculoLinha(r)
    });
  });
  const comSaldo = [], semSaldo = [];
  porChave.forEach(item => {
    const resumo = resumoSaldoVinculos([item.chave], mapa);
    if (!resumo.temSaldo) { semSaldo.push(item); return; }
    comSaldo.push({
      ...item, ...resumo,
      acima80: resumo.percentual > 80,
      esgotado: arred2Saldo(resumo.disponivel) <= 0
    });
  });
  comSaldo.sort((a, b) => (b.percentual || 0) - (a.percentual || 0));
  const principais = comSaldo.slice(0, topo);
  const destaques = comSaldo.slice(topo).filter(i => i.acima80 || i.esgotado);
  return {
    itens: [...principais, ...destaques],
    totalComSaldo: comSaldo.length,
    acima80: comSaldo.filter(i => i.acima80).length,
    esgotados: comSaldo.filter(i => i.esgotado).length,
    semSaldoQtd: semSaldo.length,
    semSaldoNomes: [...new Set(semSaldo.map(i => i.preceptor))]
  };
}

// Valores de saldo das exportações (Excel e PDF) — sempre os mesmos da lista.
// semSaldo: texto exato "Saldo não informado"; percentual null → exibir "—".
export function valoresSaldoExport(resumo) {
  const r = resumo || resumoSaldoVinculos([], new Map());
  const semSaldo = 'Saldo não informado';
  return {
    saldoInicial: r.temSaldo ? r.saldoInicial : semSaldo,
    utilizado: r.utilizado,
    pago: r.pago,
    disponivel: r.temSaldo ? r.disponivel : semSaldo,
    percentual: r.temSaldo ? r.percentual : null
  };
}

export async function registrarSolicitacaoNota(calculoId, situacao = 'preparada') {
  const { data, error } = await supabase.rpc('registrar_solicitacao_nota_fiscal', { p_calculo_id: calculoId, p_situacao: situacao });
  if (error) throw error;
  return data;
}

// ── Controle Unificado de Nota Fiscal (Parte 11A / 11B) ──

export async function fetchSolicitacoesNotaFiscal({ preceptorId, competencia } = {}) {
  let query = supabase.from('solicitacoes_nota_fiscal').select('*');
  if (preceptorId) query = query.eq('preceptor_id', preceptorId);
  if (competencia) query = query.eq('competencia', competencia);
  const { data, error } = await query;
  if (error) {
    console.warn('Erro ao consultar solicitacoes_nota_fiscal:', error);
    throw new Error('Não foi possível carregar a situação fiscal. Verifique a conexão e tente novamente.');
  }
  return data || [];
}

const SITUACOES_AVANCADAS_NOTA = ['solicitada', 'nota_recebida', 'em_pagamento', 'pago'];

export async function prepararSolicitacaoNotaUnificada({
  preceptorId,
  competencia,
  calculoIds,
  valorTotal,
  situacao = 'preparada',
  identificacaoFiscal = {},
  emailUsado = '',
  assunto = null,
  corpo = null,
  demonstrativoNome = null
}) {
  // Busca a solicitação existente para evitar duplicidade e preservar situação avançada.
  const { data: existentes } = await supabase
    .from('solicitacoes_nota_fiscal')
    .select('id, situacao, preparado_em, created_at')
    .eq('preceptor_id', preceptorId)
    .eq('competencia', competencia)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  const solExistente = Array.isArray(existentes) && existentes.length > 0 ? existentes[0] : null;

  // Se já foi enviada/recebida/paga, re-preparar NÃO rebaixa a situação em silêncio.
  let situacaoEfetiva = situacao;
  if (solExistente && SITUACOES_AVANCADAS_NOTA.includes(solExistente.situacao) && situacao === 'preparada') {
    situacaoEfetiva = solExistente.situacao;
  }

  try {
    const { data, error } = await supabase.rpc('preparar_ou_atualizar_solicitacao_nota', {
      p_preceptor_id: preceptorId,
      p_competencia: competencia,
      p_calculo_ids: calculoIds,
      p_valor_total: valorTotal,
      p_situacao: situacaoEfetiva,
      p_identificacao_fiscal: identificacaoFiscal,
      p_email_usado: emailUsado,
      p_assunto: assunto,
      p_corpo: corpo,
      p_demonstrativo_nome: demonstrativoNome
    });
    if (!error && data) return data;
  } catch (rpcErr) {
    console.warn('Fallback para RPC unificada de solicitação de nota:', rpcErr);
  }

  const now = new Date().toISOString();
  const payload = {
    preceptor_id: preceptorId,
    competencia: competencia,
    email_usado: emailUsado,
    situacao: situacaoEfetiva,
    assunto: assunto,
    corpo: corpo,
    demonstrativo_nome: demonstrativoNome,
    valor_total_solicitado: valorTotal || 0,
    qtd_atuacoes: (calculoIds || []).length,
    identificacao_fiscal: identificacaoFiscal || {},
    updated_at: now
  };

  let solicitacaoId = solExistente?.id;
  if (!solicitacaoId) {
    payload.preparado_em = now;
    const { data: inserted, error: insertErr } = await supabase
      .from('solicitacoes_nota_fiscal')
      .insert(payload)
      .select('id')
      .single();
    if (insertErr) {
      // Corrida: outra preparação criou a linha — reutiliza a existente.
      const { data: retry } = await supabase
        .from('solicitacoes_nota_fiscal')
        .select('id, situacao')
        .eq('preceptor_id', preceptorId)
        .eq('competencia', competencia)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!retry) throw insertErr;
      solicitacaoId = retry.id;
      const { error: updateErr } = await supabase
        .from('solicitacoes_nota_fiscal')
        .update(payload)
        .eq('id', solicitacaoId);
      if (updateErr) throw updateErr;
    } else {
      solicitacaoId = inserted.id;
    }
  } else {
    const { error: updateErr } = await supabase
      .from('solicitacoes_nota_fiscal')
      .update(payload)
      .eq('id', solicitacaoId);
    if (updateErr) throw updateErr;
  }

  try {
    await supabase.from('solicitacao_nota_fiscal_eventos').insert({
      solicitacao_id: solicitacaoId,
      calculo_id: (calculoIds && calculoIds[0]) || null,
      situacao_anterior: solExistente?.situacao || 'nao_solicitada',
      situacao_nova: situacaoEfetiva,
      ocorrido_em: now,
      detalhes: { preceptor_id: preceptorId, competencia, valor_total: valorTotal, qtd_atuacoes: (calculoIds || []).length, origem: 'preparar_email_outlook' }
    });
  } catch (evErr) {}

  return { sucesso: true, id: solicitacaoId, situacao: situacaoEfetiva };
}

function ehErroTecnicoNaoExpor(error) {
  const msg = String((error && error.message) || error || '');
  return /constraint|violates|foreign key|syntax error|relation |column |sqlstate|PGRST\d+|\b23503\b|\b23505\b|\b42703\b|\b42P01\b/i.test(msg);
}

export function mensagemErroAmigavel(error, fallback = 'Não foi possível concluir a operação. Tente novamente.') {
  if (!error) return fallback;
  let msg = typeof error === 'string' ? error : String(error.message || '');
  msg = msg.replace(/^public\.[a-z_0-9]+\([^)]*\):\s*/i, '').trim();
  if (!msg) return fallback;
  if (ehErroTecnicoNaoExpor(msg)) return fallback;
  return msg;
}

async function resolverProfileIdAtual() {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle();
    return profile?.id || null;
  } catch (e) {
    console.warn('[resolverProfileIdAtual]', e);
    return null;
  }
}

function rpcNaoDisponivel(error) {
  if (!error) return false;
  if (error.code === 'PGRST202') return true;
  return /could not find the function/i.test(String(error.message || ''));
}

export async function confirmarEnvioSolicitacaoNota(solicitacaoId) {
  const now = new Date().toISOString();
  const { data: sol, error: solErr } = await supabase
    .from('solicitacoes_nota_fiscal')
    .select('*')
    .eq('id', solicitacaoId)
    .single();
  if (solErr || !sol) throw new Error('Solicitação de nota fiscal não encontrada.');

  if (sol.situacao !== 'preparada') {
    throw new Error(`Somente solicitações no estado "preparada" podem ser confirmadas. Estado atual: ${sol.situacao}`);
  }

  // Caminho transacional: o servidor resolve o responsável a partir de auth.uid()
  // (profiles.id) e grava situação, data, responsável e histórico na mesma transação.
  const { data: rpcData, error: rpcError } = await supabase.rpc('confirmar_envio_solicitacao_nota', {
    p_solicitacao_id: solicitacaoId
  });
  if (!rpcError && rpcData) {
    return { sucesso: true, id: solicitacaoId, situacao: 'solicitada', ...rpcData };
  }
  if (rpcError && !rpcNaoDisponivel(rpcError)) {
    throw new Error(mensagemErroAmigavel(rpcError, 'Não foi possível confirmar o envio da solicitação. Tente novamente.'));
  }

  // Fallback (RPC indisponível): nunca confiar em ID enviado pelo frontend.
  const profileId = await resolverProfileIdAtual();
  if (!profileId) {
    throw new Error('Não foi possível identificar o usuário autenticado. Saia do sistema e entre novamente.');
  }

  const { error: updateErr } = await supabase
    .from('solicitacoes_nota_fiscal')
    .update({ situacao: 'solicitada', enviado_por: profileId, enviado_em: now, updated_at: now })
    .eq('id', solicitacaoId);
  if (updateErr) {
    throw new Error(mensagemErroAmigavel(updateErr, 'Não foi possível confirmar o envio da solicitação. Tente novamente.'));
  }

  const { error: eventoErr } = await supabase.from('solicitacao_nota_fiscal_eventos').insert({
    solicitacao_id: solicitacaoId,
    situacao_anterior: 'preparada',
    situacao_nova: 'solicitada',
    ocorrido_em: now,
    realizado_por: profileId,
    detalhes: { acao: 'confirmar_envio_humano', valor_total: sol.valor_total_solicitado }
  });

  if (eventoErr) {
    // Rollback manual: evita deixar a solicitação parcialmente atualizada.
    await supabase
      .from('solicitacoes_nota_fiscal')
      .update({
        situacao: sol.situacao,
        enviado_por: sol.enviado_por ?? null,
        enviado_em: sol.enviado_em ?? null,
        updated_at: sol.updated_at
      })
      .eq('id', solicitacaoId);
    throw new Error('Não foi possível registrar o histórico da confirmação. Nenhuma alteração foi mantida. Tente novamente.');
  }

  return { sucesso: true, id: solicitacaoId, situacao: 'solicitada', enviado_por: profileId, enviado_em: now };
}

export async function corrigirConfirmacaoEnvioNota(solicitacaoId, motivo, profileId = null) {
  if (!motivo || motivo.trim().length < 3) {
    throw new Error('Por favor, informe um motivo válido para a correção (mínimo 3 caracteres).');
  }

  const now = new Date().toISOString();
  const { data: sol, error: solErr } = await supabase
    .from('solicitacoes_nota_fiscal')
    .select('*')
    .eq('id', solicitacaoId)
    .single();
  if (solErr || !sol) throw new Error('Solicitação de nota fiscal não encontrada.');

  if (sol.situacao !== 'solicitada') {
    throw new Error(`Não é possível corrigir confirmação. A solicitação não está no estado "solicitada". Estado atual: ${sol.situacao}`);
  }

  const { error: updateErr } = await supabase
    .from('solicitacoes_nota_fiscal')
    .update({ situacao: 'preparada', updated_at: now })
    .eq('id', solicitacaoId);
  if (updateErr) throw updateErr;

  try {
    await supabase.from('solicitacao_nota_fiscal_eventos').insert({
      solicitacao_id: solicitacaoId,
      situacao_anterior: 'solicitada',
      situacao_nova: 'preparada',
      ocorrido_em: now,
      motivo: motivo.trim(),
      detalhes: { acao: 'corrigir_confirmacao_envio', motivo: motivo.trim() }
    });
  } catch (e) {}

  return { sucesso: true, id: solicitacaoId, situacao: 'preparada' };
}

export async function registrarRecebimentoNotaFiscal({
  solicitacaoId,
  profileId = null,
  numeroNota = '',
  dataEmissao = null,
  dataRecebimento = null,
  valorInformado,
  observacao = '',
  divergencia = false,
  registrarDivergencia,
  motivoDivergencia = ''
}) {
  // aceita tanto `divergencia` (chamada do App.jsx) quanto `registrarDivergencia` (legacy)
  const usarDivergencia = divergencia || registrarDivergencia || false;
  if (!valorInformado || Number(valorInformado) <= 0) {
    throw new Error('Por favor, informe o valor da nota fiscal recebida.');
  }

  const now = new Date().toISOString();
  const { data: sol, error: solErr } = await supabase
    .from('solicitacoes_nota_fiscal')
    .select('*')
    .eq('id', solicitacaoId)
    .single();
  if (solErr || !sol) throw new Error('Solicitação de nota fiscal não encontrada.');

  if (sol.situacao !== 'solicitada') {
    throw new Error(`Somente solicitações em estado "Solicitação enviada" podem ser registradas como recebidas. Estado atual: ${sol.situacao}`);
  }

  const temDivergencia = Math.abs(Number(valorInformado) - Number(sol.valor_total_solicitado)) > 0.001;
  if (temDivergencia && !usarDivergencia) {
    throw new Error(`O valor informado (R$ ${valorInformado}) difere do valor solicitado (R$ ${sol.valor_total_solicitado}). Confirmação necessária.`);
  }
  if (temDivergencia && (!motivoDivergencia || motivoDivergencia.trim().length < 3)) {
    throw new Error('Por favor, informe o motivo da divergência (mínimo 3 caracteres).');
  }

  const payload = {
    situacao: 'nota_recebida',
    numero_nota: numeroNota?.trim() || null,
    data_emissao_nota: dataEmissao || null,
    nota_recebida_em: dataRecebimento || now,
    valor_nota_informado: Number(valorInformado),
    observacao: observacao?.trim() || null,
    divergencia_valor: temDivergencia,
    motivo_divergencia: temDivergencia ? motivoDivergencia.trim() : null,
    updated_at: now
  };

  const { error: updateErr } = await supabase
    .from('solicitacoes_nota_fiscal')
    .update(payload)
    .eq('id', solicitacaoId);
  if (updateErr) throw updateErr;

  try {
    await supabase.from('solicitacao_nota_fiscal_eventos').insert({
      solicitacao_id: solicitacaoId,
      situacao_anterior: 'solicitada',
      situacao_nova: 'nota_recebida',
      ocorrido_em: dataRecebimento || now,
      realizado_por: profileId,
      motivo: temDivergencia ? motivoDivergencia.trim() : null,
      detalhes: {
        acao: 'registrar_nota_recebida',
        numero_nota: numeroNota,
        valor_solicitado: sol.valor_total_solicitado,
        valor_informado: Number(valorInformado),
        divergencia: temDivergencia
      }
    });
  } catch (e) {}

  return { sucesso: true, id: solicitacaoId, situacao: 'nota_recebida', divergencia: temDivergencia };
}

export async function fetchHistoricoSolicitacaoNota(solicitacaoId) {
  const { data: eventos, error } = await supabase
    .from('solicitacao_nota_fiscal_eventos')
    .select('*')
    .eq('solicitacao_id', solicitacaoId)
    .order('ocorrido_em', { ascending: true });
  if (error) throw error;

  const profileIds = [...new Set((eventos || []).map(e => e.realizado_por).filter(Boolean))];
  let profileMap = {};
  if (profileIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id,nome_completo').in('id', profileIds);
    profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.nome_completo || '']));
  }

  return (eventos || []).map(e => ({
    id: e.id,
    tipo_evento: e.situacao_nova || e.tipo_evento || 'evento',
    situacao_anterior: e.situacao_anterior,
    situacao_nova: e.situacao_nova,
    ocorrido_em: e.ocorrido_em,
    criado_em: e.ocorrido_em,
    motivo: e.motivo,
    observacao: e.motivo || (e.detalhes?.motivo) || null,
    usuario_nome: profileMap[e.realizado_por] || 'Sistema/Administrador',
    realizado_por_nome: profileMap[e.realizado_por] || 'Sistema/Administrador',
    detalhes: e.detalhes || {}
  }));
}

export async function fetchDatasPagamentos() {
  const { data, error } = await supabase
    .from('solicitacao_nota_fiscal_eventos')
    .select('solicitacao_id, ocorrido_em, detalhes')
    .eq('situacao_nova', 'pago')
    .order('ocorrido_em', { ascending: false });
  if (error) {
    console.warn('[fetchDatasPagamentos]', error);
    return {};
  }
  const mapa = {};
  (data || []).forEach(e => {
    if (!e.solicitacao_id || mapa[e.solicitacao_id]) return;
    const candidatos = [e.detalhes?.data_pagamento, e.ocorrido_em].filter(Boolean);
    for (const c of candidatos) {
      const d = new Date(c);
      if (!isNaN(d.getTime())) { mapa[e.solicitacao_id] = c; break; }
    }
  });
  return mapa;
}

export async function registrarPagamentoDireto({
  solicitacaoId,
  valorPago,
  dataPagamento = null,
  observacao = '',
  profileId = null
}) {
  if (!solicitacaoId) throw new Error('ID da solicitação fiscal é obrigatório.');
  if (!valorPago || Number(valorPago) <= 0) throw new Error('Informe um valor de pagamento válido.');

  const now = new Date().toISOString();
  const { data: sol, error: solErr } = await supabase
    .from('solicitacoes_nota_fiscal')
    .select('*')
    .eq('id', solicitacaoId)
    .single();
  if (solErr || !sol) throw new Error('Solicitação de nota fiscal não encontrada.');
  if (sol.situacao === 'pago') throw new Error('Pagamento já registrado para esta solicitação.');
  if (sol.situacao !== 'nota_recebida' && sol.situacao !== 'em_pagamento') {
    throw new Error(`Somente solicitações com nota recebida podem ser marcadas como pagas. Estado atual: ${sol.situacao}`);
  }

  const { error: updateErr } = await supabase
    .from('solicitacoes_nota_fiscal')
    .update({ situacao: 'pago', updated_at: now })
    .eq('id', solicitacaoId);
  if (updateErr) throw updateErr;

  try {
    await supabase.from('solicitacao_nota_fiscal_eventos').insert({
      solicitacao_id: solicitacaoId,
      situacao_anterior: sol.situacao,
      situacao_nova: 'pago',
      ocorrido_em: now,
      realizado_por: profileId,
      motivo: observacao?.trim() || null,
      detalhes: {
        acao: 'registrar_pagamento',
        valor_pago: Number(valorPago),
        data_pagamento: dataPagamento || now.slice(0, 10),
        observacao: observacao?.trim() || null
      }
    });
  } catch (e) {}

  return { sucesso: true, id: solicitacaoId, situacao: 'pago' };
}


export async function previaRefazerFluxo(competenciaId, preceptorId = null, tipoAtuacao = null, vinculoAdmId = null, vinculoInternatoId = null) {
  const params = { p_competencia_id: competenciaId };
  if (preceptorId) params.p_preceptor_id = preceptorId;
  if (tipoAtuacao) params.p_tipo_atuacao = tipoAtuacao;
  if (vinculoAdmId) params.p_vinculo_adm_id = vinculoAdmId;
  if (vinculoInternatoId) params.p_vinculo_internato_id = vinculoInternatoId;
  const { data, error } = await supabase.rpc('previa_refazer_fluxo', params);
  if (error) throw error;
  return data;
}

export async function refazerFluxoCompetencia(competenciaId, preceptorId = null, tipoAtuacao = null, vinculoAdmId = null, vinculoInternatoId = null, confirmar = false) {
  const params = { p_competencia_id: competenciaId, p_confirmar: confirmar };
  if (preceptorId) params.p_preceptor_id = preceptorId;
  if (tipoAtuacao) params.p_tipo_atuacao = tipoAtuacao;
  if (vinculoAdmId) params.p_vinculo_adm_id = vinculoAdmId;
  if (vinculoInternatoId) params.p_vinculo_internato_id = vinculoInternatoId;
  const { data, error } = await supabase.rpc('refazer_fluxo_competencia', params);
  if (error) throw error;
  return data;
}

export async function previaRefazerVinculo({ vinculoAdmId = null, vinculoInternatoId = null } = {}) {
  const params = {};
  if (vinculoAdmId) params.p_vinculo_adm_id = vinculoAdmId;
  if (vinculoInternatoId) params.p_vinculo_internato_id = vinculoInternatoId;
  const { data, error } = await supabase.rpc('previa_refazer_vinculo', params);
  if (error) throw error;
  return data;
}

export async function refazerVinculo({ vinculoAdmId = null, vinculoInternatoId = null, confirmar = false } = {}) {
  const params = { p_confirmar: confirmar };
  if (vinculoAdmId) params.p_vinculo_adm_id = vinculoAdmId;
  if (vinculoInternatoId) params.p_vinculo_internato_id = vinculoInternatoId;
  const { data, error } = await supabase.rpc('refazer_vinculo', params);
  if (error) throw error;
  return data;
}

export async function previaExcluirVinculo({ vinculoAdmId = null, vinculoInternatoId = null } = {}) {
  const params = {};
  if (vinculoAdmId) params.p_vinculo_adm_id = vinculoAdmId;
  if (vinculoInternatoId) params.p_vinculo_internato_id = vinculoInternatoId;
  const { data, error } = await supabase.rpc('previa_excluir_vinculo', params);
  if (error) throw error;
  return data;
}

export async function excluirVinculo({ vinculoAdmId = null, vinculoInternatoId = null, confirmar = false } = {}) {
  const params = { p_confirmar: confirmar };
  if (vinculoAdmId) params.p_vinculo_adm_id = vinculoAdmId;
  if (vinculoInternatoId) params.p_vinculo_internato_id = vinculoInternatoId;
  const { data, error } = await supabase.rpc('excluir_vinculo', params);
  if (error) throw error;
  return data;
}

export async function previaExcluirPreceptor(preceptorId) {
  const { data, error } = await supabase.rpc('previa_excluir_preceptor', { p_preceptor_id: preceptorId });
  if (error) throw error;
  return data;
}

export async function excluirPreceptor(preceptorId, { confirmar = false } = {}) {
  const { data, error } = await supabase.rpc('excluir_preceptor', {
    p_preceptor_id: preceptorId,
    p_confirmar: confirmar
  });
  if (error) throw error;
  return data;
}

export async function fetchPresencasPorVinculo({ preceptorId, vinculoInternatoId, mes, ano }) {
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  const { data, error } = await supabase
    .from('presencas')
    .select('id, data_presenca, turno, status, local:locais(nome), setor:setores(nome)')
    .eq('preceptor_id', preceptorId)
    .eq('vinculo_internato_id', vinculoInternatoId)
    .neq('status', 'cancelada')
    .gte('data_presenca', dataInicio)
    .lte('data_presenca', dataFim)
    .order('data_presenca', { ascending: true })
    .order('turno', { ascending: true });
  if (error) throw error;
  return (data || []).map(p => ({
    ...p,
    local_nome: p.local?.nome || '',
    setor_nome: p.setor?.nome || ''
  }));
}

/**
 * Parte 9A: PDF-FINANCEIRO-9A
 * Fonte de dados unificada para o Demonstrativo Financeiro por Preceptor e Competência.
 *
 * Regra: Um único demonstrativo por preceptor e competência, agregando todas as atuações elegíveis.
 * Critérios de elegibilidade da atuação (fluxo simplificado — sem exigência de revisão):
 * 1. Pertencer ao mesmo preceptor e competência
 * 2. Estar calculada (status === 'calculado') com valor calculado
 * 3. Estar atualizada (sem presenças registradas/alteradas após a apuração)
 *
 * Revisão financeira (quando existir) é apenas conferência visual e NÃO bloqueia PDF/e-mail.
 *
 * @param {Object|string} params - { preceptorId, competenciaId } ou preceptorId diretamente
 * @param {string} [paramCompetenciaId] - competenciaId caso params seja string
 * @returns {Promise<Object>} { identificacaoFiscal (cadastro principal; usada por PDF/listas), competenciaInfo, atuacoesElegiveis (cada atuação com `identificacao` fiscal do vínculo; usada pelo e-mail), valorTotalGeral, impedimentos }
 */
export async function montarDadosDemonstrativoFinanceiro(params, paramCompetenciaId) {
  let preceptorId, competenciaId;
  if (typeof params === 'object' && params !== null) {
    preceptorId = params.preceptorId || params.preceptor_id;
    competenciaId = params.competenciaId || params.competencia_id;
  } else {
    preceptorId = params;
    competenciaId = paramCompetenciaId;
  }

  if (!preceptorId || !competenciaId) {
    throw new Error('preceptorId e competenciaId são obrigatórios para montar os dados do demonstrativo.');
  }

  // 1. Dados cadastrais do Preceptor (cadastro principal: nome, CPF, profissão, conselho).
  //    Modalidade/CNPJ/razão social da identificação fiscal vêm do vínculo de cada cálculo (passo 3).
  const { data: preceptor, error: precErr } = await supabase
    .from('preceptores')
    .select('id, nome_completo, cpf, cnpj, razao_social, conselho_tipo, conselho_numero, email, profissao, profissao_ref:profissoes!preceptores_profissao_id_fkey(nome), modalidade_ref:modalidades_pagamento!preceptores_modalidade_pagamento_id_fkey(nome)')
    .eq('id', preceptorId)
    .single();

  if (precErr || !preceptor) {
    throw new Error(`Preceptor não encontrado (${preceptorId}).`);
  }

  const profissaoNome = preceptor.profissao_ref?.nome || preceptor.profissao || '';
  // Identificação única do cadastro principal — usada pelo PDF, listas e pelo registro
  // da solicitação. O e-mail usa a identificação fiscal por vínculo (`identificacao`
  // em cada atuação), montada no passo 3 do laço de cálculos.
  const temCnpj = Boolean(preceptor.cnpj && preceptor.cnpj.trim());
  const identificacaoFiscal = temCnpj ? {
    tipo_identificacao: 'PJ',
    razao_social: preceptor.razao_social?.trim() || preceptor.nome_completo,
    cnpj: preceptor.cnpj.trim(),
    conselho_numero: preceptor.conselho_numero || '',
    conselho_tipo: preceptor.conselho_tipo || '',
    profissao: profissaoNome,
    nome: preceptor.nome_completo,
    cpf: null
  } : {
    tipo_identificacao: 'PF',
    nome: preceptor.nome_completo,
    cpf: preceptor.cpf?.trim() || '',
    conselho_numero: preceptor.conselho_numero || '',
    conselho_tipo: preceptor.conselho_tipo || '',
    profissao: profissaoNome,
    razao_social: null,
    cnpj: null
  };

  // 2. Informações da Competência
  const { data: comp, error: compErr } = await supabase
    .from('competencias')
    .select('id, ano, mes, data_inicio, data_fim, status')
    .eq('id', competenciaId)
    .single();

  if (compErr || !comp) {
    throw new Error(`Competência não encontrada (${competenciaId}).`);
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  const ultimoDia = new Date(comp.ano, comp.mes, 0).getDate();
  const dataInicioFormated = `01/${pad2(comp.mes)}/${comp.ano}`;
  const dataFimFormated = `${pad2(ultimoDia)}/${pad2(comp.mes)}/${comp.ano}`;

  const competenciaInfo = {
    competencia_id: comp.id,
    mes: comp.mes,
    ano: comp.ano,
    rotulo: apuracaoMesLabel(comp.mes, comp.ano),
    periodo_considerado: `${dataInicioFormated} a ${dataFimFormated}`
  };

  // 3. Buscar todos os cálculos do preceptor na competência
  const { data: calculos, error: calcErr } = await supabase
    .from('calculos')
    .select(`
      id, competencia_id, preceptor_id, tipo_atuacao, status,
      total_bruto, total_descontos, total_liquido, versao, calculado_em,
      quantidade_presencas, vinculo_adm_id, vinculo_internato_id
    `)
    .eq('preceptor_id', preceptorId)
    .eq('competencia_id', competenciaId)
    .order('created_at', { ascending: true });

  if (calcErr) throw calcErr;

  const atuacoesElegiveis = [];
  const impedimentos = [];

  const dataInicioStr = `${comp.ano}-${String(comp.mes).padStart(2, '0')}-01`;
  const dataFimStr = `${comp.ano}-${String(comp.mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  for (const calc of (calculos || [])) {
    const calcId = calc.id;
    const tipoAtuacao = calc.tipo_atuacao || (calc.vinculo_internato_id ? 'internato' : 'adm');

    // Rótulo da atuação para mensagens de impedimento específicas (não genéricas)
    let rotuloAtuacao = tipoAtuacao === 'internato' ? 'Internato' : 'Prática';
    try {
      if (tipoAtuacao === 'internato' && calc.vinculo_internato_id) {
        const { data: vRot } = await supabase
          .from('vinculos_internato')
          .select('internato:internatos(nome), periodo:periodos(numero, nome), local:locais(nome)')
          .eq('id', calc.vinculo_internato_id)
          .maybeSingle();
        const partes = [
          vRot?.internato?.nome,
          vRot?.periodo?.nome || (vRot?.periodo?.numero ? `${vRot.periodo.numero}º período` : null),
          vRot?.local?.nome
        ].filter(Boolean);
        if (partes.length) rotuloAtuacao = partes.join(' · ');
      } else if (tipoAtuacao === 'adm' && calc.vinculo_adm_id) {
        const { data: vRot } = await supabase
          .from('vinculos_adm')
          .select('disciplina:disciplinas(nome), periodo:periodos(numero, nome), local:locais(nome)')
          .eq('id', calc.vinculo_adm_id)
          .maybeSingle();
        const partes = [
          vRot?.disciplina?.nome,
          vRot?.periodo?.nome || (vRot?.periodo?.numero ? `${vRot.periodo.numero}º período` : null),
          vRot?.local?.nome
        ].filter(Boolean);
        if (partes.length) rotuloAtuacao = partes.join(' · ');
      }
    } catch (_) { /* rótulo é opcional */ }

    // A) Verificar status do cálculo
    if (calc.status !== 'calculado') {
      impedimentos.push({
        calculo_id: calcId,
        atuacao: rotuloAtuacao,
        motivo: `Atuação "${rotuloAtuacao}": cálculo com status '${calc.status}', aguardando apuração final.`
      });
      continue;
    }

    // A2) Valor calculado deve existir (pode ser 0 apenas se a apuração retornou valor explícito)
    if (calc.total_bruto === null || calc.total_bruto === undefined || calc.total_liquido === null || calc.total_liquido === undefined) {
      impedimentos.push({
        calculo_id: calcId,
        atuacao: rotuloAtuacao,
        motivo: `Atuação "${rotuloAtuacao}": cálculo sem valor calculado. Recalcule a competência.`
      });
      continue;
    }

    // B) Buscar presenças do vínculo nesta competência
    let presQuery = supabase
      .from('presencas')
      .select('id, data_presenca, turno, status, registrado_em, updated_at, local:locais(id, nome), setor:setores(id, nome)')
      .eq('preceptor_id', preceptorId)
      .neq('status', 'cancelada')
      .gte('data_presenca', dataInicioStr)
      .lte('data_presenca', dataFimStr)
      .order('data_presenca', { ascending: true })
      .order('turno', { ascending: true });

    if (tipoAtuacao === 'adm' && calc.vinculo_adm_id) {
      presQuery = presQuery.eq('vinculo_adm_id', calc.vinculo_adm_id);
    } else if (tipoAtuacao === 'internato' && calc.vinculo_internato_id) {
      presQuery = presQuery.eq('vinculo_internato_id', calc.vinculo_internato_id);
    }

    const { data: presencas } = await presQuery;
    const presencasData = presencas || [];

    // C) Verificar desatualização
    const calcTime = new Date(calc.calculado_em).getTime();
    const desatualizado = presencasData.some(p => {
      const regTime = p.registrado_em ? new Date(p.registrado_em).getTime() : 0;
      const updTime = p.updated_at ? new Date(p.updated_at).getTime() : 0;
      return Math.max(regTime, updTime) > calcTime;
    });

    if (desatualizado) {
      impedimentos.push({
        calculo_id: calcId,
        atuacao: rotuloAtuacao,
        motivo: `Atuação "${rotuloAtuacao}": cálculo desatualizado. Existem presenças registradas ou alteradas após a apuração (${new Date(calc.calculado_em).toLocaleString('pt-BR')}). É necessário recalcular a competência.`
      });
      continue;
    }

    // D) Revisão financeira NÃO é exigida neste fluxo (apenas conferência visual, se existir).

    // E) Se passou em todas as checagens, carregar os detalhes do vínculo e da regra
    let vinculoCtx = null;
    if (tipoAtuacao === 'adm' && calc.vinculo_adm_id) {
      const { data: v } = await supabase
        .from('vinculos_adm')
        .select('periodo:periodos(numero, nome), unidade:unidades(nome), disciplina:disciplinas(nome), local:locais(nome), setor:setores(nome)')
        .eq('id', calc.vinculo_adm_id)
        .maybeSingle();
      vinculoCtx = v;
    } else if (tipoAtuacao === 'internato' && calc.vinculo_internato_id) {
      const { data: v } = await supabase
        .from('vinculos_internato')
        .select('periodo:periodos(numero, nome), unidade:unidades(nome), internato:internatos(nome), local:locais(nome), setor:setores(nome), cnpj, razao_social, modalidade_ref:modalidades_pagamento!vinculos_internato_modalidade_pagamento_id_fkey(nome)')
        .eq('id', calc.vinculo_internato_id)
        .maybeSingle();
      vinculoCtx = v;
    }

    let regraNome = '';
    const vinculoTargetId = tipoAtuacao === 'adm' ? calc.vinculo_adm_id : calc.vinculo_internato_id;
    if (vinculoTargetId) {
      let rQuery = supabase
        .from('vinculo_regras_financeiras')
        .select('regra:regras_financeiras(nome)')
        .eq('status', 'ativo');
      if (tipoAtuacao === 'adm') {
        rQuery = rQuery.eq('vinculo_adm_id', vinculoTargetId);
      } else {
        rQuery = rQuery.eq('vinculo_internato_id', vinculoTargetId);
      }
      const { data: vr } = await rQuery.limit(1).maybeSingle();
      regraNome = vr?.regra?.nome || '';
    }

    const internatoOuDisciplina = vinculoCtx?.internato?.nome
      || vinculoCtx?.disciplina?.nome
      || (tipoAtuacao === 'internato' ? 'Internato' : 'Prática');

    const periodoAcademico = vinculoCtx?.periodo?.nome
      || (vinculoCtx?.periodo?.numero ? `${vinculoCtx.periodo.numero}º período` : '');

    const unidadeNome = vinculoCtx?.unidade?.nome || null;
    const localNome = vinculoCtx?.local?.nome || '';
    const setorNome = vinculoCtx?.setor?.nome || '';

    const presencasFormatadas = presencasData.map(p => ({
      id: p.id,
      data_presenca: p.data_presenca,
      turno: p.turno,
      local_nome: p.local?.nome || localNome,
      setor_nome: p.setor?.nome || setorNome
    }));

    const valorAtuacao = Number(calc.total_bruto || calc.total_liquido || 0);

    // Identificação fiscal desta atuação: modalidade/CNPJ/razão social consultados no
    // vínculo relacionado ao cálculo (internato: vinculos_internato; prática: cadastro
    // principal, única fonte de dados fiscais do vínculo adm). CPF e dados profissionais
    // sempre do cadastro principal. PJ somente quando modalidade NFS e vínculo com CNPJ.
    const modalidadeNome = (tipoAtuacao === 'internato'
      ? (vinculoCtx?.modalidade_ref?.nome || '')
      : (preceptor.modalidade_ref?.nome || ''));
    const ehNfs = modalidadeNome.toLowerCase().includes('nfs');
    const cnpjVinculo = (tipoAtuacao === 'internato'
      ? (vinculoCtx?.cnpj || '')
      : (preceptor.cnpj || ''));
    const razaoVinculo = (tipoAtuacao === 'internato'
      ? (vinculoCtx?.razao_social || '')
      : (preceptor.razao_social || ''));
    const temCnpjVinculo = Boolean(String(cnpjVinculo || '').trim());
    const identificacaoAtuacao = (ehNfs && temCnpjVinculo) ? {
      tipo_identificacao: 'PJ',
      razao_social: String(razaoVinculo).trim(),
      cnpj: String(cnpjVinculo).trim(),
      profissao: profissaoNome,
      conselho_numero: preceptor.conselho_numero || '',
      conselho_tipo: preceptor.conselho_tipo || '',
      nome: preceptor.nome_completo,
      cpf: null
    } : {
      tipo_identificacao: 'PF',
      nome: preceptor.nome_completo,
      cpf: preceptor.cpf?.trim() || '',
      profissao: profissaoNome,
      conselho_numero: preceptor.conselho_numero || '',
      conselho_tipo: preceptor.conselho_tipo || '',
      razao_social: null,
      cnpj: null
    };

    atuacoesElegiveis.push({
      calculo_id: calcId,
      tipo_atuacao: tipoAtuacao,
      vinculo_adm_id: calc.vinculo_adm_id || null,
      vinculo_internato_id: calc.vinculo_internato_id || null,
      internato_ou_disciplina: internatoOuDisciplina,
      periodo_academico: periodoAcademico,
      unidade_nome: unidadeNome,
      local_nome: localNome,
      setor_nome: setorNome,
      regra_financeira: regraNome,
      presencas: presencasFormatadas,
      total_turnos: presencasFormatadas.length || Number(calc.quantidade_presencas || 0),
      valor_atuacao: valorAtuacao,
      versao: calc.versao,
      identificacao: identificacaoAtuacao
    });
  }

  const valorTotalGeral = atuacoesElegiveis.reduce((acc, at) => acc + Number(at.valor_atuacao || 0), 0);

  return {
    identificacaoFiscal,
    competenciaInfo,
    atuacoesElegiveis,
    valorTotalGeral,
    impedimentos
  };
}

// =====================================================================
// ESTÁGIO 12A: CONTROLE E RPCS DE PAGAMENTO POR PRECEPTOR E COMPETÊNCIA
// =====================================================================

export async function iniciarPagamento({
  solicitacaoId,
  divergenciaAutorizada = false,
  motivoDivergencia = '',
  observacao = ''
}) {
  if (!solicitacaoId) {
    throw new Error('ID da solicitação fiscal é obrigatório.');
  }

  try {
    const { data, error } = await supabase.rpc('iniciar_pagamento', {
      p_solicitacao_id: solicitacaoId,
      p_divergencia_autorizada: Boolean(divergenciaAutorizada),
      p_motivo_divergencia: motivoDivergencia?.trim() || null,
      p_observacao: observacao?.trim() || null
    });
    if (!error && data) return data;
    if (error) throw error;
  } catch (rpcErr) {
    console.warn('Erro ao chamar RPC iniciar_pagamento:', rpcErr);
    throw rpcErr;
  }
}

export async function concluirPagamento({
  pagamentoId,
  valorPago = null,
  observacao = ''
}) {
  if (!pagamentoId) {
    throw new Error('ID do pagamento é obrigatório.');
  }

  try {
    const { data, error } = await supabase.rpc('concluir_pagamento', {
      p_pagamento_id: pagamentoId,
      p_valor_pago: valorPago !== null && valorPago !== undefined ? Number(valorPago) : null,
      p_observacao: observacao?.trim() || null
    });
    if (!error && data) return data;
    if (error) throw error;
  } catch (rpcErr) {
    console.warn('Erro ao chamar RPC concluir_pagamento:', rpcErr);
    throw rpcErr;
  }
}

export async function cancelarPagamento({
  pagamentoId,
  motivo = ''
}) {
  if (!pagamentoId) {
    throw new Error('ID do pagamento é obrigatório.');
  }
  if (!motivo || motivo.trim().length < 5) {
    throw new Error('Por favor, informe o motivo do cancelamento (mínimo 5 caracteres).');
  }

  try {
    const { data, error } = await supabase.rpc('cancelar_pagamento', {
      p_pagamento_id: pagamentoId,
      p_motivo: motivo.trim()
    });
    if (!error && data) return data;
    if (error) throw error;
  } catch (rpcErr) {
    console.warn('Erro ao chamar RPC cancelar_pagamento:', rpcErr);
    throw rpcErr;
  }
}

export async function buscarPagamentoPorSolicitacao(solicitacaoId) {
  if (!solicitacaoId) return null;
  const { data, error } = await supabase
    .from('pagamentos')
    .select(`
      *,
      pagamento_itens(*)
    `)
    .eq('solicitacao_id', solicitacaoId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function previaPagamentoLote(competenciaId, preceptorIds) {
  if (!competenciaId) {
    throw new Error('Competência é obrigatória para a prévia de pagamento em lote.');
  }
  const ids = Array.isArray(preceptorIds) ? preceptorIds.filter(Boolean) : [];
  if (ids.length === 0) {
    throw new Error('Selecione ao menos um preceptor para a prévia de pagamento em lote.');
  }

  try {
    const { data, error } = await supabase.rpc('previa_pagamento_lote', {
      p_competencia_id: competenciaId,
      p_preceptor_ids: ids
    });
    if (error) throw error;
    return data;
  } catch (rpcErr) {
    console.warn('Erro ao chamar RPC previa_pagamento_lote:', rpcErr);
    throw rpcErr;
  }
}

export async function executarPagamentoLote({
  competenciaId,
  preceptorIds,
  dataPagamento,
  observacao = ''
}) {
  if (!competenciaId) {
    throw new Error('Competência é obrigatória para o pagamento em lote.');
  }
  const ids = Array.isArray(preceptorIds) ? preceptorIds.filter(Boolean) : [];
  if (ids.length === 0) {
    throw new Error('Selecione ao menos um preceptor para registrar o pagamento em lote.');
  }
  if (!dataPagamento) {
    throw new Error('Informe a data do pagamento.');
  }

  try {
    const { data, error } = await supabase.rpc('executar_pagamento_lote', {
      p_competencia_id: competenciaId,
      p_preceptor_ids: ids,
      p_data_pagamento: dataPagamento,
      p_observacao: observacao?.trim() || null
    });
    if (error) throw error;
    return data;
  } catch (rpcErr) {
    console.warn('Erro ao chamar RPC executar_pagamento_lote:', rpcErr);
    throw rpcErr;
  }
}

export async function excluirEscala({
  escalaId,
  competenciaId,
  profileId = null
}) {
  if (!escalaId || !competenciaId) {
    throw new Error('ID da escala e competência são obrigatórios.');
  }

  const now = new Date().toISOString();

  try {
    const { data: escala, error: escalaErr } = await supabase
      .from('escalas')
      .select('*, escalas_itens(*)')
      .eq('id', escalaId)
      .single();

    if (escalaErr || !escala) throw new Error('Escala não encontrada.');

    const { data: competencia, error: compErr } = await supabase
      .from('competencias')
      .select('*')
      .eq('id', competenciaId)
      .single();

    if (compErr || !competencia) throw new Error('Competência não encontrada.');

    const itensNaCompetencia = (escala.escalas_itens || []).filter(item =>
      item.data >= competencia.data_inicio && item.data <= competencia.data_fim
    );

    if (itensNaCompetencia.length === 0) {
      throw new Error('Nenhum item da escala encontrado dentro da competência.');
    }

    const { error: delItensErr } = await supabase
      .from('escalas_itens')
      .delete()
      .eq('escala_id', escalaId)
      .gte('data', competencia.data_inicio)
      .lte('data', competencia.data_fim);

    if (delItensErr) throw delItensErr;

    const { data: itensRestantes, error: itensRestErr } = await supabase
      .from('escalas_itens')
      .select('id')
      .eq('escala_id', escalaId);

    if (itensRestErr) throw itensRestErr;

    if ((itensRestantes || []).length === 0) {
      const { error: delEscalaErr } = await supabase
        .from('escalas')
        .delete()
        .eq('id', escalaId);
      if (delEscalaErr) throw delEscalaErr;
    }

    const { error: delPresencasErr } = await supabase
      .from('presencas')
      .delete()
      .eq('escala_id', escalaId)
      .gte('data_presenca', competencia.data_inicio)
      .lte('data_presenca', competencia.data_fim);

    if (delPresencasErr) throw delPresencasErr;

    const { data: calculos, error: calcErr } = await supabase
      .from('calculos')
      .select('id')
      .eq('competencia_id', competenciaId)
      .eq('vinculo_internato_id', escala.vinculo_internato_id)
      .eq('vinculo_adm_id', escala.vinculo_adm_id);

    if (calcErr) throw calcErr;

    const calculoIds = (calculos || []).map(c => c.id);
    if (calculoIds.length > 0) {
      await supabase.from('calculo_itens').delete().in('calculo_id', calculoIds);
      await supabase.from('aprovacoes').delete().in('calculo_id', calculoIds);
      await supabase.from('saldo_movimentos').delete().in('calculo_id', calculoIds);
      await supabase.from('processo_calculos').delete().in('calculo_id', calculoIds);
      await supabase.from('calculos').delete().in('id', calculoIds);
    }

    await supabase.from('audit_logs').insert({
      tabela: 'escalas',
      registro_id: escalaId,
      operacao: 'DELETE',
      dados_anteriores: escala,
      dados_novos: null,
      realizado_por: profileId,
      ocorrido_em: now,
      detalhes: { acao: 'excluir_escala_competencia', competencia_id: competenciaId, itens_removidos: itensNaCompetencia.length }
    });

    return { sucesso: true, itensRemovidos: itensNaCompetencia.length, escalaRemovida: (itensRestantes || []).length === 0 };
  } catch (e) {
    console.error('[excluirEscala]', e);
    throw e;
  }
}

export async function excluirAtuacao({
  preceptorId,
  competenciaId,
  vinculoInternatoId = null,
  vinculoAdmId = null,
  profileId = null
}) {
  if (!preceptorId || !competenciaId || (!vinculoInternatoId && !vinculoAdmId)) {
    throw new Error('Preceptor, competência e vínculo são obrigatórios.');
  }

  const now = new Date().toISOString();

  try {
    const { data: competencia, error: compErr } = await supabase
      .from('competencias')
      .select('*')
      .eq('id', competenciaId)
      .single();

    if (compErr || !competencia) throw new Error('Competência não encontrada.');

    const { data: calculos, error: calcErr } = await supabase
      .from('calculos')
      .select('id')
      .eq('competencia_id', competenciaId)
      .eq('preceptor_id', preceptorId)
      .eq('vinculo_internato_id', vinculoInternatoId)
      .eq('vinculo_adm_id', vinculoAdmId);

    if (calcErr) throw calcErr;

    const calculoIds = (calculos || []).map(c => c.id);

    const { error: delPresencasErr } = await supabase
      .from('presencas')
      .delete()
      .eq('preceptor_id', preceptorId)
      .eq('vinculo_internato_id', vinculoInternatoId)
      .eq('vinculo_adm_id', vinculoAdmId)
      .gte('data_presenca', competencia.data_inicio)
      .lte('data_presenca', competencia.data_fim);

    if (delPresencasErr) throw delPresencasErr;

    if (calculoIds.length > 0) {
      await supabase.from('calculo_itens').delete().in('calculo_id', calculoIds);
      await supabase.from('aprovacoes').delete().in('calculo_id', calculoIds);
      await supabase.from('saldo_movimentos').delete().in('calculo_id', calculoIds);
      await supabase.from('processo_calculos').delete().in('calculo_id', calculoIds);
      await supabase.from('solicitacoes_nota_fiscal').delete().in('calculo_id', calculoIds);
      await supabase.from('calculos').delete().in('id', calculoIds);
    }

    await supabase.from('audit_logs').insert({
      tabela: 'calculos',
      registro_id: calculoIds.join(','),
      operacao: 'DELETE',
      dados_anteriores: { calculo_ids: calculoIds, preceptor_id: preceptorId, competencia_id: competenciaId },
      dados_novos: null,
      realizado_por: profileId,
      ocorrido_em: now,
      detalhes: { acao: 'excluir_atuacao_competencia', vinculo_internato_id: vinculoInternatoId, vinculo_adm_id: vinculoAdmId }
    });

    return { sucesso: true, calculosRemovidos: calculoIds.length };
  } catch (e) {
    console.error('[excluirAtuacao]', e);
    throw e;
  }
}


