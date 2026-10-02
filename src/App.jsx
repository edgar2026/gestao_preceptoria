import React,{useMemo,useState,useCallback,useEffect,useRef}from "react";
import{
  CalendarCheck,CalendarDays,CalendarOff,CalendarPlus,Check,
  ChevronDown,ChevronLeft,ChevronRight,ChevronsLeft,ChevronsRight,CircleDollarSign,ClipboardCheck,Eye,EyeOff,
  FileClock,FileSearch,Filter,History,
  Landmark,LockKeyhole,Menu,MoreHorizontal,Pencil,Plus,
  ReceiptText,Search,Settings,SlidersHorizontal,Stethoscope,
  Trash2,UsersRound,WalletCards,X,
  Shield,ShieldOff,Loader2,AlertCircle,LogIn,LogOut,
  UserRound,BriefcaseBusiness,MessageSquareText,
  Download,FileText,Printer,
  Info,MapPin,Calculator,RotateCw,BarChart3,Mail,FileSpreadsheet,Send,Paperclip,
  Play,CheckCircle2,XCircle,AlertTriangle,DollarSign,CreditCard,Ban,CheckCircle,CheckCheck
} from "lucide-react";
import {supabase} from "./supabase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { baixarXlsx, S_BOLD, S_MONEY } from "./services/xlsx";
import Logo from "./components/Logo";
import{
    fetchPreceptores,fetchPreceptoresPratica,fetchPreceptoresInternato,buscarPreceptorPorCpf,
    fetchVinculosPratica,fetchVinculosInternato,fetchVinculosInternatoPorPreceptor,fetchVinculoLocais,
    insertPreceptor,updatePreceptor,inativarPreceptor,reativarPreceptor,inativarVinculoPratica,reativarVinculoPratica,inativarVinculoInternato,reativarVinculoInternato,insertVinculoPratica,insertVinculoInternato,updateVinculoPratica,updateVinculoInternato,
    fetchEmailsCopia,salvarEmailsCopia,validarEmailsCopia,normalizarEmailCopia,montarDestinatariosOutlook,mensagemErroDestinatariosEmail,montarUrlOutlook,
    fetchPeriodosByRange,fetchDisciplinas,fetchDisciplinasAtivas,fetchInternatosAtivos,fetchSemestresAtivos,
     fetchLocais,fetchSetores,fetchLocaisAtivos,fetchSetoresAtivos,upsertVinculoLocal,
    fetchProfissoes,fetchProfissoesAtivas,insertProfissao,updateProfissao,
    fetchUnidades,fetchUnidadesAtivas,insertUnidade,updateUnidade,deleteUnidade,checkUnidadeDependencies,
    fetchModalidadesPagamento,fetchModalidadesPagamentoAtivas,insertModalidadePagamento,updateModalidadePagamento,deleteModalidadePagamento,inativarModalidadePagamento,checkModalidadePagamentoDependencies,
    fetchPeriodosCadastro,insertPeriodoCadastro,updatePeriodoCadastro,deletePeriodo,inativarPeriodo,checkPeriodoDependencies,
    fetchSemestresCadastro,insertSemestreCadastro,updateSemestreCadastro,deleteSemestre,inativarSemestre,checkSemestreDependencies,
    insertDisciplinaCadastro,updateDisciplinaCadastro,
    insertLocalCadastro,updateLocalCadastro,
    insertSetorCadastro,updateSetorCadastro,
    checkDuplicateName,
    checkProfissaoDependencies,checkDisciplinaDependencies,checkLocalDependencies,checkSetorDependencies,
    deleteProfissao,deleteDisciplina,deleteLocal,deleteSetor,
    inativarProfissao,inativarDisciplina,inativarLocal,inativarSetor,inativarRegistro,
    fetchVinculosLocaisParaEscalas,fetchVinculosParaEscalasPage,fetchEscalasPorVinculo,salvarEscala,inativarEscala,reativarEscala,
    fetchPresencas,fetchPreceptoresComEscalaNoDia,registrarPresencaCoordenador,corrigirPresencaAdministrativa,fetchPresencasConsolidadas,fetchFolhaPresenca,fetchCalendarioPresencas,fetchAjustes,fetchConfiguracoes,fetchAuditLogs,
    fetchUsuarios,atualizarUsuario,criarUsuarioViaEdge,bloquearUsuario,inativarReativarUsuario,redefinirAcessoUsuario,redefinirAcessoViaEdge,deletarUsuarioViaEdge,marcarPrimeiroAcessoConcluido,atualizarDadosUsuario,enviarRecuperacaoSenha,
    fetchRegrasFinanceiras,salvarRegraFinanceira,inativarRegraFinanceira,reativarRegraFinanceira,checarConflitoRegraFinanceira,
    fetchPreceptoresPraticaParaRegras,fetchPreceptoresInternatoParaRegras,
    fetchInternatos,insertInternato,updateInternato,deleteInternato,inativarInternato,checkInternatoDependencies,
    fetchDisciplinasByInternato,setInternatoDisciplinas,fetchCursos,
    fetchRegrasFinanceirasAtivas,salvarVinculoRegraFinanceira,getRegraAtiva,isVinculoCompleto,getVinculoCamposFaltantes,isDadosGeraisCompleto,
    fetchCoordenadoresAtivos,fetchVinculoCoordenadores,salvarVinculoCoordenadores,
    verificarDuplicidadeVinculo,
    formatCurrencyBRL,formatInitialValueBRL,
    fetchCompetencias,criarCompetencia,calcularCompetencia,fetchApuracoes,fetchDetalhesCalculo,fetchResumoApuracao,
    autoApurarFilaFinanceira,buscarFilaFinanceira,verificarDesatualizacaoCompetencia,fetchDetalhesCalculoCompleto,
    resolverCompetenciaIdPorCalculos,anexarCamposFilaFinanceira,
    fetchRevisoesCompetencia,salvarRevisaoFinanceira,
    previaRefazerFluxo,refazerFluxoCompetencia,
    previaRefazerVinculo,refazerVinculo,
    previaExcluirVinculo,excluirVinculo,
    previaExcluirPreceptor,excluirPreceptor,
    apuracaoMesLabel,fetchPainelPagamentos,registrarSolicitacaoNota,fetchPresencasPorVinculo,montarDadosDemonstrativoFinanceiro,fetchDatasPagamentos,
    prepararSolicitacaoNotaUnificada,confirmarEnvioSolicitacaoNota,corrigirConfirmacaoEnvioNota,registrarRecebimentoNotaFiscal,fetchHistoricoSolicitacaoNota,fetchSolicitacoesNotaFiscal,registrarPagamentoDireto,mensagemErroAmigavel,ehMensagemConflito,
    iniciarPagamento,concluirPagamento,cancelarPagamento,buscarPagamentoPorSolicitacao,
    previaPagamentoLote,executarPagamentoLote,
    montarMapaSaldosVinculos,resumoSaldoVinculos,chaveVinculoLinha,passaFiltroSaldo,itensCabecalhoSaldo,percentualSaldoTexto,larguraBarraSaldo,montarRankingSaldoVinculos,valoresSaldoExport,
    statusBadge,fmtData,fmtTimestamp,turnoLabel,diaLabel,fmtCompetencia
  } from "./services/queries";

// Filtros rápidos de pagamento do Controle Financeiro.
const PAG_LOTE_FILTROS=[
  ["todos","Todos"],
  ["aguardando_conferencia","Aguardando conferência"],
  ["email_nao_enviado","E-mail não enviado"],
  ["nao_pagos","Não pagos"],
  ["pagos","Pagos"],
  ["com_pendencia","Com pendência"]
];

// Filtros rápidos de saldo da lista "Acompanhamento dos preceptores".
// São independentes dos filtros rápidos de situação (um de cada grupo ativo por vez).
const SALDO_FILTROS=[
  {k:"acima80",rot:"Saldo acima de 80% utilizado"},
  {k:"esgotado",rot:"Saldo esgotado"},
  {k:"nao_informado",rot:"Saldo não informado"}
];
const SALDO_VAZIO={
  acima80:"Nenhum preceptor acima de 80% de saldo utilizado para os filtros selecionados.",
  esgotado:"Nenhum preceptor com saldo esgotado para os filtros selecionados.",
  nao_informado:"Nenhum preceptor sem saldo informado para os filtros selecionados."
};



function systemDialog(options={}){
  return new Promise(resolve=>window.dispatchEvent(new CustomEvent('system-dialog',{detail:{...options,resolve}})));
}
function systemConfirm(message,title='Confirmar ação',extra={}){return systemDialog({type:'confirm',title,message,...extra});}
function systemAlert(message,title='Atenção',extra={}){return systemDialog({type:'alert',title,message,...extra});}
function mostrarConflito(mensagem){
  const texto=String(mensagem||"").trim();
  const nl=texto.indexOf("\n");
  const titulo=nl>0?texto.slice(0,nl).trim():"Conflito de horário";
  const corpo=nl>0?texto.slice(nl+1).trim():texto;
  return systemAlert(corpo,titulo);
}
function SystemDialogHost(){
  const[d,setD]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const h=e=>{setD(e.detail);setBusy(false);setError('')};window.addEventListener('system-dialog',h);return()=>window.removeEventListener('system-dialog',h)},[]);
  useEffect(()=>{if(!d)return;const k=e=>{if(e.key==='Escape'&&!busy){d.resolve(false);setD(null)}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[d,busy]);
  if(!d)return null;
  const close=v=>{if(busy)return;d.resolve(v);setD(null)};
  const confirm=async()=>{if(!d.onConfirm){close(true);return}setBusy(true);setError('');try{await d.onConfirm();d.resolve(true);setD(null)}catch(e){setError(e.message||'Não foi possível concluir a operação.');setBusy(false)}};
  return <div className="system-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&d.type!=='working')close(false)}}><section className="system-dialog" role="dialog" aria-modal="true"><header><div className="system-dialog-icon">{d.danger?<AlertCircle/>:<Info/>}</div><div><small>{d.eyebrow||'GESTÃO DE PRECEPTORIA'}</small><h3>{d.title||'Atenção'}</h3></div><button onClick={()=>close(false)} disabled={busy} aria-label="Fechar"><X/></button></header><div className="system-dialog-body"><p>{d.message}</p>{d.details&&<div className="system-dialog-details">{d.details}</div>}{d.warning&&<div className="system-dialog-warning"><AlertCircle size={17}/>{d.warning}</div>}{error&&<div className="system-dialog-error">{error}</div>}</div><footer>{d.type==='confirm'&&<button className="btn secondary" onClick={()=>close(false)} disabled={busy}>Cancelar</button>}<button className={"btn"+(d.danger?' danger':'')} onClick={confirm} disabled={busy}>{busy?<Loader2 size={16} className="spin"/>:d.icon||<Check size={16}/>} {busy?(d.busyLabel||'Processando...'):(d.confirmLabel||'Entendi')}</button></footer></section></div>;
}

function maskCpf(v){
  const d=String(v||"").replace(/\D/g,"").slice(0,11);
  if(d.length<=3)return d;
  if(d.length<=6)return d.slice(0,3)+"."+d.slice(3);
  if(d.length<=9)return d.slice(0,3)+"."+d.slice(3,6)+"."+d.slice(6);
  return d.slice(0,3)+"."+d.slice(3,6)+"."+d.slice(6,9)+"-"+d.slice(9);
}
function maskCnpj(v){
  const d=String(v||"").replace(/\D/g,"").slice(0,14);
  if(d.length<=2)return d;
  if(d.length<=5)return d.slice(0,2)+"."+d.slice(2);
  if(d.length<=8)return d.slice(0,2)+"."+d.slice(2,5)+"."+d.slice(5);
  if(d.length<=12)return d.slice(0,2)+"."+d.slice(2,5)+"."+d.slice(5,8)+"/"+d.slice(8);
  return d.slice(0,2)+"."+d.slice(2,5)+"."+d.slice(5,8)+"/"+d.slice(8,12)+"-"+d.slice(12);
}

// ── Máscara BRL (digitação em tempo real) ──
function maskBRL(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  return 'R$ ' + reais.toLocaleString('pt-BR') + ',' + String(centavos).padStart(2, '0');
}
function parseBRLDecimal(v) {
  const digits = String(v || '').replace(/\D/g, '');
  if (!digits) return null;
  const val = parseInt(digits, 10) / 100;
  return val > 0 ? val : null;
}

const NAV_BASE=[
  ["Operação",[["escalas","Escalas",CalendarDays],["registrar-presencas","Registrar Presenças",CalendarCheck],["presencas","Presenças",CalendarCheck]]],
  ["Financeiro",[["controle-financeiro","Controle financeiro",WalletCards],["dashboard","Dashboard",BarChart3]]],
  ["Cadastros",[["preceptores-internato","Preceptores do Internato",Stethoscope],["cadastros-auxiliares","Cadastros auxiliares",ClipboardCheck],["regras","Regras financeiras",SlidersHorizontal]]],
  ["Governança",[["auditoria","Auditoria",History],["configuracoes","Configurações",Settings]]]
];
const COORDENACAO_ALLOWED=["escalas","registrar-presencas","presencas"];

function getNav(isAdmin,isCoordenacao){
  if(isAdmin){
    return NAV_BASE.map(([grupo,items])=>{
      if(grupo==="Governança"){
        return[grupo,[...items,["usuarios","Gerenciar Usuários",UsersRound]]];
      }
      return[grupo,items];
    });
  }
  return NAV_BASE.map(([grupo,items])=>{
    if(grupo==="Operação"){
      return[grupo,items.filter(([id])=>COORDENACAO_ALLOWED.includes(id))];
    }
    return null;
  }).filter(Boolean);
}

const PAGE_META={
  "preceptores-pratica":{title:"Preceptores Prática",desc:"Cadastros e vínculos com disciplinas, períodos, escalas e vigências.",btn:"Novo preceptor Prática",cols:["Unidade","Nome","Profissão","Disciplina","Período","Modalidade","Valor","Situação"]},
  "preceptores-internato":{title:"Preceptores do Internato",desc:"Vínculos com internatos, hospitais, setores, escalas e vigências.",btn:"Novo preceptor do Internato",cols:["Unidade","Nome","Profissão","Vínculos","Modalidade de pagamento","Situação"]},
  "cadastros-auxiliares":{title:"Cadastros auxiliares",desc:"Profissões, disciplinas, locais e setores de estágio e prática.",btn:null,cols:["Nome","Situação","Ações"]},
  escalas:{title:"Escalas",desc:"Preceptores ativos, vínculos, dias, turnos e vigências.",btn:null,cols:["Vínculo","Internato","Período","Unidade","Local","Setor","Situação da escala"]},
  "registrar-presencas":{title:"Registrar Presenças",desc:"Calendário operacional com escalas e presenças do mês. Selecione uma data para registrar.",btn:null,cols:[]},
  presencas:{title:"Presenças",desc:"Presenças reais confirmadas, consolidadas por preceptor, competência, local e unidade.",btn:"Registrar presença",cols:["Preceptor","Local","Setor","Unidade","Turnos","Total","Ações"]},
  regras:{title:"Regras financeiras",desc:"Valores, formas de cálculo, condições, prioridades e vigências.",btn:"Nova regra financeira",cols:["Regra","Aplicação","Cálculo","Vigência","Situação"]},
  "controle-financeiro":{title:"Controle financeiro",desc:"Apuração, revisão, demonstrativos, notas fiscais e pagamentos.",btn:"",cols:["Preceptor","Competência","Atuações","Turnos","Valor","Situação","Ações"]},
  "apuracao-mensal":{title:"Apuração mensal",desc:"Fila financeira automática baseada em presenças confirmadas.",btn:"",cols:["Preceptor","Ref. Mensal","Unidade","Disciplina/Internato","Local","Presenças","Regra","Valor","Ações"]},
  memoria:{title:"Memória de cálculo",desc:"Componentes detalhados de cada valor devido.",btn:null,cols:["Preceptor","Competência","Itens","Bruto","Descontos","Situação"]},
  saldos:{title:"Saldos autorizados",desc:"Autorizações, reservas, consumo, estornos e disponibilidade.",btn:"Novo saldo",cols:["Favorecido","CH","Autorizado","Consumido","Disponível","Situação"]},
  processos:{title:"Processos e movimentos",desc:"CHs, processos, movimentos, deferimentos e andamento.",btn:"Novo processo",cols:["Processo/CH","Favorecido","Competência","Movimento","Valor","Situação"]},
  pagamentos:{title:"Pagamentos",desc:"Solicitação de nota fiscal, demonstrativos e acompanhamento do pagamento.",btn:null,cols:[]},
  dashboard:{title:"Dashboard",desc:"Indicadores, filtros e relatórios consolidados do Internato.",btn:null,cols:[]},
  auditoria:{title:"Auditoria",desc:"Histórico de alterações, aprovações e operações críticas.",btn:null,cols:["Data e hora","Usuário","Ação","Registro","Detalhe","Origem"]},
  configuracoes:{title:"Configurações",desc:"Perfis, permissões, semestres, feriados e parâmetros gerais.",btn:"Nova configuração",cols:["Configuração","Categoria","Valor atual","Última alteração","Responsável","Situação"]},
  usuarios:{title:"Gerenciar Usuários",desc:"Cadastro de usuários do sistema, papéis e acesso.",btn:"Novo usuário",cols:["Nome","E-mail","Perfil","Situação","Último acesso","Ações"]}
};

function Btn({children,onClick,secondary=false,icon:Icon=Plus,disabled=false}){
  return <button className={secondary?"btn secondary":"btn"} onClick={onClick} disabled={disabled}>{Icon&&<Icon size={16}/>} {children}</button>;
}

function LoginScreen({onLogin}){
  const[email,setEmail]=useState("");
  const[senha,setSenha]=useState("");
  const[showSenha,setShowSenha]=useState(false);
  const[erro,setErro]=useState("");
  const[carregando,setCarregando]=useState(false);
  const handle=async(e)=>{
    e.preventDefault();
    setErro("");setCarregando(true);
    if(!email.trim()){setErro("Informe seu e-mail.");setCarregando(false);return}
    if(!senha){setErro("Informe sua senha.");setCarregando(false);return}
    const{data,error}=await supabase.auth.signInWithPassword({email,password:senha});
    if(error){
      const msg=error.message.includes("Invalid login")
        ?"Credenciais incorretas. Verifique seu e-mail e senha."
        :error.message.includes("Email not confirmed")
        ?"E-mail não confirmado. Verifique sua caixa de entrada."
        :"Não foi possível realizar o login. Tente novamente.";
      setErro(msg);setCarregando(false);return}
    onLogin(data.session);
    setCarregando(false);
  };
  return <div className="login-screen">
    <div className="login-card">
      <Logo variant="completa"/>
      <h2>Gestão de Preceptoria</h2>
      <p>Acesse o painel administrativo</p>
      <form onSubmit={handle}>
        <label><b>E-mail</b><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus/></label>
        <label><b>Senha</b><div className="pw-input-wrap"><input type={showSenha?"text":"password"} value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Sua senha" required/><button type="button" className="pw-toggle" onClick={()=>setShowSenha(!showSenha)} tabIndex={-1}>{showSenha?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
        {erro&&<div className="login-erro"><AlertCircle size={14}/> {erro}</div>}
        <button className="btn" type="submit" disabled={carregando}>{carregando?<Loader2 size={16} className="spin"/>:<><LogIn size={16}/></>} Entrar</button>
      </form>
      <a href="/recuperar-senha" className="auth-forgot-link">Esqueci minha senha?</a>
    </div>
  </div>;
}

function PrimeiroAcessoScreen({onComplete}){
  const[novaSenha,setNovaSenha]=useState("");
  const[confirmarSenha,setConfirmarSenha]=useState("");
  const[erro,setErro]=useState("");
  const[carregando,setCarregando]=useState(false);
  const[senhaValida,setSenhaValida]=useState(false);

  const validarSenha=(s)=>{
    return s.length>=8&&/[A-Z]/.test(s)&&/[a-z]/.test(s)&&/[0-9]/.test(s)&&/[^A-Za-z0-9]/.test(s);
  };

  useEffect(()=>{
    setSenhaValida(validarSenha(novaSenha)&&novaSenha===confirmarSenha&&novaSenha!=="ser@2026");
  },[novaSenha,confirmarSenha]);

  const handle=async(e)=>{
    e.preventDefault();
    setErro("");setCarregando(true);
    try{
      if(!novaSenha||!confirmarSenha){setErro("Preencha ambos os campos.");setCarregando(false);return}
      if(!validarSenha(novaSenha)){setErro("Senha fraca. Mínimo 8 caracteres com maiúscula, minúscula, número e símbolo.");setCarregando(false);return}
      if(novaSenha!==confirmarSenha){setErro("As senhas não coincidem.");setCarregando(false);return}
      if(novaSenha==="ser@2026"){setErro("A nova senha deve ser diferente da temporária.");setCarregando(false);return}
      const{error}=await supabase.auth.updateUser({password:novaSenha});
      if(error)throw error;
      const{data:{session:s}}=await supabase.auth.getSession();
      if(s){
        const{data:profile}=await supabase.from("profiles").select("id").eq("user_id",s.user.id).single();
        if(profile){
          await marcarPrimeiroAcessoConcluido(profile.id);
        }
      }
      onComplete();
    }catch(e){setErro(e.message||"Erro ao atualizar senha")}
    setCarregando(false);
  };

  return<div className="login-screen">
    <div className="login-card" style={{maxWidth:460}}>
      <Logo variant="completa"/>
      <h2>Crie sua nova senha</h2>
      <p style={{color:"var(--text-soft)",marginBottom:20}}>Por seguranca, voce deve alterar sua senha temporaria antes de acessar o sistema.</p>
      <form onSubmit={handle}>
        <label><b>Nova senha</b><input type="password" value={novaSenha} onChange={e=>setNovaSenha(e.target.value)} placeholder="Minimo 8 caracteres" required autoFocus/></label>
        <label><b>Confirmar senha</b><input type="password" value={confirmarSenha} onChange={e=>setConfirmarSenha(e.target.value)} placeholder="Repita a nova senha" required/></label>
        {novaSenha.length>0&&<div className="pw-rules">
          {[
            [novaSenha.length>=8,`${novaSenha.length}/8 caracteres`],
            [/[A-Z]/.test(novaSenha),"Uma letra maiuscula"],
            [/[a-z]/.test(novaSenha),"Uma letra minuscula"],
            [/[0-9]/.test(novaSenha),"Um numero"],
            [/[^A-Za-z0-9]/.test(novaSenha),"Um simbolo"],
            [novaSenha!=="ser@2026","Diferente de ser@2026"],
            [novaSenha===confirmarSenha&&confirmarSenha.length>0,"Senhas coincidem"],
          ].map(([ok,text])=><span key={text} className={ok?"ok":"bad"}><Check size={12}/> {text}</span>)}
        </div>}
        {erro&&<div className="login-erro"><AlertCircle size={14}/> {erro}</div>}
        <button className="btn" type="submit" disabled={carregando||!senhaValida}>{carregando?<Loader2 size={16} className="spin"/>:<><Check size={16}/></>} Atualizar senha</button>
      </form>
      <a href="/login" className="auth-forgot-link" onClick={async(e)=>{e.preventDefault();await supabase.auth.signOut();window.location.href="/login";}}>Sair</a>
    </div>
  </div>;
}

const FICHA_NI="Não informado";

function PreceptorFicha({row,page,onAddVinculo,onEditVinculo,onInactivateVinculo}){
  const isPratica=page==="preceptores-pratica";
  const isInternato=page==="preceptores-internato";
  const vinc=isPratica?row.vinculo_adm:row.vinculo_internato;
  const[vinculos,setVinculos]=useState([]);
  const[vinculosLoading,setVinculosLoading]=useState(false);
  const txt=(v)=>(v===null||v===undefined||v===""||v==="-")?FICHA_NI:String(v);
  const dataFmt=(v)=>v?fmtData(v):FICHA_NI;
  const money=(v)=>v!=null&&v!==""?formatCurrencyBRL(v):FICHA_NI;
  const cpfFmt=(v)=>{const d=String(v||"").replace(/\D/g,"");return d.length===11?maskCpf(d):txt(v);};
  const cnpjFmt=(v)=>{const d=String(v||"").replace(/\D/g,"");return d.length===14?maskCnpj(d):txt(v);};
  const situacao=row.vinculo_status==="ativo"||row.vinculo_status==="inativo"?row.vinculo_status:"-";
  const vincModalidade=!isPratica?(vinc?.modalidade_pagamento_id||null):null;
  const vincCnpj=!isPratica?(vinc?.cnpj||null):null;
  const vincRazaoSocial=!isPratica?(vinc?.razao_social||null):null;

  useEffect(()=>{
    if(!isInternato||!row?.id)return;
    let active=true;
    (async()=>{
      setVinculosLoading(true);
      try{
        const data=await fetchVinculosInternatoPorPreceptor(row.id);
        if(active)setVinculos(data);
      }catch(e){console.error("[PreceptorFicha vinculos]",e)}
      if(active)setVinculosLoading(false);
    })();
    return()=>{active=false};
  },[row?.id,isInternato]);

  return <div className="ficha">
    <div className="ficha-body">
      <section className="ficha-section">
        <h4 className="ficha-section-title"><UserRound size={15}/> Identificação</h4>
        <div className="ficha-grid">
          <div className="ficha-item wide"><small>Nome completo</small><b>{txt(row.nome_completo)}</b></div>
          <div className="ficha-item"><small>CPF</small><b>{row.cpf?cpfFmt(row.cpf):FICHA_NI}</b></div>
          <div className="ficha-item"><small>Número do conselho</small><b>{txt(row.conselho_numero)}</b></div>
          <div className="ficha-item"><small>E-mail principal</small><b>{txt(row.email)}</b></div>
          <div className="ficha-item"><small>Telefone</small><b>{txt(row.telefone)}</b></div>
          <div className="ficha-item"><small>Profissão</small><b>{txt(row.profissao)}</b></div>
        </div>
      </section>

      <section className="ficha-section">
        <h4 className="ficha-section-title"><WalletCards size={15}/> Pagamento</h4>
        <div className="ficha-grid">
          {!isPratica&&<>
            <div className="ficha-item"><small>Modalidade de pagamento</small><b>{txt(vinc?.modalidade_pagamento_id?(vinc.modalidade_ref?.nome||row.modalidade_ref?.nome):row.modalidade_ref?.nome)}</b></div>
            <div className="ficha-item"><small>CNPJ</small><b>{(vinc?.cnpj||row.cnpj)?cnpjFmt(vinc?.cnpj||row.cnpj):FICHA_NI}</b></div>
            <div className="ficha-item"><small>Razão social</small><b>{txt(vinc?.razao_social||row.razao_social)}</b></div>
          </>}
          {isPratica&&<>
            <div className="ficha-item"><small>Modalidade de pagamento</small><b>{txt(row.modalidade_ref?.nome)}</b></div>
            <div className="ficha-item"><small>CNPJ</small><b>{row.cnpj?cnpjFmt(row.cnpj):FICHA_NI}</b></div>
            <div className="ficha-item"><small>Razão social</small><b>{txt(row.razao_social)}</b></div>
          </>}
        </div>
      </section>

      {isPratica&&<section className="ficha-section">
        <h4 className="ficha-section-title"><BriefcaseBusiness size={15}/> Vínculo</h4>
        <div className="ficha-grid">
          <div className="ficha-item"><small>Unidade</small><b>{txt(vinc?.unidade?.nome||row.unidade)}</b></div>
          <div className="ficha-item"><small>Tipo de vínculo</small><b><span className="ficha-tag">Prática</span></b></div>
          <div className="ficha-item"><small>Disciplina</small><b>{txt(vinc?.disciplina?.nome||row.disciplina)}</b></div>
          <div className="ficha-item"><small>Período</small><b>{txt(vinc?.periodo?.numero ? `${vinc.periodo.numero}º período` : row.periodo)}</b></div>
          <div className="ficha-item"><small>Local</small><b>{txt(vinc?.local?.nome||row.local)}</b></div>
          <div className="ficha-item"><small>Semestre</small><b>{txt(vinc?.semestre?.codigo)}</b></div>
          <div className="ficha-item"><small>Data inicial</small><b>{dataFmt(vinc?.data_inicio)}</b></div>
          <div className="ficha-item"><small>Data final</small><b>{dataFmt(vinc?.data_fim)}</b></div>
          <div className="ficha-item"><small>Situação</small><b><em className={statusBadge(situacao)}>{situacao==="ativo"?"Ativo":situacao==="inativo"?"Inativo":"Sem vínculo"}</em></b></div>
        </div>
      </section>}

      {isInternato&&<section className="ficha-section vinculos-section">
        <div className="vinculos-section-header">
          <h4><BriefcaseBusiness size={16}/> Vínculos de atuação</h4>
          {onAddVinculo&&<button className="btn secondary" style={{fontSize:12,padding:"5px 12px"}} onClick={onAddVinculo}><Plus size={14}/> Adicionar vínculo</button>}
        </div>
        {vinculosLoading&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 0",fontSize:13,color:"var(--text-muted)"}}><Loader2 size={14} className="spin"/> Carregando vínculos...</div>}
        {!vinculosLoading&&vinculos.length===0&&<div style={{fontSize:13,color:"var(--text-muted)",padding:"12px 0",textAlign:"center"}}>Nenhum vínculo cadastrado.</div>}
        {!vinculosLoading&&vinculos.map((v,idx)=>{
          const vAtivo=v.status==="ativo";
          const vSituacao=vAtivo?"ativo":"inativo";
          const regraVinc=v.regraAtiva;
          const vinculoLabel=`Vínculo ${idx+1}`;
          const internatoLabel=v.internato?.nome||"";
          const periodoLabel=v.periodo?.numero?`${v.periodo.numero}º período`:"";
          const identParts=[internatoLabel,periodoLabel].filter(Boolean).join(" | ");
          return <div key={v.id} className={"vinculo-card"+(vAtivo?"":" vinculo-inativo")}>
            <div className="vinculo-card-header">
              <div className="vinculo-card-header-left">
                <span className="vinculo-card-badge"><BriefcaseBusiness size={11}/> {vinculoLabel}</span>
                {identParts&&<span className="vinculo-card-ident">{identParts}</span>}
              </div>
              <div className="vinculo-card-header-right">
                <em className={statusBadge(vSituacao)} style={{fontSize:11}}>{vAtivo?"Ativo":"Inativo"}</em>
                {vAtivo&&!v.vinculo_completo&&v.vinculo_campos_faltantes?.length>0&&(
                  <span style={{fontSize:11,color:"var(--danger)",display:"flex",flexDirection:"column",gap:2,marginTop:4}}>
                    <span style={{fontWeight:600}}>Pendência para Escala</span>
                    {v.vinculo_campos_faltantes.map(f=>(<span key={f}>• {f}</span>))}
                  </span>
                )}
                {onEditVinculo&&<button className="vinculo-edit-btn" onClick={()=>onEditVinculo(v)}><Pencil size={13}/> Editar vínculo</button>}
                {onInactivateVinculo&&<button className={"vinculo-toggle-btn"+(vAtivo?"":" reativar")} title={vAtivo?"Inativar vínculo":"Reativar vínculo"} onClick={()=>onInactivateVinculo(v)}>{vAtivo?<LogOut size={14}/>:<LogIn size={14}/>}</button>}
              </div>
            </div>
            <div className="vinculo-card-body">
              <div className="vinculo-card-grid">
                <div><small>Unidade</small><b>{txt(v.unidade?.nome)}</b></div>
                <div><small>Internato</small><b>{txt(v.internato?.nome)}</b></div>
                <div><small>Período</small><b>{v.periodo?.numero?`${v.periodo.numero}º período`:FICHA_NI}</b></div>
                <div><small>Local</small><b>{txt(v.local?.nome)}</b></div>
                <div><small>Setor</small><b>{txt(v.setor?.nome)}</b></div>
                <div><small>Semestre</small><b>{txt(v.semestre?.codigo)}</b></div>
                <div><small>Vigência</small><b>{dataFmt(v.data_inicio)}{v.data_fim?` a ${dataFmt(v.data_fim)}`:""}</b></div>
                {v.coordenadores&&v.coordenadores.length>0&&<div className="wide"><small>Coordenadores</small><b>{v.coordenadores.map(c=>c.nome_completo).join(", ")}</b></div>}
                {regraVinc&&<div className="wide"><small>Regra financeira</small><b>{txt(regraVinc.regra?.nome)}</b></div>}
                {!regraVinc&&<div className="wide"><small>Regra financeira</small><b><em className="warn">Pendente</em></b></div>}
                <div><small>Saldo semestral</small><b>{v.valor_inicial!=null?formatCurrencyBRL(v.valor_inicial):FICHA_NI}</b></div>
              </div>
            </div>
          </div>;
        })}
      </section>}

      {isPratica&&<section className="ficha-section">
        <h4 className="ficha-section-title"><CircleDollarSign size={15}/> Regra financeira</h4>
        <div className="ficha-grid">
          {row.regraAtiva
            ?<>
              <div className="ficha-item wide"><small>Regra aplicada</small><b>{txt(row.regraAtiva.regra?.nome)}</b></div>
              <div className="ficha-item"><small>Tipo de cálculo</small><b>{txt(FORMA_CALCULO_LABELS[row.regraAtiva.regra?.forma_calculo])}</b></div>
              <div className="ficha-item"><small>Aplicada desde</small><b>{dataFmt(row.regraAtiva.data_inicio)}</b></div>
              <div className="ficha-item wide"><small>Componentes</small><b>{(row.regraAtiva.regra?.componentes||[]).filter(c=>c.status==="ativo").map(c=>`${TIPO_COMPONENTE_LABELS[c.tipo]||c.tipo}${c.valor!=null?` (${formatCurrencyBRL(c.valor)})`:""}`).join("; ")||"Sem componentes ativos"}</b></div>
            </>
            :<div className="ficha-item wide"><small>Regra financeira</small><b><em className="warn">Pendente</em></b></div>}
        </div>
      </section>}

      {row.observacoes&&<section className="ficha-section">
        <h4 className="ficha-section-title"><MessageSquareText size={15}/> Observações</h4>
        <div className="ficha-obs">{row.observacoes}</div>
      </section>}
    </div>
  </div>;
}

function gerarPDF(row, esc, datasTurnos) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (day && month && year) return `${day}/${month}/${year}`;
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const cleanFileName = (text) => {
    if (!text) return '';
    return text.toString()
      .replace(/[/\\?*<>|:\"']+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .trim();
  };

  const preceptorName = cleanFileName(row.preceptor_nome || 'Preceptor');
  const semestre = cleanFileName(row.semestre_codigo) || 'Semestre';
  const fileName = `Escala_${preceptorName}_${semestre}.pdf`;

  // 1. Header Banner (Navy Blue with Gold Accent Line)
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, 210, 28, 'F');
  
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 28, 210, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('MEDICINA UNINASSAU', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text('Sistema de Gestão de Preceptoria', 14, 22);

  // 2. Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138);
  doc.text('Escala de Preceptoria', 14, 40);

  // 3. Preceptor Info Box
  let yPos = 48;
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`Preceptor: ${row.preceptor_nome || '-'}`, 14, yPos);
  
  const modalidadeText = row.tipo_atuacao === 'adm' ? 'Prática' : row.tipo_atuacao === 'internato' ? 'Internato' : (row.modalidade_label || '-');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Modalidade: ${modalidadeText}`, 14, yPos + 6);

  yPos += 14;

  // Academic Info Fields (Omitting empty fields)
  const isVal = (val) => val && val !== '-' && val !== 'null' && val !== 'undefined' && String(val).trim() !== '';
  const academicFields = [];
  if (isVal(row.unidade_nome)) academicFields.push({ label: 'Unidade', val: row.unidade_nome });
  if (row.tipo_atuacao === 'adm' && isVal(row.disciplina_nome)) academicFields.push({ label: 'Disciplina', val: row.disciplina_nome });
  if (row.tipo_atuacao === 'internato' && isVal(row.internato_nome)) academicFields.push({ label: 'Internato', val: row.internato_nome });
  if (isVal(row.periodo_nome)) academicFields.push({ label: 'Período', val: row.periodo_nome });
  if (isVal(row.local_nome)) academicFields.push({ label: 'Local', val: row.local_nome });
  if (isVal(row.setor_nome)) academicFields.push({ label: 'Setor', val: row.setor_nome });
  if (isVal(row.semestre_codigo)) academicFields.push({ label: 'Semestre', val: row.semestre_codigo });

  if (academicFields.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.text('Dados Acadêmicos', 14, yPos);
    yPos += 5;

    const gridRows = [];
    for (let i = 0; i < academicFields.length; i += 2) {
      const f1 = academicFields[i];
      const f2 = academicFields[i + 1];
      gridRows.push([
        f1 ? `${f1.label}: ${f1.val}` : '',
        f2 ? `${f2.label}: ${f2.val}` : ''
      ]);
    }

    autoTable(doc, {
      startY: yPos,
      body: gridRows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2, textColor: [30, 41, 59] },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
      margin: { left: 14, right: 14 }
    });

    yPos = doc.lastAutoTable.finalY + 8;
  }

  // 4. Vigência & Situação
  if (esc) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.text('Vigência e Situação', 14, yPos);
    yPos += 5;

    const vigenciaStr = esc.data_fim 
      ? `${formatDate(esc.data_inicio)} até ${formatDate(esc.data_fim)}`
      : `a partir de ${formatDate(esc.data_inicio)}`;
    const situacaoStr = esc.status === 'ativo' ? 'Ativa' : 'Inativa';

    autoTable(doc, {
      startY: yPos,
      body: [
        [`Vigência: ${vigenciaStr}`, `Situação: ${situacaoStr}`]
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2, textColor: [30, 41, 59] },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 60 } },
      margin: { left: 14, right: 14 }
    });

    yPos = doc.lastAutoTable.finalY + 8;

    // 5. Dates & Shifts Table
    if (datasTurnos && datasTurnos.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 58, 138);
      doc.text('Escala de Atendimento (Datas e Turnos)', 14, yPos);
      yPos += 4;

      const tableData = datasTurnos.map(item => [
        item.dataFmtStr,
        item.diaSemanaCap,
        Array.isArray(item.turnos) ? item.turnos.join(', ') : item.turnos
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Data', 'Dia da Semana', 'Turno']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        styles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 }
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }
  }

  // 6. Generation Timestamp & Institutional Footer on all pages
  const totalPages = doc.internal.getNumberOfPages();
  const nowStr = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.height;

    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 15, 196, pageHeight - 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Gerado em: ${nowStr}`, 14, pageHeight - 10);
    doc.text(`Medicina UNINASSAU — Sistema de Gestão de Preceptoria`, 105, pageHeight - 10, { align: 'center' });
    doc.text(`Página ${i} de ${totalPages}`, 196, pageHeight - 10, { align: 'right' });
  }

  doc.save(fileName);
}

const DIAS_SEMANA_EXT = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
function diaSemanaStr(iso){
  if(!iso)return '-';
  const d=new Date(String(iso)+'T12:00:00');
  return DIAS_SEMANA_EXT[d.getDay()]||'-';
}

function gerarFolhaPresencaPDF(detalhe){
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const pageW=210;
  const margin=14;

  const formatDate=(d)=>{if(!d)return'';const[y,m,dd]=String(d).split('-');return dd&&m&&y?`${dd}/${m}/${y}`:d;};
  const clean=(t)=>String(t||'').replace(/[/\\?*<>|:"']+/g,'_').replace(/\s+/g,'_').replace(/_+/g,'_').trim();
  const fileName=`Folha_de_Presenca_${clean(detalhe.preceptor_nome)||'Preceptor'}_${clean(detalhe.competencia)||'Competencia'}.pdf`;

  // Header: navy band + gold accent
  doc.setFillColor(30,58,138);
  doc.rect(0,0,pageW,30,'F');
  doc.setFillColor(217,119,6);
  doc.rect(0,30,pageW,1.6,'F');
  doc.setFont('helvetica','bold');
  doc.setFontSize(13);
  doc.setTextColor(255,255,255);
  doc.text('MEDICINA UNINASSAU',margin,15);
  doc.setFont('helvetica','normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226,232,240);
  doc.text('Sistema de Gestão de Preceptoria',margin,22);

  // Title
  let y=44;
  doc.setFont('helvetica','bold');
  doc.setFontSize(15);
  doc.setTextColor(30,58,138);
  doc.text('Folha de Presença da Preceptoria',margin,y);
  y+=7;

  // Basic data (omit empty)
  const isVal=(v)=>v&&v!=='-'&&v!=='null'&&v!=='undefined'&&String(v).trim()!=='';
  const campos=[];
  campos.push({label:'Preceptor',val:detalhe.preceptor_nome});
  campos.push({label:'Competência',val:detalhe.competencia_label||detalhe.competencia});
  campos.push({label:'Modalidade',val:detalhe.modalidade_label});
  if(isVal(detalhe.unidade_nome))campos.push({label:'Unidade',val:detalhe.unidade_nome});
  if(detalhe.tipo_atuacao==='adm'&&isVal(detalhe.disciplina_nome))campos.push({label:'Disciplina',val:detalhe.disciplina_nome});
  if(detalhe.tipo_atuacao==='internato'&&isVal(detalhe.internato_nome))campos.push({label:'Internato',val:detalhe.internato_nome});
  if(isVal(detalhe.periodo_nome))campos.push({label:'Período',val:detalhe.periodo_nome});
  if(isVal(detalhe.local_nome))campos.push({label:'Local',val:detalhe.local_nome});
  if(isVal(detalhe.setor_nome))campos.push({label:'Setor',val:detalhe.setor_nome});

  const gridRows=[];
  for(let i=0;i<campos.length;i+=2){
    const f1=campos[i],f2=campos[i+1];
    gridRows.push([f1?`${f1.label}: ${f1.val}`:'',f2?`${f2.label}: ${f2.val}`:'']);
  }
  if(gridRows.length){
    autoTable(doc,{
      startY:y,
      body:gridRows,
      theme:'plain',
      styles:{fontSize:9,cellPadding:2,textColor:[30,41,59]},
      columnStyles:{0:{cellWidth:91},1:{cellWidth:91}},
      margin:{left:margin,right:margin}
    });
    y=doc.lastAutoTable.finalY+8;
  }else{
    y+=4;
  }

  // Presences table grouped by month (only real records)
  const itens=Array.isArray(detalhe.itens)?detalhe.itens:[];
  const porMes={};
  itens.forEach(i=>{
    if(!i.data_presenca)return;
    const mk=String(i.data_presenca).slice(0,7);
    if(!porMes[mk])porMes[mk]={};
    if(!porMes[mk][i.data_presenca])porMes[mk][i.data_presenca]={manha:'',tarde:'',noite:''};
    porMes[mk][i.data_presenca][i.turno]='X';
  });
  const meses=Object.keys(porMes).sort();
  const head=[['Data','Dia da semana','Manhã','Tarde','Noite']];
  const headStyles={fillColor:[30,58,138],textColor:[255,255,255],fontStyle:'bold',fontSize:8.5,halign:'center'};
  const colStyles={0:{cellWidth:38},1:{cellWidth:44},2:{cellWidth:36},3:{cellWidth:36},4:{cellWidth:36}};

  if(meses.length){
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.setTextColor(30,58,138);
    doc.text('Presenças Confirmadas',margin,y);
    y+=3;
    meses.forEach(mk=>{
      const dias=porMes[mk];
      const dateKeys=Object.keys(dias).sort();
      doc.setFont('helvetica','bold');
      doc.setFontSize(9);
      doc.setTextColor(30,58,138);
      doc.text(fmtCompetencia(mk),margin,y);
      y+=2;
      const body=dateKeys.map(dk=>[formatDate(dk),diaSemanaStr(dk),dias[dk].manha,dias[dk].tarde,dias[dk].noite]);
      autoTable(doc,{
        startY:y,
        head,
        body,
        theme:'striped',
        headStyles,
        styles:{fontSize:8.5,cellPadding:2.5,halign:'center'},
        columnStyles:colStyles,
        margin:{left:margin,right:margin},
        alternateRowStyles:{fillColor:[248,250,252]}
      });
      y=doc.lastAutoTable.finalY+6;
    });
  }else{
    doc.setFont('helvetica','italic');
    doc.setFontSize(9);
    doc.setTextColor(100,116,139);
    doc.text('Nenhuma presença real registrada nesta competência.',margin,y);
    y+=8;
  }

  y+=2;
  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.setTextColor(30,58,138);
  doc.text(`Total de turnos confirmados: ${itens.length}`,margin,y);
  y+=8;

  // Footer + timestamp on all pages
  const totalPages=doc.internal.getNumberOfPages();
  const nowStr=`${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  for(let i=1;i<=totalPages;i++){
    doc.setPage(i);
    const pageHeight=doc.internal.pageSize.height;
    doc.setDrawColor(226,232,240);
    doc.line(margin,pageHeight-15,pageW-margin,pageHeight-15);
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(100,116,139);
    doc.text(`Gerado em: ${nowStr}`,margin,pageHeight-10);
    doc.text('Medicina UNINASSAU — Sistema de Gestão de Preceptoria',pageW/2,pageHeight-10,{align:'center'});
    doc.text(`Página ${i} de ${totalPages}`,pageW-margin,pageHeight-10,{align:'right'});
  }

  doc.save(fileName);
}

function EscalaDetail({ row, onEdit, onClose }) {
  const escalas = row.escalas || [];
  const [selIdx, setSelIdx] = useState(0);
  const esc = escalas[selIdx];
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  const handleClose = () => {
    setSelIdx(0);
    if (onClose) onClose();
  };

  const itens = esc ? (Array.isArray(esc.itens) ? esc.itens : []) : [];
  const datasTurnos = useMemo(() => {
    if (!esc || !itens.length) return [];
    const dateGroups = {};
    itens.forEach((i) => {
      if (!i.data) return;
      if (!dateGroups[i.data]) dateGroups[i.data] = [];
      dateGroups[i.data].push(i.turno);
    });
    const result = [];
    Object.keys(dateGroups).sort().forEach((iso) => {
      const d = new Date(iso + 'T12:00:00');
      const dataFmtStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
      const diaSemanaCap = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
      result.push({
        iso,
        dataFmtStr,
        diaSemanaCap,
        turnos: dateGroups[iso].map(turnoLabel)
      });
    });
    return result;
  }, [esc, itens]);

  const itensDetalhe = useMemo(() => {
    if (!esc || !itens.length) return [];
    const legado = row.setor_nome && row.setor_nome !== '-' ? row.setor_nome : '';
    return itens.map((i) => {
      const d = i.data ? new Date(i.data + 'T12:00:00') : null;
      return {
        data: i.data || '',
        dataFmtStr: d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-',
        diaSemanaCap: d ? (() => { const s = d.toLocaleDateString('pt-BR', { weekday: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); })() : '-',
        turno: turnoLabel(i.turno),
        turnoKey: i.turno || '',
        setor: i.setor_nome || legado || '-',
        situacao: esc.status === 'ativo' ? 'Ativa' : 'Inativa'
      };
    }).sort((a, b) => a.data.localeCompare(b.data) || a.turno.localeCompare(b.turno));
  }, [esc, itens, row.setor_nome]);

  const datasPorMes = useMemo(() => {
    return itensDetalhe.reduce((acc, item) => {
      const date = new Date(item.data + 'T00:00:00');
      const mesAnoStr = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const mesAnoCap = mesAnoStr.charAt(0).toUpperCase() + mesAnoStr.slice(1);
      if (!acc[mesAnoCap]) acc[mesAnoCap] = [];
      acc[mesAnoCap].push(item);
      return acc;
    }, {});
  }, [itensDetalhe]);

  const handleGeneratePDF = async () => {
    if (gerandoPDF || !esc) return;
    setGerandoPDF(true);
    setPdfError(null);
    try {
      await gerarPDF(row, esc, datasTurnos);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setPdfError('Falha ao gerar PDF. Tente novamente.');
    } finally {
      setGerandoPDF(false);
    }
  };

  const isVal = (val) => val && val !== '-' && val !== 'null' && val !== 'undefined' && String(val).trim() !== '';

  return (
    <div className="ficha">
      <div className="ficha-body">
        {/* Preceptor Academic Info Grid */}
        <section className="ficha-section">
          <h4 className="ficha-section-title"><UserRound size={15}/> Dados Acadêmicos</h4>
          <div className="ficha-grid">
            {isVal(row.unidade_nome) && (
              <div className="ficha-item">
                <small>Unidade</small>
                <b>{row.unidade_nome}</b>
              </div>
            )}
            {row.tipo_atuacao === 'adm' && isVal(row.disciplina_nome) && (
              <div className="ficha-item">
                <small>Disciplina</small>
                <b>{row.disciplina_nome}</b>
              </div>
            )}
            {row.tipo_atuacao === 'internato' && isVal(row.internato_nome) && (
              <div className="ficha-item">
                <small>Internato</small>
                <b>{row.internato_nome}</b>
              </div>
            )}
            {isVal(row.periodo_nome) && (
              <div className="ficha-item">
                <small>Período</small>
                <b>{row.periodo_nome}</b>
              </div>
            )}
            {isVal(row.local_nome) && (
              <div className="ficha-item">
                <small>Local</small>
                <b>{row.local_nome}</b>
              </div>
            )}
            {isVal(row.setor_nome) && (
              <div className="ficha-item">
                <small>Setor</small>
                <b>{row.setor_nome}</b>
              </div>
            )}
            {isVal(row.semestre_codigo) && (
              <div className="ficha-item">
                <small>Semestre</small>
                <b>{row.semestre_codigo}</b>
              </div>
            )}
          </div>
        </section>

        {/* Dates and Shifts */}
        {esc && (
          <>
            <section className="ficha-section">
              <h4 className="ficha-section-title"><CalendarCheck size={15}/> Datas, Turnos e Setores</h4>
              {itensDetalhe.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma data cadastrada nesta escala.</div>
              ) : (
                <>
                  <div className="escala-item-head" aria-hidden="true">
                    <span>Data</span><span>Dia</span><span>Turno</span><span>Setor</span><span>Situação</span>
                  </div>
                  {Object.entries(datasPorMes).map(([mesAno, items]) => (
                    <div key={mesAno} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold-600)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '.05em' }}>
                        {mesAno}
                      </div>
                      {items.map((item, idx) => (
                        <div key={(item.data || 'i') + '-' + idx} className="escala-item-row">
                          <span className="data-date-str">{item.dataFmtStr}</span>
                          <span className="data-weekday">{item.diaSemanaCap}</span>
                          <span className={`turno-badge turno-${item.turnoKey.toLowerCase()}`}>{item.turno}</span>
                          <span className="escala-item-setor">{item.setor}</span>
                          <span className="escala-item-situacao">{item.situacao}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </section>

            {/* Vigência */}
            <section className="ficha-section">
              <h4 className="ficha-section-title"><ClipboardCheck size={15}/> Vigência</h4>
              <div className="ficha-vigencia-line">
                <b>Vigência:</b> {esc.data_fim ? `${fmtData(esc.data_inicio)} até ${fmtData(esc.data_fim)}` : `a partir de ${fmtData(esc.data_inicio)}`}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Fixed Footer */}
      <footer className="ficha-footer">
        <Btn secondary icon={Pencil} onClick={() => onEdit(esc)} disabled={gerandoPDF || !esc}>
          Editar escala
        </Btn>
        <Btn secondary icon={Download} onClick={handleGeneratePDF} disabled={gerandoPDF || !esc}>
          {gerandoPDF ? 'Gerando PDF...' : 'Gerar PDF'}
        </Btn>
        <Btn icon={Check} onClick={handleClose} disabled={gerandoPDF}>
          Fechar
        </Btn>
      </footer>
      {pdfError && <div style={{ padding: '0 22px 10px', color: 'var(--danger)', fontSize: 12, textAlign: 'right' }}>{pdfError}</div>}
    </div>
  );
}

function EscalaIncompleta({row,onCompletar,onClose}){
  const faltantes=(row.vinculo_campos_faltantes||[]);
  return <div className="form"><div className="grid">
    <div style={{gridColumn:"1/-1",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:14,color:"var(--danger)",display:"flex",gap:10,alignItems:"flex-start"}}>
      <AlertCircle size={18} style={{flexShrink:0,marginTop:1}}/>
      <div>
        <b style={{display:"block",fontSize:14}}>Complete o vínculo do preceptor antes de criar a escala.</b>
        <span style={{fontSize:13,color:"#7f1d1d"}}>O vínculo de {row.preceptor_nome||"este preceptor"} está com o cadastro incompleto.</span>
      </div>
    </div>
    {faltantes.length>0&&<div style={{gridColumn:"1/-1",fontSize:13,color:"var(--text)"}}>
      <b style={{display:"block",marginBottom:8}}>Campos ausentes:</b>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {faltantes.map(f=>(
          <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
            <span style={{width:16,height:16,borderRadius:"50%",background:"var(--danger-bg)",color:"var(--danger)",display:"grid",placeItems:"center",flexShrink:0,fontWeight:700,fontSize:10}}>!</span>
            {f}
          </div>
        ))}
      </div>
    </div>}
  </div><footer>
    <Btn secondary icon={X} onClick={onClose}>Fechar</Btn>
    <Btn icon={Pencil} onClick={onCompletar}>Completar cadastro</Btn>
  </footer></div>;
}

function EscalasCalendar({formData,set,v,setores=[]}){
  const isPratica=v("tipo_atuacao")==="adm";
  const itens=formData._itens||[];
  const today=new Date();
  const[calMonth,setCalMonth]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1));
  const[selDate,setSelDate]=useState(null);
  const[modalVigencia,setModalVigencia]=useState(null);
  const calYear=calMonth.getFullYear();
  const calMon=calMonth.getMonth();
  const firstDay=new Date(calYear,calMon,1).getDay();
  const daysInMonth=new Date(calYear,calMon+1,0).getDate();
  const monthNames=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const dayLabels=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const turnoLabels={manha:"Manhã",tarde:"Tarde",noite:"Noite"};

  const vigenciaInicio=formData._vigencia_inicio||null;
  const vigenciaFim=formData._vigencia_fim||null;

  function fmtDateISO(d,m,y){
    const mm=String(m+1).padStart(2,"0");
    const dd=String(d).padStart(2,"0");
    return `${y}-${mm}-${dd}`;
  }

  function fmtDateBR(iso){
    if(!iso)return"";
    const[y,m,d]=iso.split("-");
    return`${d}/${m}/${y}`;
  }

  function isDateBeforeVigencia(d,m,y){
    if(!vigenciaInicio)return false;
    const dateStr=fmtDateISO(d,m,y);
    return dateStr<vigenciaInicio;
  }

  function isDateAfterVigencia(d,m,y){
    if(!vigenciaFim)return false;
    const dateStr=fmtDateISO(d,m,y);
    return dateStr>vigenciaFim;
  }

  function isDateOutOfVigencia(d,m,y){
    return isDateBeforeVigencia(d,m,y)||isDateAfterVigencia(d,m,y);
  }

  function isDateDisabled(d,m,y){
    if(isDateOutOfVigencia(d,m,y))return true;
    const dow=new Date(y,m,d).getDay();
    return isPratica&&(dow===0||dow===6);
  }

  function isDateToday(d,m,y){
    return d===today.getDate()&&m===today.getMonth()&&y===today.getFullYear();
  }

  function isDateSelected(d,m,y){
    const iso=fmtDateISO(d,m,y);
    return itens.some(i=>i.data===iso);
  }

  function getItensForDate(iso){
    return itens.filter(i=>i.data===iso);
  }

  function toggleDate(d,m,y){
    const iso=fmtDateISO(d,m,y);
    if(isDateDisabled(d,m,y)){
      if(isDateBeforeVigencia(d,m,y)){
        setModalVigencia({type:"before",date:vigenciaInicio});
      }else if(isDateAfterVigencia(d,m,y)){
        setModalVigencia({type:"after",date:vigenciaFim});
      }
      return;
    }
    const next=[...itens];
    const existing=next.filter(i=>i.data===iso);
    if(existing.length>0){
      const filtered=next.filter(i=>i.data!==iso);
      set("_itens",filtered);
      if(selDate===iso)setSelDate(null);
    }else{
      setSelDate(iso);
    }
  }

  function toggleTurno(iso,turno){
    const next=[...itens];
    const idx=next.findIndex(i=>i.data===iso&&i.turno===turno);
    if(idx>=0){
      next.splice(idx,1);
    }else{
      next.push({data:iso,turno,setor_id:""});
    }
    set("_itens",next);
  }

  function setItemSetor(iso,turno,setorId){
    set("_itens",itens.map(i=>i.data===iso&&i.turno===turno?{...i,setor_id:setorId}:i));
  }

  function removeItem(iso,turno){
    set("_itens",itens.filter(i=>!(i.data===iso&&i.turno===turno)));
    if(selDate===iso&&itens.filter(i=>i.data===iso).length<=1)setSelDate(null);
  }

  function prevMonth(){
    const nm=new Date(calYear,calMon-1,1);
    setCalMonth(nm);
    setSelDate(null);
  }

  function nextMonth(){
    const nm=new Date(calYear,calMon+1,1);
    setCalMonth(nm);
    setSelDate(null);
  }

  const calendarCells=[];
  for(let i=0;i<firstDay;i++)calendarCells.push(null);
  for(let d=1;d<=daysInMonth;d++)calendarCells.push(d);

  const uniqueDates=[...new Set(itens.map(i=>i.data))].sort();

  return <div style={{gridColumn:"1/-1"}} className="escala-cal">
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
      <b style={{fontSize:12,color:"#566880"}}>Calendário *</b>
      <span style={{fontSize:12,color:"var(--text-muted)"}}>
        {itens.length>0?`${itens.length} item(ns) em ${uniqueDates.length} data(s)`:"Nenhuma data selecionada"}
      </span>
    </div>

    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
      <button type="button" onClick={prevMonth} className="escala-cal-nav" style={{background:"none",border:"none",cursor:"pointer",padding:4,color:"var(--text)"}}><ChevronLeft size={18}/></button>
      <b style={{fontSize:13,color:"var(--text)"}}>{monthNames[calMon]} {calYear}</b>
      <button type="button" onClick={nextMonth} className="escala-cal-nav" style={{background:"none",border:"none",cursor:"pointer",padding:4,color:"var(--text)"}}><ChevronRight size={18}/></button>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,textAlign:"center",marginBottom:4}}>
      {dayLabels.map(dl=><div key={dl} style={{fontSize:10,fontWeight:600,color:"#566880",padding:"4px 0"}}>{dl}</div>)}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:12}}>
      {calendarCells.map((d,i)=>{
        if(d===null)return <div key={"e"+i}/>;
        const disabled=isDateDisabled(d,calMon,calYear);
        const outOfVigencia=isDateOutOfVigencia(d,calMon,calYear);
        const selected=isDateSelected(d,calMon,calYear);
        const isToday=isDateToday(d,calMon,calYear);
        const iso=fmtDateISO(d,calMon,calYear);
        const hasItems=itens.some(it=>it.data===iso);
        return <button key={iso} type="button" onClick={()=>toggleDate(d,calMon,calYear)}
          className="escala-cal-day"
          disabled={disabled}
          aria-label={`${d} de ${monthNames[calMon]}${outOfVigencia?" - Data fora da vigência":""}`}
          title={outOfVigencia?"Data fora da vigência":undefined}
          style={{
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            padding:"6px 2px",borderRadius:6,cursor:disabled?"not-allowed":"pointer",
            border:selected?"2px solid #4f46e5":outOfVigencia?"1px solid #e2e8f0":isToday?"1px solid #4f46e5":"1px solid transparent",
            background:selected?"#eef2ff":outOfVigencia?"#f8fafc":"transparent",
            opacity:disabled?0.4:1,fontSize:12,fontWeight:isToday?700:400,
            color:disabled?"#94a3b8":selected?"#4f46e5":"var(--text)",
            position:"relative",minHeight:32,textDecoration:outOfVigencia?"line-through":"none"
          }}>
          <span>{d}</span>
          {hasItems&&!selected&&<span style={{width:4,height:4,borderRadius:"50%",background:"#4f46e5",marginTop:2}}/>}
        </button>;
      })}
    </div>

    {selDate&&<div style={{background:"var(--surface)",borderRadius:8,padding:12,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <b style={{fontSize:12,color:"var(--text)"}}>
          {new Date(selDate+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}
        </b>
        <button type="button" onClick={()=>setSelDate(null)} style={{background:"none",border:"none",cursor:"pointer",padding:2,color:"var(--text-muted)"}}><X size={14}/></button>
      </div>
      <div style={{display:"flex",gap:6}}>
        {["manha","tarde","noite"].map(t=>{
          const active=itens.some(i=>i.data===selDate&&i.turno===t);
          return <button key={t} type="button" onClick={()=>toggleTurno(selDate,t)}
            className="escala-cal-turno"
            style={{
              flex:1,padding:"8px 4px",borderRadius:6,border:active?"2px solid #4f46e5":"1px solid #ddd",
              background:active?"#eef2ff":"var(--surface)",cursor:"pointer",fontSize:12,fontWeight:active?600:400,
              color:active?"#4f46e5":"var(--text)",display:"flex",alignItems:"center",justifyContent:"center",gap:4
            }}>
            {active&&<Check size={12}/>}
            {turnoLabels[t]}
          </button>;
        })}
      </div>
    </div>}

    {uniqueDates.length>0&&<div style={{marginBottom:4}}>
      <b style={{fontSize:11,color:"#566880",display:"block",marginBottom:6}}>Datas, turnos e setores selecionados:</b>
      {uniqueDates.map(iso=>{
        const itemsForDate=getItensForDate(iso);
        const dateObj=new Date(iso+"T12:00:00");
        const label=dateObj.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
        const dowLabel=dateObj.toLocaleDateString("pt-BR",{weekday:"short"});
        return <div key={iso} style={{display:"flex",flexDirection:"column",gap:4,marginBottom:6}}>
          {itemsForDate.map(it=>(
            <div key={it.turno} style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",fontSize:12,padding:"4px 8px",background:"var(--surface)",borderRadius:6}}>
              <span style={{fontWeight:600,minWidth:60,color:"var(--text)"}}>{label}</span>
              <span style={{color:"var(--text-muted)",minWidth:30}}>{dowLabel}</span>
              <span style={{display:"inline-flex",alignItems:"center",gap:2,background:"#eef2ff",color:"#4f46e5",padding:"2px 8px",borderRadius:4,fontSize:11}}>
                {turnoLabels[it.turno]}
              </span>
              <span className="select" style={{minWidth:150,flex:"1 1 150px",maxWidth:220}}>
                <select
                  value={it.setor_id||""}
                  onChange={e=>setItemSetor(iso,it.turno,e.target.value)}
                  aria-label={`Setor de ${label} ${turnoLabels[it.turno]}`}
                  style={{fontSize:12,padding:"3px 6px"}}
                >
                  <option value="">Setor: legado do vínculo</option>
                  {setores.map(s=><option key={s.id} value={s.id}>Setor: {s.nome}</option>)}
                </select>
                <ChevronDown size={13}/>
              </span>
              <button type="button" onClick={()=>removeItem(iso,it.turno)} aria-label="Remover item" style={{background:"none",border:"none",cursor:"pointer",padding:2,color:"var(--danger)",display:"flex"}}><X size={13}/></button>
            </div>
          ))}
        </div>;
      })}
    </div>}

    {modalVigencia&&<div className="overlay" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:9999}} onClick={()=>setModalVigencia(null)}>
      <div style={{background:"var(--white)",border:"1px solid var(--border)",borderRadius:16,width:"100%",maxWidth:420,maxHeight:"90vh",overflow:"hidden",boxShadow:"0 28px 80px #07122657",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"linear-gradient(135deg,var(--navy-900),var(--navy-700))",color:"#fff",padding:"16px 20px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:34,height:34,color:"var(--gold-400)",background:"rgba(255,255,255,.12)",borderRadius:10,display:"grid",placeItems:"center",flexShrink:0}}><CalendarOff size={17}/></div>
          <h3 style={{margin:0,flex:1,fontSize:15,fontWeight:700}}>Data fora da vigência</h3>
          <button onClick={()=>setModalVigencia(null)} style={{color:"#fff",background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.18)",borderRadius:8,cursor:"pointer",width:30,height:30,display:"grid",placeItems:"center",flexShrink:0,transition:"background .15s"}} onMouseOver={e=>e.currentTarget.style.background="rgba(255,255,255,.22)"} onMouseOut={e=>e.currentTarget.style.background="rgba(255,255,255,.12)"}><X size={15}/></button>
        </div>
        <div style={{padding:"20px",textAlign:"center"}}>
          <p style={{margin:"0 0 8px",fontSize:14,color:"var(--text)",lineHeight:1.5}}>
            {modalVigencia.type==="before"?<>
              Este vínculo inicia em <b>{fmtDateBR(modalVigencia.date)}</b>. Selecione uma data igual ou posterior ao início da vigência.
            </>:<>
              Este vínculo termina em <b>{fmtDateBR(modalVigencia.date)}</b>. Selecione uma data dentro do período de vigência.
            </>}
          </p>
        </div>
        <div style={{padding:"0 20px 20px",display:"flex",justifyContent:"center"}}>
          <button onClick={()=>setModalVigencia(null)} style={{minHeight:44,minWidth:120,border:"1px solid var(--border)",borderRadius:10,background:"var(--white)",color:"var(--text)",cursor:"pointer",fontSize:13,fontWeight:600,padding:"0 20px",transition:"background .15s"}} onMouseOver={e=>e.currentTarget.style.background="var(--surface)"} onMouseOut={e=>e.currentTarget.style.background="var(--white)"}>Entendi</button>
        </div>
      </div>
    </div>}
  </div>;
}

function RegraResumoCard({regra}){
  if(!regra)return null;
  const comps=(regra.componentes||[]).filter(c=>c.status==="ativo");
  const aplicabilidade=[];
  if(regra.unidade?.nome)aplicabilidade.push(`Unidade: ${regra.unidade.nome}`);
  if(regra.internato?.nome)aplicabilidade.push(`Internato: ${regra.internato.nome}`);
  if(regra.disciplina?.nome)aplicabilidade.push(`Disciplina: ${regra.disciplina.nome}`);
  if(regra.local?.nome)aplicabilidade.push(`Local: ${regra.local.nome}`);
  if(regra.setor?.nome)aplicabilidade.push(`Setor: ${regra.setor.nome}`);
  if(regra.preceptor?.nome_completo)aplicabilidade.push(`Preceptor: ${regra.preceptor.nome_completo}`);
  return <div className="regra-resumo">
    <div className="regra-resumo-head">
      <b>{regra.nome||"-"}</b>
      <span className="badge ok">Ativa</span>
    </div>
    <div className="regra-resumo-row"><small>Tipo de cálculo</small><b>{FORMA_CALCULO_LABELS[regra.forma_calculo]||regra.forma_calculo||"-"}</b></div>
    {aplicabilidade.length>0&&<div className="regra-resumo-row"><small>Aplicabilidade</small><b>{aplicabilidade.join(" · ")}</b></div>}
    <div className="regra-resumo-row"><small>Componentes e valores</small></div>
    {comps.length===0
      ?<div className="regra-resumo-empty">Sem componentes ativos.</div>
      :<ul className="regra-resumo-comps">{comps.map(c=><li key={c.id}>
          <span>{(TIPO_COMPONENTE_LABELS[c.tipo]||c.tipo)+(c.descricao?` — ${c.descricao}`:"")}</span>
          <b>{c.valor!=null&&c.valor!==""?formatCurrencyBRL(c.valor):"Sem valor"}</b>
        </li>)}</ul>}
  </div>;
}

const FORMA_CALCULO_LABELS = {
  por_turno: "Por turno", por_hora: "Por hora", por_grupo: "Por grupo",
  mensal_fixo: "Mensal fixo", rateio: "Rateio", adicional: "Adicional",
  ajuste: "Ajuste", desconto: "Desconto", estorno: "Estorno"
};

function CoordenadoresSelect({value,onChange,options,loading}){
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const handler=(e)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[]);
  const toggle=(id)=>{
    const next=value.includes(id)?value.filter(v=>v!==id):[...value,id];
    onChange(next);
  };
  const remove=(id)=>onChange(value.filter(v=>v!==id));
  const selected=options.filter(o=>value.includes(o.id));
  const dropdownOpen=()=>{setOpen(true);};
  return <div ref={ref} style={{position:"relative"}}><b style={{display:"block",marginBottom:4}}>Coordenadores responsáveis</b><div className="coordenadores-select" onClick={dropdownOpen} style={{minHeight:38,padding:"6px 8px",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",cursor:"pointer",display:"flex",flexWrap:"wrap",gap:4,alignItems:"center",background:"var(--white)"}}>{selected.length===0&&<span style={{color:"var(--text-muted)",fontSize:13}}>Nenhum selecionado</span>}{selected.map(c=><span key={c.id} style={{display:"inline-flex",alignItems:"center",gap:4,background:"var(--info-bg)",color:"var(--info)",padding:"2px 8px",borderRadius:12,fontSize:12}}>{c.nome_completo}<button type="button" onClick={(e)=>{e.stopPropagation();remove(c.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:1,color:"var(--info)"}}><X size={12}/></button></span>)}</div>{open&&<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:100,maxHeight:180,overflowY:"auto",background:"var(--white)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",boxShadow:"var(--shadow-md)",marginTop:2}}>{loading&&<div style={{padding:8,color:"var(--text-muted)",fontSize:13}}>Carregando...</div>}{!loading&&options.length===0&&<div style={{padding:8,color:"var(--text-muted)",fontSize:13}}>Nenhum coordenador cadastrado</div>}{!loading&&options.map(o=><div key={o.id} onClick={()=>toggle(o.id)} style={{padding:"6px 10px",cursor:"pointer",fontSize:13,background:value.includes(o.id)?"var(--info-bg)":"transparent",color:value.includes(o.id)?"var(--info)":"var(--text)"}}>{value.includes(o.id)?"✓ ":""}{o.nome_completo}{o.email?` (${o.email})`:``}</div>)}</div>}</div>;
}

function VinculoForm({preceptor, vinculo, onClose, onSaved, page}){
  const isEdit=!!vinculo;
  const isInternato=page==="preceptores-internato";
  const buildInitial=()=>{
    if(isEdit){
      return {
        internato_id:vinculo.internato_id||"",
        periodo_id:vinculo.periodo_id||"",
        local_id:vinculo.local_id||"",
        setor_id:vinculo.setor_id||"",
        semestre_id:vinculo.semestre_id||"",
        data_inicio:vinculo.data_inicio||"",
        data_fim:vinculo.data_fim||"",
        status:vinculo.status||"ativo",
        vinculo_modalidade_pagamento_id:vinculo.modalidade_pagamento_id||"",
        vinculo_cnpj:vinculo.cnpj||"",
        vinculo_razao_social:vinculo.razao_social||"",
        _coordenadores:(vinculo.coordenadores||[]).filter(c=>c.status==="ativo").map(c=>c.profile_id),
        valor_inicial:vinculo.valor_inicial!=null?vinculo.valor_inicial:"",
        regra_financeira_id:"",
        _regraAnteriorId:"",
        justificativa_regra:""
      };
    }
    return {
      internato_id:"",
      periodo_id:preceptor?.periodo_id||"",
      local_id:"",
      setor_id:"",
      semestre_id:preceptor?.semestre_id||"",
      data_inicio:"",
      data_fim:"",
      status:"ativo",
      vinculo_modalidade_pagamento_id:"",
      vinculo_cnpj:"",
      vinculo_razao_social:"",
      _coordenadores:[],
      valor_inicial:"",
      regra_financeira_id:"",
      _regraAnteriorId:"",
      justificativa_regra:""
    };
  };
  const[formData,setFormData]=useState(buildInitial);
  const[formOpts,setFormOpts]=useState({});
  const[optsLoading,setOptsLoading]=useState(true);
  const[optsErrors,setOptsErrors]=useState({});
  const[saving,setSaving]=useState(false);
  const[maskedCnpj,setMaskedCnpj]=useState(formData.vinculo_cnpj?maskCnpj(formData.vinculo_cnpj):"");
  const[maskedValor,setMaskedValor]=useState(formData.valor_inicial!=null&&formData.valor_inicial!==""?formatCurrencyBRL(formData.valor_inicial):"");

  const v=(field)=>formData[field]||"";
  const set=(field,val)=>setFormData(p=>({...p,[field]:val}));

  useEffect(()=>{
    const init=buildInitial();
    setFormData(init);
    setMaskedCnpj(init.vinculo_cnpj?maskCnpj(init.vinculo_cnpj):"");
    setMaskedValor(init.valor_inicial!=null&&init.valor_inicial!==""?formatCurrencyBRL(init.valor_inicial):"");
  },[vinculo]);

  useEffect(()=>{
    let active=true;
    (async()=>{
      setOptsLoading(true);
      const errors={};
      const extras={};
      const sett=async(key,fn)=>{try{extras[key]=await fn()}catch(e){errors[key]=e.message||"Erro";extras[key]=[]}};
      await Promise.allSettled([
        sett('periodos',()=>fetchPeriodosByRange(9,12)),
        sett('internatos',fetchInternatosAtivos),
        sett('semestres',fetchSemestresAtivos),
        sett('locais',fetchLocaisAtivos),
        sett('unidades',fetchUnidadesAtivas),
        sett('modalidades',fetchModalidadesPagamentoAtivas),
        sett('setores',fetchSetoresAtivos),
        sett('regrasFinanceiras',()=>fetchRegrasFinanceirasAtivas('internato')),
        sett('coordenadores',fetchCoordenadoresAtivos),
      ]);
      if(!active)return;
      setFormOpts(extras);
      setOptsErrors(errors);
      setOptsLoading(false);
    })();
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    if(isEdit&&vinculo){
      const regraVinc=(vinculo.vinculo_regras||[]).find(r=>r.status==="ativo")||null;
      if(regraVinc){
        setFormData(p=>({
          ...p,
          regra_financeira_id:regraVinc.regra_id||"",
          _regraAnteriorId:regraVinc.regra_id||"",
          justificativa_regra:""
        }));
      }
    }
  },[vinculo]);

  const selectedModalidade=(formOpts.modalidades||[]).find(m=>m.id===formData.vinculo_modalidade_pagamento_id);
  const isNFS=selectedModalidade?.nome?.toLowerCase().includes("nfs");
  const regraSelecionadaId=formData.regra_financeira_id||"";
  const regraSelecionada=(formOpts.regrasFinanceiras||[]).find(r=>r.id===regraSelecionadaId)||null;
  const regraAnteriorId=formData._regraAnteriorId||"";
  const mudouRegra=regraSelecionadaId!==regraAnteriorId;

  const renderOptions=(key,items,renderFn,empty="Nenhuma opção cadastrada.")=>{
    if(optsLoading)return<option value="" disabled>Carregando...</option>;
    if(optsErrors?.[key])return<option value="" disabled>Erro: {optsErrors[key]}</option>;
    if(!items||items.length===0)return<option value="" disabled>{empty}</option>;
    return items.map(item=><option key={item.id} value={item.id}>{renderFn(item)}</option>);
  };

  async function handleSave(){
    if(!v("internato_id")){await systemDialog({type:'alert',title:'Revise as informações',message:'Selecione o internato.',confirmLabel:'Entendi'});return}
    if(!v("periodo_id")){await systemDialog({type:'alert',title:'Revise as informações',message:'Selecione o período.',confirmLabel:'Entendi'});return}
    if(!v("local_id")){await systemDialog({type:'alert',title:'Revise as informações',message:'Selecione o local de atuação.',confirmLabel:'Entendi'});return}
    if(!v("semestre_id")){await systemDialog({type:'alert',title:'Revise as informações',message:'Selecione o semestre.',confirmLabel:'Entendi'});return}
    if(isNFS&&formData.vinculo_cnpj){
      const cnpjRaw=formData.vinculo_cnpj.replace(/\D/g,"");
      if(cnpjRaw.length!==14){await systemDialog({type:'alert',title:'Revise as informações',message:'CNPJ inválido. Informe 14 dígitos.',confirmLabel:'Entendi'});return}
    }
    if(mudouRegra&&!regraSelecionadaId&&regraAnteriorId&&!formData.justificativa_regra?.trim()){
      await systemDialog({type:'alert',title:'Revise as informações',message:'Justificativa obrigatória para remover a regra financeira.',confirmLabel:'Entendi'});return;
    }
    {
      const dupCheck={
        preceptor_id:preceptor.id,
        internato_id:v("internato_id"),
        periodo_id:v("periodo_id"),
        semestre_id:v("semestre_id"),
        local_id:v("local_id"),
        setor_id:v("setor_id")||null,
        data_inicio:v("data_inicio")||null,
        data_fim:v("data_fim")||null
      };
      const isDup=await verificarDuplicidadeVinculo(dupCheck,isEdit?vinculo.id:null);
      if(isDup){await systemDialog({type:'alert',title:'Vínculo já cadastrado',message:'Este preceptor já possui um vínculo com as mesmas informações. Revise os dados antes de salvar.',confirmLabel:'Entendi'});return}
    }
    setSaving(true);
    try{
      const vincData={
        preceptor_id:preceptor.id,
        internato_id:v("internato_id"),
        periodo_id:v("periodo_id"),
        local_id:v("local_id"),
        setor_id:v("setor_id")||null,
        semestre_id:v("semestre_id"),
        data_inicio:v("data_inicio")||null,
        data_fim:v("data_fim")||null,
        modalidade_pagamento_id:v("vinculo_modalidade_pagamento_id")||null,
        cnpj:isNFS?formData.vinculo_cnpj||null:null,
        razao_social:isNFS?v("vinculo_razao_social")||null:null,
        valor_inicial:formData.valor_inicial!=null&&formData.valor_inicial!==""?formData.valor_inicial:null,
        status:formData.status||"ativo"
      };
      let vinculoId;
      if(isEdit){
        await updateVinculoInternato(vinculo.id,vincData);
        vinculoId=vinculo.id;
      }else{
        const created=await insertVinculoInternato(vincData);
        vinculoId=created.id;
      }
      if(vinculoId){
        const vlLocal=await fetchVinculoLocais(null,vinculoId);
        const existingVL=vlLocal?.[0]||null;
        if(existingVL){
          if(vincData.local_id!==existingVL.local_id||vincData.setor_id!==existingVL.setor_id){
            await upsertVinculoLocal({id:existingVL.id,vinculo_internato_id:vinculoId,local_id:vincData.local_id,setor_id:vincData.setor_id});
          }
        }else{
          await upsertVinculoLocal({tipo_atuacao:"internato",vinculo_internato_id:vinculoId,local_id:vincData.local_id,setor_id:vincData.setor_id});
        }
        await salvarVinculoCoordenadores(vinculoId,formData._coordenadores||[]);
        if(mudouRegra){
          await salvarVinculoRegraFinanceira({
            vinculo_internato_id:vinculoId,
            regra_id:regraSelecionadaId||null,
            justificativa:formData.justificativa_regra?.trim()||null
          });
        }
      }
      onSaved&&onSaved();
    }catch(e){
      console.error("[VinculoForm save error]",e);
      await systemDialog({type:'alert',title:'Não foi possível salvar',message:'Ocorreu um problema ao salvar o vínculo. Tente novamente.',confirmLabel:'Fechar'});
    }
    setSaving(false);
  }

  return <div className="form"><div className="grid">
    <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:8,marginBottom:4,paddingBottom:8,borderBottom:"1px solid var(--border)"}}>
      <div style={{display:"inline-flex",alignItems:"center",gap:5,background:"#e2ecf7",border:"1px solid #c5d3e6",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,color:"var(--navy-700)",letterSpacing:".04em",whiteSpace:"nowrap"}}><BriefcaseBusiness size={12}/> {isEdit?"EDITAR VÍNCULO":"NOVO VÍNCULO"}</div>
      <span style={{fontSize:13,fontWeight:600,color:"var(--text-soft)"}}>Vínculo de atuação</span>
    </div>
    <div className="ficha-item" style={{gridColumn:"1/-1"}}><small>Preceptor</small><b>{preceptor?.nome_completo||"-"}</b></div>
    <label><b>Internato *</b><span className="select"><select value={v("internato_id")} onChange={e=>set("internato_id",e.target.value)}>
      <option value="">Selecione</option>
      {renderOptions("internatos",formOpts.internatos||[],i=>i.nome,"Nenhum internato cadastrado.")}
    </select><ChevronDown size={16}/></span></label>
    <label><b>Período *</b><span className="select"><select value={v("periodo_id")} onChange={e=>set("periodo_id",e.target.value)}>
      <option value="">Selecione o período</option>
      {renderOptions("periodos",formOpts.periodos||[],p=>`${p.numero}º período`,"Nenhum período cadastrado.")}
    </select><ChevronDown size={16}/></span></label>
    <label><b>Local de atuação *</b><span className="select"><select value={v("local_id")} onChange={e=>{set("local_id",e.target.value);set("setor_id","");}}>
      <option value="">Selecione</option>
      {renderOptions("locais",formOpts.locais||[],l=>l.nome,"Nenhum local cadastrado.")}
    </select><ChevronDown size={16}/></span></label>
    <label><b>Semestre *</b><span className="select"><select value={v("semestre_id")} onChange={e=>set("semestre_id",e.target.value)}>
      <option value="">Selecione</option>
      {renderOptions("semestres",formOpts.semestres||[],s=>s.codigo,"Nenhum semestre cadastrado.")}
    </select><ChevronDown size={16}/></span></label>
    <label><b>Início vínculo</b><input type="date" value={v("data_inicio")} onChange={e=>set("data_inicio",e.target.value)}/></label>
    <label><b>Fim vínculo</b><input type="date" value={v("data_fim")} onChange={e=>set("data_fim",e.target.value)}/></label>
    <label><b>Situação</b><span className="select"><select value={v("status")} onChange={e=>set("status",e.target.value)}>
      <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
    </select><ChevronDown size={16}/></span></label>

    <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:6,marginTop:12,marginBottom:4,paddingBottom:6,borderBottom:"1px solid var(--border)",fontSize:13,fontWeight:600,color:"var(--text-soft)"}}>
      <WalletCards size={14}/> Pagamento do vínculo
    </div>
    <label><b>Saldo semestral (R$)</b><input value={maskedValor} onChange={e=>{
      const rawDigits=e.target.value.replace(/\D/g,"");
      if(rawDigits===""){setMaskedValor("");set("valor_inicial",null);}
      else{
        const cents=parseInt(rawDigits,10);
        const valor=cents/100;
        setMaskedValor(formatCurrencyBRL(valor));
        set("valor_inicial",valor);
      }
    }} placeholder="R$ 0,00" className="currency-input"/>
    <small style={{display:"block",marginTop:3,color:"var(--text-muted,#64748b)",fontSize:12}}>Saldo autorizado para pagamento neste vínculo.</small></label>
    <label><b>Modalidade de pagamento</b><span className="select"><select value={v("vinculo_modalidade_pagamento_id")} onChange={e=>{
      const val=e.target.value;
      set("vinculo_modalidade_pagamento_id",val);
      const sel=(formOpts.modalidades||[]).find(m=>m.id===val);
      if(!sel||!sel.nome.toLowerCase().includes("nfs")){
        set("vinculo_cnpj",null);setMaskedCnpj("");set("vinculo_razao_social",null);
      }
    }}>
      <option value="">Selecione</option>
      {renderOptions("modalidades",formOpts.modalidades||[],m=>m.nome,"Nenhuma modalidade cadastrada.")}
    </select><ChevronDown size={16}/></span></label>
    {isNFS&&<>
      <label><b>CNPJ</b><input value={maskedCnpj} onChange={e=>{
        const raw=e.target.value.replace(/\D/g,"").slice(0,14);
        setMaskedCnpj(maskCnpj(raw));
        set("vinculo_cnpj",raw||null);
      }} placeholder="00.000.000/0000-00"/></label>
      <label><b>Razão social</b><input value={v("vinculo_razao_social")||""} onChange={e=>set("vinculo_razao_social",e.target.value||null)} placeholder="Razão social da empresa"/></label>
    </>}

    <div style={{gridColumn:"1/-1",marginTop:8}}>
      <CoordenadoresSelect
        value={v("_coordenadores")||[]}
        onChange={val=>set("_coordenadores",val)}
        options={formOpts.coordenadores||[]}
        loading={optsLoading}
      />
    </div>

    <div className="regra-vinculo-section" style={{gridColumn:"1/-1"}}>
      <hr className="form-sep"/>
      <b style={{display:"block",marginBottom:4,fontSize:13}}>Regra financeira aplicável ao vínculo</b>
      <small style={{display:"block",marginBottom:10,color:"var(--text-muted,#64748b)",fontSize:12}}>
        A ausência não impede criar o cadastro nem a escala; apenas bloqueia cálculos financeiros futuros.
      </small>
      <label><b>Regra</b><span className="select"><select value={regraSelecionadaId} onChange={e=>set("regra_financeira_id",e.target.value)}>
        <option value="">Nenhuma (regra financeira pendente)</option>
        {renderOptions("regrasFinanceiras",formOpts.regrasFinanceiras||[],r=>`${r.nome} • ${FORMA_CALCULO_LABELS[r.forma_calculo]||r.forma_calculo||""} • ${(r.componentes||[]).filter(c=>c.status==="ativo").map(c=>TIPO_COMPONENTE_LABELS[c.tipo]||c.tipo).join(", ")||"Sem componentes"}`,"Nenhuma regra financeira ativa da modalidade.")}
      </select><ChevronDown size={16}/></span></label>
      {regraSelecionada&&<RegraResumoCard regra={regraSelecionada}/>}
      {mudouRegra&&regraAnteriorId&&<label><b>Justificativa da alteração de regra *</b><input value={v("justificativa_regra")} onChange={e=>set("justificativa_regra",e.target.value)} placeholder="Descreva o motivo da troca ou remoção da regra"/></label>}
    </div>
  </div>
  <footer>
    <Btn secondary icon={X} onClick={onClose}>Cancelar</Btn>
    <Btn icon={saving?Loader2:Check} onClick={handleSave} disabled={saving}>{saving?"Salvando…":isEdit?"Salvar alterações":"Criar vínculo"}</Btn>
  </footer>
</div>;
}

function EmailsCopiaSection({lista,loading,onChange}){
  const itens=Array.isArray(lista)?lista:[];
  const alterar=(idx,campo,valor)=>onChange(itens.map((it,i)=>i===idx?{...it,[campo]:valor}:it));
  return <div className="emails-copia-section">
    <div className="emails-copia-header"><Mail size={14}/> E-mails para cópia</div>
    <small className="emails-copia-help">Endereços que recebem cópia dos e-mails deste preceptor. Não fazem parte do vínculo: ficam no cadastro principal.</small>
    {loading
      ? <div className="emails-copia-vazio"><Loader2 size={14} className="spin"/> Carregando e-mails para cópia…</div>
      : <>
        <div className="emails-copia-list">
          {itens.length===0&&<div className="emails-copia-vazio">Nenhum e-mail para cópia cadastrado.</div>}
          {itens.map((item,idx)=>{
            const ativo=item.ativo!==false;
            return <div className="emails-copia-row" key={item.id||`novo-${idx}`}>
              <input type="email" value={item.email||""} onChange={e=>alterar(idx,"email",e.target.value)} placeholder="email@exemplo.com" aria-label="E-mail para cópia"/>
              <span className={"emails-copia-badge"+(ativo?" ativo":" inativo")}>{ativo?"Ativo":"Inativo"}</span>
              {item.id
                ?(ativo
                  ?<button type="button" className="emails-copia-acao" onClick={()=>alterar(idx,"ativo",false)}><Ban size={13}/> Desativar</button>
                  :<button type="button" className="emails-copia-acao" onClick={()=>alterar(idx,"ativo",true)}><Check size={13}/> Ativar</button>)
                :<button type="button" className="emails-copia-acao remover" onClick={()=>onChange(itens.filter((_,i)=>i!==idx))}><Trash2 size={13}/> Remover</button>}
            </div>;
          })}
        </div>
        <button type="button" className="btn secondary emails-copia-add" onClick={()=>onChange([...itens,{email:"",ativo:true}])}><Plus size={14}/> Adicionar e-mail para cópia</button>
      </>}
  </div>;
}

function Form({page,close,save,formData,setFormData,formOptions,optionsLoading,optionsErrors,saving,isEdit,vinculos,editSetModal,editId,onDeleteVinculo,onDeletePreceptor,isAdmin,emailsCopiaLoading}){
  const opts=formOptions||{};
  const v=(field)=>formData[field]||"";
  const set=(field,val)=>setFormData(prev=>({...prev,[field]:val}));
  const[maskedCpf,setMaskedCpf]=useState(v("cpf")?maskCpf(v("cpf")):"");
  const[cpfError,setCpfError]=useState("");
  const[maskedCnpj,setMaskedCnpj]=useState(v("vinculo_cnpj")||v("cnpj")?maskCnpj(v("vinculo_cnpj")||v("cnpj")):"");
  const isPreceptor=page.includes("preceptores");
  const isInternato=page==="preceptores-internato";
  useEffect(()=>{setMaskedCpf(v("cpf")?maskCpf(v("cpf")):"");setCpfError("");const cnpjVal=isInternato?(v("vinculo_cnpj")||""):(v("cnpj")||"");setMaskedCnpj(cnpjVal?maskCnpj(cnpjVal):"");},[formData]);
  const financial=["regras","apuracao-mensal","pagamentos","dashboard"].includes(page);
  const selectedModalidade=(opts.modalidades||[]).find(m=>m.id===formData.modalidade_pagamento_id);
  const isNFS=selectedModalidade?.nome?.toLowerCase().includes("nfs");
  const selectedModalidadeVinculo=(opts.modalidades||[]).find(m=>m.id===formData.vinculo_modalidade_pagamento_id);
  const isNFSVinculo=selectedModalidadeVinculo?.nome?.toLowerCase().includes("nfs");
  const setores=(opts.setores||[]);

  const camposFaltantesForm=(()=>{
    if(!isPreceptor)return [];
    const f=[];
    if(!v("nome_completo").trim())f.push("Nome completo");
    if(!v("profissao_id"))f.push("Profissão");
    if(isInternato){
      if(!v("vinculo_modalidade_pagamento_id"))f.push("Modalidade de pagamento");
      if(isNFSVinculo){
        if(!v("vinculo_cnpj")?.trim())f.push("CNPJ");
        if(!v("vinculo_razao_social")?.trim())f.push("Razão social");
      }
    }else{
      if(!v("modalidade_pagamento_id"))f.push("Modalidade de pagamento");
      if(isNFS){
        if(!v("cnpj")?.trim())f.push("CNPJ");
        if(!v("razao_social")?.trim())f.push("Razão social");
      }
    }
    return f;
  })();

  const regraAnteriorId=formData._regraAnteriorId||"";
  const regraSelecionadaId=formData.regra_financeira_id||"";
  const regraSelecionada=(opts.regrasFinanceiras||[]).find(r=>r.id===regraSelecionadaId)||null;
  const regraAnterior=(opts.regrasFinanceiras||[]).find(r=>r.id===regraAnteriorId)||null;
  const mudouRegra=regraSelecionadaId!==regraAnteriorId;
  const precisaJustificativa=!!regraAnteriorId&&mudouRegra;

  const renderOptions = (key, items, renderFn, emptyLabel = "Nenhuma opção cadastrada.") => {
    if (optionsLoading) return <option value="" disabled>Carregando...</option>;
    if (optionsErrors?.[key]) return <option value="" disabled className="option-error">Erro: {optionsErrors[key]}</option>;
    if (!items || items.length === 0) return <option value="" disabled>{emptyLabel}</option>;
    return items.map(item => <option key={item.id} value={item.id}>{renderFn(item)}</option>);
  };

  const isEscalaSemSel=page==="escalas"&&!((formData._itens||[]).length>0);

   return <div className="form"><div className="grid">
      {isPreceptor&&<div className="vinculo-aviso">
        <span>Dados gerais do cadastro principal.</span>
        {camposFaltantesForm.length>0&&<span className="vinculo-aviso-pendencias"><AlertCircle size={12}/> Incompletos: {camposFaltantesForm.join(", ")}</span>}
        {camposFaltantesForm.length===0&&null}
      </div>}
      {isPreceptor&&<>
        <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:6,marginTop:8,marginBottom:4,paddingBottom:6,borderBottom:"1px solid var(--border)",fontSize:13,fontWeight:600,color:"var(--text-soft)"}}><UserRound size={14}/> Dados gerais do preceptor</div>
        <label><b>Nome completo *</b><input value={v("nome_completo")} onChange={e=>set("nome_completo",e.target.value)} placeholder="Nome completo"/></label>
        <label><b>CPF</b><input value={maskedCpf} onChange={e=>{
          const raw=e.target.value.replace(/\D/g,"").slice(0,11);
          setMaskedCpf(maskCpf(raw));
          set("cpf",raw||null);
          if(raw.length===11){setCpfError("");}
          else{setCpfError(raw.length>0&&raw.length<11?"CPF incompleto":"");}
        }} placeholder="000.000.000-00" className={cpfError?"input-error":""}/>{cpfError&&<span className="field-error">{cpfError}</span>}</label>
        <label><b>E-mail principal</b><input type="email" value={v("email")} onChange={e=>set("email",e.target.value)} placeholder="email@exemplo.com"/></label>
        <label><b>Telefone</b><input value={v("telefone")} onChange={e=>set("telefone",e.target.value)} placeholder="(00) 00000-0000"/></label>
        {isAdmin&&<EmailsCopiaSection lista={formData._emails_copia} loading={!!emailsCopiaLoading} onChange={lista=>set("_emails_copia",lista)}/>}
        <label><b>Unidade *</b><span className="select"><select value={v("unidade_id")} onChange={e=>set("unidade_id",e.target.value)}>
          <option value="">Selecione</option>
          {renderOptions("unidades", opts.unidades || [], u => u.nome, "Nenhuma unidade cadastrada.")}
        </select><ChevronDown size={16}/></span></label>
        <label><b>Profissão *</b><span className="select"><select value={v("profissao_id")} onChange={e=>set("profissao_id",e.target.value)}>
          <option value="">Selecione</option>
          {renderOptions("profissoes", opts.profissoes || [], p => p.nome, "Nenhuma profissão cadastrada.")}
        </select><ChevronDown size={16}/></span></label>
        <label><b>Nº conselho</b><input value={v("conselho_numero")||""} onChange={e=>set("conselho_numero",e.target.value||null)} placeholder="Nº do conselho profissional"/></label>
        {!isInternato&&<>
          <label><b>Modalidade de pagamento</b><span className="select"><select value={v("modalidade_pagamento_id")} onChange={e=>{
            const val=e.target.value;
            set("modalidade_pagamento_id",val);
            const sel=(opts.modalidades||[]).find(m=>m.id===val);
            if(!sel||!sel.nome.toLowerCase().includes("nfs")){
              set("cnpj",null);setMaskedCnpj("");
              set("razao_social",null);
            }
          }}>
            <option value="">Selecione</option>
            {renderOptions("modalidades", opts.modalidades || [], m => m.nome, "Nenhuma modalidade cadastrada.")}
          </select><ChevronDown size={16}/></span></label>
          {isNFS&&<>
            <label><b>CNPJ</b><input value={maskedCnpj} onChange={e=>{
              const raw=e.target.value.replace(/\D/g,"").slice(0,14);
              setMaskedCnpj(maskCnpj(raw));
              set("cnpj",raw||null);
            }} placeholder="00.000.000/0000-00"/></label>
            <label><b>Razão social</b><input value={v("razao_social")||""} onChange={e=>set("razao_social",e.target.value||null)} placeholder="Razão social da empresa"/></label>
          </>}
        </>}
        <label><b>Observações</b><input value={v("observacoes")} onChange={e=>set("observacoes",e.target.value)} placeholder="Observações"/></label>
        <label><b>Situação *</b><span className="select"><select value={v("status")||"ativo"} onChange={e=>set("status",e.target.value)}>
          <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
        </select><ChevronDown size={16}/></span></label>

        {!isEdit&&<>
          <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:6,marginTop:12,marginBottom:4,paddingBottom:6,borderBottom:"1px solid var(--border)",fontSize:13,fontWeight:600,color:"var(--text-soft)"}}><BriefcaseBusiness size={14}/> Primeiro vínculo de atuação</div>
          {isInternato&&<>
            <label><b>Internato *</b><span className="select"><select value={v("internato_id")} onChange={e=>set("internato_id",e.target.value)}>
              <option value="">Selecione</option>
              {renderOptions("internatos", opts.internatos || [], i => i.nome, "Nenhum internato cadastrado.")}
            </select><ChevronDown size={16}/></span></label>
          </>}
          {!isInternato&&<>
            <label><b>Disciplina *</b><span className="select"><select value={v("disciplina_id")} onChange={e=>set("disciplina_id",e.target.value)}>
              <option value="">Selecione</option>
              {renderOptions("disciplinas", opts.disciplinas || [], d => d.nome, "Nenhuma disciplina cadastrada.")}
            </select><ChevronDown size={16}/></span></label>
          </>}
          <label><b>Período *</b><span className="select"><select value={v("periodo_id")} onChange={e=>set("periodo_id",e.target.value)}>
            <option value="">Selecione o período</option>
            {renderOptions("periodos", opts.periodos || [], p => `${p.numero}º período`, "Nenhum período cadastrado.")}
          </select><ChevronDown size={16}/></span></label>
          <label><b>Local de atuação *</b><span className="select"><select value={v("local_id")} onChange={e=>{set("local_id",e.target.value);set("setor_id","");}}>
            <option value="">Selecione</option>
            {renderOptions("locais", opts.locais || [], l => l.nome, "Nenhum local cadastrado.")}
          </select><ChevronDown size={16}/></span></label>
          <label><b>Semestre *</b><span className="select"><select value={v("semestre_id")} onChange={e=>set("semestre_id",e.target.value)}>
            <option value="">Selecione</option>
            {renderOptions("semestres", opts.semestres || [], s => s.codigo, "Nenhum semestre cadastrado.")}
          </select><ChevronDown size={16}/></span></label>
          <label><b>Início vínculo</b><input type="date" value={v("data_inicio")} onChange={e=>set("data_inicio",e.target.value)}/></label>
          <label><b>Fim vínculo</b><input type="date" value={v("data_fim")} onChange={e=>set("data_fim",e.target.value)}/></label>
          <label><b>Modalidade de pagamento</b><span className="select"><select value={v("vinculo_modalidade_pagamento_id")} onChange={e=>{
            const val=e.target.value;
            set("vinculo_modalidade_pagamento_id",val);
            const sel=(opts.modalidades||[]).find(m=>m.id===val);
            if(!sel||!sel.nome.toLowerCase().includes("nfs")){
              set("vinculo_cnpj",null);setMaskedCnpj("");
              set("vinculo_razao_social",null);
            }
          }}>
            <option value="">Selecione</option>
            {renderOptions("modalidades", opts.modalidades || [], m => m.nome, "Nenhuma modalidade cadastrada.")}
          </select><ChevronDown size={16}/></span></label>
          {isNFSVinculo&&<>
            <label><b>CNPJ</b><input value={maskedCnpj} onChange={e=>{
              const raw=e.target.value.replace(/\D/g,"").slice(0,14);
              setMaskedCnpj(maskCnpj(raw));
              set("vinculo_cnpj",raw||null);
            }} placeholder="00.000.000/0000-00"/></label>
            <label><b>Razão social</b><input value={v("vinculo_razao_social")||""} onChange={e=>set("vinculo_razao_social",e.target.value||null)} placeholder="Razão social da empresa"/></label>
           </>}
          {isInternato&&<>
            <CoordenadoresSelect
              value={v("_coordenadores")||[]}
              onChange={val=>set("_coordenadores",val)}
              options={opts.coordenadores||[]}
              loading={optionsLoading}
            />
          </>}
          <div className="regra-vinculo-section">
            <hr className="form-sep"/>
            <b style={{display:"block",marginBottom:4,fontSize:13}}>Regra financeira aplicável ao vínculo</b>
            <small style={{display:"block",marginBottom:10,color:"var(--text-muted,#64748b)",fontSize:12}}>
              A regra é vinculada a este vínculo (Prática ou Internato), preservando o histórico de trocas. A ausência não impede criar o cadastro nem a escala; apenas bloqueia cálculos financeiros futuros.
            </small>
            <label><b>Regra</b><span className="select"><select value={regraSelecionadaId} onChange={e=>set("regra_financeira_id",e.target.value)}>
              <option value="">Nenhuma (regra financeira pendente)</option>
              {renderOptions("regrasFinanceiras", opts.regrasFinanceiras || [], r => `${r.nome} • ${FORMA_CALCULO_LABELS[r.forma_calculo]||r.forma_calculo||""} • ${(r.componentes||[]).filter(c=>c.status==="ativo").map(c=>TIPO_COMPONENTE_LABELS[c.tipo]||c.tipo).join(", ")||"Sem componentes"}`, "Nenhuma regra financeira ativa da modalidade.")}
            </select><ChevronDown size={16}/></span></label>
            {regraSelecionada&&<RegraResumoCard regra={regraSelecionada}/>}
            {precisaJustificativa&&<label style={{marginTop:10}}>
              <b>Justificativa *</b><input value={v("justificativa_regra")} onChange={e=>set("justificativa_regra",e.target.value)} placeholder="Informe o motivo da troca ou remoção da regra"/>
            </label>}
          </div>
        </>}
        {isEdit&&isPreceptor&&<>
          <div className="vinculos-section" style={{gridColumn:"1/-1"}}>
            <div className="vinculos-section-header">
              <h4 style={{margin:0}}><BriefcaseBusiness size={16}/> Vínculos de atuação</h4>
              {editSetModal&&editId&&<button type="button" className="btn secondary" style={{fontSize:12,padding:"5px 12px",display:"flex",alignItems:"center",gap:4}} onClick={()=>editSetModal({mode:"vinculo-edit",title:`Novo vínculo — ${formData.nome_completo||""}`,preceptor:{id:editId,nome_completo:formData.nome_completo},vinculo:null,page})}><Plus size={13}/> Adicionar vínculo</button>}
            </div>
            {(!vinculos||vinculos.length===0)&&<div style={{fontSize:13,color:"var(--text-muted,#64748b)",padding:"12px 0",textAlign:"center"}}>Nenhum vínculo cadastrado.</div>}
            {vinculos&&vinculos.map((vinc,idx)=>{
              const vAtivo=vinc.status==="ativo";
              const vinculoLabel=`Vínculo ${idx+1}`;
              const internatoLabel=isInternato?(vinc.internato?.nome||""):(vinc.disciplina?.nome||"");
              const periodoLabel=vinc.periodo?.numero?`${vinc.periodo.numero}º período`:"";
              const identParts=[internatoLabel,periodoLabel].filter(Boolean).join(" | ");
              return <div key={vinc.id} className={"vinculo-card"+(vAtivo?"":" vinculo-inativo")}>
                <div className="vinculo-card-header">
                  <div className="vinculo-card-header-left">
                    <span className="vinculo-card-badge"><BriefcaseBusiness size={11}/> {vinculoLabel}</span>
                    {identParts&&<span className="vinculo-card-ident">{identParts}</span>}
                  </div>
                  <div className="vinculo-card-header-right">
                    <em className={statusBadge(vAtivo?"ativo":"inativo")} style={{fontSize:11}}>{vAtivo?"Ativo":"Inativo"}</em>
                    {editSetModal&&<button type="button" className="vinculo-edit-btn" onClick={()=>editSetModal({mode:"vinculo-edit",title:`Editar vínculo — ${formData.nome_completo||""}`,preceptor:{id:editId,nome_completo:formData.nome_completo},vinculo:vinc,page})}><Pencil size={13}/> Editar vínculo</button>}
                    {onDeleteVinculo&&<button type="button" className="vinculo-edit-btn" style={{color:"#dc2626"}} onClick={()=>onDeleteVinculo(vinc,isInternato?"internato":"adm")}><Trash2 size={13}/> Excluir vínculo</button>}
                  </div>
                </div>
                <div className="vinculo-card-body">
                  <div className="vinculo-card-grid">
                    {vinc.local?.nome&&<div><small>Local</small><b>{vinc.local.nome}</b></div>}
                    {vinc.setor?.nome&&<div><small>Setor</small><b>{vinc.setor.nome}</b></div>}
                    {vinc.semestre?.codigo&&<div><small>Semestre</small><b>{vinc.semestre.codigo}</b></div>}
                    {vinc.data_inicio&&<div><small>Vigência</small><b>{fmtData(vinc.data_inicio)}{vinc.data_fim?` a ${fmtData(vinc.data_fim)}`:""}</b></div>}
                    {isInternato&&vinc.coordenadores&&vinc.coordenadores.length>0&&<div className="wide"><small>Coordenadores</small><b>{vinc.coordenadores.map(c=>c.nome_completo).join(", ")}</b></div>}
                    {isInternato&&vinc.regraAtiva&&<div className="wide"><small>Regra financeira</small><b>{vinc.regraAtiva.regra?.nome||"-"}</b></div>}
                    {isInternato&&<div><small>Saldo semestral</small><b>{vinc.valor_inicial!=null?formatCurrencyBRL(vinc.valor_inicial):"-"}</b></div>}
                  </div>
                </div>
              </div>;
            })}
          </div>
        </>}
      </>}
      {page==="escalas"&&<>
        <EscalasCalendar formData={formData} set={set} v={v} setores={setores}/>
        <label><b>Situação</b><span className="select"><select value={v("status")||"ativo"} onChange={e=>set("status",e.target.value)}>
          <option value="ativo">Ativa</option><option value="inativo">Inativa</option>
        </select><ChevronDown size={16}/></span></label>
      </>}
      {page==="ajustes"&&<>
        <label><b>Preceptor</b><span className="select"><select value={v("preceptor_id")} onChange={e=>set("preceptor_id",e.target.value)}>
          <option value="">Selecione</option>
          {(opts.preceptores||[]).map(p=><option key={p.id} value={p.id}>{p.nome_completo}</option>)}
        </select><ChevronDown size={16}/></span></label>
        <label><b>Tipo</b><span className="select"><select value={v("tipo_ajuste")} onChange={e=>set("tipo_ajuste",e.target.value)}>
          <option value="">Selecione</option><option value="inclusao">Inclusão</option><option value="alteracao">Correção</option><option value="cancelamento">Cancelamento</option>
        </select><ChevronDown size={16}/></span></label>
        <label><b>Data</b><input type="date" value={v("data")} onChange={e=>set("data",e.target.value)}/></label>
        <label><b>Turno</b><span className="select"><select value={v("turno")} onChange={e=>set("turno",e.target.value)}>
          <option value="">Selecione</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option>
        </select><ChevronDown size={16}/></span></label>
        <label><b>Justificativa</b><input value={v("justificativa")} onChange={e=>set("justificativa",e.target.value)} placeholder="Justificativa"/></label>
      </>}
      {!isPreceptor&&page!=="escalas"&&page!=="ajustes"&&
        <><label><b>Nome ou referência</b><input value={v("nome")} onChange={e=>set("nome",e.target.value)} placeholder="Preencha este campo"/></label>
        <label><b>Documento ou código</b><input value={v("documento")} onChange={e=>set("documento",e.target.value)} placeholder="Preencha este campo"/></label>
        <label><b>Tipo</b><span className="select"><select value={v("tipo")} onChange={e=>set("tipo",e.target.value)}>
          <option value="">Selecione</option>{financial?["por_turno","mensal_fixo","rateio","adicional"].map(x=><option key={x} value={x}>{x}</option>):["ativo","inativo"].map(x=><option key={x} value={x}>{x}</option>)}
        </select><ChevronDown size={16}/></span></label>
        <label><b>Valor ou descrição</b><input value={v("valor")} onChange={e=>set("valor",e.target.value)} placeholder="Preencha este campo"/></label>
        <label><b>Início da vigência</b><input type="date" value={v("inicio")} onChange={e=>set("inicio",e.target.value)}/></label>
        <label><b>Fim da vigência</b><input type="date" value={v("fim")} onChange={e=>set("fim",e.target.value)}/></label></>}
  </div><footer>{isEdit&&isPreceptor&&onDeletePreceptor&&<button type="button" className="btn danger" style={{marginRight:"auto"}} onClick={()=>onDeletePreceptor(editId)}><Trash2 size={16}/> Excluir preceptor</button>}<Btn secondary icon={X} onClick={close}>Cancelar</Btn><Btn icon={Check} onClick={save} disabled={saving||isEscalaSemSel}>{saving?"Salvando...":"Salvar"}</Btn></footer></div>;
}

const ALL_ROLES=["admin","coordenador"];
const ROLE_LABELS={admin:"Administrador",coordenador:"Coordenação"};

function UserForm({modal,close,onSaved}){
  const user=modal.user||null;
  const isCreate=modal.mode==="user-create";
  const[nome,setNome]=useState(user?.nome_completo||"");
  const[email,setEmail]=useState(user?.email||"");
  const[telefone,setTelefone]=useState(user?.telefone||"");
  const[roles,setRoles]=useState(user?.roles||["coordenador"]);
  const[ativo,setAtivo]=useState(user?.ativo!==false);
  const[erro,setErro]=useState("");
  const[carregando,setCarregando]=useState(false);

  const toggleRole=(role)=>{
    setRoles(prev=>prev.includes(role)?prev.filter(r=>r!==role):[...prev,role]);
  };

  const handle=async(e)=>{
    e.preventDefault();
    setErro("");setCarregando(true);
    try{
      if(!nome.trim()){setErro("Informe o nome.");setCarregando(false);return}
      if(!email.trim()){setErro("Informe o e-mail.");setCarregando(false);return}
      if(roles.length===0){setErro("Selecione pelo menos um perfil.");setCarregando(false);return}
      if(isCreate){
        await criarUsuarioViaEdge({email,password:"ser@2026",nome_completo:nome,telefone:telefone||null,roles});
      }else{
        await atualizarUsuario({
          profile_id:user.profile_id,
          nome_completo:nome,
          email,
          telefone:telefone||null,
          roles,
          ativo
        });
      }
      onSaved();
    }catch(e){setErro(e.message||"Erro ao salvar usuario");}
    setCarregando(false);
  };

  return<div className="form"><div className="grid">
    <label><b>Nome completo</b><input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome completo"/></label>
    <label><b>E-mail</b><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@exemplo.com"/></label>
    {isCreate&&<div style={{gridColumn:"1/-1",padding:"12px 16px",background:"#f0f7ff",borderRadius:8,border:"1px solid #bfdbfe",fontSize:12,color:"#1e40af"}}>
      <b>Senha temporária:</b> ser@2026 (primeiro acesso obrigatório)
    </div>}
    <div style={{gridColumn:"1/-1"}}>
      <b style={{display:"block",marginBottom:8,fontSize:12,color:"#566880"}}>Perfil do usuário</b>
      <div className="roles-grid">
        {ALL_ROLES.map(role=>{
          return<label key={role} className={"role-chip"+(roles.includes(role)?" role-active":"")}>
            <input type="checkbox" checked={roles.includes(role)} onChange={()=>toggleRole(role)}/>
            <span>{ROLE_LABELS[role]}</span>
          </label>;
        })}
      </div>
    </div>
    {!isCreate&&<label><b>Ativo</b><span className="select"><select value={ativo?"true":"false"} onChange={e=>setAtivo(e.target.value==="true")}>
      <option value="true">Sim</option><option value="false">Não</option>
    </select><ChevronDown size={16}/></span></label>}
  </div>
  {erro&&<div className="login-erro" style={{marginTop:12}}><AlertCircle size={14}/> {erro}</div>}
  <footer><Btn secondary icon={X} onClick={close}>Cancelar</Btn><Btn icon={Check} onClick={handle} disabled={carregando}>{carregando?<Loader2 size={16} className="spin"/>:null} {isCreate?"Criar usuário":"Salvar alterações"}</Btn></footer></div>;
}

const AUX_TABS=[
  {id:"profissoes",label:"Profissões"},
  {id:"disciplinas",label:"Disciplinas"},
  {id:"internatos",label:"Internatos"},
  {id:"locais",label:"Locais"},
  {id:"setores",label:"Setores"},
  {id:"periodos",label:"Períodos"},
  {id:"semestres",label:"Semestres"},
  {id:"unidades",label:"Unidades"},
  {id:"modalidades",label:"Modalidades"}
];

function MultiSelectSearch({options,value,onChange,placeholder,emptyLabel,label}){
 const[open,setOpen]=useState(false);
 const[input,setInput]=useState("");
 const[containerRef,setContainerRef]=useState(null);
 useEffect(()=>{
   const handleDoc=(e)=>{
     if(containerRef&&!containerRef.contains(e.target)){setOpen(false);setInput("")}
   };
   document.addEventListener("mousedown",handleDoc);
   return()=>document.removeEventListener("mousedown",handleDoc);
 },[containerRef]);
 const selected=Array.isArray(value)?value:[];
  const filtered=options.filter(o=>o.nome.toLowerCase().includes(input.toLowerCase()));
  const toggle=(id)=>{
    const newSel=selected.includes(id)?selected.filter(v=>v!==id):[...selected,id];
    onChange(newSel);
  };
  return<div className="multi-select" ref={setContainerRef}>
    <div className={"multi-select-trigger"+(open?" open":"")} onClick={()=>setOpen(!open)}>
      <div className="multi-select-tags">{selected.map(id=>{const opt=options.find(o=>o.id===id);return opt?
        <span className="multi-select-tag" key={id}>{opt.nome}<button type="button" onClick={e=>{e.stopPropagation();toggle(id)}} aria-label="Remover">×</button></span>:"";})}</div>
      {selected.length===0&&<span className="multi-select-placeholder">{placeholder}</span>}
      <ChevronDown size={16}/>
    </div>
    {open&&<div className="multi-select-dropdown">
      <input className="multi-select-search" type="text" placeholder="Pesquisar..." value={input} onChange={e=>setInput(e.target.value)} onClick={e=>e.stopPropagation()} autoFocus/>
      <div className="multi-select-options">{
        filtered.length===0?<div className="multi-select-empty">{emptyLabel}</div>
        :filtered.map(o=><div className={"multi-select-option"+(selected.includes(o.id)?" selected":"")} key={o.id} onClick={()=>toggle(o.id)}>{o.nome}</div>)}
      </div>
    </div>}
  </div>;
}

function CadastrosAuxiliares({onNotify}){
const[activeTab,setActiveTab]=useState("profissoes");
   const[data,setData]=useState([]);
   const[loading,setLoading]=useState(true);
   const[search,setSearch]=useState("");
   const[panelFilters,setPanelFilters]=useState({});
   const[panelOpen,setPanelOpen]=useState(false);
   const[modal,setModal]=useState(null);
    const[saving,setSaving]=useState(false);
    const isSetores=activeTab==="setores";

const TAB_FILTERS={
  profissoes:[{key:"status",label:"Situação"}],
  disciplinas:[{key:"status",label:"Situação"}],
  internatos:[{key:"status",label:"Situação"}],
  locais:[{key:"status",label:"Situação"}],
  setores:[{key:"local",label:"Local",nestedKey:"nome"}],
  periodos:[{key:"status",label:"Situação"}],
  semestres:[{key:"status",label:"Situação"}],
  unidades:[{key:"status",label:"Situação"}],
  modalidades:[{key:"status",label:"Situação"}],
};

const load=useCallback(async()=>{
     setLoading(true);
     try{
       if(activeTab==="profissoes"){setData(await fetchProfissoes())}
       else if(activeTab==="disciplinas"){setData(await fetchDisciplinas())}
       else if(activeTab==="internatos"){setData(await fetchInternatos())}
       else if(activeTab==="locais"){setData(await fetchLocais())}
       else if(activeTab==="setores"){setData(await fetchSetores())}
       else if(activeTab==="periodos"){setData(await fetchPeriodosCadastro())}
       else if(activeTab==="semestres"){setData(await fetchSemestresCadastro())}
       else if(activeTab==="unidades"){setData(await fetchUnidades())}
       else if(activeTab==="modalidades"){setData(await fetchModalidadesPagamento())}
     }catch(e){onNotify("Erro ao carregar: "+e.message,"error")}
     setLoading(false);
   },[activeTab]);

  useEffect(()=>{load()},[load]);

  const filtered=useMemo(()=>{
    let result=data;
    if(search.trim()){
      const s=normalizeText(search);
      result=result.filter(r=>{
        if(activeTab==="periodos")return String(r.numero).includes(s)||normalizeText(r.nome||"").includes(s);
        if(activeTab==="semestres")return normalizeText(r.codigo||"").includes(s);
        if(activeTab==="unidades")return normalizeText(r.nome||"").includes(s)||normalizeText(r.codigo||"").includes(s);
        if(activeTab==="modalidades")return normalizeText(r.nome||"").includes(s);
        if(activeTab==="internatos")return normalizeText(r.nome||"").includes(s)||String(r.numero).includes(s);
        return normalizeText(r.nome||"").includes(s)||normalizeText(r.local?.nome||"").includes(s);
      });
    }
    const cfg=TAB_FILTERS[activeTab]||[];
    cfg.forEach(f=>{
      const vals=panelFilters[f.key];
      if(vals&&vals.length){
        result=result.filter(r=>{
          let v=f.nestedKey&&r[f.key]?r[f.key][f.nestedKey]:r[f.key];
          return vals.includes(String(v));
        });
      }
    });
    return result;
  },[data,search,activeTab,panelFilters]);

  async function handleSave(){
    if(!modal||modal.mode!=="aux-form")return;
    const{editId,formData}=modal;

    if(activeTab==="periodos"){
      if(!formData.numero){onNotify("Selecione o número do período.","error");return}
      const nome=`${formData.numero}º período`;
      const dup=data.find(r=>r.numero===parseInt(formData.numero)&&r.id!==editId);
      if(dup){onNotify("Já existe um período com este número.","error");return}
      setSaving(true);
      try{
        if(editId){await updatePeriodoCadastro(editId,{...formData,nome})}
        else{await insertPeriodoCadastro({...formData,nome})}
        onNotify(editId?"Registro atualizado!":"Registro criado!");
        setModal(null);load();
      }catch(e){onNotify(e.message||"Erro ao salvar.","error")}
      setSaving(false);return;
    }

    if(activeTab==="semestres"){
      if(!formData.codigo?.trim()){onNotify("Informe o código do semestre.","error");return}
      if(!/^\d{4}\.[12]$/.test(formData.codigo.trim())){onNotify("Código inválido. Use o formato AAAA.1 ou AAAA.2 (ex: 2026.1).","error");return}
      const dup=data.find(r=>r.codigo?.toLowerCase()===formData.codigo.toLowerCase().trim()&&r.id!==editId);
      if(dup){onNotify("Já existe um semestre com este código.","error");return}
      setSaving(true);
      try{
        const saveData={codigo:formData.codigo.trim(),status:formData.status||"ativo"};
        if(editId){await updateSemestreCadastro(editId,saveData)}
        else{await insertSemestreCadastro(saveData)}
        onNotify(editId?"Registro atualizado!":"Registro criado!");
        setModal(null);load();
      }catch(e){onNotify(e.message||"Erro ao salvar.","error")}
      setSaving(false);return;
    }

    if(activeTab==="unidades"){
      if(!formData.nome?.trim()){onNotify("Informe o nome da unidade.","error");return}
      setSaving(true);
      try{
        if(editId){await updateUnidade(editId,formData)}
        else{await insertUnidade(formData)}
        onNotify(editId?"Registro atualizado!":"Registro criado!");
        setModal(null);load();
      }catch(e){onNotify(e.message||"Erro ao salvar.","error")}
      setSaving(false);return;
    }

    if(activeTab==="modalidades"){
      if(!formData.nome?.trim()){onNotify("Informe o nome da modalidade.","error");return}
      const nomeNormalizado=formData.nome.trim().toLowerCase().replace(/\s+/g,' ');
      const dup=data.find(r=>r.nome?.trim().toLowerCase().replace(/\s+/g,' ')===nomeNormalizado&&r.id!==editId);
      if(dup){onNotify("Já existe uma modalidade com este nome.","error");return}
      setSaving(true);
      try{
        if(editId){await updateModalidadePagamento(editId,formData)}
        else{await insertModalidadePagamento(formData)}
        onNotify(editId?"Registro atualizado!":"Registro criado!");
        setModal(null);load();
      }catch(e){
        let msg=e.message||"Erro ao salvar.";
        if(msg.includes("unique constraint")||msg.includes("unique"))msg="Já existe uma modalidade com este nome.";
        onNotify(msg,"error");
      }
      setSaving(false);return;
    }

       if(activeTab==="internatos"){
         if(!formData.nome?.trim()){onNotify("Informe o nome do internato.","error");return}
         const nomeNorm=formData.nome.trim().toLowerCase();
         const dup=data.find(r=>r.nome?.trim().toLowerCase()===nomeNorm&&r.id!==editId);
         if(dup){onNotify("Já existe um internato cadastrado com este nome.","error");return}
       } else {
         if(!formData.nome?.trim()){onNotify("Informe o nome.","error");return}
       }

      setSaving(true);
      try{
        if(activeTab==="profissoes"){
          if(editId){await updateProfissao(editId,formData)}
          else{await insertProfissao(formData)}
        }else if(activeTab==="disciplinas"){
          if(editId){await updateDisciplinaCadastro(editId,formData)}
          else{await insertDisciplinaCadastro(formData)}
        }else if(activeTab==="internatos"){
          if(editId){
            await updateInternato(editId,{nome:formData.nome.trim()});
          }else{
            await insertInternato({nome:formData.nome.trim()});
          }
        }else if(activeTab==="locais"){
          if(editId){await updateLocalCadastro(editId,formData)}
          else{await insertLocalCadastro(formData)}
        }else if(activeTab==="setores"){
          if(editId){await updateSetorCadastro(editId,formData)}
          else{await insertSetorCadastro(formData)}
        }
       onNotify(editId?"Registro atualizado!":"Registro criado!");
       setModal(null);load();
     }catch(e){
       let msg=e.message||"Erro ao salvar.";
       if(msg.includes("unique constraint")||msg.includes("unique"))msg="Já existe um registro com este nome ou número.";
       onNotify(msg,"error");
     }
     setSaving(false);
   }

   async function handleDelete(){
     if(!modal||modal.mode!=="aux-confirm")return;
     const{id,nome,action}=modal;
     setSaving(true);
     try{
       if(action==="delete"){
         let deps=[];
if(activeTab==="profissoes")deps=await checkProfissaoDependencies(id);
          else if(activeTab==="disciplinas")deps=await checkDisciplinaDependencies(id);
          else if(activeTab==="internatos")deps=await checkInternatoDependencies(id);
          else if(activeTab==="locais")deps=await checkLocalDependencies(id);
          else if(activeTab==="setores")deps=await checkSetorDependencies(id);
         else if(activeTab==="periodos")deps=await checkPeriodoDependencies(id);
         else if(activeTab==="semestres")deps=await checkSemestreDependencies(id);
         else if(activeTab==="unidades")deps=await checkUnidadeDependencies(id);
         else if(activeTab==="modalidades")deps=await checkModalidadePagamentoDependencies(id);
         if(deps.length>0){
           const lista=deps.map(d=>`${d.count} ${d.label}`).join(", ");
           setModal({mode:"aux-confirm",id,nome,action:"inativar",
             msg:`Este registro já possui vínculos (${lista}) e não pode ser excluído. Deseja inativá-lo?`});
           setSaving(false);return;
         }
if(activeTab==="profissoes")await deleteProfissao(id);
          else if(activeTab==="disciplinas")await deleteDisciplina(id);
          else if(activeTab==="internatos")await deleteInternato(id);
          else if(activeTab==="locais")await deleteLocal(id);
          else if(activeTab==="setores")await deleteSetor(id);
         else if(activeTab==="periodos")await deletePeriodo(id);
         else if(activeTab==="semestres")await deleteSemestre(id);
         else if(activeTab==="unidades")await deleteUnidade(id);
         else if(activeTab==="modalidades")await deleteModalidadePagamento(id);
         onNotify("Registro excluído com sucesso!");
       }else{
if(activeTab==="profissoes")await inativarProfissao(id);
          else if(activeTab==="disciplinas")await inativarDisciplina(id);
          else if(activeTab==="internatos")await inativarInternato(id);
          else if(activeTab==="locais")await inativarLocal(id);
          else if(activeTab==="setores")await inativarSetor(id);
         else if(activeTab==="periodos")await inativarPeriodo(id);
         else if(activeTab==="semestres")await inativarSemestre(id);
         else if(activeTab==="modalidades")await inativarModalidadePagamento(id);
         onNotify("Registro inativado com sucesso!");
       }
       setModal(null);load();
     }catch(e){onNotify("Erro: "+e.message,"error")}
     setSaving(false);
   }

   const TAB_LABELS={profissoes:"Profissões",disciplinas:"Disciplinas",internatos:"Internatos",locais:"Locais",setores:"Setores",periodos:"Períodos",semestres:"Semestres",unidades:"Unidades",modalidades:"Modalidades de Pagamento"};
   const TAB_BTN_LABELS={profissoes:"Nova profissão",disciplinas:"Nova disciplina",internatos:"Novo internato",locais:"Novo local",setores:"Novo setor",periodos:"Novo período",semestres:"Novo semestre",unidades:"Nova unidade",modalidades:"Nova modalidade"};
   const TAB_PLACEHOLDERS={profissoes:"profissões",disciplinas:"disciplinas",internatos:"internatos",locais:"locais",setores:"setores",periodos:"períodos",semestres:"semestres",unidades:"unidades",modalidades:"modalidades"};

   const isPeriodo=activeTab==="periodos";
   const isSemestre=activeTab==="semestres";
   const isUnidade=activeTab==="unidades";
   const isModalidade=activeTab==="modalidades";
   const isInternato=activeTab==="internatos";

   return <div className="aux-cadastros">
     <div className="aux-tabs">
        {AUX_TABS.map(t=><button key={t.id} className={"aux-tab"+(activeTab===t.id?" active":"")} onClick={()=>{setActiveTab(t.id);setSearch("");setPanelFilters({})}}>{t.label}</button>)}
     </div>
      <div className="aux-card">
        <div className="aux-toolbar" style={{flexDirection:"column",alignItems:"stretch",gap:8}}>
          <SearchFilterBar
            search={search} setSearch={setSearch}
            placeholder={`Buscar em ${TAB_PLACEHOLDERS[activeTab]}...`}
            panelFilters={panelFilters} onApplyFilters={setPanelFilters}
            onClearFilters={()=>setPanelFilters({})} panelOpen={panelOpen} setPanelOpen={setPanelOpen}
            filters={TAB_FILTERS[activeTab]||[]} rows={data}
            resultCount={filtered.length}
          />
          <Btn icon={Plus} onClick={()=>setModal({mode:"aux-form",title:TAB_BTN_LABELS[activeTab],formData:isPeriodo?{numero:"",status:"ativo"}:isSemestre?{codigo:"",status:"ativo"}:isUnidade?{nome:""}:isModalidade?{nome:"",status:"ativo"}:isInternato?{nome:""}:isSetores?{nome:""}:{nome:"",status:"ativo"}})} style={{alignSelf:"flex-end"}}>{TAB_BTN_LABELS[activeTab]}</Btn>
        </div>
       <div className="aux-content">
          {loading?<div className="empty"><Loader2 size={24} className="spin"/><b>Carregando...</b></div>
          :filtered.length===0?<div className="empty"><FileSearch/><b>Nenhum registro encontrado</b>{search.trim()&&<span> para "{search.trim()}"</span>}{Object.values(panelFilters).flat().length>0&&<small> Tente ajustar os filtros aplicados.</small>}</div>
         :<div className="tablewrap"><table>
           <thead><tr>
{isPeriodo&&<th>Período</th>}
              {isSemestre&&<th>Semestre</th>}
              {isUnidade&&<th>Nome</th>}
              {isUnidade&&<th>Código</th>}
               {!isPeriodo&&!isSemestre&&!isUnidade&&<th>Nome</th>}
                {!isUnidade&&!isInternato&&!isSetores&&<th>Situação</th>}
               <th>Ações</th>
             </tr></thead>
             <tbody>{filtered.map(r=><tr key={r.id}>
               {isPeriodo&&<td>{r.nome||`${r.numero}º período`}</td>}
                {isSemestre&&<td>{r.codigo}</td>}
                {isUnidade&&<td>{r.nome}</td>}
                {isUnidade&&<td>{r.codigo}</td>}
                 {!isPeriodo&&!isSemestre&&!isUnidade&&<td>{r.nome}</td>}
                {!isUnidade&&!isInternato&&!isSetores&&<td><em className={statusBadge(r.status)}>{r.status==="ativo"?"Ativo":"Inativo"}</em></td>}
              <td><span className="actions">
                  <button onClick={()=>setModal({mode:"aux-form",title:`Editar: ${isPeriodo?r.nome||`${r.numero}º período`:isSemestre?r.codigo:isUnidade?r.nome:r.nome}`,editId:r.id,formData:isPeriodo?{numero:String(r.numero),status:r.status}:isSemestre?{codigo:r.codigo,status:r.status}:isUnidade?{nome:r.nome,codigo:r.codigo}:isModalidade?{nome:r.nome,status:r.status}:isInternato?{nome:r.nome}:isSetores?{nome:r.nome}:{nome:r.nome,status:r.status}})} title="Editar"><Pencil/></button>
               <button onClick={()=>setModal({mode:"aux-confirm",id:r.id,nome:isPeriodo?r.nome||`${r.numero}º período`:isSemestre?r.codigo:isUnidade?r.nome:r.nome,action:"delete",msg:`Tem certeza de que deseja excluir "${isPeriodo?r.nome||`${r.numero}º período`:isSemestre?r.codigo:isUnidade?r.nome:r.nome}"?`})} title="Excluir"><Trash2/></button>
             </span></td>
           </tr>)}</tbody>
         </table></div>}
        </div>
      </div>

     {modal?.mode==="aux-form"&&<div className="overlay modal"><div className="dialog">
       <div className="modalhead"><div><small>CADASTRO</small><h2>{modal.title}</h2></div><button onClick={()=>setModal(null)}><X/></button></div>
       <div className="form"><div className="grid">
         {isPeriodo&&<>
           <label><b>Número do período *</b><span className="select"><select value={modal.formData.numero||""} onChange={e=>setModal({...modal,formData:{...modal.formData,numero:e.target.value}})}>
             <option value="">Selecione</option>
             {[1,2,3,4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n}º período</option>)}
           </select><ChevronDown size={16}/></span></label>
           {modal.formData.numero&&<label><b>Nome de exibição</b><input value={`${modal.formData.numero}º período`} disabled/></label>}
           <label><b>Situação</b><span className="select"><select value={modal.formData.status||"ativo"} onChange={e=>setModal({...modal,formData:{...modal.formData,status:e.target.value}})}>
             <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
           </select><ChevronDown size={16}/></span></label>
         </>}
         {isSemestre&&<>
            <label><b>Código do semestre *</b><input value={modal.formData.codigo||""} onChange={e=>setModal({...modal,formData:{...modal.formData,codigo:e.target.value}})} placeholder="Ex: 2026.1"/></label>
            <label><b>Situação</b><span className="select"><select value={modal.formData.status||"ativo"} onChange={e=>setModal({...modal,formData:{...modal.formData,status:e.target.value}})}>
              <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
            </select><ChevronDown size={16}/></span></label>
          </>}
         {isUnidade&&<>
           <label><b>Nome da unidade *</b><input value={modal.formData.nome||""} onChange={e=>setModal({...modal,formData:{...modal.formData,nome:e.target.value}})} placeholder="Nome da unidade"/></label>
           {modal.editId&&<label><b>Código</b><input value={modal.formData.codigo||""} disabled/></label>}
         </>}
         {isModalidade&&<>
           <label><b>Nome da modalidade *</b><input value={modal.formData.nome||""} onChange={e=>setModal({...modal,formData:{...modal.formData,nome:e.target.value}})} placeholder="Nome da modalidade"/></label>
           <label><b>Situação</b><span className="select"><select value={modal.formData.status||"ativo"} onChange={e=>setModal({...modal,formData:{...modal.formData,status:e.target.value}})}>
             <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
           </select><ChevronDown size={16}/></span></label>
         </>}
  {isInternato&&<>
     <label style={{gridColumn:"1 / -1"}}><b>Nome do internato *</b><input value={modal.formData.nome||""} onChange={e=>setModal({...modal,formData:{...modal.formData,nome:e.target.value}})} placeholder="Digite o nome do internato (Ex: INTERNATO 1)"/></label>
   </>}
           {!isPeriodo&&!isSemestre&&!isUnidade&&!isModalidade&&!isInternato&&<>
             {isSetores&&<>
              <label><b>Nome do setor *</b><input value={modal.formData.nome||""} onChange={e=>setModal({...modal,formData:{...modal.formData,nome:e.target.value}})} placeholder="Nome do setor"/></label>
            </>}
            {!isSetores&&<>
              <label><b>Nome *</b><input value={modal.formData.nome||""} onChange={e=>setModal({...modal,formData:{...modal.formData,nome:e.target.value}})} placeholder={`Nome da ${TAB_LABELS[activeTab].slice(0,-1).toLowerCase()}`}/></label>
              <label><b>Situação</b><span className="select"><select value={modal.formData.status||"ativo"} onChange={e=>setModal({...modal,formData:{...modal.formData,status:e.target.value}})}>
                <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
</select><ChevronDown size={16}/></span></label>
             </>}
           </>}
      </div><footer>
        <Btn secondary icon={X} onClick={()=>setModal(null)}>Cancelar</Btn>
        <Btn icon={Check} onClick={handleSave} disabled={saving}>{saving?<Loader2 size={16} className="spin"/>:null} Salvar</Btn>
      </footer></div>
    </div></div>}

    {modal?.mode==="aux-confirm"&&modal.action!=="inativar-final"&&<div className="overlay modal"><div className="dialog">
      <div className="modalhead"><div><small>CONFIRMAÇÃO</small><h2>{modal.action==="delete"?"Excluir registro":"Inativar registro"}</h2></div><button onClick={()=>setModal(null)}><X/></button></div>
      <div style={{padding:24}}>
        <p style={{marginBottom:8}}>{modal.msg}</p>
        {modal.action==="delete"&&<p style={{fontSize:12,color:"var(--text-muted)"}}>Esta ação não pode ser desfeita.</p>}
      </div>
      <footer style={{padding:"0 24px 24px",display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn secondary icon={X} onClick={()=>setModal(null)}>Cancelar</Btn>
        {modal.action==="inativar"
          ?<Btn icon={AlertCircle} onClick={()=>{setModal({...modal,action:"inativar-final"})}} disabled={saving}>Inativar</Btn>
          :<Btn icon={Trash2} onClick={handleDelete} disabled={saving} style={{background:"var(--danger)",color:"white"}}>{saving?<Loader2 size={16} className="spin"/>:null} Excluir</Btn>}
      </footer>
    </div></div>}

    {modal?.mode==="aux-confirm"&&modal.action==="inativar-final"&&<div className="overlay modal"><div className="dialog">
      <div className="modalhead"><div><small>CONFIRMAÇÃO</small><h2>Inativar registro</h2></div><button onClick={()=>setModal(null)}><X/></button></div>
      <div style={{padding:24}}>
        <p>Confirma inativação de <b>"{modal.nome}"</b>?</p>
        <p style={{fontSize:12,color:"var(--text-muted)",marginTop:8}}>O registro continuará no histórico mas não aparecerá em listas futuras.</p>
      </div>
      <footer style={{padding:"0 24px 24px",display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn secondary icon={X} onClick={()=>setModal(null)}>Cancelar</Btn>
        <Btn icon={Check} onClick={handleDelete} disabled={saving}>{saving?<Loader2 size={16} className="spin"/>:null} Confirmar inativação</Btn>
      </footer>
    </div></div>}
  </div>;
}


function apenasDigitos(s){return String(s==null?'':s).replace(/\D+/g,'')}
function camposBuscaFinanceira(r){
 const texto=[r.preceptor_nome,r.preceptor_nome_social,r.preceptor_razao_social,r.preceptor_profissao,r.preceptor_conselho_tipo,r.preceptor_conselho_numero,r.preceptor_email,r.internato_nome,r.disciplina_nome,r.unidade_nome,r.local_nome,r.setor_nome,r.vinculo_setor_nome,r.periodo_nome,r.modalidade_pagamento].filter(Boolean).join(' ');
 const digitos=[r.preceptor_cpf,r.preceptor_cnpj,r.vinculo_cnpj,r.preceptor_conselho_numero].map(apenasDigitos).filter(d=>d.length>=3);
 return{texto:normalizeText(texto),digitos};
}
function buscaFinanceira(r,busca){
 const b=normalizeText(busca).trim();
 if(!b)return true;
 const{texto,digitos}=camposBuscaFinanceira(r);
 if(texto.includes(b))return true;
 const db=apenasDigitos(busca);
 if(db.length>=3&&digitos.some(d=>d.includes(db)))return true;
 return false;
}
const STATUS_SIT_COMPOSTOS={email_nao_enviado:['nao_solicitada','preparada'],nao_pago:['solicitada','nota_recebida','em_pagamento','cancelado']};
function statusSitLinhaOk(st,alvo){const lista=STATUS_SIT_COMPOSTOS[alvo];return lista?lista.includes(st):st===alvo;}
function filtrarFinanceiro(rows,f){return rows.filter(r=>(!f.competencia||`${r.ano}-${String(r.mes).padStart(2,'0')}`===f.competencia)&&(!f.mes||String(Number(r.mes)).padStart(2,'0')===String(f.mes).padStart(2,'0'))&&(!f.ano||String(r.ano)===String(f.ano))&&(!f.busca||buscaFinanceira(r,f.busca))&&(!f.unidade||r.unidade_nome===f.unidade)&&(!f.internato||r.internato_nome===f.internato)&&(!f.local||r.local_nome===f.local)&&(!f.status||statusSitLinhaOk(r.situacao_nota||'nao_solicitada',f.status)));}
function formatCpf(cpf){if(!cpf)return'';const s=cpf.replace(/\D/g,'');return s.length===11?`${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}`:cpf}
function formatCnpj(cnpj){if(!cnpj)return'';const s=cnpj.replace(/\D/g,'');return s.length===14?`${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`:cnpj}
function identificacaoFiscal(r){
 const cnpj=r.vinculo_cnpj||r.preceptor_cnpj;
 const razao=r.vinculo_razao_social||r.preceptor_razao_social;
 if(cnpj)return{tipo:'PJ',linha:`${razao||r.preceptor_nome||'Preceptor'} — CNPJ: ${formatCnpj(cnpj)}`};
 return{tipo:'PF',linha:`${r.preceptor_nome||'Preceptor'} — CPF: ${formatCpf(r.preceptor_cpf)}`};
}
function turnoLabelPdf(t){return t==='manha'?'Manhã':t==='tarde'?'Tarde':t==='noite'?'Noite':t||'-'}
async function handleGerarDemonstrativoPDF(preceptorId, competenciaId, contexto = {}){

  if(!preceptorId){
    await systemAlert('Preceptor não identificado na lista exibida. Atualize a página e tente novamente.','Preceptor ausente');
    return;
  }
  let compId = competenciaId;
  if(!compId && Array.isArray(contexto.calculoIds) && contexto.calculoIds.length > 0){
    compId = await resolverCompetenciaIdPorCalculos(contexto.calculoIds);
  }
  if(!compId){
    const rotulo = (contexto.mes && contexto.ano) ? apuracaoMesLabel(contexto.mes, contexto.ano) : 'a competência exibida';
    await systemAlert(`Competência financeira não encontrada para ${rotulo}.`,'Competência não encontrada');
    return;
  }
  try{
    // Consulta sempre os dados atuais (sem reutilizar estado de tentativa anterior).
    const dados = await montarDadosDemonstrativoFinanceiro(preceptorId, compId);
    if(!dados || !dados.atuacoesElegiveis || dados.atuacoesElegiveis.length === 0){
      let msg = "Nenhuma atuação elegível (calculada e atualizada) foi encontrada para este preceptor nesta competência.";
      if(dados?.impedimentos && dados.impedimentos.length > 0){
        msg += "\n\nMotivo(s) por atuação:\n" + dados.impedimentos.map(imp => `• ${imp.motivo}`).join("\n");
      }
      await systemAlert(msg, "Demonstrativo Indisponível");
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const ident = dados.identificacaoFiscal;
    const comp = dados.competenciaInfo;

    doc.setFillColor(12, 35, 70);
    doc.rect(0, 0, 210, 34, 'F');
    doc.setTextColor(226, 183, 78);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('MEDICINA UNINASSAU', 15, 15);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Demonstrativo Financeiro de Preceptoria', 15, 25);

    let y = 42;

    doc.setFillColor(245, 247, 250);
    doc.rect(12, y - 4, 186, 26, 'F');
    doc.setDrawColor(210, 218, 230);
    doc.rect(12, y - 4, 186, 26, 'S');

    doc.setTextColor(12, 35, 70);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    if (ident.tipo_identificacao === 'PJ') {
      doc.text(`RAZÃO SOCIAL: ${ident.razao_social}`, 16, y + 2);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      let subText = `CNPJ: ${ident.cnpj}`;
      if (ident.conselho_numero) subText += `  |  Conselho: ${ident.conselho_tipo ? ident.conselho_tipo + ' ' : ''}${ident.conselho_numero}`;
      doc.text(subText, 16, y + 8);
      doc.text(`Nome do Preceptor: ${ident.nome}`, 16, y + 14);
    } else {
      doc.text(`PRECEPTOR: ${ident.nome}`, 16, y + 2);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      let subText = `CPF: ${ident.cpf}`;
      if (ident.conselho_numero) subText += `  |  Conselho: ${ident.conselho_tipo ? ident.conselho_tipo + ' ' : ''}${ident.conselho_numero}`;
      doc.text(subText, 16, y + 8);
    }

    y += 28;

    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.text(`Competência: ${comp.rotulo}`, 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período considerado: ${comp.periodo_considerado}`, 75, y);
    doc.text(`Atuações elegíveis: ${dados.atuacoesElegiveis.length}`, 160, y);
    y += 8;

    doc.setDrawColor(200, 205, 215);
    doc.line(15, y - 3, 195, y - 3);
    y += 3;

    for (let idx = 0; idx < dados.atuacoesElegiveis.length; idx++) {
      const at = dados.atuacoesElegiveis[idx];

      if (y > 230) {
        doc.addPage();
        y = 20;
      }

      doc.setFillColor(235, 240, 248);
      doc.rect(14, y - 3, 182, 7, 'F');
      doc.setTextColor(12, 35, 70);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Atuação ${idx + 1}: ${at.internato_ou_disciplina}${at.periodo_academico ? ' (' + at.periodo_academico + ')' : ''}`, 16, y + 2);
      y += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      let descVinculo = `Local: ${at.local_nome}`;
      if (at.setor_nome) descVinculo += `  |  Setor: ${at.setor_nome}`;
      if (at.unidade_nome) descVinculo += `  |  Unidade: ${at.unidade_nome}`;
      doc.text(descVinculo, 16, y);
      y += 5;

      if (at.regra_financeira) {
        doc.text(`Regra aplicada: ${at.regra_financeira}`, 16, y);
        y += 5;
      }

      if (at.presencas && at.presencas.length > 0) {
        const tableBody = at.presencas.map(p => [
          fmtData(p.data_presenca),
          p.turno || '-',
          p.local_nome || at.local_nome,
          p.setor_nome || at.setor_nome,
          'Confirmada'
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Data', 'Turno', 'Local', 'Setor', 'Situação']],
          body: tableBody,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 1.5, textColor: [40, 40, 40] },
          headStyles: { fillColor: [12, 35, 70], textColor: [255, 255, 255], fontStyle: 'bold' },
          margin: { left: 15, right: 15 }
        });

        y = doc.lastAutoTable.finalY + 6;
      } else {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text('Presenças confirmadas conforme escala acumulada.', 16, y);
        y += 6;
      }

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(12, 35, 70);
      doc.text(`Total de turnos da atuação: ${at.total_turnos}  |  Subtotal da Atuação: ${formatCurrencyBRL(at.valor_atuacao)}`, 16, y);
      y += 8;

      if (idx < dados.atuacoesElegiveis.length - 1) {
        doc.setDrawColor(220, 225, 230);
        doc.line(15, y - 3, 195, y - 3);
        y += 4;
      }
    }

    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(12, 35, 70);
    doc.rect(15, y, 180, 13, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`VALOR TOTAL GERAL: ${formatCurrencyBRL(dados.valorTotalGeral)}`, 20, y + 8.5);

    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.setFont('helvetica', 'normal');
    doc.text(`Documento gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 15, 287);

    const nomePreceptor = (ident.razao_social || ident.nome || 'preceptor').replace(/\s+/g, '-').toLowerCase();
    const nomeArquivo = `demonstrativo-${nomePreceptor}-${comp.ano}-${String(comp.mes).padStart(2, '0')}.pdf`;

    doc.save(nomeArquivo);
  }catch(e){
    console.error('Erro ao gerar demonstrativo PDF:', e);
    await systemAlert('Não foi possível gerar o demonstrativo financeiro em PDF: ' + (e.message || e), 'Erro ao gerar PDF');
  }
}

async function handlePrepararEmailOutlook(preceptorId, competenciaId, contexto = {}) {
  if (!preceptorId) {
    await systemAlert('Preceptor não identificado na lista exibida. Atualize a página e tente novamente.', 'Preceptor ausente');
    return;
  }
  let compId = competenciaId;
  if (!compId && Array.isArray(contexto.calculoIds) && contexto.calculoIds.length > 0) {
    compId = await resolverCompetenciaIdPorCalculos(contexto.calculoIds);
  }
  if (!compId) {
    const rotulo = (contexto.mes && contexto.ano) ? apuracaoMesLabel(contexto.mes, contexto.ano) : 'a competência exibida';
    await systemAlert(`Competência financeira não encontrada para ${rotulo}.`, 'Competência não encontrada');
    return;
  }
  try {
    const dados = await montarDadosDemonstrativoFinanceiro(preceptorId, compId);

    if (!dados || !dados.atuacoesElegiveis || dados.atuacoesElegiveis.length === 0) {
      let msg = "Nenhuma atuação elegível (calculada e atualizada) foi encontrada para este preceptor nesta competência.";
      if (dados?.impedimentos && dados.impedimentos.length > 0) {
        msg += "\n\nMotivo(s) por atuação:\n" + dados.impedimentos.map(imp => `• ${imp.motivo}`).join("\n");
      }
      await systemAlert(msg, "E-mail Indisponível");
      return;
    }

    // Destinatários consultados A CADA preparação, direto do cadastro
    // principal atual do preceptor (sem usar dados locais antigos).
    const { data: prec, error: precErr } = await supabase
      .from('preceptores')
      .select('email')
      .eq('id', preceptorId)
      .single();

    if (precErr || !prec) {
      console.error('Erro ao consultar o cadastro do preceptor para os destinatários:', precErr);
      await systemAlert('Cadastro do preceptor não localizado. Corrija o cadastro antes de preparar o e-mail no Outlook.', 'Preceptor não encontrado');
      return;
    }

    let copias = [];
    try {
      copias = await fetchEmailsCopia(preceptorId);
    } catch (copiasErr) {
      console.error('Erro ao consultar os e-mails para cópia do cadastro:', copiasErr);
      await systemAlert('Não foi possível consultar os e-mails para cópia do cadastro do preceptor. ' + (copiasErr.message || ''), 'Erro ao preparar e-mail');
      return;
    }

    const destinatarios = montarDestinatariosOutlook(prec.email, copias);
    if (destinatarios.erro) {
      await systemAlert(mensagemErroDestinatariosEmail(destinatarios), 'Destinatário inválido');
      return;
    }
    const preceptorEmail = destinatarios.para;
    const emailsCopia = destinatarios.cc;

    const ident = dados.identificacaoFiscal;
    const comp = dados.competenciaInfo;
    const atuacoes = dados.atuacoesElegiveis || [];

    if (ident.tipo_identificacao === 'PJ' && (!ident.razao_social || !ident.cnpj)) {
      await systemAlert('Dados fiscais de Pessoa Jurídica incompletos (Razão Social e CNPJ obrigatórios).', 'Dados fiscais ausentes');
      return;
    }
    if (ident.tipo_identificacao === 'PF' && (!ident.nome || !ident.cpf)) {
      await systemAlert('Dados cadastrais de Pessoa Física incompletos (Nome e CPF obrigatórios).', 'Dados cadastrais ausentes');
      return;
    }

    const assunto = `Solicitação de nota fiscal - Preceptoria - ${comp.rotulo}`;

    const linhasIdent = (i) => {
      const linhas = [];
      if (i.tipo_identificacao === 'PJ') {
        if (i.razao_social) linhas.push(`Razão social: ${i.razao_social}`);
        if (i.cnpj) linhas.push(`CNPJ: ${formatCnpj(i.cnpj)}`);
      } else {
        if (i.nome) linhas.push(`Nome do preceptor: ${i.nome}`);
        if (i.cpf) linhas.push(`CPF: ${formatCpf(i.cpf)}`);
      }
      if (i.profissao) linhas.push(`Profissão: ${i.profissao}`);
      const mConselho = /^(.+?)\s*\/\s*([A-Za-z]{2})$/.exec((i.conselho_tipo || '').trim());
      const conselhoNome = mConselho ? mConselho[1].trim() : (i.conselho_tipo || '').trim();
      const conselhoUf = mConselho ? mConselho[2].toUpperCase() : '';
      if (conselhoNome) linhas.push(`Conselho profissional: ${conselhoNome}`);
      if (i.conselho_numero) linhas.push(`Número do conselho: ${i.conselho_numero}`);
      if (conselhoUf) linhas.push(`UF do conselho: ${conselhoUf}`);
      return linhas;
    };

    // Uma identificação única no início apenas quando todos os vínculos incluídos
    // têm o mesmo CNPJ e a mesma razão social (ou todos são PF, com o mesmo CPF).
    // Identificações diferentes não são misturadas: cada atuação exibe a sua.
    const chaveIdent = (i) => i?.tipo_identificacao === 'PJ'
      ? `PJ|${String(i.cnpj || '').replace(/\D/g, '')}|${String(i.razao_social || '').trim().toLowerCase()}`
      : `PF|${String(i.cpf || '').replace(/\D/g, '')}`;
    const identAtuacoes = atuacoes.map(at => at.identificacao || ident);
    const identUnica = new Set(identAtuacoes.map(chaveIdent)).size === 1 ? identAtuacoes[0] : null;

    const nomeDestinatario = ident?.nome || ident?.razao_social || '';

    let corpo = `Prezado(a) ${nomeDestinatario},\n\n`;
    corpo += `Solicitamos a emissão da Nota Fiscal referente aos serviços de preceptoria prestados na competência ${comp.rotulo} (${comp.periodo_considerado}).\n\n`;

    if (identUnica) {
      corpo += `=========================================\n`;
      corpo += `DADOS PARA EMISSÃO DA NOTA FISCAL\n`;
      corpo += linhasIdent(identUnica).join('\n') + '\n';
      corpo += `=========================================\n\n`;
    }

    atuacoes.forEach((at, idx) => {
      corpo += `--- ATUAÇÃO ${idx + 1}: ${at.internato_ou_disciplina}${at.periodo_academico ? ' (' + at.periodo_academico + ')' : ''} ---\n`;
      if (!identUnica) {
        const idAt = at.identificacao || ident;
        corpo += `Dados fiscais desta atuação:\n`;
        corpo += linhasIdent(idAt).join('\n') + '\n';
      }
      if (at.unidade_nome) corpo += `Unidade: ${at.unidade_nome}\n`;
      if (at.local_nome || at.setor_nome) corpo += `Local: ${at.local_nome}${at.setor_nome ? (at.local_nome ? ' | ' : '') + 'Setor: ' + at.setor_nome : ''}\n`;
      if (at.regra_financeira) corpo += `Regra aplicada: ${at.regra_financeira}\n`;

      if (at.presencas && at.presencas.length > 0) {
        corpo += `Datas e turnos confirmados:\n`;
        at.presencas.forEach(p => {
          corpo += `  • ${fmtData(p.data_presenca)}${p.turno ? ' — ' + p.turno : ''}\n`;
        });
      }
      corpo += `Total de turnos: ${at.total_turnos}\n`;
      corpo += `Valor da atuação: ${formatCurrencyBRL(at.valor_atuacao)}\n\n`;
    });

    corpo += `VALOR TOTAL GERAL: ${formatCurrencyBRL(dados.valorTotalGeral)}\n\n`;
    corpo += `Este e-mail formaliza a solicitação de emissão da Nota Fiscal referente aos serviços de preceptoria e aos valores apresentados acima.\n`;

    try {
      const calculoIds = dados.atuacoesElegiveis.map(at => at.calculo_id);
      const competenciaLabel = `${dados.competenciaInfo.ano}-${String(dados.competenciaInfo.mes).padStart(2, '0')}`;
      // Atualiza/prepara a solicitação SEM marcar como enviada e SEM duplicar
      // (prepararSolicitacaoNotaUnificada reutiliza a linha existente e preserva situação avançada).
      await prepararSolicitacaoNotaUnificada({
        preceptorId,
        competencia: competenciaLabel,
        calculoIds,
        valorTotal: dados.valorTotalGeral,
        situacao: 'preparada',
        identificacaoFiscal: dados.identificacaoFiscal,
        emailUsado: preceptorEmail.trim(),
        assunto,
        corpo
      });
    } catch (e) {
      console.warn('Aviso ao registrar solicitação unificada de nota:', e);
    }

    // Deep link do Outlook Web: Para = e-mail principal; Cc = adicionais
    // ativos. Usa os parâmetros diretos (to/cc/subject/body) e também o
    // parâmetro "mailtouri" (URI mailto completo), único formato suportado
    // pela integração atual para preencher o Cc. O corpo não é alterado e a
    // assinatura pessoal é a do próprio Outlook Web.
    const urlOutlook = montarUrlOutlook({
      para: preceptorEmail,
      cc: emailsCopia,
      assunto,
      corpo
    });

    console.info(
      '[preparar-email-outlook] Para: ' + preceptorEmail
      + ' | Cc: ' + (emailsCopia.length > 0 ? emailsCopia.join(', ') : '(sem cópias ativas)')
      + ' | URL: ' + urlOutlook
    );

    window.open(
      urlOutlook,
      '_blank',
      'noopener,noreferrer'
    );
  } catch (err) {
    console.error('Erro ao preparar e-mail no Outlook:', err);
    await systemAlert('Não foi possível preparar o e-mail no Outlook. Erro: ' + (err.message || err), 'Erro ao preparar e-mail');
  }
}


function DashboardPage({onAbrirControle}){
 const now=new Date(),[rows,setRows]=useState([]),[solsMap,setSolsMap]=useState({}),[pagDatas,setPagDatas]=useState({}),[revisoes,setRevisoes]=useState({}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[abertos,setAbertos]=useState({}),[rapida,setRapida]=useState('pagos'),[pagLista,setPagLista]=useState(1),[porPagina,setPorPagina]=useState(20),[f,setF]=useState({competencia:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`,mes:'',ano:'',busca:'',unidade:'',internato:'',local:'',status:''});
 const[filtrosAbertos,setFiltrosAbertos]=useState(false);
 const[exportAberto,setExportAberto]=useState(false);
 const[exportFormato,setExportFormato]=useState('excel');
 const[exportConteudo,setExportConteudo]=useState({indicadores:true,graficos:true,lista:true,composicao:true,pendencias:true});
 const[exportGerando,setExportGerando]=useState(false);
 const[exportErro,setExportErro]=useState('');
 const[saldoFiltro,setSaldoFiltro]=useState('');
 const[abrirPreceptor,setAbrirPreceptor]=useState(null);
 useEffect(()=>{
  let vivo=true;
  setLoading(true);setError('');
  Promise.all([
    fetchPainelPagamentos({incluirTodos:true}),
    fetchSolicitacoesNotaFiscal().catch(e=>{console.warn('[dashboard] Falha ao carregar situação fiscal:',e);return[];}),
    fetchDatasPagamentos().catch(e=>{console.warn('[dashboard] Falha ao carregar datas de pagamento:',e);return{};})
  ]).then(([painel,sols,datas])=>{
   if(!vivo)return;
   const mapa={};
   (sols||[]).forEach(s=>{mapa[`${s.preceptor_id}|${s.competencia}`]=s;});
    const enriquecido=(painel||[]).map(r=>({...r,competencia:`${r.ano}-${String(r.mes).padStart(2,'0')}`,situacao_nota:mapa[`${r.preceptor_id}|${r.ano}-${String(r.mes).padStart(2,'0')}`]?.situacao||r.situacao_nota||'nao_solicitada'}));
   setRows(enriquecido);setSolsMap(mapa);setPagDatas(datas||{});
   const ids=[...new Set(enriquecido.map(r=>r.id).filter(Boolean))];
   return fetchRevisoesCompetencia(ids).then(rev=>{if(vivo)setRevisoes(rev||{});});
  }).catch(e=>{if(vivo){console.warn('[dashboard]',e);setError(e.message||'Erro ao carregar dados do dashboard.');}})
   .finally(()=>{if(vivo)setLoading(false);});
  return()=>{vivo=false;};
  },[]);
  useEffect(()=>{setPagLista(1);},[f,rapida,porPagina,saldoFiltro]);
  const data=useMemo(()=>filtrarFinanceiro(rows,f),[rows,f]);
  // Saldo semestral por vínculo (fonte: fila financeira inteira — semestre do vínculo).
  const mapaSaldos=useMemo(()=>montarMapaSaldosVinculos(rows),[rows]);
  // Ranking do gráfico "Utilização do saldo semestral" — mesmos dados, busca e filtros do painel.
  const rankingSaldo=useMemo(()=>montarRankingSaldoVinculos(data,mapaSaldos,10),[data,mapaSaldos]);
 const ehRevisada=(r)=>{
  if(!r||!r.id)return false;
  const rev=revisoes[r.id];
  if(!rev||rev.status!=='aprovado')return false;
  if(r.calculado_em&&rev.decidido_em&&new Date(rev.decidido_em)<new Date(r.calculado_em))return false;
  return true;
 };
 const bucketDoGrupo=(g)=>{
  const st=g.sol?.situacao||g.situacao||'nao_solicitada';
  if(st==='pago')return'pago';
  if(st==='nota_recebida'||st==='em_pagamento'||st==='cancelado')return'nota_recebida';
  if(st==='solicitada')return'aguardando_nf';
  if(st==='preparada')return'aguardando_envio';
  return g.atuacoes.length>0&&g.atuacoes.every(ehRevisada)?'aguardando_envio':'aguardando_revisao';
 };
   const rotuloSituacao=(st)=>({nao_solicitada:'E-mail não enviado',preparada:'E-mail preparado',solicitada:'Não pago',nota_recebida:'Não pago',em_pagamento:'Não pago',pago:'Pago',cancelado:'Cancelado',email_nao_enviado:'E-mail não enviado',nao_pago:'Não pago'}[st]||'E-mail não enviado');
   const dataPagamentoGrupo=(g)=>{if(!g||!g.sol||!g.sol.id)return null;const v=pagDatas[g.sol.id];if(!v)return null;const d=new Date(v);return isNaN(d.getTime())?null:v;};
   const fmtMovimento=(v)=>{if(!v)return null;const s=String(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const[y,m,d]=s.split('-');return`${d}/${m}/${y}`;}const dt=new Date(s);if(isNaN(dt.getTime()))return null;const p=n=>String(n).padStart(2,'0');return`${p(dt.getDate())}/${p(dt.getMonth()+1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;};
   const ultimaMovimentacao=(g)=>{
    if(bucketDoGrupo(g)==='pago'){const v=dataPagamentoGrupo(g);const t=v?fmtMovimento(v):null;return t||'Data de pagamento não registrada';}
    const s=g.sol;
    const candidatos=[s&&s.enviado_em,s&&s.updated_at,s&&s.created_at].filter(Boolean);
    for(const c of candidatos){const t=fmtMovimento(c);if(t)return t;}
    return'Sem movimentação';
   };
   const RAPIDAS=[
    {k:'todos',rot:'Todos'},
    {k:'pendentes',rot:'Pendentes'},
    {k:'revisao',rot:'Aguardando revisão'},
    {k:'envio',rot:'Aguardando envio'},
    {k:'email',rot:'E-mail não enviado'},
    {k:'naopag',rot:'Não pagos'},
    {k:'pagos',rot:'Pagos'},
    {k:'pendencia',rot:'Com pendência real'}
   ];
 const grupos=useMemo(()=>{
  const m={};
  data.forEach(r=>{
   const k=`${r.preceptor_id||r.preceptor_nome}|${r.ano}-${String(r.mes).padStart(2,'0')}`;
   if(!m[k])m[k]={chave:k,preceptor_id:r.preceptor_id,nome:r.preceptor_nome||'Preceptor',mes:r.mes,ano:r.ano,competencia:`${r.ano}-${String(r.mes).padStart(2,'0')}`,atuacoes:[],turnos:0,valor:0,situacao:r.situacao_nota||'nao_solicitada',sol:solsMap[k]};
   const g=m[k];
   g.atuacoes.push(r);
   g.turnos+=Number(r.quantidade_presencas||0);
   g.valor+=Number(r.total_bruto||0);
  });
   return Object.values(m).map(g=>{
     g.chaves=[...new Set(g.atuacoes.map(chaveVinculoLinha).filter(Boolean))];
     g.saldo=resumoSaldoVinculos(g.chaves,mapaSaldos);
     return g;
   }).sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
  },[data,solsMap,mapaSaldos]);
  // Pendências reais do fluxo financeiro (uma entrada por preceptor + competência).
  // Regras: registro já pago NUNCA é pendência; ausência de data é apenas apresentação;
  // campo opcional vazio e ausência de movimentação posterior ao pagamento também não contam.
  const pendenciasMap=useMemo(()=>{
   const mapa=new Map();
   const marcar=(chave,motivo)=>{if(!mapa.has(chave))mapa.set(chave,[]);const lista=mapa.get(chave);if(!lista.includes(motivo))lista.push(motivo);};
   grupos.forEach(g=>{
    if(bucketDoGrupo(g)==='pago')return;
    g.atuacoes.forEach(r=>{
     if(!r.regra_nome||r.regra_nome==='Regra financeira pendente')marcar(g.chave,'Regra financeira pendente');
     else if(r.observacoes&&r.observacoes!=='Calculado')marcar(g.chave,'Cálculo desatualizado');
     if(!ehRevisada(r))marcar(g.chave,'Atuação não revisada');
    });
    const sol=g.sol;
    if(bucketDoGrupo(g)==='aguardando_envio'&&sol&&sol.situacao==='preparada'&&!sol.identificacao_fiscal)marcar(g.chave,'Identificação fiscal ausente (bloqueia a emissão)');
    if(!sol&&g.situacao&&g.situacao!=='nao_solicitada')marcar(g.chave,'Falha no processo: registro fiscal inconsistente');
   });
   return mapa;
  },[grupos,revisoes]);
   const ind=useMemo(()=>{
    const somaB=b=>grupos.filter(g=>bucketDoGrupo(g)===b).reduce((a,g)=>a+g.valor,0);
    const total=grupos.reduce((a,g)=>a+g.valor,0);
    const pago=somaB('pago');
    const saldos={};
    data.forEach(r=>{const k=r.vinculo_internato_id||r.vinculo_adm_id;if(k&&!saldos[k])saldos[k]=Number(r.saldo_semestral||0)});
    const saldo=Object.values(saldos).reduce((a,v)=>a+v,0);
    const contaB=b=>grupos.filter(g=>bucketDoGrupo(g)===b).length;
    const pendencias=pendenciasMap.size;
    return{preceptores:grupos.length,atuacoes:data.length,turnos:grupos.reduce((a,g)=>a+g.turnos,0),total,pago,pendente:Math.max(0,total-pago),saldo,disponivel:saldo-pago,pendencias,
     sit:{revisao:contaB('aguardando_revisao'),envio:contaB('aguardando_envio'),nf:contaB('aguardando_nf'),nota:contaB('nota_recebida'),pago:contaB('pago'),pendencia:pendencias}};
   },[grupos,data,pendenciasMap]);
  const gruposPendencia=useMemo(()=>new Set(pendenciasMap.keys()),[pendenciasMap]);
 const registros=useMemo(()=>{
  let base;
  if(rapida==='todos')base=grupos;
  else if(rapida==='pendentes')base=grupos.filter(g=>bucketDoGrupo(g)!=='pago');
  else if(rapida==='pagos')base=grupos.filter(g=>bucketDoGrupo(g)==='pago');
  else if(rapida==='pendencia')base=grupos.filter(g=>gruposPendencia.has(g.chave));
  else if(rapida==='email')base=grupos.filter(g=>{const b=bucketDoGrupo(g);return b==='aguardando_revisao'||b==='aguardando_envio';});
  else if(rapida==='naopag')base=grupos.filter(g=>{const b=bucketDoGrupo(g);return b==='aguardando_nf'||b==='nota_recebida';});
  else{
    const mapa={revisao:'aguardando_revisao',envio:'aguardando_envio'};
    const b=mapa[rapida];
    base=b?grupos.filter(g=>bucketDoGrupo(g)===b):grupos;
  }
  if(!saldoFiltro)return base;
  return base.filter(g=>passaFiltroSaldo(g.saldo,saldoFiltro));
 },[grupos,rapida,gruposPendencia,saldoFiltro]);
  // Clique na barra do gráfico: expande o registro do preceptor assim que a lista o contém.
  useEffect(()=>{
   if(!abrirPreceptor)return;
   const alvo=abrirPreceptor;
   const chaves=registros.filter(g=>(alvo.id!=null&&g.preceptor_id===alvo.id)||g.nome===alvo.nome).map(g=>g.chave);
   if(chaves.length)setAbertos(p=>{const n={...p};chaves.forEach(k=>{n[k]=true});return n;});
   setAbrirPreceptor(null);
  },[abrirPreceptor,registros]);
 const resumo=useMemo(()=>{
    const saldos={};
    data.forEach(r=>{const k=r.vinculo_internato_id||r.vinculo_adm_id;if(k&&!saldos[k])saldos[k]=Number(r.saldo_semestral||0)});
    const saldo=Object.values(saldos).reduce((a,v)=>a+v,0);
    const pago=data.filter(r=>r.situacao_nota==='pago').reduce((a,r)=>a+Number(r.total_bruto||0),0);
    const calculado=data.reduce((a,r)=>a+Number(r.total_bruto||0),0);
    const fluxo={
      emailNaoEnviado:data.filter(r=>['nao_solicitada','preparada'].includes(r.situacao_nota||'nao_solicitada')).length,
      naoPagos:data.filter(r=>['solicitada','nota_recebida','em_pagamento','cancelado'].includes(r.situacao_nota||'nao_solicitada')).length,
      pagos:data.filter(r=>r.situacao_nota==='pago').length
    };
    const porInternato={};
    data.filter(r=>r.situacao_nota==='pago').forEach(r=>{const nome=r.internato_nome||'Internato nao informado';porInternato[nome]=(porInternato[nome]||0)+Number(r.total_bruto||0)});
    const ranking=Object.entries(porInternato).map(([nome,valor])=>({nome,valor})).sort((a,b)=>b.valor-a.valor);
    return{saldo,pago,disponivel:saldo-pago,calculado,fluxo,ranking,maxInternato:Math.max(1,...ranking.map(x=>x.valor))};
  },[data]);
  const MESES_ROTULO=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const dataTempo=useMemo(()=>filtrarFinanceiro(rows,{...f,competencia:'',mes:'',ano:''}),[rows,f]);
  const janelaMeses=useMemo(()=>{
   const out=[];
   const ref=f.competencia||(f.ano&&f.mes?`${f.ano}-${String(Number(f.mes)).padStart(2,'0')}`:null);
   if(ref){
    const[ry,rm]=ref.split('-').map(Number);
    for(let i=5;i>=0;i--){let m=rm-i,y=ry;while(m<1){m+=12;y--}out.push({mes:m,ano:y});}
   }else if(f.ano){
    const y=Number(f.ano);for(let m=1;m<=12;m++)out.push({mes:m,ano:y});
   }else{
    for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);out.push({mes:d.getMonth()+1,ano:d.getFullYear()});}
   }
   return out;
  },[f.competencia,f.ano,f.mes]);
  const evolucao=useMemo(()=>{
   const mapa={};
   dataTempo.forEach(r=>{const k=`${r.ano}-${String(r.mes).padStart(2,'0')}`;if(!mapa[k])mapa[k]={calculado:0,pago:0};mapa[k].calculado+=Number(r.total_bruto||0);if((r.situacao_nota||'nao_solicitada')==='pago')mapa[k].pago+=Number(r.total_bruto||0);});
   return janelaMeses.map(x=>{const k=`${x.ano}-${String(x.mes).padStart(2,'0')}`;const m=mapa[k]||{calculado:0,pago:0};return{...x,rotulo:`${MESES_ROTULO[x.mes-1]}/${x.ano}`,curto:`${MESES_ROTULO[x.mes-1].toLowerCase()}/${String(x.ano).slice(2)}`,calculado:m.calculado,pago:m.pago};});
  },[dataTempo,janelaMeses]);
  const porInternato=resumo.ranking.slice(0,10);
  const modalidades=useMemo(()=>{
   const m={};
   grupos.filter(g=>bucketDoGrupo(g)==='pago').forEach(g=>{
    const nome=String(g.atuacoes[0]?.modalidade_pagamento||'').trim();
    if(!nome)return;
    if(!m[nome])m[nome]={nome,ids:new Set(),valor:0};
    m[nome].ids.add(g.preceptor_id||g.nome);
    m[nome].valor+=g.valor;
   });
   return Object.values(m).map(x=>({nome:x.nome,preceptores:x.ids.size,valor:x.valor})).sort((a,b)=>b.valor-a.valor);
  },[grupos]);
  const vazioGrafico=()=> <div className="dash-grafico-vazio">Nenhum dado encontrado para os filtros selecionados.</div>;
  const alternarFiltro=(campo,valor)=>setF(prev=>({...prev,[campo]:prev[campo]===valor?'':valor}));
  const SITUACAO_STATUS={email_nao_enviado:'email_nao_enviado',nao_pagos:'nao_pago',pago:'pago'};
  const aplicarSituacao=(chave)=>{const st=SITUACAO_STATUS[chave];if(!st)return;setF(prev=>({...prev,status:prev.status===st?'':st}));};
  const tecladoClique=(fn)=>(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}};
  const fracPago=ind.total>0?ind.pago/ind.total:0;
  const fracPend=ind.total>0?ind.pendente/ind.total:0;
  const pctFmt=v=>(v*100).toFixed(1).replace('.',',');
  const maxMod=Math.max(1,...modalidades.map(x=>x.valor));
  const maxEvo=Math.max(1,...evolucao.flatMap(m=>[m.calculado,m.pago]));
  const evoTemDados=evolucao.some(m=>m.calculado>0||m.pago>0);
  const evoW=evolucao.length*68;
  const SIT_LISTA=[
   {k:'email_nao_enviado',rot:'E-mail não enviado',qtd:ind.sit.revisao+ind.sit.envio,cor:'#123a73'},
   {k:'nao_pagos',rot:'Não pagos',qtd:ind.sit.nf+ind.sit.nota,cor:'#c99b2a'},
   {k:'pago',rot:'Pagos',qtd:ind.sit.pago,cor:'#2e9e6b'},
   {k:'pendencia',rot:'Com pendência real',qtd:ind.sit.pendencia,cor:'#d97706'}
  ];
  const maxSit=Math.max(1,...SIT_LISTA.map(s=>s.qtd));
  const sitTemDado=SIT_LISTA.some(s=>s.qtd>0);
  const NOMES_MES_DASH=["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const FILTROS_KEYS=['competencia','mes','ano','unidade','internato','local','status'];
  const filtrosDash=useMemo(()=>{
    const comps=new Map(),anos=new Set();
    rows.forEach(r=>{const k=`${r.ano}-${String(r.mes).padStart(2,'0')}`;if(!comps.has(k))comps.set(k,apuracaoMesLabel(r.mes,r.ano));anos.add(String(r.ano));});
    return[
      {key:'competencia',label:'Competência',options:[...comps.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([value,label])=>({value,label}))},
      {key:'unidade',label:'Unidade'},
      {key:'internato',label:'Internato'},
      {key:'local',label:'Local'},
      {key:'status',label:'Situação',options:[{value:'email_nao_enviado',label:'E-mail não enviado'},{value:'preparada',label:'E-mail preparado'},{value:'nao_pago',label:'Não pago'},{value:'pago',label:'Pago'}]},
      {key:'mes',label:'Mês',options:NOMES_MES_DASH.slice(1).map((m,i)=>({value:String(i+1).padStart(2,'0'),label:m}))},
      {key:'ano',label:'Ano',options:[...anos].sort().map(a=>({value:a,label:a}))}
    ];
  },[rows]);
  const filtrosPainel=useMemo(()=>{const o={};FILTROS_KEYS.forEach(k=>{o[k]=f[k]||''});return o;},[f]);
  const aplicarPainel=(next)=>{
    setF(prev=>{
      const out={...prev};
      FILTROS_KEYS.forEach(k=>{out[k]=(next&&next[k])||''});
      if(out.mes!==prev.mes||out.ano!==prev.ano)out.competencia='';
      else if(out.competencia!==prev.competencia){out.mes='';out.ano='';}
      return out;
    });
    setFiltrosAbertos(false);
  };
  const limparTodosFiltros=()=>setF({competencia:'',mes:'',ano:'',busca:'',unidade:'',internato:'',local:'',status:''});
  const chipsBusca=f.busca?[{key:'busca',label:`Busca: "${f.busca}"`,clear:()=>setF(prev=>({...prev,busca:''}))}]:[];
  const rotuloCompetencia=f.competencia?new Date(`${f.competencia}-02T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):(f.mes&&f.ano?`${NOMES_MES_DASH[Number(f.mes)]||f.mes} de ${f.ano}`:'Todas as competências');
  const filtrosAplicados=useMemo(()=>{
    const out=[];
    if(f.competencia)out.push(['Competência',rotuloCompetencia]);
    if(f.mes)out.push(['Mês',NOMES_MES_DASH[Number(f.mes)]||f.mes]);
    if(f.ano)out.push(['Ano',String(f.ano)]);
    if(f.unidade)out.push(['Unidade',f.unidade]);
    if(f.internato)out.push(['Internato',f.internato]);
    if(f.local)out.push(['Local',f.local]);
    if(f.status)out.push(['Situação',rotuloSituacao(f.status)]);
    if(f.busca)out.push(['Busca',f.busca]);
    if(!out.length)out.push(['Filtros','Nenhum filtro aplicado']);
    return out;
  },[f]);
  const round2=(v)=>Math.round((Number(v)||0)*100)/100;
  function montarDadosExportacao(){
    const lista=registros;
    const atuacoes=[];
    lista.forEach(g=>g.atuacoes.forEach(r=>atuacoes.push({grupo:g,r})));
    const pendencias=[];
    pendenciasMap.forEach((motivos,chave)=>{const g=grupos.find(x=>x.chave===chave);if(g)pendencias.push({grupo:g,motivos});});
    return{lista,atuacoes,pendencias};
  }
  function gerarExcel(){
    const{lista,atuacoes,pendencias}=montarDadosExportacao();
    const gerado=new Date();
    const planilhaResumo=[];
    const secao=(t)=>planilhaResumo.push([{v:t,s:S_BOLD}]);
    const celSaldoExcel=(v)=>typeof v==='number'?{v:round2(v),s:S_MONEY}:v;
    const celSaldoLinha=(resumoVinculo)=>{
      const sv=valoresSaldoExport(resumoVinculo);
      return[celSaldoExcel(sv.saldoInicial),{v:round2(sv.utilizado),s:S_MONEY},{v:round2(sv.pago),s:S_MONEY},celSaldoExcel(sv.disponivel),sv.percentual==null?'—':{v:round2(sv.percentual),s:S_MONEY}];
    };
    planilhaResumo.push([{v:'Relatório do Dashboard — Preceptoria',s:S_BOLD}]);
    planilhaResumo.push(['Competência',rotuloCompetencia]);
    planilhaResumo.push(['Gerado em',gerado.toLocaleString('pt-BR')]);
    planilhaResumo.push([]);
    secao('Filtros aplicados');
    filtrosAplicados.forEach(([k,v])=>planilhaResumo.push([k,v]));
    if(exportConteudo.indicadores){
      planilhaResumo.push([]);
      secao('Indicadores');
      planilhaResumo.push([{v:'Indicador',s:S_BOLD},{v:'Valor',s:S_BOLD}]);
      planilhaResumo.push(['Preceptores',ind.preceptores]);
      planilhaResumo.push(['Atuações',ind.atuacoes]);
      planilhaResumo.push(['Turnos confirmados',ind.turnos]);
      planilhaResumo.push(['Pendências',ind.pendencias]);
      planilhaResumo.push(['Valor total calculado',{v:round2(ind.total),s:S_MONEY}]);
      planilhaResumo.push(['Valor total pago',{v:round2(ind.pago),s:S_MONEY}]);
      planilhaResumo.push(['Valor pendente',{v:round2(ind.pendente),s:S_MONEY}]);
      planilhaResumo.push(['Saldo disponível',{v:round2(ind.disponivel),s:S_MONEY}]);
      planilhaResumo.push([]);
      secao('Situações — quantidade de preceptores');
      planilhaResumo.push([{v:'Situação',s:S_BOLD},{v:'Preceptores',s:S_BOLD}]);
      SIT_LISTA.forEach(s=>planilhaResumo.push([s.rot,s.qtd]));
    }
    if(exportConteudo.graficos){
      planilhaResumo.push([]);
      secao('Gráficos — Pago x não pago');
      planilhaResumo.push([{v:'Situação',s:S_BOLD},{v:'Valor',s:S_BOLD}]);
      planilhaResumo.push(['Pago',{v:round2(ind.pago),s:S_MONEY}]);
      planilhaResumo.push(['Pendente',{v:round2(ind.pendente),s:S_MONEY}]);
      planilhaResumo.push([]);
      secao('Gráficos — Evolução mensal (calculado x pago)');
      planilhaResumo.push([{v:'Mês',s:S_BOLD},{v:'Calculado',s:S_MONEY},{v:'Pago',s:S_MONEY}]);
      evolucao.forEach(m=>planilhaResumo.push([m.rotulo,{v:round2(m.calculado),s:S_MONEY},{v:round2(m.pago),s:S_MONEY}]));
      planilhaResumo.push([]);
      secao('Gráficos — Valor pago por Internato');
      planilhaResumo.push([{v:'Internato',s:S_BOLD},{v:'Valor pago',s:S_MONEY}]);
      porInternato.forEach(i=>planilhaResumo.push([i.nome,{v:round2(i.valor),s:S_MONEY}]));
      planilhaResumo.push([]);
      secao('Gráficos — Situação dos processos');
      planilhaResumo.push([{v:'Situação',s:S_BOLD},{v:'Preceptores',s:S_BOLD}]);
      SIT_LISTA.forEach(s=>planilhaResumo.push([s.rot,s.qtd]));
      planilhaResumo.push([]);
      secao('Gráficos — Pagamentos por modalidade');
      planilhaResumo.push([{v:'Modalidade',s:S_BOLD},{v:'Preceptores',s:S_BOLD},{v:'Valor pago',s:S_MONEY}]);
      modalidades.forEach(m=>planilhaResumo.push([m.nome,m.preceptores,{v:round2(m.valor),s:S_MONEY}]));
      planilhaResumo.push([]);
      secao('Gráficos — Utilização do saldo semestral');
      planilhaResumo.push([{v:'Indicador',s:S_BOLD},{v:'Valor',s:S_MONEY}]);
      planilhaResumo.push(['Saldo autorizado',{v:round2(resumo.saldo),s:S_MONEY}]);
      planilhaResumo.push(['Utilizado',{v:round2(resumo.pago),s:S_MONEY}]);
      planilhaResumo.push(['Disponível',{v:round2(resumo.disponivel),s:S_MONEY}]);
      planilhaResumo.push([]);
      planilhaResumo.push([{v:'Ranking por vínculo — maiores percentuais, acima de 80% e saldo esgotado',s:S_BOLD}]);
      planilhaResumo.push([{v:'Preceptor',s:S_BOLD},{v:'Vínculo',s:S_BOLD},{v:'Saldo inicial',s:S_BOLD},{v:'Valor utilizado',s:S_BOLD},{v:'Valor pago',s:S_BOLD},{v:'Saldo disponível',s:S_BOLD},{v:'Percentual utilizado (%)',s:S_BOLD}]);
      rankingSaldo.itens.forEach(it=>planilhaResumo.push([it.preceptor,it.vinculo,...celSaldoLinha(it)]));
      planilhaResumo.push([]);
      planilhaResumo.push([{v:'Vínculos acima de 80% utilizado',s:S_BOLD},rankingSaldo.acima80]);
      planilhaResumo.push([{v:'Vínculos com saldo esgotado',s:S_BOLD},rankingSaldo.esgotados]);
      planilhaResumo.push([{v:'Vínculos sem saldo informado',s:S_BOLD},rankingSaldo.semSaldoQtd]);
      if(rankingSaldo.semSaldoNomes.length)planilhaResumo.push([{v:'Preceptores sem saldo informado',s:S_BOLD},rankingSaldo.semSaldoNomes.join('; ')]);
    }
    const sheets=[{name:'Resumo',headerRows:1,rows:planilhaResumo}];
    if(exportConteudo.lista){
      sheets.push({name:'Preceptores',headerRows:1,rows:[
        ['Preceptor','Competência','Atuações','Turnos','Valor calculado','Valor pago','Situação','Última movimentação','Saldo inicial','Valor utilizado','Valor pago (semestre)','Saldo disponível','Percentual utilizado (%)'],
        ...lista.map(g=>[g.nome,apuracaoMesLabel(g.mes,g.ano),g.atuacoes.length,g.turnos,{v:round2(g.valor),s:S_MONEY},bucketDoGrupo(g)==='pago'?{v:round2(g.valor),s:S_MONEY}:'—',rotuloSituacao(g.sol?.situacao||g.situacao),ultimaMovimentacao(g),...celSaldoLinha(g.saldo)])
      ]});
    }
    if(exportConteudo.composicao){
      sheets.push({name:'Atuações',headerRows:1,rows:[
        ['Preceptor','Competência','Internato/Disciplina','Período','Unidade','Local','Setor','Turnos','Valor','Situação','Saldo inicial','Valor utilizado','Valor pago (semestre)','Saldo disponível','Percentual utilizado (%)'],
        ...atuacoes.map(({grupo,r})=>[grupo.nome,apuracaoMesLabel(grupo.mes,grupo.ano),(r.internato_nome&&r.internato_nome!=='-')?r.internato_nome:(r.disciplina_nome&&r.disciplina_nome!=='-'?r.disciplina_nome:'Atuação'),r.periodo_nome||'—',(r.unidade_nome&&r.unidade_nome!=='-')?r.unidade_nome:'—',r.local_nome||'—',r.setor_nome||'—',Number(r.quantidade_presencas||0),{v:round2(Number(r.total_bruto||0)),s:S_MONEY},rotuloSituacao(r.situacao_nota||'nao_solicitada'),...celSaldoLinha(resumoSaldoVinculos([chaveVinculoLinha(r)],mapaSaldos))])
      ]});
    }
    if(exportConteudo.pendencias){
      sheets.push({name:'Pendências',headerRows:1,rows:[
        ['Preceptor','Competência','Motivos'],
        ...pendencias.map(p=>[p.grupo.nome,apuracaoMesLabel(p.grupo.mes,p.grupo.ano),p.motivos.join('; ')])
      ]});
    }
    baixarXlsx(`dashboard-preceptoria-${f.competencia||f.ano||'geral'}.xlsx`,sheets);
  }
  function pdfRosca(doc,cx,cy,rOut,rIn,sectores){
    const total=sectores.reduce((a,s)=>a+Math.max(0,s.valor),0);
    if(total<=0)return;
    let ang=-Math.PI/2;
    sectores.forEach(s=>{
      const frac=Math.max(0,s.valor)/total;
      if(frac<=0)return;
      const fim=ang+frac*Math.PI*2;
      const passos=Math.max(8,Math.ceil(frac*90));
      const pts=[];
      for(let i=0;i<=passos;i++){const a=ang+(fim-ang)*(i/passos);pts.push([cx+Math.cos(a)*rOut,cy+Math.sin(a)*rOut]);}
      for(let i=passos;i>=0;i--){const a=ang+(fim-ang)*(i/passos);pts.push([cx+Math.cos(a)*rIn,cy+Math.sin(a)*rIn]);}
      const d=[];
      for(let i=1;i<pts.length;i++)d.push([pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]]);
      d.push([pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1]]);
      doc.setFillColor(s.cor[0],s.cor[1],s.cor[2]);
      doc.lines(d,pts[0][0],pts[0][1],[1,1],'F',true);
      ang=fim;
    });
  }
  function pdfBarrasH(doc,x,y,w,itens){
    const labelW=Math.min(66,w*0.42),valorW=32,barW=Math.max(20,w-labelW-valorW-4);
    const max=Math.max(1,...itens.map(i=>Number(i.valor)||0));
    const lh=6.4;
    itens.forEach((it,i)=>{
      const yy=y+i*lh;
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(50,55,65);
      doc.text(String(it.rotulo).replace(/\s+/g,' ').slice(0,40),x,yy+4.4);
      doc.setFillColor(233,238,245);doc.rect(x+labelW,yy+1.6,barW,3.6,'F');
      const larg=Math.max(0.8,(Math.max(0,Number(it.valor)||0)/max)*barW);
      doc.setFillColor(it.cor[0],it.cor[1],it.cor[2]);doc.rect(x+labelW,yy+1.6,larg,3.6,'F');
      doc.setFont('helvetica','bold');doc.setTextColor(12,35,70);
      doc.text(String(it.texto),x+labelW+barW+4,yy+4.4);
    });
    return y+itens.length*lh;
  }
  function pdfColunas(doc,x,y,w,h,gruposGraf){
    const max=Math.max(1,...gruposGraf.flatMap(g=>[g.a,g.b]));
    const passo=w/Math.max(1,gruposGraf.length);
    const base=y+h;
    doc.setDrawColor(203,213,225);doc.setLineWidth(0.2);doc.line(x,base,x+w,base);
    gruposGraf.forEach((g,i)=>{
      const x0=x+i*passo;
      const ha=(Math.max(0,g.a)/max)*h,hb=(Math.max(0,g.b)/max)*h;
      doc.setFillColor(18,58,115);doc.rect(x0+passo*0.16,base-ha,Math.max(1.2,passo*0.3),ha,'F');
      doc.setFillColor(46,158,107);doc.rect(x0+passo*0.52,base-hb,Math.max(1.2,passo*0.3),hb,'F');
      doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(100,110,125);
      doc.text(String(g.rotulo),x0+passo/2,base+4,{align:'center'});
    });
    return base;
  }
  function gerarPdf(){
    const{lista,atuacoes,pendencias}=montarDadosExportacao();
    const gerado=new Date();
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const W=297,M=14;
    const altura=()=>doc.internal.pageSize.getHeight();
    let y=M;
    const novaPagina=()=>{doc.addPage();y=M+4;};
    const garantir=(h)=>{if(y+h>altura()-M)novaPagina();};
    const tituloSecao=(t,sub)=>{
      garantir(16);
      doc.setFillColor(237,242,249);doc.rect(M,y,W-M*2,8,'F');
      doc.setFillColor(12,35,70);doc.rect(M,y,2.2,8,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.setTextColor(12,35,70);
      doc.text(t,M+5,y+5.6);
      if(sub){doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100,110,125);doc.text(sub,W-M-3,y+5.6,{align:'right'});}
      y+=12;
    };
    // Colunas de saldo das tabelas do PDF — mesmos valores da lista (sem CPF/CNPJ).
    const saldoPdfLinha=(resumoVinculo)=>{
      const sv=valoresSaldoExport(resumoVinculo);
      return[
        typeof sv.saldoInicial==='number'?formatCurrencyBRL(sv.saldoInicial):sv.saldoInicial,
        formatCurrencyBRL(sv.utilizado),
        formatCurrencyBRL(sv.pago),
        typeof sv.disponivel==='number'?formatCurrencyBRL(sv.disponivel):sv.disponivel,
        sv.percentual==null?'—':`${sv.percentual.toFixed(1).replace('.',',')}%`
      ];
    };
    doc.setFillColor(12,35,70);doc.rect(0,0,W,26,'F');
    doc.setTextColor(226,183,78);doc.setFont('helvetica','bold');doc.setFontSize(16);
    doc.text('MEDICINA UNINASSAU',M,12);
    doc.setTextColor(255,255,255);doc.setFontSize(11);doc.setFont('helvetica','normal');
    doc.text('Relatório do Dashboard — Preceptoria',M,20);
    doc.setFontSize(9);
    doc.text(`Competência: ${rotuloCompetencia}`,W-M,12,{align:'right'});
    doc.text(`Gerado em: ${gerado.toLocaleString('pt-BR')}`,W-M,19,{align:'right'});
    y=33;
    tituloSecao('Filtros aplicados',`${lista.length} preceptor(es) na lista`);
    doc.setFontSize(8.5);doc.setTextColor(60,65,75);doc.setFont('helvetica','normal');
    const linhasFiltro=filtrosAplicados.map(([k,v])=>`${k}: ${v}`);
    doc.text(linhasFiltro,M+2,y);
    y+=Math.max(6,linhasFiltro.length*4.4)+4;
    if(f.busca){doc.setFont('helvetica','italic');doc.setTextColor(100,110,125);doc.text(`Busca textual aplicada: "${f.busca}"`,M+2,y);y+=6;}
    if(exportConteudo.indicadores){
      tituloSecao('Indicadores','valores da seleção atual');
      autoTable(doc,{
        startY:y,margin:{left:M,right:M},
        head:[['Preceptores','Atuações','Turnos confirmados','Pendências','Valor total calculado','Valor total pago','Valor pendente','Saldo disponível']],
        body:[[
          String(ind.preceptores),String(ind.atuacoes),String(ind.turnos),String(ind.pendencias),
          formatCurrencyBRL(ind.total),formatCurrencyBRL(ind.pago),formatCurrencyBRL(ind.pendente),formatCurrencyBRL(ind.disponivel)
        ]],
        theme:'grid',styles:{fontSize:7.5,cellPadding:2,overflow:'linebreak'},
        headStyles:{fillColor:[12,35,70],textColor:[255,255,255],fontStyle:'bold',halign:'center'},
        bodyStyles:{halign:'center',textColor:[20,30,50]}
      });
      y=doc.lastAutoTable.finalY+6;
      autoTable(doc,{
        startY:y,margin:{left:M,right:M},
        head:[['Situação','Preceptores']],
        body:SIT_LISTA.map(s=>[s.rot,String(s.qtd)]),
        theme:'grid',styles:{fontSize:7.5,cellPadding:1.8},
        headStyles:{fillColor:[12,35,70],textColor:[255,255,255],fontStyle:'bold'},
        columnStyles:{0:{cellWidth:70},1:{cellWidth:24,halign:'center'}}
      });
      y=doc.lastAutoTable.finalY+8;
    }
    if(exportConteudo.graficos){
      tituloSecao('Gráficos','mesma base de dados e filtros dos indicadores');
      const caixaH=58;
      garantir(caixaH+10);
      const colW=(W-M*2-8)/2;
      if(ind.total>0){
        doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(12,35,70);
        doc.text('Pago x não pago',M,y+5);
        const cx=M+28,cy=y+caixaH/2+6;
        pdfRosca(doc,cx,cy,19,10.5,[{valor:ind.pago,cor:[46,158,107]},{valor:ind.pendente,cor:[245,158,11]}]);
        doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(110,120,135);
        doc.text('Total',cx,cy-1.5,{align:'center'});
        doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(12,35,70);
        doc.text(formatCurrencyBRL(ind.total),cx,cy+4,{align:'center'});
        doc.setFontSize(8);doc.setFont('helvetica','normal');
        doc.setFillColor(46,158,107);doc.rect(M+56,y+18,3.5,3.5,'F');
        doc.setTextColor(60,65,75);doc.text(`Pago — ${formatCurrencyBRL(ind.pago)} (${pctFmt(fracPago)}%)`,M+62,y+21.5);
        doc.setFillColor(245,158,11);doc.rect(M+56,y+27,3.5,3.5,'F');
        doc.text(`Pendente — ${formatCurrencyBRL(ind.pendente)} (${pctFmt(fracPend)}%)`,M+62,y+30.5);
      }else{
        doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(130,140,155);
        doc.text('Nenhum dado encontrado para os filtros selecionados.',M+4,y+16);
      }
      const x2=M+colW+8;
      doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(12,35,70);
      doc.text('Situação dos processos',x2,y+5);
      if(sitTemDado){
        doc.setFont('helvetica','normal');doc.setFontSize(7);
        pdfBarrasH(doc,x2,y+10,colW-4,SIT_LISTA.map(s=>({rotulo:s.rot,valor:s.qtd,texto:String(s.qtd),cor:s.cor?[(parseInt(s.cor.slice(1,3),16)),(parseInt(s.cor.slice(3,5),16)),(parseInt(s.cor.slice(5,7),16))]:[18,58,115]})));
      }else{
        doc.setTextColor(130,140,155);doc.text('Nenhum dado encontrado para os filtros selecionados.',x2,y+16);
      }
      y+=caixaH+6;
      garantir(caixaH+10);
      doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(12,35,70);
      doc.text('Valor pago por Internato',M,y+5);
      if(porInternato.length){
        pdfBarrasH(doc,M,y+10,colW-4,porInternato.map(i=>({rotulo:i.nome,valor:i.valor,texto:formatCurrencyBRL(i.valor),cor:[18,58,115]})));
      }else{
        doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(130,140,155);
        doc.text('Nenhum dado encontrado para os filtros selecionados.',M+4,y+16);
      }
      doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(12,35,70);
      doc.text('Pagamentos por modalidade',x2,y+5);
      if(modalidades.length){
        pdfBarrasH(doc,x2,y+10,colW-4,modalidades.map(m=>({rotulo:m.nome,valor:m.valor,texto:formatCurrencyBRL(m.valor),cor:[201,155,42]})));
      }else{
        doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(130,140,155);
        doc.text('Nenhum pagamento com modalidade identificada para os filtros selecionados.',x2,y+16);
      }
      y+=caixaH+6;
      garantir(64);
      doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(12,35,70);
      doc.text('Evolução mensal — calculado x pago',M,y+5);
      doc.setFontSize(7.5);
      doc.setFillColor(18,58,115);doc.rect(M+88,y+1.5,3.5,3.5,'F');
      doc.setTextColor(80,90,105);doc.setFont('helvetica','normal');doc.text('Calculado',M+94,y+5);
      doc.setFillColor(46,158,107);doc.rect(M+120,y+1.5,3.5,3.5,'F');
      doc.text('Pago',M+126,y+5);
      if(evoTemDados)pdfColunas(doc,M,y+10,W-M*2,38,evolucao.map(m=>({rotulo:m.curto,a:m.calculado,b:m.pago})));
      else{doc.setTextColor(130,140,155);doc.text('Nenhum dado encontrado para os filtros selecionados.',M+4,y+18);}
      y+=56;
      garantir(52);
      doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(12,35,70);
      doc.text('Utilização do saldo semestral',M,y+5);
      pdfRosca(doc,M+24,y+30,17,9.5,[{valor:Math.max(0,resumo.pago),cor:[190,141,26]},{valor:Math.max(0,resumo.disponivel),cor:[232,237,243]}]);
      doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(110,120,135);
      doc.text(`${percentualPago.toFixed(1).replace('.',',')}%`,M+24,y+31,{align:'center'});
      doc.setFontSize(8.5);doc.setTextColor(60,65,75);
      doc.text(`Saldo autorizado: ${formatCurrencyBRL(resumo.saldo)}`,M+52,y+18);
      doc.text(`Utilizado: ${formatCurrencyBRL(resumo.pago)}`,M+52,y+25);
      doc.text(`Disponível: ${formatCurrencyBRL(resumo.disponivel)}`,M+52,y+32);
      y+=52;
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(12,35,70);
      garantir(20);
      doc.text('Vínculos com maior utilização do saldo',M,y+5);
      y+=9;
      if(rankingSaldo.itens.length){
        autoTable(doc,{
          startY:y,margin:{left:M,right:M,bottom:M},
          head:[['Preceptor','Vínculo','Saldo inicial','Valor utilizado','Saldo disponível','Percentual utilizado']],
          body:rankingSaldo.itens.map(it=>[it.preceptor,it.vinculo,formatCurrencyBRL(it.saldoInicial),formatCurrencyBRL(it.utilizado),formatCurrencyBRL(it.disponivel),percentualSaldoTexto(it)]),
          theme:'grid',styles:{fontSize:6.5,cellPadding:1.4,overflow:'linebreak'},
          headStyles:{fillColor:[12,35,70],textColor:[255,255,255],fontStyle:'bold',halign:'center'},
          columnStyles:{0:{cellWidth:44},1:{cellWidth:76},2:{cellWidth:30,halign:'right'},3:{cellWidth:30,halign:'right'},4:{cellWidth:30,halign:'right'},5:{cellWidth:24,halign:'right'}}
        });
        y=doc.lastAutoTable.finalY+7;
      }else{
        doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(130,140,155);
        doc.text('Nenhum vínculo com saldo informado para os filtros selecionados.',M+2,y+5);
        y+=8;
      }
      garantir(20);
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(60,65,75);
      doc.text(`Vínculos acima de 80% utilizado: ${rankingSaldo.acima80}   •   Vínculos com saldo esgotado: ${rankingSaldo.esgotados}   •   Vínculos sem saldo informado: ${rankingSaldo.semSaldoQtd}`,M,y);
      y+=5.5;
      if(rankingSaldo.semSaldoNomes.length){
        const nomes=rankingSaldo.semSaldoNomes.slice(0,8).join(', ')+(rankingSaldo.semSaldoNomes.length>8?` e mais ${rankingSaldo.semSaldoNomes.length-8}`:'');
        garantir(12);
        doc.setFontSize(7.5);doc.setTextColor(110,120,135);
        doc.text(`Vínculos sem saldo informado — ${nomes}.`,M,y);
        y+=5;
      }
    }
    if(exportConteudo.lista){
      tituloSecao('Lista de preceptores',subLista);
      autoTable(doc,{
        startY:y,margin:{left:M,right:M,bottom:M},
        head:[['Preceptor','Competência','Atuações','Turnos','Valor calculado','Valor pago','Situação','Última movimentação','Saldo inicial','Valor utilizado','Valor pago (sem.)','Saldo disponível','Percentual utilizado']],
        body:lista.map(g=>[g.nome,apuracaoMesLabel(g.mes,g.ano),String(g.atuacoes.length),String(g.turnos),formatCurrencyBRL(g.valor),bucketDoGrupo(g)==='pago'?formatCurrencyBRL(g.valor):'—',rotuloSituacao(g.sol?.situacao||g.situacao),ultimaMovimentacao(g),...saldoPdfLinha(g.saldo)]),
        theme:'grid',styles:{fontSize:7,cellPadding:1.6,overflow:'linebreak'},
        headStyles:{fillColor:[12,35,70],textColor:[255,255,255],fontStyle:'bold',halign:'center'},
        columnStyles:{0:{cellWidth:34},1:{cellWidth:16},2:{cellWidth:10,halign:'center'},3:{cellWidth:10,halign:'center'},4:{cellWidth:20,halign:'right'},5:{cellWidth:20,halign:'right'},6:{cellWidth:20},7:{cellWidth:24},8:{cellWidth:22,halign:'right'},9:{cellWidth:22,halign:'right'},10:{cellWidth:22,halign:'right'},11:{cellWidth:22,halign:'right'},12:{cellWidth:16,halign:'right'}}
      });
      y=doc.lastAutoTable.finalY+8;
    }
    if(exportConteudo.composicao){
      tituloSecao('Composição das atuações',`${atuacoes.length} atuação(ões)`);
      autoTable(doc,{
        startY:y,margin:{left:M,right:M},
        head:[['Preceptor','Competência','Internato/Disciplina','Período','Unidade','Local','Setor','Turnos','Valor','Situação','Saldo inicial','Valor utilizado','Valor pago (sem.)','Saldo disponível','Percentual utilizado']],
        body:atuacoes.map(({grupo,r})=>[grupo.nome,apuracaoMesLabel(grupo.mes,grupo.ano),(r.internato_nome&&r.internato_nome!=='-')?r.internato_nome:(r.disciplina_nome&&r.disciplina_nome!=='-'?r.disciplina_nome:'Atuação'),r.periodo_nome||'—',(r.unidade_nome&&r.unidade_nome!=='-')?r.unidade_nome:'—',r.local_nome||'—',r.setor_nome||'—',String(Number(r.quantidade_presencas||0)),formatCurrencyBRL(Number(r.total_bruto||0)),rotuloSituacao(r.situacao_nota||'nao_solicitada'),...saldoPdfLinha(resumoSaldoVinculos([chaveVinculoLinha(r)],mapaSaldos))]),
        theme:'grid',styles:{fontSize:6.5,cellPadding:1.4,overflow:'linebreak'},
        headStyles:{fillColor:[12,35,70],textColor:[255,255,255],fontStyle:'bold',halign:'center'},
        columnStyles:{0:{cellWidth:22},1:{cellWidth:14},2:{cellWidth:28},3:{cellWidth:12},4:{cellWidth:16},5:{cellWidth:18},6:{cellWidth:14},7:{cellWidth:9,halign:'center'},8:{cellWidth:16,halign:'right'},9:{cellWidth:16},10:{cellWidth:20,halign:'right'},11:{cellWidth:20,halign:'right'},12:{cellWidth:20,halign:'right'},13:{cellWidth:20,halign:'right'},14:{cellWidth:14,halign:'right'}}
      });
      y=doc.lastAutoTable.finalY+8;
    }
    if(exportConteudo.pendencias){
      tituloSecao('Pendências',`${pendencias.length} preceptor(es) com pendência real`);
      if(!pendencias.length){
        doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(80,90,105);
        doc.text('Nenhuma pendência real para os filtros selecionados. Registros já pagos não são contados como pendência.',M+2,y);
        y+=8;
      }else{
        autoTable(doc,{
          startY:y,margin:{left:M,right:M},
          head:[['Preceptor','Competência','Motivos']],
          body:pendencias.map(p=>[p.grupo.nome,apuracaoMesLabel(p.grupo.mes,p.grupo.ano),p.motivos.join('; ')]),
          theme:'grid',styles:{fontSize:7.5,cellPadding:1.8,overflow:'linebreak'},
          headStyles:{fillColor:[12,35,70],textColor:[255,255,255],fontStyle:'bold',halign:'center'},
          columnStyles:{0:{cellWidth:60},1:{cellWidth:26}}
        });
        y=doc.lastAutoTable.finalY+8;
      }
    }
    garantir(26);
    doc.setDrawColor(210,218,230);doc.line(M,y,W-M,y);y+=6;
    doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(12,35,70);
    doc.text('Totais',M,y);y+=5.5;
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(50,55,65);
    doc.text(`Preceptores: ${ind.preceptores}   •   Atuações: ${ind.atuacoes}   •   Turnos confirmados: ${ind.turnos}   •   Pendências: ${ind.pendencias}`,M,y);y+=5;
    doc.text(`Calculado: ${formatCurrencyBRL(ind.total)}   •   Pago: ${formatCurrencyBRL(ind.pago)}   •   Pendente: ${formatCurrencyBRL(ind.pendente)}   •   Saldo disponível: ${formatCurrencyBRL(ind.disponivel)}`,M,y);y+=5;
    doc.setFontSize(7.5);doc.setTextColor(110,120,135);
    doc.text(`Documento gerado em ${gerado.toLocaleString('pt-BR')} — todos os registros encontrados pela busca e pelos filtros aplicados.`,M,y);
    const total=doc.getNumberOfPages();
    for(let p=1;p<=total;p++){
      doc.setPage(p);
      doc.setFontSize(7);doc.setTextColor(140,150,165);doc.setFont('helvetica','normal');
      doc.text(`Página ${p} de ${total}`,W-M,altura()-6,{align:'right'});
    }
    doc.save(`dashboard-preceptoria-${f.competencia||f.ano||'geral'}.pdf`);
  }
  const temConteudoSelecionado=exportConteudo.indicadores||exportConteudo.graficos||exportConteudo.lista||exportConteudo.composicao||exportConteudo.pendencias;
  const executarExportacao=async()=>{
    if(exportGerando)return;
    if(!temConteudoSelecionado){setExportErro('Selecione ao menos um conteúdo para exportar.');return;}
    setExportErro('');setExportGerando(true);
    try{
      await new Promise(r=>setTimeout(r,30));
      if(exportFormato==='excel')gerarExcel();else gerarPdf();
      setExportAberto(false);
    }catch(e){
      console.warn('[dashboard][export]',e);
      setExportErro(e.message||'Não foi possível gerar o arquivo.');
    }finally{setExportGerando(false);}
  };
  const percentualPago=resumo.saldo>0?Math.min(100,Math.max(0,(resumo.pago/resumo.saldo)*100)):0;
  // Clique em uma barra do ranking: filtra a lista pelo preceptor e expande o registro dele.
  const localizarVinculoNaLista=(item)=>{
    if(!item)return;
    setF(prev=>({...prev,busca:item.preceptor}));
    setAbrirPreceptor({id:item.preceptor_id!=null?item.preceptor_id:null,nome:item.preceptor});
    try{document.getElementById('dash-lista-preceptores')?.scrollIntoView({block:'start',behavior:'smooth'});}catch(e){/* rolagem é opcional */}
  };
  const toggle=(k)=>setAbertos(p=>({...p,[k]:!p[k]}));
  const cabecalhoComposicao=<div className="dash-comp-linha dash-comp-cab"><span>Internato/Disciplina</span><span>Período</span><span>Unidade</span><span>Local</span><span>Setor</span><span>Turnos</span><strong>Valor</strong><span>Situação</span></div>;
  const linhaComposicao=(r,turnos,valor)=> {
    const t=turnos!=null?Number(turnos||0):Number(r.quantidade_presencas||0);
    const v=valor!=null?Number(valor||0):Number(r.total_bruto||0);
    return <div className="dash-comp-linha">
    <span><i>Internato/Disciplina</i>{r.internato_nome&&r.internato_nome!=='-'?r.internato_nome:(r.disciplina_nome&&r.disciplina_nome!=='-'?r.disciplina_nome:'Atuação')}</span>
    <span><i>Período</i>{r.periodo_nome||'—'}</span>
    <span><i>Unidade</i>{r.unidade_nome&&r.unidade_nome!=='-'?r.unidade_nome:'—'}</span>
    <span><i>Local</i>{r.local_nome||'—'}</span>
    <span><i>Setor</i>{r.setor_nome||'—'}</span>
    <span><i>Turnos</i>{t} turno{t===1?'':'s'}</span>
    <strong><i>Valor</i>{formatCurrencyBRL(v)}</strong>
    <span><i>Situação</i>{rotuloSituacao(r.situacao_nota||'nao_solicitada')}</span>
  </div>;
  };
  // Um bloco por vínculo (a expansão nunca mistura saldos entre vínculos).
  const vinculosDoGrupo=(g)=>{
    const mapa=new Map();
    (g.atuacoes||[]).forEach(r=>{
      const k=chaveVinculoLinha(r)||`calculo-${r.id}`;
      const atual=mapa.get(k);
      if(!atual)mapa.set(k,{chave:k,atuacao:r,turnos:Number(r.quantidade_presencas||0),valor:Number(r.total_bruto||0)});
      else{atual.turnos+=Number(r.quantidade_presencas||0);atual.valor+=Number(r.total_bruto||0);}
    });
    return[...mapa.values()];
  };
  const linhaSaldoVinculo=(v)=>{
    const s=resumoSaldoVinculos([v.chave],mapaSaldos);
    const excedente=s.temSaldo&&s.disponivel<0;
    return <div className="dash-saldo-linha">
      <span className={`dash-saldo-item${s.temSaldo?'':' ni'}`}><i>Saldo inicial</i><b>{s.temSaldo?formatCurrencyBRL(s.saldoInicial):'Saldo não informado'}</b></span>
      <span className="dash-saldo-item"><i>Valor utilizado</i><b>{formatCurrencyBRL(s.utilizado)}</b></span>
      <span className="dash-saldo-item"><i>Valor pago</i><b>{formatCurrencyBRL(s.pago)}</b></span>
      <span className={`dash-saldo-item${s.temSaldo?'':' ni'}${excedente?' excedente':''}`}><i>Saldo disponível</i><b>{s.temSaldo?formatCurrencyBRL(s.disponivel):'Saldo não informado'}</b>{excedente&&<em>Excedente</em>}</span>
      <span className={`dash-saldo-item${s.temSaldo?'':' ni'}`}><i>Percentual utilizado</i><b>{percentualSaldoTexto(s)}</b></span>
      <span className="dash-saldo-item dash-saldo-barra-item"><i>Barra de progresso</i>
        <span className={`dash-saldo-barra faixa-${s.faixa}`} role="img" aria-label={`${percentualSaldoTexto(s)} do saldo utilizado — ${s.situacao}`}><u style={{width:`${larguraBarraSaldo(s)}%`}}/></span>
      </span>
    </div>;
  };
  const blocoVinculo=(v)=><div className="dash-vinculo-bloco" key={v.chave}>{linhaComposicao(v.atuacao,v.turnos,v.valor)}{linhaSaldoVinculo(v)}</div>;
  const cabecalhoSaldoGrupo=(g)=>(
    <div className="dash-saldo-cab">
      {itensCabecalhoSaldo(g.saldo,g.turnos).map(it=>(
        <span key={it.rot} className={`dash-saldo-cab-item${it.naoInformado?' ni':''}${it.excedente?' excedente':''}${it.faixa?` faixa-${it.faixa}`:''}`}>
          <i>{it.rot}</i><b>{it.valor}</b>{it.excedente&&<em>Excedente</em>}
        </span>
      ))}
    </div>
  );
  const totalPag=Math.max(1,Math.ceil(registros.length/porPagina));
  const paginaAtual=Math.min(pagLista,totalPag);
  const registrosPagina=registros.slice((paginaAtual-1)*porPagina,paginaAtual*porPagina);
  const competenciaVigente=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const rotuloRapido=(RAPIDAS.find(x=>x.k===rapida)||{}).rot||'';
  const subLista=rapida==='pagos'&&f.competencia===competenciaVigente?'Preceptores pagos no mês vigente':`${rotuloRapido} — ${f.competencia?new Date(`${f.competencia}-02T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):'todas as competências'}`;
  const vazioLista=saldoFiltro?SALDO_VAZIO[saldoFiltro]:(rapida==='pagos'?'Nenhum preceptor pago na competência selecionada.':(rapida==='todos'?'Nenhum preceptor encontrado para os filtros selecionados.':'Nenhum preceptor nesta situação para os filtros selecionados.'));
  return <div className="fin-screen dashboard-impact"><SearchFilterBar search={f.busca} setSearch={v=>setF(prev=>({...prev,busca:v}))} placeholder="Buscar preceptor, e-mail, conselho, internato, unidade ou local" panelFilters={filtrosPainel} onApplyFilters={aplicarPainel} onClearFilters={limparTodosFiltros} panelOpen={filtrosAbertos} setPanelOpen={setFiltrosAbertos} filters={filtrosDash} rows={rows} emptyLabel="Nenhum preceptor encontrado para os filtros e para a busca selecionados" extraChips={chipsBusca} actions={<button type="button" className="btn dashboard-export" onClick={()=>{setExportErro('');setExportAberto(true);}} disabled={loading}><FileSpreadsheet size={17}/> Exportar relatório</button>}/>{error&&<div className="fin-error">{error}</div>}{loading?<div className="fin-loading"><Loader2 className="spin"/> Carregando...</div>:<>
   <section className="dashboard-hero"><div><small>VISAO FINANCEIRA DO INTERNATO</small><h2>{f.competencia?new Date(`${f.competencia}-02T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):'Todas as competencias'}</h2><p>Pagamentos sao registrados apos a confirmacao do e-mail, individualmente ou em lote. O saldo disponivel e atualizado automaticamente.</p></div><div className="dashboard-hero-value"><span>Saldo disponível</span><strong>{formatCurrencyBRL(resumo.disponivel)}</strong><small>{percentualPago.toFixed(1).replace('.',',')}% do saldo utilizado</small></div></section>
   <section className="dashboard-chart-card dashboard-indicadores-card">
     <header><div><small>COMPETÊNCIA SELECIONADA</small><h3>Indicadores financeiros</h3><p>Valores reais da fila financeira e situação fiscal, respeitando a competência e os filtros aplicados</p></div></header>
     <div className="dash-principais">
       <div className="dash-principal"><span>Valor total calculado</span><b>{formatCurrencyBRL(ind.total)}</b></div>
       <div className="dash-principal"><span>Valor total pago</span><b>{formatCurrencyBRL(ind.pago)}</b></div>
       <div className="dash-principal"><span>Valor pendente</span><b>{formatCurrencyBRL(ind.pendente)}</b></div>
       <div className="dash-principal"><span>Saldo disponível</span><b>{formatCurrencyBRL(ind.disponivel)}</b></div>
     </div>
     <div className="dash-compactos">
       <div><span>Preceptores</span><b>{ind.preceptores}</b></div>
       <div><span>Atuações</span><b>{ind.atuacoes}</b></div>
       <div><span>Turnos confirmados</span><b>{ind.turnos}</b></div>
       <div><span>Pendências</span><b>{ind.pendencias}</b></div>
     </div>
     <div className="dash-situacoes">
       <span className="dash-situacoes-titulo">Resumo das situações — quantidade de preceptores</span>
       <div className="dash-chips">
          <div className="dash-chip"><b>{ind.sit.revisao+ind.sit.envio}</b><span>E-mail não enviado</span></div>
          <div className="dash-chip"><b>{ind.sit.nf+ind.sit.nota}</b><span>Não pagos</span></div>
          <div className="dash-chip dash-chip-pago"><b>{ind.sit.pago}</b><span>Pagos</span></div>
          <div className="dash-chip dash-chip-pend"><b>{ind.sit.pendencia}</b><span>Com pendência real</span></div>
       </div>
     </div>
    </section>
    <section className="dash-graficos">
    <section className="dashboard-chart-card dash-grafico">
      <header><div><small>COMPETÊNCIA SELECIONADA</small><h3>Pago x não pago</h3><p>Fonte dos cartões oficiais — só o pagamento registrado conta como pago</p></div></header>
      {ind.total<=0?vazioGrafico():
      <div className="dash-roca-flex">
        <svg viewBox="0 0 130 130" className="dash-roca" role="img" aria-label={`Pago ${pctFmt(fracPago)}%, pendente ${pctFmt(fracPend)}%`}>
          <circle cx="65" cy="65" r="54" fill="none" stroke="#e8edf4" strokeWidth="16"/>
          <circle cx="65" cy="65" r="54" fill="none" stroke="#2e9e6b" strokeWidth="16" strokeDasharray={`${fracPago*2*Math.PI*54} ${2*Math.PI*54}`} transform="rotate(-90 65 65)" className="dash-roca-fatia" onClick={()=>alternarFiltro('status','pago')}><title>{`Pago: ${formatCurrencyBRL(ind.pago)} (${pctFmt(fracPago)}%) — clique para filtrar por pago`}</title></circle>
          <circle cx="65" cy="65" r="54" fill="none" stroke="#f59e0b" strokeWidth="16" strokeDasharray={`${fracPend*2*Math.PI*54} ${2*Math.PI*54}`} strokeDashoffset={-fracPago*2*Math.PI*54} transform="rotate(-90 65 65)"><title>{`Pendente: ${formatCurrencyBRL(ind.pendente)} (${pctFmt(fracPend)}%) — sem filtro equivalente de situação`}</title></circle>
          <text x="65" y="62" textAnchor="middle" className="dash-roca-valor">{formatCurrencyBRL(ind.total)}</text>
          <text x="65" y="77" textAnchor="middle" className="dash-roca-label">Total calculado</text>
        </svg>
        <div className="dash-roca-legenda">
          <div><i style={{background:'#2e9e6b'}}/><span>Pago</span><b>{formatCurrencyBRL(ind.pago)}</b><em>{pctFmt(fracPago)}%</em></div>
          <div><i style={{background:'#f59e0b'}}/><span>Pendente</span><b>{formatCurrencyBRL(ind.pendente)}</b><em>{pctFmt(fracPend)}%</em></div>
        </div>
      </div>}
    </section>
    <section className="dashboard-chart-card dash-grafico dash-grafico-mod">
      <header><div><small>CADASTRO REAL</small><h3>Pagamentos por modalidade</h3><p>Modalidade registrada no cálculo do vínculo</p></div></header>
      {modalidades.length===0?<div className="dash-grafico-vazio-compacto">Nenhum pagamento com modalidade identificada para os filtros selecionados.</div>:<div className="dash-mod-lista">{modalidades.map(item=>
        <div className="dash-mod-linha" key={item.nome} title={`${item.nome} — ${item.preceptores} preceptor(es) — Pago: ${formatCurrencyBRL(item.valor)}`}>
          <b>{item.nome}</b>
          <span className="dash-mod-qtd">{item.preceptores} preceptor{item.preceptores===1?'':'es'}</span>
          <strong>{formatCurrencyBRL(item.valor)}</strong>
          <em>{ind.pago>0?((item.valor/ind.pago)*100).toFixed(1).replace('.',','):'0,0'}% do total pago</em>
          <span className="dash-mod-trilha"><u style={{width:`${Math.max(4,(item.valor/maxMod)*100)}%`}}/></span>
        </div>)}</div>}
    </section>
    <section className="dashboard-chart-card dash-grafico dash-grafico-span">
      <header><div><small>SÉRIE HISTÓRICA</small><h3>Evolução mensal — calculado x pago</h3><p>Séries por mês/ano, sem misturar competências</p></div></header>
      {!evoTemDados?vazioGrafico():<>
      <div className="dash-legenda-linha"><span><i style={{background:'#123a73'}}/>Calculado</span><span><i style={{background:'#2e9e6b'}}/>Pago</span></div>
      <svg viewBox={`0 0 ${evoW} 178`} className="dash-evo-svg" role="img" aria-label="Evolução mensal dos valores calculado e pago">
        <line x1="0" y1="150" x2={evoW} y2="150" stroke="#cbd5e1" strokeWidth="1"/>
        {evolucao.map((m,i)=>{const x0=i*68+16;const hc=(m.calculado/maxEvo)*120;const hp=(m.pago/maxEvo)*120;return(
          <g key={`${m.ano}-${m.mes}`}>
            <rect x={x0} y={150-hc} width="24" height={Math.max(0,hc)} fill="#123a73" rx="2"><title>{`${m.rotulo} — Calculado: ${formatCurrencyBRL(m.calculado)}`}</title></rect>
            <rect x={x0+28} y={150-hp} width="24" height={Math.max(0,hp)} fill="#2e9e6b" rx="2"><title>{`${m.rotulo} — Pago: ${formatCurrencyBRL(m.pago)}`}</title></rect>
            <text x={x0+26} y="167" textAnchor="middle" className="dash-evo-rotulo">{m.curto}</text>
          </g>);})}
      </svg>
      </>}
    </section>
    <section className="dashboard-chart-card dashboard-internato-chart dash-grafico">
      <header><div><small>DISTRIBUICAO DOS PAGAMENTOS</small><h3>Valor pago por Internato</h3><p>Clique em uma barra para filtrar o Dashboard</p></div><strong>{formatCurrencyBRL(resumo.pago)}</strong></header>
      {porInternato.length===0?vazioGrafico():<div className="internato-bars">{porInternato.map((item,index)=>{
        const ativo=f.internato===item.nome;
        return <div className={`internato-bar-row${ativo?' ativo':''}`} key={item.nome} role="button" tabIndex={0}
          onClick={()=>alternarFiltro('internato',item.nome)}
          onKeyDown={tecladoClique(()=>alternarFiltro('internato',item.nome))}
          title={`${item.nome} — Pago: ${formatCurrencyBRL(item.valor)}${ativo?' — filtro ativo (clique para remover)':''}`}>
          <span className="internato-rank">{String(index+1).padStart(2,'0')}</span>
          <div className="internato-bar-info"><div><b>{item.nome}</b><strong>{formatCurrencyBRL(item.valor)}</strong></div><i><u style={{width:`${Math.max(4,(item.valor/resumo.maxInternato)*100)}%`}}/></i></div>
        </div>;})}</div>}
    </section>
    <section className="dashboard-chart-card dash-grafico">
      <header><div><small>PROCESSOS FINANCEIROS</small><h3>Situação dos processos</h3><p>Preceptores por situação — clique para filtrar os gráficos</p></div></header>
      {!sitTemDado?vazioGrafico():<div className="dash-sit-barras">{SIT_LISTA.map(s=>{
        const st=SITUACAO_STATUS[s.k];
        const ativo=!!st&&f.status===st;
        const clicavel=!!st;
        return <div key={s.k} className={`dash-sit-linha${ativo?' ativo':''}`} role={clicavel?'button':undefined} tabIndex={clicavel?0:undefined}
          onClick={clicavel?()=>aplicarSituacao(s.k):undefined}
          onKeyDown={clicavel?tecladoClique(()=>aplicarSituacao(s.k)):undefined}
          title={clicavel?`${s.rot}: ${s.qtd} preceptor(es) — clique para ${ativo?'remover o':'aplicar o'} filtro de situação`:`${s.rot}: ${s.qtd} preceptor(es) — sem filtro equivalente`}>
          <span className="dash-sit-nome">{s.rot}</span>
          <span className="dash-sit-trilha"><u style={{width:`${(s.qtd/maxSit)*100}%`,background:s.cor}}/></span>
          <b>{s.qtd}</b>
        </div>;})}</div>}
    </section>
    <section className="dashboard-chart-card dashboard-balance-card dash-grafico dash-grafico-span" title={`Saldo autorizado: ${formatCurrencyBRL(resumo.saldo)} — Utilizado: ${formatCurrencyBRL(resumo.pago)} — Disponível: ${formatCurrencyBRL(resumo.disponivel)}`}>
      <header><div><small>ORÇAMENTO</small><h3>Utilização do saldo semestral</h3><p>Maiores percentuais utilizados, acima de 80% e saldo esgotado — clique em uma barra para localizar o preceptor na lista</p></div></header>
      <div className="balance-legend dash-rank-totais">
        <div><i className="authorized"/><span>Saldo autorizado</span><b>{formatCurrencyBRL(resumo.saldo)}</b></div>
        <div><i className="paid"/><span>Utilizado</span><b>{formatCurrencyBRL(resumo.pago)}</b></div>
        <div><i className="available"/><span>Disponível</span><b>{formatCurrencyBRL(resumo.disponivel)}</b></div>
      </div>
      {rankingSaldo.itens.length===0?<div className="dash-grafico-vazio">Nenhum vínculo com saldo informado para os filtros selecionados.</div>:
      <div className="dash-rank-lista">{rankingSaldo.itens.map((it,i)=>(
        <button type="button" key={it.chave} className="dash-rank-item" onClick={()=>localizarVinculoNaLista(it)}
          title={`${it.preceptor} — ${it.vinculo} — ${percentualSaldoTexto(it)} do saldo utilizado — clique para localizar o preceptor na lista`}>
          <span className="dash-rank-topo">
            <span className="dash-rank-pos">{String(i+1).padStart(2,'0')}</span>
            <b>{it.preceptor}</b>
            <span className="dash-rank-vinculo">{it.vinculo}</span>
            {it.esgotado&&<em className="dash-rank-tag esgotado">Saldo esgotado</em>}
            {it.acima80&&!it.esgotado&&<em className="dash-rank-tag acima80">Acima de 80%</em>}
          </span>
          <span className="dash-rank-vals">
            <span><i>Saldo inicial</i><b>{formatCurrencyBRL(it.saldoInicial)}</b></span>
            <span><i>Valor utilizado</i><b>{formatCurrencyBRL(it.utilizado)}</b></span>
            <span><i>Saldo disponível</i><b>{formatCurrencyBRL(it.disponivel)}</b>{it.disponivel<0&&<em className="dash-rank-exc">Excedente</em>}</span>
            <span><i>Percentual utilizado</i><b>{percentualSaldoTexto(it)}</b></span>
          </span>
          <span className={`dash-saldo-barra faixa-${it.faixa}`}><u style={{width:`${larguraBarraSaldo(it)}%`}}/></span>
        </button>))}</div>}
      <div className="dash-rank-resumo">
        <span>{rankingSaldo.acima80} vínculo(s) acima de 80%</span>
        <span>{rankingSaldo.esgotados} vínculo(s) com saldo esgotado</span>
        <span>{rankingSaldo.semSaldoQtd} vínculo{rankingSaldo.semSaldoQtd===1?'':'is'} sem saldo informado</span>
      </div>
    </section>
   </section>
   <section className="dashboard-fiscal-flow"><header><div><small>FLUXO SIMPLIFICADO</small><h3>Acompanhamento do pagamento</h3><p>Cálculo conferido, preparar e-mail, marcar e-mail enviado e pagar individualmente ou em lote.</p></div></header><div className="fiscal-steps"><div className={resumo.fluxo.emailNaoEnviado?'pending':''}><span><Mail/></span><b>{resumo.fluxo.emailNaoEnviado}</b><strong>E-mail não enviado</strong><small>Cálculo conferido ou e-mail preparado, envio ainda não confirmado</small></div><div className={resumo.fluxo.naoPagos?'active':''}><span><Send/></span><b>{resumo.fluxo.naoPagos}</b><strong>Não pagos</strong><small>E-mail confirmado como enviado, pagamento ainda não registrado</small></div><div className={resumo.fluxo.pagos?'done':''}><span><CircleDollarSign/></span><b>{resumo.fluxo.pagos}</b><strong>Pagos</strong><small>Pagamento registrado individualmente ou em lote</small></div></div></section>
   <section className="dashboard-chart-card dash-lista-unica" id="dash-lista-preceptores">
     <header><div><small>ACOMPANHAMENTO</small><h3>Acompanhamento dos preceptores</h3><p>{subLista} — um registro por preceptor e competência</p></div></header>
      <div className="dash-filtros-rapidos" role="group" aria-label="Filtros rápidos da lista">
        {RAPIDAS.map(x=><button key={x.k} type="button" className={`dash-filtro-rapido${rapida===x.k?' ativo':''}`} aria-pressed={rapida===x.k} onClick={()=>setRapida(x.k)}>{x.rot}</button>)}
      </div>
      <div className="dash-filtros-rapidos dash-filtros-saldo" role="group" aria-label="Filtros rápidos de saldo da lista">
        <span className="dash-filtros-saldo-rot">Saldo:</span>
        {SALDO_FILTROS.map(x=><button key={x.k} type="button" className={`dash-filtro-rapido${saldoFiltro===x.k?' ativo':''}`} aria-pressed={saldoFiltro===x.k} onClick={()=>setSaldoFiltro(cur=>cur===x.k?'':x.k)}>{x.rot}</button>)}
      </div>
     {registros.length===0?<div className="dash-vazio">{vazioLista}</div>:<>
       <div className="dash-tabela-wrap so-desktop"><table className="dash-tabela dash-tabela-unica">
         <thead><tr><th></th><th>Preceptor</th><th>Competência</th><th>Atuações</th><th>Turnos</th><th>Valor calculado</th><th>Valor pago</th><th>Situação</th><th>Última movimentação</th><th>Ação</th></tr></thead>
         <tbody>{registrosPagina.map(g=>{
           const sit=rotuloSituacao(g.sol?.situacao||g.situacao);
           const pago=bucketDoGrupo(g)==='pago';
           return <React.Fragment key={g.chave}>
             <tr>
               <td><button type="button" className="dash-expand-btn" onClick={()=>toggle(g.chave)} aria-label="Expandir composição" title="Expandir composição">{abertos[g.chave]?'−':'+'}</button></td>
               <td><span className="dash-nome-fixo">{g.nome}</span></td>
               <td>{apuracaoMesLabel(g.mes,g.ano)}</td>
               <td>{g.atuacoes.length}</td>
               <td>{g.turnos}</td>
               <td>{formatCurrencyBRL(g.valor)}</td>

               <td>{pago?formatCurrencyBRL(g.valor):'—'}</td>
               <td>{sit}</td>
               <td>{ultimaMovimentacao(g)}</td>
                <td><button type="button" className="dash-btn-controle" onClick={()=>onAbrirControle?.(g.nome,g.mes,g.ano)}>Abrir no Controle financeiro</button></td>
              </tr>
              <tr className="dash-saldo-cabecalho"><td colSpan={10}>{cabecalhoSaldoGrupo(g)}</td></tr>
              {abertos[g.chave]&&<tr className="dash-expandido"><td colSpan={10}><div className="dash-composicao-unica">{cabecalhoComposicao}{vinculosDoGrupo(g).map(blocoVinculo)}</div></td></tr>}
            </React.Fragment>;})}</tbody>
       </table></div>
       <div className="dash-cards-unica so-mobile">{registrosPagina.map(g=>{
         const sit=rotuloSituacao(g.sol?.situacao||g.situacao);
         const pago=bucketDoGrupo(g)==='pago';
         return <article className="dash-card-preceptor" key={g.chave}>
           <header className="dash-card-preceptor-topo">
             <button type="button" className="dash-expand-btn" onClick={()=>toggle(g.chave)} aria-label="Expandir composição" title="Expandir composição">{abertos[g.chave]?'−':'+'}</button>
             <b>{g.nome}</b>
              <span className="dash-sit-tag">{sit}</span>
            </header>
            {cabecalhoSaldoGrupo(g)}
            <dl className="dash-card-preceptor-vals">
             <div><dt>Competência</dt><dd>{apuracaoMesLabel(g.mes,g.ano)}</dd></div>
             <div><dt>Atuações</dt><dd>{g.atuacoes.length}</dd></div>
             <div><dt>Turnos</dt><dd>{g.turnos}</dd></div>
             <div><dt>Valor calculado</dt><dd>{formatCurrencyBRL(g.valor)}</dd></div>

             <div><dt>Valor pago</dt><dd>{pago?formatCurrencyBRL(g.valor):'—'}</dd></div>
             <div className="dash-card-mov"><dt>Última movimentação</dt><dd>{ultimaMovimentacao(g)}</dd></div>
           </dl>
            {abertos[g.chave]&&<div className="dash-composicao-unica">{cabecalhoComposicao}{vinculosDoGrupo(g).map(blocoVinculo)}</div>}
           <button type="button" className="dash-btn-controle" onClick={()=>onAbrirControle?.(g.nome,g.mes,g.ano)}>Abrir no Controle financeiro</button>
         </article>;})}</div>
       <div className="dash-paginacao">
         <span className="dash-paginacao-info">{registros.length} registro{registros.length===1?'':'s'} • Página {paginaAtual} de {totalPag}</span>
         <label className="dash-paginacao-tamanho">Por página
           <select value={porPagina} onChange={e=>setPorPagina(Number(e.target.value))} aria-label="Registros por página">
             {[20,50,100].map(n=><option key={n} value={n}>{n}</option>)}
           </select>
         </label>
         <div className="dash-paginacao-botoes">
           <button type="button" onClick={()=>setPagLista(1)} disabled={paginaAtual<=1} aria-label="Primeira página">«</button>
           <button type="button" onClick={()=>setPagLista(p=>Math.max(1,p-1))} disabled={paginaAtual<=1} aria-label="Página anterior">‹ Anterior</button>
           <button type="button" onClick={()=>setPagLista(p=>Math.min(totalPag,p+1))} disabled={paginaAtual>=totalPag} aria-label="Próxima página">Próxima ›</button>
           <button type="button" onClick={()=>setPagLista(totalPag)} disabled={paginaAtual>=totalPag} aria-label="Última página">»</button>
         </div>
       </div>
     </>}
    </section>
   </>}
   {exportAberto&&<div className="system-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!exportGerando)setExportAberto(false)}}>
     <section className="system-dialog dash-export-dialog" role="dialog" aria-modal="true" aria-labelledby="dash-export-titulo">
       <header className="system-dialog-header">
         <div className="system-dialog-icon"><FileSpreadsheet size={20}/></div>
         <div className="system-dialog-titulo"><small>RELATÓRIO DO DASHBOARD</small><h3 id="dash-export-titulo">Exportar relatório</h3></div>
         <button type="button" className="system-dialog-fechar" onClick={()=>setExportAberto(false)} disabled={exportGerando} aria-label="Fechar"><X size={18}/></button>
       </header>
       <div className="system-dialog-body">
         <div className="dash-export-campo">
           <b>Formato do arquivo</b>
           <div className="dash-export-opcoes" role="radiogroup" aria-label="Formato do arquivo">
             {[['excel','Excel (.xlsx)'],['pdf','PDF']].map(([v,rot])=><label key={v} className={`dash-export-opcao${exportFormato===v?' ativo':''}`}><input type="radio" name="dash-export-formato" checked={exportFormato===v} onChange={()=>setExportFormato(v)} disabled={exportGerando}/><span>{rot}</span></label>)}
           </div>
         </div>
         <div className="dash-export-campo">
           <b>Conteúdo do relatório</b>
           <div className="dash-export-checks">
             {[['indicadores','Indicadores'],['graficos','Gráficos'],['lista','Lista de preceptores'],['composicao','Composição das atuações'],['pendencias','Pendências']].map(([k,rot])=><label key={k} className="dash-export-check"><input type="checkbox" checked={!!exportConteudo[k]} onChange={e=>setExportConteudo(c=>({...c,[k]:e.target.checked}))} disabled={exportGerando}/><span>{rot}</span></label>)}
           </div>
         </div>
         <div className="dash-export-resumo">
           <p>Busca: <b>{f.busca?`"${f.busca}"`:'—'}</b></p>
           <p>{registros.length} preceptor{registros.length===1?'':'es'} • {ind.atuacoes} atuação{ind.atuacoes===1?'':'ões'} • {ind.pendencias} pendência{ind.pendencias===1?'':'s'}</p>
           <p>{filtrosAplicados.filter(([k])=>k!=='Filtros').map(([k,v])=>`${k}: ${v}`).join(' • ')||'Nenhum filtro aplicado'}</p>
         </div>
         <p className="dash-export-nota">A exportação usa exatamente a busca textual e os filtros aplicados, incluindo os registros que não estão na página visível da lista.</p>
         {exportErro&&<div className="dash-export-erro"><AlertCircle size={16}/><span>{exportErro}</span></div>}
       </div>
       <footer className="system-dialog-footer">
         <button type="button" className="btn secondary" onClick={()=>setExportAberto(false)} disabled={exportGerando}>Cancelar</button>
         <button type="button" className="btn" onClick={executarExportacao} disabled={exportGerando||!temConteudoSelecionado||loading}>
           {exportGerando?<><Loader2 size={16} className="spin"/> Gerando...</>:<><Download size={16}/> Exportar</>}
         </button>
       </footer>
     </section>
   </div>}
  </div>;
}

function normalizeText(s){return(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}

function FilterPanel({open,filters,panelFilters,onApply,onClear,onClose,rows}){
  const[local,setLocal]=useState({});
  useEffect(()=>{if(open)setLocal({...panelFilters})},[open,panelFilters]);
  useEffect(()=>{
    if(!open)return;
    const h=(e)=>{if(e.key==="Escape")onClose()};
    document.addEventListener("keydown",h);
    return()=>document.removeEventListener("keydown",h);
  },[open,onClose]);

  function getOpts(f){
    if(f.options)return f.options;
    const vals=new Set();
    rows.forEach(r=>{
      let v=r[f.key];
      if(v&&typeof v==="object"){
        if(f.nestedKey){const n=v[f.nestedKey];if(n)vals.add(String(n))}
        else if(Array.isArray(v))v.forEach(x=>{const n=x?.nome||x?.nome_completo||x;if(n)vals.add(String(n))});
        else{const n=v.nome||v.nome_completo||"";if(n)vals.add(String(n))}
      }else if(v!==undefined&&v!==null&&v!==""&&v!=="-"){
        vals.add(String(v));
      }
    });
    return[...vals].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
  }

  if(!open)return null;

  const camposVisiveis=filters.filter(f=>f.type!=='hidden');
  const count=camposVisiveis.filter(f=>{const v=local[f.key];return Array.isArray(v)?v.length>0:Boolean(v)}).length;

  const handleApply=()=>{
    onApply(local);
    onClose();
  };

  const handleClear=()=>{
    const cleared={};
    filters.forEach(f=>{cleared[f.key]=""});
    setLocal(cleared);
    if(onClear)onClear();
  };

  return(
    <div className="sf-panel" role="dialog" aria-label="Filtros da página">
      <div className="sf-panel__backdrop" onClick={onClose} aria-hidden="true"/>
      <div className="sf-panel__sheet">
        <div className="sf-panel__header">
          <div className="sf-panel__title">
            <Filter size={15}/>
            <span>Filtros</span>
          </div>
          <button type="button" className="sf-panel__close" onClick={onClose} aria-label="Fechar filtros">
            <X size={16}/>
          </button>
        </div>
        <div className="sf-panel__body">
          <div className="sf-panel__grid">
            {camposVisiveis.map(f=>{
              const allOpts=getOpts(f);
              const curVal=Array.isArray(local[f.key])?(local[f.key][0]||""):(local[f.key]||"");
              return(
                <div key={f.key} className="sf-field">
                  <label className="sf-field__label" htmlFor={`sf-field-${f.key}`}>
                    {f.label}
                  </label>
                  <div className="sf-field__control">
                    <select
                      id={`sf-field-${f.key}`}
                      value={curVal}
                      onChange={e=>setLocal(p=>({...p,[f.key]:e.target.value}))}
                      className="sf-select"
                    >
                      <option value="">Todos</option>
                      {allOpts.map(o=>{
                        const val=typeof o==="object"?o.value:o;
                        const lbl=typeof o==="object"?o.label:o;
                        return <option key={String(val)} value={val}>{lbl}</option>;
                      })}
                    </select>
                    <ChevronDown size={15} className="sf-select__icon" aria-hidden="true"/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="sf-panel__footer">
          <button type="button" className="btn secondary sf-btn-clear" onClick={handleClear}>
            <RotateCw size={13}/> Limpar
          </button>
          <button type="button" className="btn sf-btn-apply" onClick={handleApply}>
            <Check size={13}/> Aplicar{count>0?` (${count})`:""}
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchFilterBar({search,setSearch,placeholder,panelFilters,onApplyFilters,onClearFilters,panelOpen,setPanelOpen,filters,rows,resultCount,resultLabel,emptyLabel,actions,extraChips}){
  const activeEntries=Object.entries(panelFilters).filter(([,v])=>Array.isArray(v)?v.length>0:Boolean(v));
  const activeCount=activeEntries.length;

  const allChips=[];
  activeEntries.forEach(([k,val])=>{
    const f=filters.find(x=>x.key===k);
    if(!f)return;
    const vals=Array.isArray(val)?val:[val];
    vals.forEach(v=>{
      if(!v)return;
      let displayVal=v;
      if(f.options){
        const opt=f.options.find(o=>typeof o==="object"?o.value===v:o===v);
        if(opt&&typeof opt==="object")displayVal=opt.label;
      }
      allChips.push({
        key:k,
        rawVal:v,
        label:`${f.label}: ${displayVal}`,
        clear:()=>{
          const next={...panelFilters};
          if(Array.isArray(panelFilters[k])){
            next[k]=panelFilters[k].filter(x=>x!==v);
            if(next[k].length===0)delete next[k];
          }else{
            delete next[k];
          }
          onApplyFilters(next);
        }
      });
    });
  });
  (extraChips||[]).forEach(c=>{if(c&&c.label)allChips.push(c)});

  return(
    <div className="sf-container">
      <div className="sf-bar">
        <label className="sf-bar__search">
          <Search size={17}/>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder={placeholder}
            aria-label="Buscar"
          />
          {search&&(
            <button
              type="button"
              className="sf-search__clear"
              onClick={()=>setSearch("")}
              aria-label="Limpar busca"
            >
              <X size={14}/>
            </button>
          )}
        </label>
        <button
          type="button"
          className={"sf-bar__filter"+(panelOpen?" active":"")+(activeCount>0?" has-active":"")}
          onClick={()=>setPanelOpen(!panelOpen)}
          aria-expanded={panelOpen}
          aria-label="Filtros"
        >
          <Filter size={14}/>
          <span>Filtros</span>
          {activeCount>0&&<span className="sf-bar__count">{activeCount}</span>}
        </button>
        {actions}
      </div>

      <FilterPanel
        open={panelOpen}
        filters={filters}
        panelFilters={panelFilters}
        onApply={onApplyFilters}
        onClear={onClearFilters}
        onClose={()=>setPanelOpen(false)}
        rows={rows}
      />

      {allChips.length>0&&(
        <div className="sf-chips">
          {allChips.map(c=>(
            <span key={c.key+c.rawVal} className="sf-chip">
              <span>{c.label}</span>
              <button type="button" onClick={c.clear} aria-label={`Remover filtro ${c.label}`}>
                <X size={12}/>
              </button>
            </span>
          ))}
          <button type="button" className="sf-chip sf-chip--clear" onClick={onClearFilters}>
            <RotateCw size={12}/> Limpar todos
          </button>
        </div>
      )}

      {resultCount!==undefined&&(
        <div className="sf-result-count">
          {resultCount} {resultCount===1?(resultLabel||"registro encontrado"):(resultLabel||"registros encontrados")}
        </div>
      )}
    </div>
  );
}

export default function App({forceLogin=false}){
  const[session,setSession]=useState(null);
  const[authLoading,setAuthLoading]=useState(true);
  const[permissionLoading,setPermissionLoading]=useState(false);
  const[userRoles,setUserRoles]=useState([]);
  const[authError,setAuthError]=useState("");
  const[currentProfileId,setCurrentProfileId]=useState(null);
  const[page,setPage]=useState("preceptores-internato");
  const[menu,setMenu]=useState(false);
  const[collapsed,setCollapsed]=useState(()=>{try{return sessionStorage.getItem("sidebarCollapsed")==="1"}catch(e){return false}});
  const[escalasFiltrosAbertos,setEscalasFiltrosAbertos]=useState(false);
  const[search,setSearch]=useState("");
  const[primeiroAcessoPendente,setPrimeiroAcessoPendente]=useState(false);
  const[modal,setModal]=useState(null);
  const[modalTrigger,setModalTrigger]=useState(null);
  const[toast,setToast]=useState("");
  const[toastType,setToastType]=useState("success");
  const[jsPDFLoaded,setJSPDFLoaded]=useState(false);
  const[scriptLoaded,setScriptLoaded]=useState(false);
  const[openGroup,setOpenGroup]=useState(()=>{
    const g=NAV_BASE.find(([,items])=>items.some(([id])=>id==="preceptores-internato"));
    return g?g[0]:NAV_BASE[0][0];
  });

  const[rows,setRows]=useState([]);
  const[loadingData,setLoadingData]=useState(true);
  const[errorData,setErrorData]=useState("");
  const[formData,setFormData]=useState({});
  const[formOptions,setFormOptions]=useState({});
  const[formOptionsLoading,setFormOptionsLoading]=useState(false);
  const[formOptionsErrors,setFormOptionsErrors]=useState({});
  const[saving,setSaving]=useState(false);
  const[editVinculos,setEditVinculos]=useState([]);
  const[emailsCopiaLoading,setEmailsCopiaLoading]=useState(false);
  const[editVinculosRefresh,setEditVinculosRefresh]=useState(0);

  const [solicitacoesFiscais, setSolicitacoesFiscais] = useState([]);
  const [solicitacoesFiscaisErro, setSolicitacoesFiscaisErro] = useState(null);
  const [solicitacoesFiscaisCarregando, setSolicitacoesFiscaisCarregando] = useState(false);
  const [pagamentosFiscais, setPagamentosFiscais] = useState([]);
  const [modalConfirmarEnvio, setModalConfirmarEnvio] = useState(null);
  const [modalCorrigirEnvio, setModalCorrigirEnvio] = useState(null);
  const [modalHistoricoNota, setModalHistoricoNota] = useState(null);
  const [solicitacaoNotaLoading, setSolicitacaoNotaLoading] = useState(false);
  const emailEnvioEmAndamento = useRef(false);

  // Pagamento em lote (Controle Financeiro) — seleção múltipla de preceptores não pagos
  const [pagLoteModo, setPagLoteModo] = useState(false);
  const [pagLoteIds, setPagLoteIds] = useState(() => new Set());
  const [pagLoteFiltro, setPagLoteFiltro] = useState("todos");
  const [pagLoteExecutando, setPagLoteExecutando] = useState(false);

  const carregarSolicitacoesFiscais = useCallback(async () => {
    setSolicitacoesFiscaisCarregando(true);
    try {
      const data = await fetchSolicitacoesNotaFiscal();
      setSolicitacoesFiscais(data || []);
      setSolicitacoesFiscaisErro(null);
    } catch (err) {
      console.warn("Erro ao carregar solicitações fiscais:", err);
      setSolicitacoesFiscaisErro(err?.message || "Não foi possível carregar a situação fiscal. Tente novamente.");
    } finally {
      setSolicitacoesFiscaisCarregando(false);
    }
    try {
      const { data: pagData } = await supabase.from('pagamentos').select('*');
      setPagamentosFiscais(pagData || []);
    } catch (err) {
      console.warn("Erro ao carregar pagamentos fiscais:", err);
    }
  }, []);

  useEffect(() => {
    if (page === "apuracao-mensal" || page === "pagamentos" || page === "controle-financeiro") {
      carregarSolicitacoesFiscais();
    }
  }, [page, carregarSolicitacoesFiscais]);

  function getSolicitacaoFiscal(preceptorId, competenciaId) {
    if (!preceptorId || !solicitacoesFiscais || solicitacoesFiscais.length === 0) return null;
    // A tabela usa preceptor_id + competencia (string AAAA-MM), não competencia_id UUID
    // Na mesma tela a competência já está filtrada, então basta comparar por preceptor_id
    return solicitacoesFiscais.find(s => s.preceptor_id === preceptorId) || null;
  }

  function situacaoFiscalDoGrupo(grupo) {
    if (!grupo?.preceptor_id || !solicitacoesFiscais || solicitacoesFiscais.length === 0) return null;
    const now = new Date();
    const compMesAnoStr = `${apurFiltroAno || now.getFullYear()}-${String(apurFiltroMes || now.getMonth() + 1).padStart(2, '0')}`;
    return solicitacoesFiscais.find(s => s.preceptor_id === grupo.preceptor_id && s.competencia === compMesAnoStr) || null;
  }

  // Situação de pagamento em lote de um grupo (preceptor) na competência exibida.
  // bloqueioLote: null = elegível; 'pago' | 'email' | 'calculo' = não selecionável.
  function estadoLoteGrupo(grupo) {
    const sol = situacaoFiscalDoGrupo(grupo);
    const estadoFiscal = sol?.situacao || null;
    const isPago = estadoFiscal === 'pago';
    const isRegistroAntigo = estadoFiscal === 'nota_recebida' || estadoFiscal === 'em_pagamento';
    const isEmailEnviado = estadoFiscal === 'solicitada';
    const isNaoPago = isEmailEnviado || isRegistroAntigo;
    const isEmailPreparado = estadoFiscal === 'preparada';
    const emailEnviado = ['solicitada', 'nota_recebida', 'em_pagamento', 'pago'].includes(estadoFiscal);
    const vincs = Array.isArray(grupo?.vinculos) ? grupo.vinculos : [];
    const temDesatualizacao = vincs.some(r =>
      (r.vinculo_internato_id && setVinculosDesatualizados.has(r.vinculo_internato_id)) ||
      (r.vinculo_adm_id && setVinculosDesatualizados.has(r.vinculo_adm_id))
    );
    const vincPend = (apurDesatualizacao?.vinculos_nao_calculados || []).filter(v => v.preceptor_id === grupo?.preceptor_id);
    const regraPendente = vincs.some(r => !r.regra_nome || r.regra_nome === "Regra financeira pendente");
    const temPendente = vincPend.length > 0 || regraPendente;
    const revisadasCount = vincs.filter(r => isAtuacaoRevisada(r)).length;
    const isRevisado = revisadasCount === vincs.length && vincs.length > 0;
    const elegibilidade = avaliarElegibilidadeDemonstrativo(vincs);
    const valorTotal = Number(grupo?.totalGrupo || 0);
    const obsPendente = vincs.some(r => r.observacoes && r.observacoes !== "Calculado");

    // Mesma situação exibida na linha do preceptor (badge da tabela).
    let situacaoGrupo = "Aguardando Revisão";
    let situacaoClass = "aguardando-revisao";
    if (temDesatualizacao) {
      situacaoGrupo = "Necessita Recálculo";
      situacaoClass = "desatualizado";
    } else if (isPago) {
      situacaoGrupo = "Pago";
      situacaoClass = "pago";
    } else if (isNaoPago) {
      situacaoGrupo = "Não pago";
      situacaoClass = "nf-recebida";
    } else if (isEmailPreparado) {
      situacaoGrupo = "E-mail preparado";
      situacaoClass = "email-enviado";
    } else if (isRevisado) {
      situacaoGrupo = "Cálculo conferido";
      situacaoClass = "revisado";
    } else if (vincPend.length > 0) {
      situacaoGrupo = "Pendências";
      situacaoClass = "pendente";
    }

    let bloqueioLote = null;
    let motivoBloqueio = "";
    if (isPago) {
      bloqueioLote = 'pago';
      motivoBloqueio = "Já pago nesta competência.";
    } else if (!isNaoPago) {
      bloqueioLote = 'email';
      motivoBloqueio = "E-mail ainda não enviado para este preceptor.";
    } else if (temDesatualizacao) {
      bloqueioLote = 'calculo';
      motivoBloqueio = "Cálculo desatualizado — necessário recalcular a competência.";
    } else if (!elegibilidade.elegivel || temPendente) {
      bloqueioLote = 'calculo';
      motivoBloqueio = elegibilidade.motivo || "Cálculo incompleto ou com pendência para esta competência.";
    }

    return {
      sol, estadoFiscal, isPago, isRegistroAntigo, isEmailEnviado, isNaoPago, isEmailPreparado,
      emailEnviado, temDesatualizacao, vincPend, regraPendente, temPendente, isRevisado,
      obsPendente, situacaoGrupo, situacaoClass,
      elegibilidade, valorTotal, bloqueioLote, motivoBloqueio
    };
  }

  // Avalia o preceptor a partir do grupo-base (todas as atuações da competência),
  // ignorando busca e filtros da tela.
  function estadoLoteGrupoBase(grupo) {
    const base = grupo && pagLoteGruposBase ? pagLoteGruposBase[grupo.preceptor_id] : null;
    return estadoLoteGrupo(base || grupo);
  }

  // Filtros rápidos de pagamento: todos, aguardando conferência, e-mail não enviado,
  // não pagos, pagos e com pendência. Usa o grupo-base (sem filtros da tela) para que
  // busca/filtros não escondam pendências de um preceptor.
  function passaFiltroRapidoLote(grupo, filtro) {
    if (!filtro || filtro === 'todos') return true;
    const e = estadoLoteGrupoBase(grupo);
    if (filtro === 'nao_pagos') return e.isNaoPago;
    if (filtro === 'pagos') return e.isPago;
    if (filtro === 'email_nao_enviado') return !e.emailEnviado;
    if (filtro === 'com_pendencia') return e.situacaoGrupo === "Pendências" || e.situacaoGrupo === "Necessita Recálculo" || e.obsPendente;
    if (filtro === 'aguardando_conferencia') return e.situacaoGrupo === "Aguardando Revisão";
    return true;
  }

  function abrirModalConfirmarEnvio(grupo, solicitacao) {
    if (!solicitacao || solicitacao.situacao !== 'preparada') {
      systemAlert('A solicitação precisa estar na situação "preparada" para ser enviada.', 'Atenção');
      return;
    }
    setModalConfirmarEnvio({ grupo, solicitacao });
  }

  function abrirModalCorrigirEnvio(grupo, solicitacao) {
    if (!isAdmin) {
      systemAlert('Apenas Administradores podem corrigir a confirmação de envio.', 'Acesso Restrito');
      return;
    }
    if (!solicitacao || (solicitacao.situacao !== 'enviada' && solicitacao.situacao !== 'solicitada')) {
      systemAlert('Somente solicitações com situação "enviada" podem ter a confirmação corrigida.', 'Atenção');
      return;
    }
    setModalCorrigirEnvio({ grupo, solicitacao, motivo: '' });
  }

  async function abrirModalHistorico(grupo, solicitacao) {
    if (!solicitacao || !solicitacao.id) {
      systemAlert('Nenhuma solicitação fiscal cadastrada para este preceptor nesta competência.', 'Histórico indisponível');
      return;
    }
    setModalHistoricoNota({ grupo, solicitacao, historico: [], loading: true });
    try {
      const hist = await fetchHistoricoSolicitacaoNota(solicitacao.id);
      setModalHistoricoNota(prev => prev ? { ...prev, historico: hist || [], loading: false } : null);
    } catch (e) {
      console.error("Erro ao buscar histórico:", e);
      setModalHistoricoNota(prev => prev ? { ...prev, loading: false } : null);
    }
  }

  const isAdmin=userRoles.includes("admin");
  const isCoordenacao=userRoles.includes("coordenador");
  const NAV=useMemo(()=>getNav(isAdmin,isCoordenacao),[isAdmin,isCoordenacao]);
  const authenticated=!!session;
  const authorized=authenticated&&!permissionLoading&&userRoles.length>0;

  useEffect(()=>{
    let cancelled=false;
    async function loadSessionAndPermissions(){
      const{data:{session:s},error:sErr}=await supabase.auth.getSession();
      if(cancelled)return;
      if(sErr){setAuthError("Erro ao recuperar sessao.");setAuthLoading(false);return}
      setSession(s);
      setAuthLoading(false);
      if(s){
        setPermissionLoading(true);
        const{data:profile,error:pErr}=await supabase.from("profiles").select("id,nome_completo,ativo").eq("user_id",s.user.id).single();
        if(cancelled){setPermissionLoading(false);return}
        if(pErr||!profile){
          setAuthError("Perfil nao encontrado. Acesso negado.");
          setPermissionLoading(false);
          return;
        }
        setCurrentProfileId(profile.id);
        if(!profile.ativo){
          setAuthError("Perfil inativo. Contate o administrador.");
          setPermissionLoading(false);
          return;
        }
        const{data:roles,error:rErr}=await supabase.from("user_roles").select("role,ativo").eq("profile_id",profile.id);
        if(cancelled){setPermissionLoading(false);return}
        if(rErr){
          setAuthError("Erro ao verificar permissoes.");
          setPermissionLoading(false);
          return;
        }
        const activeRoles=(roles||[]).filter(r=>r.ativo===true).map(r=>r.role);
        if(activeRoles.length===0){
          setAuthError("Nenhuma permissao atribuida. Contate o administrador.");
          setPermissionLoading(false);
          return;
        }
        setUserRoles(activeRoles);
        setPermissionLoading(false);
        // Check if first access is pending
        const{data:profileFull}=await supabase.from("profiles").select("primeiro_acesso_pendente").eq("user_id",s.user.id).single();
        if(profileFull&&profileFull.primeiro_acesso_pendente){
          setPrimeiroAcessoPendente(true);
        }
      }
    }
    loadSessionAndPermissions();
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(event,s)=>{
      if(event==="SIGNED_OUT"||!s){
        setSession(null);setUserRoles([]);setAuthError("");setCurrentProfileId(null);
      }else if(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"){
        setSession(s);
        if(event==="SIGNED_IN"&&s&&userRoles.length===0){
          setPermissionLoading(true);
          const{data:profile}=await supabase.from("profiles").select("id,ativo").eq("user_id",s.user.id).single();
          if(profile&&profile.ativo){
            const{data:roles}=await supabase.from("user_roles").select("role,ativo").eq("profile_id",profile.id);
            const activeRoles=(roles||[]).filter(r=>r.ativo===true).map(r=>r.role);
            setUserRoles(activeRoles);
            setCurrentProfileId(profile.id);
          }
          setPermissionLoading(false);
        }
      }
    });
    return()=>{cancelled=true;subscription.unsubscribe()};
  },[]);

  useEffect(()=>{try{sessionStorage.setItem("sidebarCollapsed",collapsed?"1":"0")}catch(e){}},[collapsed]);

  useEffect(()=>{
    if(!menu)return;
    const onKey=(e)=>{if(e.key==="Escape")setMenu(false)};
    window.addEventListener("keydown",onKey);
    const prevOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{window.removeEventListener("keydown",onKey);document.body.style.overflow=prevOverflow};
  },[menu]);

  useEffect(()=>{
    if(!modal)return;
    const onKey=(e)=>{if(e.key==="Escape")setModal(null)};
    window.addEventListener("keydown",onKey);
    const prevOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{window.removeEventListener("keydown",onKey);document.body.style.overflow=prevOverflow};
  },[modal]);

  useEffect(()=>{
    if(forceLogin&&authorized){
      window.location.href="/";
    }
  },[forceLogin,authorized]);

  useEffect(()=>{
    if(authorized&&!isAdmin&&isCoordenacao&&!COORDENACAO_ALLOWED.includes(page)){
      setPage("escalas");
      const g=NAV_BASE.find(([,items])=>items.some(([id])=>id==="escalas"));
      if(g)setOpenGroup(g[0]);
    }
  },[authorized,isAdmin,isCoordenacao,page]);

  const loadPage=useCallback(async()=>{
    if(!session)return;
    setLoadingData(true);setErrorData("");if(page!=="apuracao-mensal" && page!=="controle-financeiro")setRows([]);
    try{
      switch(page){
          case"preceptores-pratica":{
            setRows(await fetchPreceptoresPratica());break;
          }
          case"preceptores-internato":{
            setRows(await fetchPreceptoresInternato());break;
          }
        case"cadastros-auxiliares":{setRows([]);break}
        case"escalas":{
          let escalasRows=(await fetchVinculosParaEscalasPage()).filter(r=>r.tipo_atuacao==="internato");
          if(!isAdmin&&isCoordenacao&&currentProfileId){
            escalasRows=escalasRows.filter(r=>{
              const coords=r.coordenadores||[];
              return coords.some(c=>c.profile_id===currentProfileId);
            });
          }
          setRows(escalasRows);break;
        }
        case"registrar-presencas":{setRows([]);break}
        case"presencas":{setRows((await fetchFolhaPresenca()).filter(r=>r.tipo_atuacao==="internato"));break}
        case"regras":{setRows((await fetchRegrasFinanceiras()).filter(r=>r.tipo_atuacao==="internato").map(r=>({...r,tipo_atuacao_label:r.tipo_atuacao==="adm"?"Prática":"Internato"})));break}
        case"controle-financeiro":{break}
        case"apuracao-mensal":{setPage("controle-financeiro");return}
        case"pagamentos":{setPage("controle-financeiro");return}
        case"ajustes":{setRows(await fetchAjustes());break}
        case"auditoria":{setRows(await fetchAuditLogs());break}
        case"configuracoes":{setRows(await fetchConfiguracoes());break}
        case"usuarios":{
          const ROLE_LBL={admin:"Administrador",coordenador:"Coordenador(a)",preceptor:"Preceptor",financeiro:"Financeiro"};
          const data=await fetchUsuarios();
          setRows(data.map(r=>{
            const roles=Array.isArray(r.roles)?r.roles:[];
            let situacao_usuario="Ativo";
            if(!r.ativo)situacao_usuario=r.motivo_bloqueio_inativacao?"Bloqueado":"Inativo";
            else if(r.primeiro_acesso_pendente)situacao_usuario="Pendente";
            return{...r,perfil_label:roles.map(rol=>ROLE_LBL[rol]||rol),situacao_usuario};
          }));break}
        default:{setRows([]);break}
      }
    }catch(e){setErrorData(e.message||"Erro ao carregar dados");}
    setLoadingData(false);
  },[page,session]);

  useEffect(()=>{loadPage()},[loadPage]);

  const loadFormOptions=useCallback(async()=>{
    if(!session)return;
    setFormOptionsLoading(true);
    const errors={};
    const extras={};
    const sett = async (key, fn) => { try { extras[key] = await fn(); } catch(e) { console.error(`[loadFormOptions:${key}]`, e); errors[key] = e.message || "Erro ao carregar."; extras[key] = []; } };
    try{
      const base = await Promise.allSettled([fetchPreceptores(),fetchVinculosLocaisParaEscalas()]);
      extras.preceptores = base[0].status === 'fulfilled' ? base[0].value : [];
      extras.vinculosLocais = base[1].status === 'fulfilled' ? base[1].value : [];
      if(base[0].status === 'rejected') errors.preceptores = base[0].reason?.message || "Erro ao carregar preceptores.";
      if(base[1].status === 'rejected') errors.vinculosLocais = base[1].reason?.message || "Erro ao carregar vínculos.";

      if(page==="preceptores-pratica"){
        await Promise.allSettled([
          sett('periodos', () => fetchPeriodosByRange(1,8)),
          sett('disciplinas', fetchDisciplinasAtivas),
          sett('semestres', fetchSemestresAtivos),
          sett('locais', fetchLocaisAtivos),
          sett('unidades', fetchUnidadesAtivas),
          sett('profissoes', fetchProfissoesAtivas),
          sett('modalidades', fetchModalidadesPagamentoAtivas),
          sett('setores', fetchSetoresAtivos),
          sett('regrasFinanceiras', () => fetchRegrasFinanceirasAtivas('adm')),
        ]);
      } else if(page==="preceptores-internato"){
        await Promise.allSettled([
          sett('periodos', () => fetchPeriodosByRange(9,12)),
          sett('internatos', fetchInternatosAtivos),
          sett('semestres', fetchSemestresAtivos),
          sett('locais', fetchLocaisAtivos),
          sett('unidades', fetchUnidadesAtivas),
          sett('profissoes', fetchProfissoesAtivas),
          sett('modalidades', fetchModalidadesPagamentoAtivas),
          sett('setores', fetchSetoresAtivos),
          sett('regrasFinanceiras', () => fetchRegrasFinanceirasAtivas('internato')),
          sett('coordenadores', fetchCoordenadoresAtivos),
        ]);
      } else if(page==="escalas"){
        await Promise.allSettled([
          sett('vinculosLocais', fetchVinculosLocaisParaEscalas),
          sett('setores', fetchSetoresAtivos),
        ]);
      } else if(page==="regras" || modal?.mode==="regra-create" || modal?.mode==="regra-edit"){
        await Promise.allSettled([
          sett('unidades', fetchUnidadesAtivas),
          sett('profissoes', fetchProfissoesAtivas),
          sett('internatos', fetchInternatosAtivos),
          sett('disciplinas', fetchDisciplinasAtivas),
          sett('locais', fetchLocaisAtivos),
          sett('setores', fetchSetoresAtivos),
          sett('preceptoresPratica', fetchPreceptoresPraticaParaRegras),
          sett('preceptoresInternato', fetchPreceptoresInternatoParaRegras),
        ]);
      }
      setFormOptions(extras);
      setFormOptionsErrors(errors);
    }catch(e){setFormOptionsErrors({geral:e.message||"Erro ao carregar opções."})}
    setFormOptionsLoading(false);
  },[session,page]);

  useEffect(()=>{
    if(modal?.mode==="form"||modal?.mode==="regra-create"||modal?.mode==="regra-edit") loadFormOptions();
  },[modal,loadFormOptions]);

  useEffect(()=>{
    if(modal?.mode==="form"){
      if(modal.editData){
        const base={...modal.editData};
        const vinc=page==="preceptores-pratica"?base.vinculo_adm:base.vinculo_internato;
        if(vinc){
          base.periodo_id=vinc.periodo_id||"";
          base.semestre_id=vinc.semestre_id||"";
          base.data_inicio=vinc.data_inicio||"";
          base.data_fim=vinc.data_fim||"";
          base.vinculo_id=vinc.id||null;
          base.local_id=vinc.local_id||"";
          base.setor_id=vinc.setor_id||"";
          base.unidade_vinculo_id=vinc.unidade_id||"";
          if(page==="preceptores-pratica"){
            base.disciplina_id=vinc.disciplina_id||"";
          }else{
            base.internato_id=vinc.internato_id||"";
            base.vinculo_modalidade_pagamento_id=vinc.modalidade_pagamento_id||"";
            base.vinculo_cnpj=vinc.cnpj||"";
            base.vinculo_razao_social=vinc.razao_social||"";
            base._coordenadores=(vinc.coordenadores||[]).filter(c=>c.status==="ativo").map(c=>c.profile_id);
          }
        }
        base.unidade_id=base.unidade?.id||base.unidade_id||"";
        base.profissao_id=base.profissao_ref?.id||base.profissao_id||"";
        base.modalidade_pagamento_id=base.modalidade_ref?.id||base.modalidade_pagamento_id||"";
        base.status=base.status||"ativo";
        const regraAnc=base.regraAtiva||null;
        base.regra_financeira_id=regraAnc?regraAnc.regra_id:"";
        base._regraAnteriorId=regraAnc?regraAnc.regra_id:"";
        base.justificativa_regra="";
        setFormData(base);
      }else if(modal.page!=="escalas"){
        setFormData({});
      }
    }
  },[modal]);

  useEffect(()=>{
    if(!modal||modal.mode!=="form"||!modal.editId)return;
    const pg=modal.page||page;
    if(pg!=="preceptores-pratica"&&pg!=="preceptores-internato")return;
    let active=true;
    (async()=>{
      try{
        const data=pg==="preceptores-internato"
          ?await fetchVinculosInternatoPorPreceptor(modal.editId)
          :await fetchVinculosPratica(modal.editId);
        if(active)setEditVinculos(data);
      }catch(e){console.error("[load vinculos for edit]",e);if(active)setEditVinculos([])}
    })();
    return()=>{active=false};
  },[modal,editVinculosRefresh]);

  useEffect(()=>{
    if(!modal||modal.mode!=="form"||!modal.editId)return;
    const pg=modal.page||page;
    if(pg!=="preceptores-pratica"&&pg!=="preceptores-internato")return;
    let active=true;
    setEmailsCopiaLoading(true);
    (async()=>{
      try{
        const data=await fetchEmailsCopia(modal.editId);
        if(active)setFormData(prev=>({...prev,_emails_copia:data.map(r=>({id:r.id,email:r.email,ativo:r.ativo!==false}))}));
      }catch(e){
        console.error("[load emails copia]",e);
        if(active)setFormData(prev=>({...prev,_emails_copia:[]}));
      }finally{
        if(active)setEmailsCopiaLoading(false);
      }
    })();
    return()=>{active=false};
  },[modal]);

  const [panelFilters,setPanelFilters]=useState({});
  const [panelOpen,setPanelOpen]=useState(false);

  const pageFilterConfigs={
    "preceptores-internato":[
      {key:"unidade",label:"Unidade"},
      {key:"profissao",label:"Profissão"},
      {key:"modalidade",label:"Modalidade"},
      {key:"vinculo_status",label:"Situação do vínculo",options:[{value:"ativo",label:"Ativo"},{value:"inativo",label:"Inativo"}]},
      {key:"vinculos_quantidade",label:"Qtd. de vínculos"},
    ],
    "preceptores-pratica":[
      {key:"unidade",label:"Unidade"},
      {key:"profissao",label:"Profissão"},
      {key:"disciplina",label:"Disciplina"},
      {key:"periodo",label:"Período"},
      {key:"modalidade",label:"Modalidade"},
      {key:"vinculo_status",label:"Situação do vínculo"},
    ],
    escalas:[
      {key:"preceptor_nome",label:"Preceptor"},
      {key:"internato_nome",label:"Internato"},
      {key:"periodo_nome",label:"Período"},
      {key:"unidade_nome",label:"Unidade"},
      {key:"local_nome",label:"Local"},
      {key:"setor_nome",label:"Setor"},
      ...(isAdmin?[{key:"coordenadores",label:"Coordenador"}]:[]),
    ],
    presencas:[
      {key:"competencia_label",label:"Competência"},
      {key:"preceptor_nome",label:"Preceptor"},
      {key:"local_nome",label:"Local"},
      {key:"unidade_nome",label:"Unidade"},
    ],
    regras:[
      {key:"tipo_atuacao_label",label:"Tipo de atuação"},
      {key:"status",label:"Situação"},
      {key:"unidade",label:"Unidade",nestedKey:"nome"},
    ],
    usuarios:[
      {key:"situacao_usuario",label:"Situação"},
      {key:"perfil_label",label:"Perfil"},
    ],
    auditoria:[
      {key:"operacao",label:"Operação"},
      {key:"tabela",label:"Tabela"},
    ],
  };

  const filteredRows=useMemo(()=>{
    if(!rows.length)return[];
    let result=rows;
    if(search.trim()){
      const s=normalizeText(search);
      result=result.filter(r=>{
        if(typeof r==="object"&&!Array.isArray(r)){
          return Object.values(r).some(v=>{
            if(!v)return false;
            if(typeof v==="object"){
              if(Array.isArray(v))return v.some(x=>{const n=x?.nome||x?.nome_completo||x;return n&&normalizeText(String(n)).includes(s)});
              const n=v.nome||v.nome_completo||"";
              return n&&normalizeText(String(n)).includes(s);
            }
            return normalizeText(String(v)).includes(s);
          });
        }
        return false;
      });
    }
    const cfg=pageFilterConfigs[page];
    if(cfg){
      cfg.forEach(f=>{
        const rawVal=panelFilters[f.key];
        if(rawVal!==undefined&&rawVal!==null&&rawVal!==""){
          const vals=Array.isArray(rawVal)?rawVal.map(String):[String(rawVal)];
          if(vals.length>0){
            result=result.filter(r=>{
              let v=r[f.key];
              if(v&&typeof v==="object"){
                if(f.nestedKey){const n=v[f.nestedKey];return n!==undefined&&vals.includes(String(n))}
                if(Array.isArray(v))return v.some(x=>{const n=x?.nome||x?.nome_completo||x;return n!==undefined&&vals.includes(String(n))});
                const n=v.nome||v.nome_completo||"";
                return vals.includes(String(n));
              }
              return v!==undefined&&vals.includes(String(v));
            });
          }
        }
      });
    }
    return result;
  },[rows,search,panelFilters,page,isAdmin]);

  function notify(t,type){setToast(t);setToastType(type||"success");setModal(null);setTimeout(()=>setToast(""),3000)}
  function toastError(t){setToast(t);setToastType("error");setTimeout(()=>setToast(""),4500)}
  function go(id){
    if(id==="usuarios"&&!isAdmin){notify("Acesso restrito a Administradores.","error");return}
    if(!isAdmin&&isCoordenacao&&!COORDENACAO_ALLOWED.includes(id)){
      notify("Acesso restrito ao perfil Coordenação.","error");return;
    }
    if(collapsed)setCollapsed(false);
    setPage(id);setSearch("");setPanelFilters({});setPanelOpen(false);setMenu(false);const g=NAV.find(([,items])=>items.some(([sid])=>sid===id));if(g)setOpenGroup(g[0]);
  }
  function handleMenuClick(){
    if(window.innerWidth>=1200){setCollapsed(c=>!c);}
    else{setMenu(m=>!m);}
  }

  function Navigation(){
    return <>{NAV.map(([g,items])=>{
      const isOpen=openGroup===g;
      return <div className={"navgroup"+(isOpen?" open":"")} key={g}>
        <button className={"module-title"+(isOpen?" active":"")} title={g} onClick={()=>{if(collapsed){setCollapsed(false)}else{setOpenGroup(isOpen?null:g)}}}>
          <span>{g}</span><ChevronDown size={15} className={"navgroup-arrow"+(isOpen?" open":"")}/>
        </button>
        <div className="navgroup-wrap"><div className="navgroup-items">
          {items.map(([id,name,I])=><button key={id} title={name} onClick={()=>go(id)} className={page===id?"active":""}>
            <I size={18}/><span>{name}</span>{page===id&&<ChevronRight size={15}/>}
          </button>)}
        </div></div>
      </div>;
    })}</>;
  }

  const meta=PAGE_META[page]||{title:page,desc:"",btn:null,cols:[]};
  const isPreceptorPage=page.includes("preceptores");
  const isInternato=page==="preceptores-internato";
  const opts=formOptions||{};

  async function handleSave(){
    if(!modal||modal.mode!=="form")return;
    if(page==="preceptores-pratica"||page==="preceptores-internato"){
      const cpf=(formData.cpf||"").replace(/\D/g,"");
      if(cpf.length>0&&cpf.length<11){toastError("CPF incompleto. Informe todos os 11 dígitos ou deixe o campo vazio.");return}
      if(cpf.length===11){
        try{
          const duplicado=await buscarPreceptorPorCpf(cpf,modal.editId||null);
          if(duplicado){toastError("CPF já cadastrado para outro preceptor.");return}
        }catch(e){console.warn("[Pre-check CPF indisponível, o banco fará a validação final]",e)}
      }
      if(!formData.nome_completo?.trim()){toastError("Informe o nome completo.");return}
      if(isAdmin){
        const erroEmailsCopia=validarEmailsCopia(formData._emails_copia||[],formData.email);
        if(erroEmailsCopia){toastError(erroEmailsCopia);return}
      }
      if(isInternato){
        const selModalV=(opts.modalidades||[]).find(m=>m.id===formData.vinculo_modalidade_pagamento_id);
        const isNFSv=selModalV?.nome?.toLowerCase().includes("nfs");
        if(isNFSv&&formData.vinculo_cnpj){
          const cnpjRaw=formData.vinculo_cnpj.replace(/\D/g,"");
          if(cnpjRaw.length!==14){toastError("CNPJ inválido. Informe 14 dígitos.");return}
        }
      }else{
        const selModalPre=(opts.modalidades||[]).find(m=>m.id===formData.modalidade_pagamento_id);
        const isNFSpre=selModalPre?.nome?.toLowerCase().includes("nfs");
        if(isNFSpre&&formData.cnpj){
          const cnpjRaw=formData.cnpj.replace(/\D/g,"");
          if(cnpjRaw.length!==14){toastError("CNPJ inválido. Informe 14 dígitos.");return}
        }
      }
    }
    if(page==="escalas"){
      const itensPre=formData._itens||[];
      if(!formData.tipo_atuacao||!formData.vinculo_local_id){notify("Complete o vínculo do preceptor antes de criar a escala.","error");return}
      if(itensPre.length===0){notify("Selecione pelo menos uma data e um turno.","error");return}
      const isNewEscala=!formData._escala_id;
      const semSetor=itensPre.filter(i=>isNewEscala?!i.setor_id:i.setor_id==="");
      if(semSetor.length>0){notify("Selecione o setor para todos os itens da escala. Itens legados sem setor próprio podem manter o setor do vínculo.","error");return}
    }
    setSaving(true);
    try{
      switch(page){
        case"preceptores-pratica":case"preceptores-internato":{
          const saveData={...formData};
          const vincModalidadeId=isInternato?saveData.vinculo_modalidade_pagamento_id:saveData.modalidade_pagamento_id;
          const selModalVinc=(opts.modalidades||[]).find(m=>m.id===vincModalidadeId);
          const isNFSsave=selModalVinc?.nome?.toLowerCase().includes("nfs");
          if(isInternato){
            if(!isNFSsave){saveData.vinculo_cnpj=null;saveData.vinculo_razao_social=null}
          }else{
            const selModalPre=(opts.modalidades||[]).find(m=>m.id===saveData.modalidade_pagamento_id);
            const isNFSpre=selModalPre?.nome?.toLowerCase().includes("nfs");
            if(!isNFSpre){saveData.cnpj=null;saveData.razao_social=null}
          }
          saveData.status=formData.status||"ativo";
          let vinculoId=modal.editId?formData.vinculo_id:null;
          const regraSel=formData.regra_financeira_id||"";
          const regraAnteriorId=formData._regraAnteriorId||"";
          const mudouRegra=regraSel!==regraAnteriorId;
          if(mudouRegra&&!regraSel&&regraAnteriorId&&!formData.justificativa_regra?.trim()){
            toastError("Justificativa obrigatória para remover a regra financeira.");setSaving(false);return
          }
          if(modal.editId){
            const preceptorUpdate={...saveData};
            if(isInternato){delete preceptorUpdate.vinculo_modalidade_pagamento_id;delete preceptorUpdate.vinculo_cnpj;delete preceptorUpdate.vinculo_razao_social;delete preceptorUpdate._coordenadores;}
            await updatePreceptor(modal.editId,preceptorUpdate);
            if(isAdmin)await salvarEmailsCopia(modal.editId,formData._emails_copia||[]);
            if(formData.vinculo_id){
              const vincData={
                semestre_id:formData.semestre_id||null,
                periodo_id:formData.periodo_id||null,
                unidade_id:formData.unidade_id||null,
                local_id:formData.local_id||null,
                setor_id:formData.setor_id||null,
                data_inicio:formData.data_inicio||null,
                data_fim:formData.data_fim||null
              };
              if(isInternato){
                vincData.internato_id=formData.internato_id||null;
                vincData.modalidade_pagamento_id=formData.vinculo_modalidade_pagamento_id||null;
                vincData.cnpj=saveData.vinculo_cnpj||null;
                vincData.razao_social=saveData.vinculo_razao_social||null;
              }
              else{vincData.disciplina_id=formData.disciplina_id||null}
              if(isInternato){
                const dupCheck={
                  preceptor_id:modal.editId,
                  internato_id:vincData.internato_id,
                  periodo_id:vincData.periodo_id,
                  semestre_id:vincData.semestre_id,
                  local_id:vincData.local_id,
                  setor_id:vincData.setor_id,
                  data_inicio:vincData.data_inicio,
                  data_fim:vincData.data_fim
                };
                const isDup=await verificarDuplicidadeVinculo(dupCheck,formData.vinculo_id);
                if(isDup){toastError("Este preceptor já possui um vínculo com as mesmas informações. Revise os dados antes de salvar.");setSaving(false);return}
              }
              await(isInternato?updateVinculoInternato(formData.vinculo_id,vincData):updateVinculoPratica(formData.vinculo_id,vincData));
              if(formData.local_id){
                const vincLocais=await fetchVinculoLocais(
                  isInternato?null:formData.vinculo_id,
                  isInternato?formData.vinculo_id:null
                );
                const existingVL=vincLocais?.[0]||null;
                if(existingVL){
                  const localChanged=formData.local_id!==existingVL.local_id;
                  const setorChanged=(formData.setor_id||null)!==(existingVL.setor_id||null);
                  if(localChanged||setorChanged){
                    await upsertVinculoLocal({
                      id:existingVL.id,
                      vinculo_adm_id:isInternato?null:formData.vinculo_id,
                      vinculo_internato_id:isInternato?formData.vinculo_id:null,
                      local_id:formData.local_id,
                      setor_id:formData.setor_id||null
                    });
                  }
                }else{
                  await upsertVinculoLocal({
                    tipo_atuacao:isInternato?'internato':'adm',
                    vinculo_adm_id:isInternato?null:formData.vinculo_id,
                    vinculo_internato_id:isInternato?formData.vinculo_id:null,
                    local_id:formData.local_id,
                    setor_id:formData.setor_id||null
                  });
                }
              }
              if(isInternato){
                await salvarVinculoCoordenadores(formData.vinculo_id,formData._coordenadores||[]);
              }
            }
          }else{
            const preceptorInsert={...saveData};
            if(isInternato){delete preceptorInsert.vinculo_modalidade_pagamento_id;delete preceptorInsert.vinculo_cnpj;delete preceptorInsert.vinculo_razao_social;delete preceptorInsert._coordenadores;}
            const preceptor=await insertPreceptor(preceptorInsert);
            if(isAdmin&&(formData._emails_copia||[]).length>0)await salvarEmailsCopia(preceptor.id,formData._emails_copia||[]);
            const vincData={
              preceptor_id:preceptor.id,
              semestre_id:saveData.semestre_id||null,
              periodo_id:saveData.periodo_id||null,
              unidade_id:saveData.unidade_id||null,
              local_id:saveData.local_id||null,
              setor_id:saveData.setor_id||null,
              data_inicio:saveData.data_inicio||null,
              data_fim:saveData.data_fim||null
            };
            if(isInternato){
              vincData.internato_id=saveData.internato_id||null;
              vincData.modalidade_pagamento_id=saveData.vinculo_modalidade_pagamento_id||null;
              vincData.cnpj=saveData.vinculo_cnpj||null;
              vincData.razao_social=saveData.vinculo_razao_social||null;
            }
            else{vincData.disciplina_id=saveData.disciplina_id||null}
            try{
              if(isInternato){
                const dupCheck={
                  preceptor_id:preceptor.id,
                  internato_id:vincData.internato_id,
                  periodo_id:vincData.periodo_id,
                  semestre_id:vincData.semestre_id,
                  local_id:vincData.local_id,
                  setor_id:vincData.setor_id,
                  data_inicio:vincData.data_inicio,
                  data_fim:vincData.data_fim
                };
                const isDup=await verificarDuplicidadeVinculo(dupCheck,null);
                if(isDup){toastError("Este preceptor já possui um vínculo com as mesmas informações. Revise os dados antes de salvar.");setSaving(false);return}
              }
              const newVinc=await(isInternato?insertVinculoInternato(vincData):insertVinculoPratica(vincData));
              vinculoId=newVinc.id;
              if(!isInternato&&saveData.local_id){
                const localChanged = !saveData.vinculo_local_id || 
                                      saveData.local_id !== saveData.vinculo_local_id;
                const setorChanged = saveData.setor_id !== saveData.vinculo_setor_id;
                
                if (localChanged || setorChanged) {
                  await upsertVinculoLocal({
                    vinculo_adm_id:newVinc.id,
                    local_id:saveData.local_id,
                    setor_id:saveData.setor_id||null
                  });
                }
              }
              if(isInternato){
                await salvarVinculoCoordenadores(newVinc.id,saveData._coordenadores||[]);
              }
            }catch(err){
              if(isInternato){await inativarPreceptor(preceptor.id).catch(()=>{});}
              throw err;
            }
          }
          if(vinculoId&&mudouRegra){
            await salvarVinculoRegraFinanceira({
              vinculo_adm_id:isInternato?null:vinculoId,
              vinculo_internato_id:isInternato?vinculoId:null,
              regra_id:regraSel||null,
              justificativa:formData.justificativa_regra?.trim()||null
            });
          }
          break;
        }
        case"escalas":{
          const itens=formData._itens||[];
          const datas=[...new Set(itens.map(i=>i.data))].sort();
          const vigInicio=formData._vigencia_inicio||null;
          const vigFim=formData._vigencia_fim||null;
          if(vigInicio||vigFim){
            const datasFora=datas.filter(d=>{
              if(vigInicio&&d<vigInicio)return true;
              if(vigFim&&d>vigFim)return true;
              return false;
            });
            if(datasFora.length>0){
              const fmt=iso=>{const[y,m,dd]=iso.split("-");return`${dd}/${m}/${y}`};
              let msg="As seguintes datas estão fora da vigência do vínculo:\n";
              datasFora.forEach(d=>{msg+=`\n• ${fmt(d)}`});
              msg+="\n\nRemova estas datas antes de salvar.";
              toastError(msg);
              setSaving(false);
              return;
            }
          }
          await salvarEscala({
            tipo_atuacao:formData.tipo_atuacao,
            vinculo_local_id:formData.vinculo_local_id,
            vinculo_adm_id:formData.vinculo_adm_id||null,
            vinculo_internato_id:formData.vinculo_internato_id||null,
            data_inicio:datas[0],
            data_fim:datas.length>1?datas[datas.length-1]:datas[0],
            status:formData.status||"ativo",
            itens:itens,
            escala_id:formData._escala_id||null
          });
          break;
        }
        default:break;
      }
      notify(modal.editId?"Registro atualizado com sucesso!":"Registro criado com sucesso!");
      loadPage();
    }catch(e){
      console.error("[Erro ao salvar]",e);
      let msg=e.message||"Erro ao salvar registro.";
      const rawMsg=String(e.message||"")+" "+String(e.details||"")+" "+String(e.hint||"");
      const ehCpfDuplicado=(e.code==="23505"&&rawMsg.includes("preceptores_cpf_unique"))||rawMsg.includes("preceptores_cpf_unique");
      if(ehCpfDuplicado)msg="CPF já cadastrado para outro preceptor.";
      else if(rawMsg.includes("cpf_formato"))msg="CPF inválido. Informe exatamente 11 dígitos numéricos.";
      else if(rawMsg.includes("check constraint"))msg="Dados fora do formato esperado. Verifique os campos.";
      else if(rawMsg.includes("vinculos_internato")||rawMsg.includes("vinculos_adm"))msg="Falha ao relacionar o vínculo. Verifique o preceptor e tente novamente.";
      if(ehMensagemConflito(msg))await mostrarConflito(msg);
      else toastError(msg);
    }
    setSaving(false);
  }

   async function handleInativar(id,tabela){
     try{
       await inativarRegistro(tabela,id);
       notify("Registro inativado com sucesso!");
       loadPage();
     }catch(e){notify("Erro ao inativar: "+(e.message||"tente novamente."),"error");}
   }

   async function handleInativarPreceptor(row){
     if(!await systemConfirm(`Tem certeza que deseja desativar o preceptor ${row.nome_completo}? Os vínculos existentes serão preservados.`,"Desativar preceptor"))return;
     try{
       await inativarRegistro('preceptores',row.id);
       notify("Preceptor desativado com sucesso!");
       loadPage();
     }catch(e){notify("Erro ao desativar: "+(e.message||"tente novamente."),"error");}
   }

   async function handleReativarPreceptor(row){
     if(!await systemConfirm(`Tem certeza que deseja reativar o preceptor ${row.nome_completo}?`,"Reativar preceptor"))return;
     try{
       await reativarPreceptor(row.id);
       notify("Preceptor reativado com sucesso!");
       loadPage();
     }catch(e){notify("Erro ao reativar: "+(e.message||"tente novamente."),"error");}
   }

   async function handleToggleVinculo(row, vinculoId, tipo){
     const isAtivo=row.vinculo_status==="ativo";
     const tipoLabel=tipo==="pratica"?"Prática":"Internato";
     if(!await systemConfirm(`Tem certeza que deseja ${isAtivo?"inativar":"reativar"} o vínculo de ${tipoLabel} de ${row.nome_completo}?`,`${isAtivo?"Inativar":"Reativar"} vínculo`))return;
     try{
       if(tipo==="pratica"){
         if(isAtivo)await inativarVinculoPratica(vinculoId);
         else await reativarVinculoPratica(vinculoId);
       }else{
         if(isAtivo)await inativarVinculoInternato(vinculoId);
         else await reativarVinculoInternato(vinculoId);
       }
       notify(`Vínculo ${isAtivo?"inativado":"reativado"} com sucesso!`);
       loadPage();
     }catch(e){notify("Erro: "+(e.message||"tente novamente."),"error");}
   }

  function handleEditEscala(row){
    const itens=(row.itens||[]).map(i=>({
      data:i.data,
      turno:i.turno,
      setor_id:i.setor_id??null
    }));
    setFormData({
      tipo_atuacao:row.tipo_atuacao,
      vinculo_local_id:row.vinculo_local_id,
      vinculo_adm_id:row.vinculo_adm_id,
      vinculo_internato_id:row.vinculo_internato_id,
      data_inicio:row.data_inicio||"",
      data_fim:row.data_fim||"",
      status:row.status||"ativo",
      _itens:itens,
      _escala_id:row.id,
      _auto_preceptor:row.preceptor_nome||"",
      _auto_unidade:row.unidade_nome||"",
      _auto_atividade:row.disciplina_ou_internato||"",
      _auto_periodo:row.periodo_nome||"",
      _auto_local:row.local_nome||"",
      _auto_setor:row.setor_nome||"",
      _auto_semestre:row.semestre_codigo||""
    });
    setModal({mode:"form",title:`Editar: ${row.preceptor_nome||"Escala"}`,page,editId:row.id,editData:row});
  }

  async function handleToggleEscala(row){
    const isAtivo=row.status==="ativo";
    if(!await systemConfirm(`Tem certeza que deseja ${isAtivo?"inativar":"reativar"} esta escala?`,`${isAtivo?"Inativar":"Reativar"} escala`))return;
    try{
      if(isAtivo)await inativarEscala(row.id);
      else await reativarEscala(row.id);
      notify(`Escala ${isAtivo?"inativada":"reativada"} com sucesso!`);
      loadPage();
    }catch(e){
      if(ehMensagemConflito(e.message)){await mostrarConflito(e.message);return;}
      notify("Erro: "+(e.message||"tente novamente."),"error");
    }
  }

  async function handleCriarEscala(vinculo){
    if(!vinculo.vinculo_completo){
      return setModal({mode:"escala-incompleta",title:"Vínculo incompleto",row:vinculo,page});
    }
    try{
      const escalasExistentes = await fetchEscalasPorVinculo(
        vinculo.tipo_atuacao === "adm" ? vinculo.vinculo_id : null,
        vinculo.tipo_atuacao === "internato" ? vinculo.vinculo_id : null
      );
      if (escalasExistentes.length > 0) {
        notify("Este preceptor já possui uma escala cadastrada. Redirecionando para a edição...", "error");
        return handleEditEscalaFromVinculo(vinculo);
      }
    }catch(e){}

    let vlLocal=(await fetchVinculosLocaisParaEscalas()).find(v=>{
      if(vinculo.tipo_atuacao==="adm")return v.vinculo_adm?.id===vinculo.vinculo_id;
      return v.vinculo_internato?.id===vinculo.vinculo_id;
    });
    if(!vlLocal){
      const upsertData={
        tipo_atuacao:vinculo.tipo_atuacao,
        local_id:vinculo.local_id||null,
        setor_id:vinculo.setor_id||null
      };
      if(vinculo.tipo_atuacao==="adm")upsertData.vinculo_adm_id=vinculo.vinculo_id;
      else upsertData.vinculo_internato_id=vinculo.vinculo_id;
      const created=await upsertVinculoLocal(upsertData);
      vlLocal=created;
    }
    setFormData({
      tipo_atuacao:vinculo.tipo_atuacao,
      vinculo_local_id:vlLocal?.id||"",
      vinculo_adm_id:vinculo.tipo_atuacao==="adm"?vinculo.vinculo_id:null,
      vinculo_internato_id:vinculo.tipo_atuacao==="internato"?vinculo.vinculo_id:null,
      data_inicio:"",
      data_fim:"",
      status:"ativo",
      _itens:[],
      _auto_preceptor:vinculo.preceptor_nome,
      _auto_unidade:vinculo.unidade_nome,
      _auto_atividade:vinculo.tipo_atuacao==="adm"?vinculo.disciplina_nome:vinculo.internato_nome,
      _auto_periodo:vinculo.periodo_nome,
      _auto_local:vinculo.local_nome,
      _auto_setor:vinculo.setor_nome,
      _auto_semestre:vinculo.semestre_codigo,
      _vigencia_inicio:vinculo.data_inicio||null,
      _vigencia_fim:vinculo.data_fim||null
    });
    setModal({mode:"form",title:`Nova escala — ${vinculo.preceptor_nome}`,page});
  }

  async function handleCompletarCadastro(vinculo){
    try{
      const target=vinculo.tipo_atuacao==="adm"?"preceptores-pratica":"preceptores-internato";
      const rows=vinculo.tipo_atuacao==="adm"?await fetchPreceptoresPratica():await fetchPreceptoresInternato();
      const preceptor=rows.find(p=>p.id===vinculo.preceptor_id);
      if(!preceptor){notify("Preceptor não encontrado.","error");return}
      setPage(target);
      setModal({mode:"form",title:`Completar cadastro — ${preceptor.nome_completo}`,page:target,editId:preceptor.id,editData:preceptor});
    }catch(e){notify("Erro: "+(e.message||"tente novamente."),"error")}
  }

  async function handleEditEscalaFromVinculo(vinculo){
    try{
      const escalas=await fetchEscalasPorVinculo(
        vinculo.tipo_atuacao==="adm"?vinculo.vinculo_id:null,
        vinculo.tipo_atuacao==="internato"?vinculo.vinculo_id:null
      );
      if(escalas.length===0){notify("Nenhuma escala encontrada.","error");return}
      const esc=escalas[0];
      const itens=(esc.itens||[]).map(i=>({data:i.data,turno:i.turno,setor_id:i.setor_id??null}));
      setFormData({
        tipo_atuacao:esc.tipo_atuacao,
        vinculo_local_id:esc.vinculo_local_id,
        vinculo_adm_id:esc.vinculo_adm_id,
        vinculo_internato_id:esc.vinculo_internato_id,
        data_inicio:esc.data_inicio||"",
        data_fim:esc.data_fim||"",
        status:esc.status||"ativo",
        _itens:itens,
        _escala_id:esc.id,
        _auto_preceptor:vinculo.preceptor_nome,
        _auto_unidade:vinculo.unidade_nome,
        _auto_atividade:vinculo.tipo_atuacao==="adm"?vinculo.disciplina_nome:vinculo.internato_nome,
        _auto_periodo:vinculo.periodo_nome,
        _auto_local:vinculo.local_nome,
        _auto_setor:vinculo.setor_nome,
        _auto_semestre:vinculo.semestre_codigo,
        _vigencia_inicio:vinculo.data_inicio||null,
        _vigencia_fim:vinculo.data_fim||null
      });
      setModal({mode:"form",title:`Editar: ${vinculo.preceptor_nome}`,page,editId:esc.id});
    }catch(e){notify("Erro: "+e.message,"error")}
  }

  async function handleVerEscalas(vinculo){
    try{
      const escalas=await fetchEscalasPorVinculo(
        vinculo.tipo_atuacao==="adm"?vinculo.vinculo_id:null,
        vinculo.tipo_atuacao==="internato"?vinculo.vinculo_id:null
      );
      setModal({mode:"escala-detail",title:`Escala — ${vinculo.preceptor_nome}`,row:{...vinculo,escalas}});
      setModalTrigger(document.activeElement);
    }catch(e){notify("Erro: "+e.message,"error")}
  }

  async function handleToggleTodasEscalas(vinculo,reativar){
    const acao=reativar?"reativar":"inativar";
    if(!await systemConfirm(`Tem certeza que deseja ${acao} todas as escalas deste preceptor?`,`${acao.charAt(0).toUpperCase()+acao.slice(1)} escalas`))return;
    try{
      const escalas=await fetchEscalasPorVinculo(
       vinculo.tipo_atuacao==="adm"?vinculo.vinculo_id:null,
       vinculo.tipo_atuacao==="internato"?vinculo.vinculo_id:null
      );
      for(const esc of escalas){
        if(reativar)await reativarEscala(esc.id);
        else if(esc.status==="ativo")await inativarEscala(esc.id);
      }
      notify(`Escalas ${acao}das com sucesso!`);
      loadPage();
    }catch(e){
      if(ehMensagemConflito(e.message)){await mostrarConflito(e.message);loadPage();return;}
      notify("Erro: "+(e.message||"tente novamente."),"error");
    }
  }

  function renderTable(){
    if(page==="cadastros-auxiliares")return null;
    if(page==="presencas")return renderPresencasTable();
    if(page==="regras")return renderRegrasTable();
    if(page==="apuracao-mensal" || page==="controle-financeiro")return renderApuracaoMensalTable();
    if(page==="auditoria")return renderAuditTable();
    if(page==="configuracoes")return renderConfigTable();
    if(page==="usuarios")return renderUsuariosTable();
    if(isPreceptorPage)return renderPreceptorTable();
    return renderGenericTable();
  }

   function renderPreceptorTable(){
     return <tbody>{filteredRows.map(r=>{
       const isInactive=r.vinculo_status!=="ativo";
       const preceptorInativo=r.status==="inativo";
       const qtdVinculos=r.vinculos_quantidade||0;
       const qtdLiberados=r.vinculos_completos||0;
       const regraOk=!!r.regraAtiva;
       let vincBadge,vincLabel;
       if(page==="preceptores-internato"){
           if(preceptorInativo){vincBadge="neutral";vincLabel="Inativo";}
           else{vincBadge="ok";vincLabel="Ativo";}
         }else{
         const vCompleto=r.vinculo_completo!==false;
         vincBadge=isInactive?"neutral":!vCompleto?"bad":regraOk?"ok":"warn";
         vincLabel=isInactive?"Preceptor inativo":!vCompleto?"Cadastro incompleto para Escala":regraOk?"Liberado":"Regra financeira pendente";
       }
       const camposFaltantes=r.vinculo_campos_faltantes||[];
       return <tr key={r.id}>
       <td>{r.unidade||"-"}</td>
       <td>{r.nome_completo}</td>
       <td>{r.profissao||"-"}</td>
       {page==="preceptores-pratica"&&<>
         <td>{r.disciplina||"-"}</td>
         <td>{r.periodo||"-"}</td>
       </>}
       {page==="preceptores-internato"&&<>
         <td><b>{qtdVinculos}</b>{qtdVinculos===1?" vínculo":" vínculos"}</td>
       </>}
       <td>{r.modalidade}</td>
        <td><em className={vincBadge} title={camposFaltantes.length?"Campos faltantes: "+camposFaltantes.join(", "):""}>{vincLabel}</em></td>
        <td><span className="actions">
          {page==="preceptores-internato"?<>
            <button title="Consultar preceptor" aria-label="Consultar preceptor" onClick={()=>setModal({mode:"detail",title:r.nome_completo,row:r,page})}><Eye/></button>
            <button title="Editar preceptor" aria-label="Editar preceptor" onClick={()=>setModal({mode:"form",title:`Editar: ${r.nome_completo}`,page,editId:r.id,editData:r})}><Pencil/></button>
            {!preceptorInativo&&<button title="Desativar preceptor" aria-label="Desativar preceptor" onClick={()=>handleInativarPreceptor(r)} style={{color:'var(--danger)'}}><ShieldOff/></button>}
            {preceptorInativo&&<button title="Reativar preceptor" aria-label="Reativar preceptor" onClick={()=>handleReativarPreceptor(r)} style={{color:'var(--success)'}}><Shield/></button>}
          </>:<>
            <button title="Consultar preceptor" aria-label="Consultar preceptor" onClick={()=>setModal({mode:"detail",title:r.nome_completo,row:r,page})}><Eye/></button>
            {!vCompleto&&!isInactive&&<button title="Completar cadastro" aria-label="Completar cadastro" onClick={()=>setModal({mode:"form",title:`Completar cadastro — ${r.nome_completo}`,page,editId:r.id,editData:r})}><AlertCircle/></button>}
            {vCompleto&&!isInactive&&<button title="Editar preceptor" aria-label="Editar preceptor" onClick={()=>setModal({mode:"form",title:`Editar: ${r.nome_completo}`,page,editId:r.id,editData:r})}><Pencil/></button>}
            {isInactive&&<button title="Editar preceptor" aria-label="Editar preceptor" onClick={()=>setModal({mode:"form",title:`Editar: ${r.nome_completo}`,page,editId:r.id,editData:r})}><Pencil/></button>}
            {r.vinculo_adm&&r.vinculo_status!==null&&
              (r.vinculo_status==="ativo"?
                <button title="Inativar vínculo" aria-label="Inativar vínculo" onClick={()=>handleToggleVinculo(r,r.vinculo_adm.id,"pratica")}><LogOut/></button>:
                <button title="Reativar vínculo" aria-label="Reativar vínculo" onClick={()=>handleToggleVinculo(r,r.vinculo_adm.id,"pratica")}><LogIn/></button>)}
          </>}
        </span></td>
       </tr>;
     })}</tbody>;
   }

  const[escalasFilter,setEscalasFilter]=useState("todos");
  const escalasFilteredRows=useMemo(()=>{
    if(page!=="escalas")return filteredRows;
    if(escalasFilter==="todos")return filteredRows;
    if(escalasFilter==="pratica")return filteredRows.filter(r=>r.tipo_atuacao==="adm");
    if(escalasFilter==="internato")return filteredRows.filter(r=>r.tipo_atuacao==="internato");
    if(escalasFilter==="sem_escala")return filteredRows.filter(r=>r.escala_status==="sem_escala");
    if(escalasFilter==="ativa")return filteredRows.filter(r=>r.escala_status==="ativa");
    if(escalasFilter==="inativa")return filteredRows.filter(r=>r.escala_status==="inativa");
    return filteredRows;
  },[filteredRows,escalasFilter,page]);

  const[presencasFilter,setPresencasFilter]=useState("todos");
  const presencasFilteredRows=useMemo(()=>{
    if(page!=="presencas")return filteredRows;
    if(presencasFilter==="todos")return filteredRows;
    return filteredRows.filter(r=>{
      const itens=Array.isArray(r.itens)?r.itens:[];
      if(presencasFilter==="manha")return itens.some(i=>i.turno==="manha");
      if(presencasFilter==="tarde")return itens.some(i=>i.turno==="tarde");
      if(presencasFilter==="noite")return itens.some(i=>i.turno==="noite");
      return true;
    });
  },[filteredRows,presencasFilter,page]);

  const[apurCompetencias,setApurCompetencias]=useState([]);
  const[apurCompetenciaId,setApurCompetenciaId]=useState("");
  const[apurFilter,setApurFilter]=useState("internato");

  const[apurResumo,setApurResumo]=useState({preceptores:0,turnos:0,valorTotal:0,pendencias:0});
  const[apurCalculando,setApurCalculando]=useState(false);
  const[apurDetalhe,setApurDetalhe]=useState(null);
  const[apurDetalheItens,setApurDetalheItens]=useState([]);
  const[apurFiltroMes,setApurFiltroMes]=useState("");
  const[apurFiltroAno,setApurFiltroAno]=useState("");
  const[apurDesatualizacao,setApurDesatualizacao]=useState(null);
  const[apurRevisoes,setApurRevisoes]=useState({});
  const[revisandoId,setRevisandoId]=useState(null);
  const[refazerFluxoModal,setRefazerFluxoModal]=useState(null);
  const[refazerFluxoPrevia,setRefazerFluxoPrevia]=useState(null);
  const[refazerFluxoEscopo,setRefazerFluxoEscopo]=useState("");
  const[refazerFluxoCarregando,setRefazerFluxoCarregando]=useState(false);
  const[refazerFluxoExecutando,setRefazerFluxoExecutando]=useState(false);
  const[refazerVinculoModal,setRefazerVinculoModal]=useState(null);
  const[refazerVinculoPrevia,setRefazerVinculoPrevia]=useState(null);
  const[refazerVinculoCarregando,setRefazerVinculoCarregando]=useState(false);
  const[refazerVinculoExecutando,setRefazerVinculoExecutando]=useState(false);
  const[excluirVinculoModal,setExcluirVinculoModal]=useState(null);
  const[excluirVinculoPrevia,setExcluirVinculoPrevia]=useState(null);
  const[excluirVinculoCarregando,setExcluirVinculoCarregando]=useState(false);
  const[excluirVinculoExecutando,setExcluirVinculoExecutando]=useState(false);
  const[excluirVinculoTexto,setExcluirVinculoTexto]=useState("");
  const[excluirPreceptorModal,setExcluirPreceptorModal]=useState(null);
  const[excluirPreceptorPrevia,setExcluirPreceptorPrevia]=useState(null);
  const[excluirPreceptorCarregando,setExcluirPreceptorCarregando]=useState(false);
  const[excluirPreceptorExecutando,setExcluirPreceptorExecutando]=useState(false);
  const[excluirPreceptorTexto,setExcluirPreceptorTexto]=useState("");
  const[gruposExpandidos,setGruposExpandidos]=useState({});

  // Filtros avançados para Apuração Mensal
  const[debouncedSearch,setDebouncedSearch]=useState(search);
  useEffect(()=>{
    const timer=setTimeout(()=>setDebouncedSearch(search),250);
    return ()=>clearTimeout(timer);
  },[search]);

  const[apurFiltroModalidade,setApurFiltroModalidade]=useState("todos");
  const[apurFiltroDisciplina,setApurFiltroDisciplina]=useState("todos");
  const[apurFiltroPeriodo,setApurFiltroPeriodo]=useState("todos");
  const[apurFiltroLocal,setApurFiltroLocal]=useState("todos");
  const[apurFiltroSetor,setApurFiltroSetor]=useState("todos");
  const[apurFiltroSituacao,setApurFiltroSituacao]=useState("todos");
  const[apurFiltroNecessitaRecalculo,setApurFiltroNecessitaRecalculo]=useState("todos");
  const[apurFiltrosPainelAberto,setApurFiltrosPainelAberto]=useState(false);

  const setVinculosDesatualizados=useMemo(()=>{
    const set=new Set();
    if(apurDesatualizacao?.vinculos_desatualizados){
      apurDesatualizacao.vinculos_desatualizados.forEach(d=>{
        if(d.vinculo_internato_id)set.add(d.vinculo_internato_id);
        if(d.vinculo_adm_id)set.add(d.vinculo_adm_id);
      });
    }
    return set;
  },[apurDesatualizacao]);

  const isAtuacaoRevisada = useCallback((r) => {
    if (!r || !r.id) return false;
    const desat = (r.vinculo_internato_id && setVinculosDesatualizados.has(r.vinculo_internato_id)) ||
                  (r.vinculo_adm_id && setVinculosDesatualizados.has(r.vinculo_adm_id));
    if (desat) return false;
    const rev = apurRevisoes[r.id];
    if (!rev || rev.status !== 'aprovado') return false;
    if (r.calculado_em && rev.decidido_em) {
      if (new Date(rev.decidido_em) < new Date(r.calculado_em)) return false;
    }
    return true;
  }, [apurRevisoes, setVinculosDesatualizados]);

  // Mesma regra de elegibilidade do clique de PDF/E-mail (sem exigir revisão).
  const avaliarElegibilidadeDemonstrativo = useCallback((vinculos) => {
    const lista = Array.isArray(vinculos) ? vinculos : [];
    if (lista.length === 0) {
      return { elegivel: false, precisaRecalcular: false, motivo: 'Nenhum cálculo válido para este preceptor nesta competência.' };
    }
    const impedidos = [];
    let temElegivel = false;
    let algumDesatualizado = false;
    for (const r of lista) {
      const desat = (r.vinculo_internato_id && setVinculosDesatualizados.has(r.vinculo_internato_id)) ||
                    (r.vinculo_adm_id && setVinculosDesatualizados.has(r.vinculo_adm_id));
      const rotulo = r.internato_nome || r.disciplina_nome || (r.modalidade === 'adm' ? 'Prática' : 'Internato');
      if (desat) {
        algumDesatualizado = true;
        impedidos.push(`Atuação "${rotulo}": cálculo desatualizado — necessário recalcular a competência.`);
        continue;
      }
      if (r.status !== 'calculado') {
        impedidos.push(`Atuação "${rotulo}": cálculo com status '${r.status || 'desconhecido'}'.`);
        continue;
      }
      if (r.total_bruto === null || r.total_bruto === undefined) {
        impedidos.push(`Atuação "${rotulo}": cálculo sem valor — necessário recalcular a competência.`);
        continue;
      }
      temElegivel = true;
    }
    if (temElegivel) return { elegivel: true, precisaRecalcular: algumDesatualizado, motivo: '' };
    return {
      elegivel: false,
      precisaRecalcular: algumDesatualizado,
      motivo: algumDesatualizado
        ? 'É necessário recalcular a competência: há cálculos desatualizados em relação às presenças. ' + impedidos.join(' ')
        : impedidos.join(' ') || 'Nenhum cálculo válido (calculado e atualizado) para gerar o demonstrativo ou preparar o e-mail.'
    };
  }, [setVinculosDesatualizados]);

  const apurOpcoesFiltros=useMemo(()=>{
    if(page!=="apuracao-mensal" && page!=="controle-financeiro"||!Array.isArray(rows)){
      return{disciplinas:[],periodos:[],locais:[],setores:[],situacoes:[]};
    }
    const disciplinas=new Set();
    const periodos=new Set();
    const locais=new Set();
    const setores=new Set();
    const situacoes=new Set();

    rows.forEach(r=>{
      const disc=r.internato_nome||r.disciplina_nome;
      if(disc)disciplinas.add(disc);
      if(r.periodo_nome)periodos.add(r.periodo_nome);
      if(r.local_nome)locais.add(r.local_nome);
      if(r.setor_nome)setores.add(r.setor_nome);

      const desat=(r.vinculo_internato_id&&setVinculosDesatualizados.has(r.vinculo_internato_id))||
                    (r.vinculo_adm_id&&setVinculosDesatualizados.has(r.vinculo_adm_id));
      let sit="Calculado";
      if(desat)sit="Necessita recálculo";
      else if(!r.regra_nome||r.regra_nome==="Regra financeira pendente")sit="Pendente";
      situacoes.add(sit);
    });

    return{
      disciplinas:Array.from(disciplinas).sort(),
      periodos:Array.from(periodos).sort(),
      locais:Array.from(locais).sort(),
      setores:Array.from(setores).sort(),
      situacoes:Array.from(situacoes).sort()
    };
  },[rows,page,setVinculosDesatualizados]);

  const rowsFiltradasApuracao=useMemo(()=>{
    if(page!=="apuracao-mensal" && page!=="controle-financeiro"||!Array.isArray(rows))return rows;

    const term=normalizeText(debouncedSearch);

    return rows.filter(r=>{
      if(term){
        const mNome=normalizeText(r.preceptor_nome).includes(term);
        const mDisc=normalizeText(r.internato_nome||r.disciplina_nome).includes(term);
        const mLocal=normalizeText(r.local_nome).includes(term);
        const mSetor=normalizeText(r.setor_nome).includes(term);
        if(!mNome&&!mDisc&&!mLocal&&!mSetor)return false;
      }

      if(apurFiltroModalidade!=="todos"){
        if(r.modalidade!==apurFiltroModalidade)return false;
      }

      if(apurFiltroDisciplina!=="todos"){
        const disc=r.internato_nome||r.disciplina_nome||"";
        if(disc!==apurFiltroDisciplina)return false;
      }

      if(apurFiltroPeriodo!=="todos"){
        if((r.periodo_nome||"")!==apurFiltroPeriodo)return false;
      }

      if(apurFiltroLocal!=="todos"){
        if((r.local_nome||"")!==apurFiltroLocal)return false;
      }

      if(apurFiltroSetor!=="todos"){
        if((r.setor_nome||"")!==apurFiltroSetor)return false;
      }

      const desat=(r.vinculo_internato_id&&setVinculosDesatualizados.has(r.vinculo_internato_id))||
                    (r.vinculo_adm_id&&setVinculosDesatualizados.has(r.vinculo_adm_id));
      let sit="Calculado";
      if(desat)sit="Necessita recálculo";
      else if(!r.regra_nome||r.regra_nome==="Regra financeira pendente")sit="Pendente";

      if(apurFiltroSituacao!=="todos"&&sit!==apurFiltroSituacao)return false;

      if(apurFiltroNecessitaRecalculo!=="todos"){
        if(apurFiltroNecessitaRecalculo==="sim"&&!desat)return false;
        if(apurFiltroNecessitaRecalculo==="nao"&&desat)return false;
      }

      return true;
    });
  },[
    rows,
    page,
    debouncedSearch,
    apurFiltroModalidade,
    apurFiltroDisciplina,
    apurFiltroPeriodo,
    apurFiltroLocal,
    apurFiltroSetor,
    apurFiltroSituacao,
    apurFiltroNecessitaRecalculo,
    setVinculosDesatualizados
  ]);

  // Mapa-base de grupos da competência (sem filtros rápidos/busca) para avaliar
  // elegibilidade e valores de forma estável quando os filtros da tela mudam.
  const pagLoteGruposBase=useMemo(()=>{
    const mapa={};
    (Array.isArray(rows)?rows:[]).forEach(r=>{
      const key=r.preceptor_id||r.id;
      if(!mapa[key])mapa[key]={preceptor_id:key,nome:r.preceptor_nome||"Preceptor",mes:r.mes,ano:r.ano,vinculos:[],totalGrupo:0};
      mapa[key].vinculos.push(r);
      mapa[key].totalGrupo+=Number(r.total_bruto||0);
    });
    return mapa;
  },[rows]);

  const gruposPorPreceptor=useMemo(()=>{
    const mapa={};
    rowsFiltradasApuracao.forEach(r=>{
      const key=r.preceptor_id||r.id;
      if(!mapa[key])mapa[key]={preceptor_id:key,nome:r.preceptor_nome||"Preceptor",modalidade:r.modalidade,mes:r.mes,ano:r.ano,data_inicio:r.data_inicio,data_fim:r.data_fim,vinculos:[],totalGrupo:0};
      mapa[key].vinculos.push(r);
      mapa[key].totalGrupo+=Number(r.total_bruto||0);
    });
    let lista=Object.values(mapa).sort((a,b)=>(a.nome||"").localeCompare(b.nome||""));
    if(page==="controle-financeiro"&&pagLoteFiltro!=="todos"){
      lista=lista.filter(g=>passaFiltroRapidoLote(g,pagLoteFiltro));
    }
    return lista;
  },[rowsFiltradasApuracao,page,pagLoteFiltro,pagLoteGruposBase,solicitacoesFiscais,apurFiltroMes,apurFiltroAno,setVinculosDesatualizados,apurDesatualizacao,isAtuacaoRevisada,avaliarElegibilidadeDemonstrativo]);

  // Paginação para Apuração Mensal (por grupos de preceptores)
  const[apurPaginaAtual,setApurPaginaAtual]=useState(1);
  const[apurItensPorPagina,setApurItensPorPagina]=useState(20);

  // Retornar à página 1 e fechar expansões ao alterar busca ou filtros
  useEffect(()=>{
    setApurPaginaAtual(1);
    setGruposExpandidos({});
  },[
    debouncedSearch,
    apurFiltroModalidade,
    apurFiltroDisciplina,
    apurFiltroPeriodo,
    apurFiltroLocal,
    apurFiltroSetor,
    apurFiltroSituacao,
    apurFiltroNecessitaRecalculo,
    apurFiltroMes,
    apurFiltroAno,
    apurItensPorPagina
  ]);

  const totalGruposApur=gruposPorPreceptor.length;
  const totalPaginasApur=Math.ceil(totalGruposApur/apurItensPorPagina)||1;
  const paginaValidaApur=Math.min(Math.max(1,apurPaginaAtual),totalPaginasApur);

  const gruposPaginados=useMemo(()=>{
    const inicio=(paginaValidaApur-1)*apurItensPorPagina;
    return gruposPorPreceptor.slice(inicio,inicio+apurItensPorPagina);
  },[gruposPorPreceptor,paginaValidaApur,apurItensPorPagina]);

  const pagLoteElegiveis=useMemo(()=>{
    return gruposPorPreceptor.filter(g=>!estadoLoteGrupoBase(g).bloqueioLote);
  },[gruposPorPreceptor,pagLoteGruposBase,solicitacoesFiscais,apurFiltroMes,apurFiltroAno,setVinculosDesatualizados,apurDesatualizacao,isAtuacaoRevisada,avaliarElegibilidadeDemonstrativo]);

  const pagLoteResumo=useMemo(()=>{
    let valor=0;
    pagLoteIds.forEach(id=>{
      const g=pagLoteGruposBase[id];
      if(g&&!estadoLoteGrupo(g).bloqueioLote)valor+=Number(g.totalGrupo||0);
    });
    return{qtd:pagLoteIds.size,valor};
  },[pagLoteIds,pagLoteGruposBase,solicitacoesFiscais,apurFiltroMes,apurFiltroAno,setVinculosDesatualizados,apurDesatualizacao,isAtuacaoRevisada,avaliarElegibilidadeDemonstrativo]);

  // Remove da seleção preceptores que deixaram de existir ou ficaram inelegíveis
  // (ex.: pagamento registrado, cálculo desatualizado ou e-mail ainda não enviado).
  useEffect(()=>{
    setPagLoteIds(prev=>{
      if(prev.size===0)return prev;
      let mudou=false;
      const proximo=new Set();
      prev.forEach(id=>{
        const g=pagLoteGruposBase[id];
        if(g&&!estadoLoteGrupo(g).bloqueioLote)proximo.add(id);
        else mudou=true;
      });
      return mudou?proximo:prev;
    });
  },[pagLoteGruposBase,solicitacoesFiscais,apurFiltroMes,apurFiltroAno,setVinculosDesatualizados,apurDesatualizacao,isAtuacaoRevisada,avaliarElegibilidadeDemonstrativo]);

  const vinculosPendentesPorPreceptor=useMemo(()=>{
    if(!apurDesatualizacao)return{};
    const map={};
    (apurDesatualizacao.vinculos_nao_calculados||[]).forEach(v=>{
      if(!map[v.preceptor_id])map[v.preceptor_id]=[];
      map[v.preceptor_id].push(v);
    });
    return map;
  },[apurDesatualizacao]);

  const periodoCompetencia=(comp)=>{
    if(!comp)return "Período não informado";
    const inicio=comp.data_inicio||`${comp.ano}-${String(comp.mes).padStart(2,"0")}-01`;
    const fim=comp.data_fim||`${comp.ano}-${String(comp.mes).padStart(2,"0")}-${String(new Date(comp.ano,comp.mes,0).getDate()).padStart(2,"0")}`;
    return `${fmtData(inicio)} a ${fmtData(fim)}`;
  };

  const apuracaoCacheKey=()=>{
    const now=new Date();
    return `apuracao:${apurFiltroAno||now.getFullYear()}:${apurFiltroMes||now.getMonth()+1}:${apurFilter}:${search.trim()}`;
  };

  const aplicarResumoApuracao=(data)=>{
    setApurResumo({
      preceptores:data.length,
      turnos:data.reduce((acc,r)=>acc+Number(r.quantidade_presencas||0),0),
      valorTotal:data.reduce((acc,r)=>acc+Number(r.total_bruto||0),0),
      pendencias:data.filter(r=>!r.regra_nome||r.regra_nome==="Regra financeira pendente"||(r.observacoes&&r.observacoes!=="Calculado")).length
    });
  };

  const consultarFilaExistente=useCallback(async()=>{
    await carregarSolicitacoesFiscais();
    const now=new Date();
    const filtros={mes:apurFiltroMes?parseInt(apurFiltroMes):now.getMonth()+1,ano:apurFiltroAno?parseInt(apurFiltroAno):now.getFullYear()};
    const data=await anexarCamposFilaFinanceira(await buscarFilaFinanceira(filtros));
    setRows(data);
    aplicarResumoApuracao(data);
    const ids=(data||[]).map(c=>c.id).filter(Boolean);
    if(ids.length>0){
      const revs=await fetchRevisoesCompetencia(ids);
      setApurRevisoes(revs);
    }else{
      setApurRevisoes({});
    }
    try{sessionStorage.setItem(apuracaoCacheKey(),JSON.stringify(data))}catch{}
    return data;
  },[apurFiltroMes,apurFiltroAno,carregarSolicitacoesFiscais]);

  function abrirControleFiltrado(nome, mes, ano) {
    setSearch(nome || "");
    if (mes) setApurFiltroMes(String(Number(mes)));
    if (ano) setApurFiltroAno(String(ano));
    setPage("controle-financeiro");
  }

  const verificarDesatualizacao=useCallback(async(mes,ano)=>{
    try{
      const resultado=await verificarDesatualizacaoCompetencia(mes,ano);
      setApurDesatualizacao(resultado);
    }catch(e){console.error("[verificarDesatualizacao]",e)}
  },[]);

  // Abrir, filtrar ou voltar à aba consulta somente cálculos existentes. Nunca recalcula.
  useEffect(()=>{
    if(page!=="apuracao-mensal" && page!=="controle-financeiro")return;
    try{
      const cached=JSON.parse(sessionStorage.getItem(apuracaoCacheKey())||"null");
      if(Array.isArray(cached)){
        setRows(cached);aplicarResumoApuracao(cached);
        anexarCamposFilaFinanceira(cached).then(normalizado=>{setRows(normalizado);aplicarResumoApuracao(normalizado)}).catch(()=>{});
      }
    }catch{}
    const now=new Date();
    const mes=apurFiltroMes?parseInt(apurFiltroMes):now.getMonth()+1;
    const ano=apurFiltroAno?parseInt(apurFiltroAno):now.getFullYear();
    const timer=setTimeout(()=>{
      consultarFilaExistente().catch(e=>console.error("[buscarFilaFinanceira]",e));
      verificarDesatualizacao(mes,ano);
    },250);
    return()=>clearTimeout(timer);
  },[page,consultarFilaExistente,verificarDesatualizacao,apurFiltroMes,apurFiltroAno]);

  // Recalcula somente quando uma presença realmente muda e apenas no mês afetado.
  useEffect(()=>{
    if(page!=="apuracao-mensal" && page!=="controle-financeiro")return;
    const channel=supabase.channel("apuracao-presencas-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"presencas"},async(payload)=>{
        const registro=payload.new&&Object.keys(payload.new).length?payload.new:payload.old;
        const data=registro?.data_presenca;
        if(!data)return;
        const [ano,mes]=String(data).split("-").map(Number);
        try{
          await autoApurarFilaFinanceira(mes,ano);
          await consultarFilaExistente();
          await verificarDesatualizacao(mes,ano);
        }catch(e){console.error("[apuracaoRealtime]",e)}
      }).subscribe();
    return()=>{supabase.removeChannel(channel)};
  },[page,consultarFilaExistente,verificarDesatualizacao]);

  useEffect(()=>{
    document.querySelectorAll(".tablewrap table").forEach(table=>{
      const labels=Array.from(table.querySelectorAll("thead th")).map(th=>th.textContent||"");
      table.querySelectorAll("tbody tr").forEach(tr=>{
        Array.from(tr.children).forEach((td,i)=>{if(labels[i])td.setAttribute("data-label",labels[i])});
      });
    });
  },[page,filteredRows,escalasFilter,loadingData]);

  function renderEscalasCards(){
    if(!escalasFilteredRows.length){
      return (
        <div className="empty">
          <FileSearch/>
          <b>Nenhum vínculo encontrado</b>
          {search.trim()&&<span> para "{search.trim()}"</span>}
          {Object.values(panelFilters).flat().length>0&&<small> Tente ajustar os filtros aplicados.</small>}
        </div>
      );
    }
    const groups={};
    escalasFilteredRows.forEach(r=>{
      const key=r.preceptor_id;
      if(!groups[key])groups[key]={preceptor_nome:r.preceptor_nome,profissao:r.profissao,vinculos:[]};
      groups[key].vinculos.push(r);
    });
    return (
      <div className="escalas-grupos">
        {Object.entries(groups).map(([pid,g])=>(
          <div key={pid} className="escalas-grupo">
            <div className="escalas-grupo__header">
              <div className="escalas-grupo__info">
                <UserRound size={16} className="escalas-grupo__icon"/>
                <div>
                  <span className="escalas-grupo__nome">{g.preceptor_nome}</span>
                  {g.profissao&&g.profissao!=="-"&&(
                    <span className="escalas-grupo__profissao">{g.profissao}</span>
                  )}
                </div>
              </div>
              <span className="escalas-grupo__count">
                {g.vinculos.length} {g.vinculos.length===1?"vínculo":"vínculos"}
              </span>
            </div>
            <div className="escalas-cards">
              {g.vinculos.map((r, idx)=>{
                const vinculoCompleto=r.vinculo_completo!==false;
                const camposFaltantes=r.vinculo_campos_faltantes||[];
                let badgeClass,badgeLabel;
                if(!vinculoCompleto){badgeClass="bad";badgeLabel="Vínculo incompleto";}
                else if(r.escala_status==="ativa"){badgeClass="ok";badgeLabel="Escala ativa";}
                else if(r.escala_status==="inativa"){badgeClass="neutral";badgeLabel="Escala inativa";}
                else{badgeClass="bad";badgeLabel="Sem escala";}
                const internato=r.tipo_atuacao==="adm"?r.disciplina_nome:r.internato_nome;
                return (
                  <div key={r.vinculo_id} className="escala-card">
                    <div className="escala-card__header">
                      <span className="escala-card__header-label">Vínculo {idx+1}</span>
                      <span className={`escala-card__header-badge ${badgeClass}`}>{badgeLabel}</span>
                    </div>
                    <div className="escala-card__body">
                      <div className="escala-card__row">
                        <span className="escala-card__field-label">Internato</span>
                        <span className="escala-card__field-value">{internato||"-"}</span>
                      </div>
                      {r.periodo_nome&&(
                        <div className="escala-card__row">
                          <span className="escala-card__field-label">Período</span>
                          <span className="escala-card__field-value">{r.periodo_nome}</span>
                        </div>
                      )}
                      {r.unidade_nome&&r.unidade_nome!=="-"&&(
                        <div className="escala-card__row">
                          <span className="escala-card__field-label">Unidade</span>
                          <span className="escala-card__field-value">{r.unidade_nome}</span>
                        </div>
                      )}
                      {r.local_nome&&(
                        <div className="escala-card__row">
                          <span className="escala-card__field-label">Local</span>
                          <span className="escala-card__field-value">{r.local_nome}</span>
                        </div>
                      )}
                      {r.setor_nome&&(
                        <div className="escala-card__row">
                          <span className="escala-card__field-label">Setor</span>
                          <span className="escala-card__field-value">{r.setor_nome}</span>
                        </div>
                      )}
                      <div className="escala-card__row">
                        <span className="escala-card__field-label">Situação</span>
                        <em
                          className={badgeClass+" escala-card__badge"}
                          title={!vinculoCompleto&&camposFaltantes.length?`Campos faltantes: ${camposFaltantes.join(", ")}`:""}
                        >
                          {badgeLabel}
                        </em>
                      </div>
                    </div>
                    <div className="escala-card__actions">
                      {!vinculoCompleto&&(
                        <button
                          className="escala-card__btn escala-card__btn--warn"
                          onClick={()=>setModal({mode:"escala-incompleta",title:"Vínculo incompleto",row:r,page})}
                        >
                          <AlertCircle size={14}/> Completar cadastro
                        </button>
                      )}
                      {r.escala_status==="sem_escala"&&vinculoCompleto&&(
                        <button
                          className="escala-card__btn escala-card__btn--primary"
                          onClick={()=>handleCriarEscala(r)}
                        >
                          <CalendarPlus size={14}/> Criar escala
                        </button>
                      )}
                      {r.escala_status!=="sem_escala"&&vinculoCompleto&&(
                        <>
                          <button
                            className="escala-card__btn escala-card__btn--secondary"
                            onClick={()=>handleVerEscalas(r)}
                          >
                            <Eye size={14}/> Ver escala
                          </button>
                          <button
                            className="escala-card__btn escala-card__btn--secondary"
                            onClick={()=>handleEditEscalaFromVinculo(r)}
                          >
                            <Pencil size={14}/> Editar escala
                          </button>
                          {r.escala_status==="ativa"
                            ?<button
                                className="escala-card__btn escala-card__btn--danger"
                                onClick={()=>handleToggleTodasEscalas(r,false)}
                              >
                                <LogOut size={14}/> Inativar
                              </button>
                            :<button
                                className="escala-card__btn escala-card__btn--success"
                                onClick={()=>handleToggleTodasEscalas(r,true)}
                              >
                                <LogIn size={14}/> Reativar
                              </button>
                          }
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderPresencasTable(){
    return <tbody>{presencasFilteredRows.map((r)=>{
      const key=[r.preceptor_id,r.tipo_atuacao,r.competencia,r.unidade_id,r.local_id].filter(Boolean).join('-');
      const itens=Array.isArray(r.itens)?r.itens:[];
      const turnos=itens.map(i=>i.turno).filter((v,i,a)=>a.indexOf(v)===i);
      return <tr key={key}>
        <td><b>{r.preceptor_nome||'-'}</b><br/><small style={{color:'var(--text-muted)'}}>{r.competencia_label||r.competencia}</small></td>
        <td>{r.local_nome||'-'}</td>
        <td>{r.setor_nome||'-'}</td>
        <td>{r.unidade_nome&&r.unidade_nome!=='-'?r.unidade_nome:'-'}</td>
        <td>{turnos.map(t=><span key={t} className={"pres-turno-badge pres-turno-"+t}>{t==="manha"?"Manhã":t==="tarde"?"Tarde":"Noite"}</span>)}</td>
        <td><b style={{fontSize:16}}>{r.total_turnos||0}</b> <small style={{color:'var(--text-muted)'}}>turno{(r.total_turnos||0)!==1?'s':''}</small></td>
        <td><span className="actions">
          <button className="pres-folha-btn" onClick={()=>setModal({mode:"folha-presenca",title:`Folha de Presença — ${r.preceptor_nome}`,row:r})}><Eye size={15}/> Folha</button>
        </span></td>
      </tr>;
    })}</tbody>;
  }

  function renderPresencasCards(){
    if(!presencasFilteredRows.length){
      return <div className="empty"><FileSearch/><b>Nenhuma presença encontrada</b>{search.trim()&&<span> para "{search.trim()}"</span>}{Object.values(panelFilters).flat().length>0&&<small> Tente ajustar os filtros aplicados.</small>}</div>;
    }
    return <div className="pres-card-list">
      {presencasFilteredRows.map(r=>{
        const key=[r.preceptor_id,r.tipo_atuacao,r.competencia,r.unidade_id,r.local_id].filter(Boolean).join('-');
        const itens=Array.isArray(r.itens)?r.itens:[];
        const turnos=itens.map(i=>i.turno).filter((v,i,a)=>a.indexOf(v)===i);
        return <div key={key} className="pres-card">
          <div className="pres-card__header">
            <b className="pres-card__nome">{r.preceptor_nome||'-'}</b>
            <span className="pres-card__comp">{r.competencia_label||r.competencia}</span>
          </div>
          <div className="pres-card__body">
            {r.local_nome&&r.local_nome!=='-'&&<div className="pres-card__row"><span className="pres-card__label">Local</span><span className="pres-card__value">{r.local_nome}</span></div>}
            {r.unidade_nome&&r.unidade_nome!=='-'&&<div className="pres-card__row"><span className="pres-card__label">Unidade</span><span className="pres-card__value">{r.unidade_nome}</span></div>}
            {r.setor_nome&&<div className="pres-card__row"><span className="pres-card__label">Setor</span><span className="pres-card__value">{r.setor_nome}</span></div>}
            <div className="pres-card__row"><span className="pres-card__label">Turnos</span><span className="pres-card__value"><b>{r.total_turnos||0}</b> turno{(r.total_turnos||0)!==1?'s':''}</span></div>
            {turnos.length>0&&<div className="pres-card__row"><span className="pres-card__label">Previstos</span><span className="pres-card__turnos">{turnos.map(t=><span key={t} className={"pres-turno-badge pres-turno-"+t}>{t==="manha"?"Manhã":t==="tarde"?"Tarde":"Noite"}</span>)}</span></div>}
          </div>
          <div className="pres-card__actions">
            <button className="pres-card__btn" onClick={()=>setModal({mode:"folha-presenca",title:`Folha de Presença — ${r.preceptor_nome}`,row:r})}><Eye size={15}/> Folha de presença</button>
          </div>
        </div>;
      })}
    </div>;
  }

  function renderRegrasTable(){
    return <tbody>{filteredRows.map(r=>{
      const isAtivo = r.status === 'ativo';
      const componentes = Array.isArray(r.componentes) ? r.componentes : [];
      return <tr key={r.id}>
        <td>
          <b>{r.nome}</b>
          {r.preceptor && (
            <div style={{ fontSize: 11, color: 'var(--gold-500,#b8930a)', fontWeight: 600, marginTop: 2 }}>
              ★ Exceção: {r.preceptor.nome_completo}
            </div>
          )}
        </td>
        <td>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div>
              <em className={r.tipo_atuacao === 'adm' ? 'ok' : 'neutral'}>
                {r.tipo_atuacao === 'adm' ? 'Prática' : 'Internato'}
              </em>
              {r.unidade?.nome && <span className="ficha-tag" style={{ marginLeft: 6 }}>{r.unidade.nome}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {[
                r.tipo_atuacao === 'internato' ? r.internato?.nome : null,
                r.disciplina?.nome,
                r.local?.nome,
                r.setor?.nome
              ].filter(Boolean).join(' • ') || 'Escopo geral'}
            </div>
          </div>
        </td>
        <td>
          <div className="presencas-itens-list">
            {componentes.map((c, i) => (
              <span key={c.id || i} className="presenca-item-pill">
                {c.descricao}: <b>{c.valor != null ? formatCurrencyBRL(c.valor) : 'Sem valor'}</b>
              </span>
            ))}
            {!componentes.length && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nenhum componente</span>}
          </div>
        </td>
        <td>
          <div style={{ fontSize: 13 }}>
            {fmtData(r.data_inicio)} {r.data_fim ? `até ${fmtData(r.data_fim)}` : '(vigente)'}
          </div>
        </td>
        <td>
          <em className={statusBadge(r.status)}>
            {isAtivo ? 'Ativa' : 'Inativa'}
          </em>
        </td>
        <td>
          <span className="actions">
            <button title="Visualizar regra" onClick={() => setModal({ mode: 'regra-detail', title: r.nome, row: r })}>
              <Eye size={16} />
            </button>
            <button title="Editar regra" onClick={() => setModal({ mode: 'regra-edit', title: `Editar: ${r.nome}`, row: r })}>
              <Pencil size={16} />
            </button>
            {isAtivo ? (
              <button title="Inativar regra" onClick={async () => {
                if (!await systemConfirm(`Inativar a regra "${r.nome}"?`,`Inativar regra financeira`)) return;
                try { await inativarRegraFinanceira(r.id); notify('Regra inativada com sucesso!'); loadPage(); }
                catch (e) { notify('Erro: ' + e.message, 'error'); }
              }}>
                <LogOut size={16} />
              </button>
            ) : (
              <button title="Reativar regra" onClick={async () => {
                try { await reativarRegraFinanceira(r); notify('Regra reativada com sucesso!'); loadPage(); }
                catch (e) { notify(e.message, 'error'); }
              }}>
                <LogIn size={16} />
              </button>
            )}
          </span>
        </td>
      </tr>;
    })}</tbody>;
  }

  function renderAuditTable(){
    return <tbody>{filteredRows.map(r=><tr key={r.id}>
      <td>{fmtTimestamp(r.ocorrido_em)}</td><td>{r.user_id?"-":"-"}</td>
      <td>{r.operacao}</td><td>{r.tabela}</td>
      <td>{r.registro_id||"-"}</td><td>{r.dados_novos?"Alteração":"-"}</td>
      <td></td>
    </tr>)}</tbody>;
  }

  function renderConfigTable(){
    return <tbody>{filteredRows.map(r=><tr key={r.chave}>
      <td>{r.chave}</td><td>{typeof r.valor==="object"?JSON.stringify(r.valor):String(r.valor)}</td>
      <td>{r.descricao||"-"}</td><td>-</td><td>-</td>
      <td><em className="ok">Ativo</em></td><td></td>
    </tr>)}</tbody>;
  }

  function renderUsuariosTable(){
    return <tbody>{filteredRows.map((r,i)=>{
      const roles=Array.isArray(r.roles)?r.roles:[];
      const isSelf=r.user_id===session?.user?.id;
      return<tr key={r.profile_id||i}>
        <td>{r.nome_completo||"-"}{isSelf&&<span style={{fontSize:10,marginLeft:4,color:"#94a3b8"}}>(você)</span>}</td>
        <td>{r.email||"-"}</td>
        <td>{roles.map(rol=>{const label=ROLE_LABELS[rol]||rol;return<span key={rol} className="user-role-badge">{label}</span>})}</td>
        <td><em className={r.ativo?(r.primeiro_acesso_pendente?"warn":"ok"):"bad"}>
          {r.ativo?(r.primeiro_acesso_pendente?"Pendente":"Ativo"):(r.motivo_bloqueio_inativacao?"Bloqueado":"Inativo")}
        </em></td>
        <td>{r.primeiro_acesso_pendente&&<span className="user-role-badge" style={{background:"#fef3c7",color:"#92400e"}}>Primeiro acesso</span>}
          {r.ultimo_acesso?fmtTimestamp(r.ultimo_acesso):"Nunca"}
        </td>
        <td><span className="actions">
          <button onClick={()=>setModal({mode:"user-view",title:`Visualizar: ${r.nome_completo}`,user:r})} title="Visualizar"><Eye/></button>
          <button onClick={()=>setModal({mode:"user-edit",title:`Editar: ${r.nome_completo}`,user:r})} title="Editar"><Pencil/></button>
          {!isSelf&&<button onClick={async()=>{
            if(!await systemConfirm(r.ativo?`Bloquear ${r.nome_completo}?`:`Desbloquear ${r.nome_completo}?`,r.ativo?"Bloquear usuário":"Desbloquear usuário"))return;
            try{await bloquearUsuario(r.profile_id,r.ativo);notify(r.ativo?"Usuário bloqueado!":"Usuário desbloqueado!");loadPage();}
            catch(e){notify("Erro: "+e.message,"error");}
          }} title={r.ativo?"Bloquear":"Desbloquear"}>{r.ativo?<ShieldOff size={16}/>:<Shield size={16}/>}</button>}
          {!isSelf&&r.ativo&&<button onClick={async()=>{
            if(!await systemConfirm(`Esta acao removera definitivamente o usuario "${r.nome_completo}" (${r.email}) do sistema e nao podera ser desfeita.\n\nTodos os acessos e permissoes serao revogados imediatamente.`,"Deletar usuario",{danger:true,confirmLabel:"Deletar definitivamente",busyLabel:"Excluindo usuario..."}))return;
            try{await deletarUsuarioViaEdge(r.profile_id);notify("Usuario deletado com sucesso!");loadPage();}
            catch(e){notify("Erro: "+e.message,"error");}
          }} title="Deletar usuario"><Trash2 size={16}/></button>}
          {!isSelf&&!r.ativo&&<button onClick={async()=>{
            if(!await systemConfirm(`Reativar o usuario ${r.nome_completo}? O usuario voltara a aparecer na lista ativa.`,"Reativar usuario"))return;
            try{await inativarReativarUsuario(r.profile_id,false);notify("Usuario reativado com sucesso!");loadPage();}
            catch(e){notify("Erro: "+e.message,"error");}
          }} title="Reativar"><RotateCw size={16}/></button>}
          {!isSelf&&<button onClick={async()=>{
            if(!await systemConfirm(`Redefinir acesso de ${r.nome_completo}?\nO usuario precisara criar uma nova senha no proximo login.`,"Redefinir acesso",{danger:true}))return;
            try{await redefinirAcessoViaEdge(r.profile_id);notify("Acesso redefinido! Senha temporaria: ser@2026");loadPage();}
            catch(e){notify("Erro: "+e.message,"error");}
          }} title="Redefinir acesso"><RotateCw size={16}/></button>}
        </span></td>
      </tr>;
    })}</tbody>;
  }

  async function handleCalcularCompetencia(mesOverride,anoOverride){
    setApurCalculando(true);
    try{
      const now=new Date();
      const mes=Number(mesOverride||apurFiltroMes||now.getMonth()+1);
      const ano=Number(anoOverride||apurFiltroAno||now.getFullYear());
      await autoApurarFilaFinanceira(mes,ano);
      await consultarFilaExistente();
      await verificarDesatualizacao(mes,ano);
      notify("Cálculo atualizado com sucesso!");
    }catch(e){notify(e.message||"Erro ao atualizar cálculo.","error")}
    setApurCalculando(false);
  }

  async function handleVerDetalhesCalculo(calcId){
    try{
      const{calculo,itens,presencas,vinculoContexto,regra,vinculoRegra,notaSituacao,revisao}=await fetchDetalhesCalculoCompleto(calcId);
      setApurDetalhe(calculo);
      setApurDetalheItens(itens);
      setModal({mode:"apuracao-detalhe",title:"Detalhes do cálculo",presencas,vinculoContexto,regra,vinculoRegra,notaSituacao,revisao});
    }catch(e){notify(e.message||"Erro ao carregar detalhes.","error")}
  }

  async function handleMarcarRevisado(calculoId){
    if(!isAdmin){notify("Apenas usuários Admin podem revisar cálculos.","error");return}
    const confirmado=await systemConfirm(
      "Confirme que as presenças, a regra aplicada e o valor calculado foram conferidos.",
      "Marcar como revisado",
      {confirmLabel:"Confirmar revisão",cancelLabel:"Cancelar",icon:<ClipboardCheck size={18}/>}
    );
    if(!confirmado)return;
    setRevisandoId(calculoId);
    try{
      await salvarRevisaoFinanceira(calculoId,session?.user?.id);
      notify("Atuação revisada com sucesso!");
      await consultarFilaExistente();
      const{calculo,itens,presencas,vinculoContexto,regra,vinculoRegra,notaSituacao,revisao}=await fetchDetalhesCalculoCompleto(calculoId);
      setApurDetalhe(calculo);
      setApurDetalheItens(itens);
      setModal({mode:"apuracao-detalhe",title:"Detalhes do cálculo",presencas,vinculoContexto,regra,vinculoRegra,notaSituacao,revisao});
    }catch(e){
      notify(e.message||"Erro ao salvar revisão.","error");
    }
    setRevisandoId(null);
  }

  async function handleAbrirRefazerFluxo(grupo){
    const now=new Date();
    const mes=Number(apurFiltroMes||now.getMonth()+1);
    const ano=Number(apurFiltroAno||now.getFullYear());
    const competenciaId=rows[0]?.competencia_id;
    if(!competenciaId){notify("Competência não encontrada.","error");return}
    const solFluxo=situacaoFiscalDoGrupo(grupo);
    if(solFluxo?.situacao==='pago'){notify("Não é possível refazer o fluxo: pagamento já registrado para este preceptor nesta competência.","error");return}
    setRefazerFluxoModal({grupo,competenciaId,mes,ano});
    setRefazerFluxoPrevia(null);
    setRefazerFluxoEscopo("");
    setRefazerFluxoCarregando(true);
    try{
      const previa=await previaRefazerFluxo(competenciaId,grupo.preceptor_id);
      setRefazerFluxoPrevia(previa);
    }catch(e){notify(e.message||"Erro ao buscar prévia.","error");setRefazerFluxoModal(null)}
    setRefazerFluxoCarregando(false);
  }

  async function handleExecutarRefazerFluxo(){
    if(!refazerFluxoModal||!refazerFluxoPrevia)return;
    const{grupo,competenciaId}=refazerFluxoModal;
    setRefazerFluxoExecutando(true);
    try{
      await refazerFluxoCompetencia(competenciaId,grupo.preceptor_id,null,null,null,true);
      setRefazerFluxoModal(null);
      setRefazerFluxoPrevia(null);
      setRefazerFluxoEscopo("");
      notify("Fluxo reiniciado. O cadastro foi preservado e o processo pode ser refeito pela Escala.");
      const now=new Date();
      const mes=Number(apurFiltroMes||now.getMonth()+1);
      const ano=Number(apurFiltroAno||now.getFullYear());
      await consultarFilaExistente();
      await verificarDesatualizacao(mes,ano);
      setPage("escalas");
    }catch(e){
      notify(e.message||"Erro ao refazer fluxo.","error");
    }
    setRefazerFluxoExecutando(false);
  }

  async function handleMarcarEmailEnviado(grupo) {
    if (!grupo || !grupo.preceptor_id) return;
    if (solicitacaoNotaLoading || emailEnvioEmAndamento.current) return;
    emailEnvioEmAndamento.current = true;
    const now = new Date();
    const mes = Number(apurFiltroMes || now.getMonth() + 1);
    const ano = Number(apurFiltroAno || now.getFullYear());
    const competenciaStr = `${ano}-${String(mes).padStart(2, '0')}`;
    const competenciaId = grupo.vinculos[0]?.competencia_id || rows[0]?.competencia_id;

    let confirmado = false;
    try {
      confirmado = await systemConfirm(
        `Confirmar registro de e-mail enviado para "${grupo.nome}"?`,
        "Marcar E-mail Enviado",
        { confirmLabel: "Confirmar envio", icon: <Send size={16} /> }
      );
    } catch (dlgErr) {
      emailEnvioEmAndamento.current = false;
      return;
    }
    if (!confirmado) {
      emailEnvioEmAndamento.current = false;
      return;
    }

    setSolicitacaoNotaLoading(true);
    try {
      const calculoIds = grupo.vinculos.map(v => v.id).filter(Boolean);
      const dados = await montarDadosDemonstrativoFinanceiro(grupo.preceptor_id, competenciaId);

      await prepararSolicitacaoNotaUnificada({
        preceptorId: grupo.preceptor_id,
        competencia: competenciaStr,
        calculoIds,
        valorTotal: grupo.totalGrupo,
        situacao: 'preparada',
        identificacaoFiscal: dados?.identificacaoFiscal || {},
        emailUsado: grupo.email
      });

      const solList = await fetchSolicitacoesNotaFiscal({ preceptorId: grupo.preceptor_id, competencia: competenciaStr });
      if (!solList?.[0]?.id) {
        throw new Error('Solicitação de nota fiscal não encontrada após a preparação. Tente novamente.');
      }
      await confirmarEnvioSolicitacaoNota(solList[0].id);

      notify("E-mail marcado como enviado com sucesso!");
    } catch (e) {
      notify(mensagemErroAmigavel(e, "Não foi possível marcar o e-mail como enviado. Tente novamente."), "error");
    } finally {
      try { await consultarFilaExistente(); }
      catch (refErr) { console.warn("[controle-financeiro] Atualização pós-ação:", refErr); }
      setSolicitacaoNotaLoading(false);
      emailEnvioEmAndamento.current = false;
    }
  }

  async function handleCorrigirEmailEnviado(grupo) {
    if (!grupo || !grupo.preceptor_id) return;
    if (solicitacaoNotaLoading) return;
    const now = new Date();
    const mes = Number(apurFiltroMes || now.getMonth() + 1);
    const ano = Number(apurFiltroAno || now.getFullYear());
    const competenciaStr = `${ano}-${String(mes).padStart(2, '0')}`;

    const motivo = prompt("Motivo da correção do envio de e-mail:");
    if (!motivo || motivo.trim().length < 3) return;

    const sol = situacaoFiscalDoGrupo(grupo);
    if (!sol?.id) {
      notify("Solicitação de nota fiscal não encontrada.", "error");
      return;
    }

    setSolicitacaoNotaLoading(true);
    try {
      await corrigirConfirmacaoEnvioNota(sol.id, motivo, currentProfileId);
      notify("Status de e-mail corrigido administrativamente!");
    } catch (e) {
      notify(mensagemErroAmigavel(e, "Erro ao corrigir confirmação de envio."), "error");
    } finally {
      try { await consultarFilaExistente(); }
      catch (refErr) { console.warn("[controle-financeiro] Atualização pós-ação:", refErr); }
      setSolicitacaoNotaLoading(false);
    }
  }

  async function handleMarcarPagoModal(grupo) {
    if (!grupo || !grupo.preceptor_id) return;
    if (solicitacaoNotaLoading) return;
    const now = new Date();
    const mes = Number(apurFiltroMes || now.getMonth() + 1);
    const ano = Number(apurFiltroAno || now.getFullYear());
    const competenciaStr = `${ano}-${String(mes).padStart(2, '0')}`;
    const competenciaId = grupo.vinculos[0]?.competencia_id || rows[0]?.competencia_id;

    let sol = situacaoFiscalDoGrupo(grupo);
    const pag = sol ? pagamentosFiscais.find(p => p.solicitacao_id === sol.id) : null;

    if (sol?.situacao === 'pago' || pag?.status === 'pago') {
      notify("Pagamento já realizado para este preceptor nesta competência.", "error");
      return;
    }

    setModal({
      mode: "marcar-pago",
      title: `Marcar como pago — ${grupo.nome}`,
      grupo,
      sol,
      pag,
      competencia: competenciaStr,
      dataPagamento: new Date().toISOString().slice(0, 10),
      valorPago: String(sol?.valor_nota_informado || sol?.valor_total_solicitado || grupo.totalGrupo || ""),
      observacao: ""
    });
  }

  async function handleExecutarMarcarPago(modalData) {
    if (solicitacaoNotaLoading) return;
    const { grupo, sol, valorPago, observacao, dataPagamento } = modalData;
    const val = Number(valorPago);
    if (!val || val <= 0) {
      notify("Informe um valor de pagamento válido.", "error");
      return;
    }
    const now = new Date();
    const mes = Number(apurFiltroMes || now.getMonth() + 1);
    const ano = Number(apurFiltroAno || now.getFullYear());
    const competenciaStr = `${ano}-${String(mes).padStart(2, '0')}`;
    const competenciaId = grupo.vinculos[0]?.competencia_id || rows[0]?.competencia_id;

    setSolicitacaoNotaLoading(true);
    try {
      let solId = sol?.id;
      let solSituacao = sol?.situacao || null;
      if (!solId) {
        const calculoIds = grupo.vinculos.map(v => v.id).filter(Boolean);
        const dados = await montarDadosDemonstrativoFinanceiro(grupo.preceptor_id, competenciaId);
        const res = await prepararSolicitacaoNotaUnificada({
          preceptorId: grupo.preceptor_id,
          competencia: competenciaStr,
          calculoIds,
          valorTotal: grupo.totalGrupo,
          situacao: 'solicitada',
          identificacaoFiscal: dados?.identificacaoFiscal || {},
          emailUsado: grupo.email
        });
        solId = res?.id;
        solSituacao = 'solicitada';
      }
      if (!solId) throw new Error('Solicitação de nota fiscal não encontrada para esta competência.');

      if (solSituacao && solSituacao !== 'nota_recebida' && solSituacao !== 'em_pagamento' && solSituacao !== 'pago') {
        if (solSituacao !== 'solicitada') {
          throw new Error('Marque o e-mail como enviado antes de registrar o pagamento.');
        }
        await registrarRecebimentoNotaFiscal({
          solicitacaoId: solId,
          profileId: currentProfileId,
          numeroNota: '',
          dataRecebimento: dataPagamento || new Date().toISOString().slice(0, 10),
          valorInformado: Number(sol?.valor_total_solicitado || grupo.totalGrupo || 0),
          observacao: 'Conclusão automática no fluxo simplificado (sem etapa de nota fiscal).',
          divergencia: true,
          motivoDivergencia: 'Valor registrado automaticamente a partir do valor solicitado.'
        });
      }

      let registradoViaFluxoAtual = false;
      try {
        let pRecord = modalData.pag || null;
        if (!pRecord) {
          try { pRecord = await buscarPagamentoPorSolicitacao(solId); }
          catch (lookupErr) { console.warn('[controle-financeiro] Consulta de pagamento anterior indisponível:', lookupErr); }
        }
        if (!pRecord) {
          pRecord = await iniciarPagamento({
            solicitacaoId: solId,
            divergenciaAutorizada: true,
            motivoDivergencia: "Aprovação direta de pagamento no Controle Financeiro",
            observacao: observacao || "Iniciado e concluído via Controle Financeiro"
          });
        }
        const pagId = pRecord?.id || pRecord?.pagamento_id;
        await concluirPagamento({
          pagamentoId: pagId,
          valorPago: val,
          observacao: observacao || "Pagamento concluído no Controle Financeiro"
        });
        registradoViaFluxoAtual = true;
      } catch (fluxoErr) {
        console.warn('[controle-financeiro] Fluxo RPC de pagamento indisponível; registrando diretamente:', fluxoErr);
      }

      if (!registradoViaFluxoAtual) {
        await registrarPagamentoDireto({
          solicitacaoId: solId,
          valorPago: val,
          dataPagamento: dataPagamento || null,
          observacao: observacao || '',
          profileId: session?.user?.id
        });
      }

      notify("Pagamento registrado com sucesso!");
      setModal(null);
    } catch (e) {
      console.warn('[controle-financeiro] Falha ao registrar pagamento:', e);
      notify("Não foi possível registrar o pagamento. O registro anterior foi mantido; tente novamente.", "error");
    } finally {
      try { await consultarFilaExistente(); }
      catch (refErr) { console.warn("[controle-financeiro] Atualização pós-ação:", refErr); }
      setSolicitacaoNotaLoading(false);
    }
  }

  function alternarModoSelecaoLote() {
    if (!pagLoteModo) {
      if (page !== "controle-financeiro") return;
      if (!isAdmin) {
        notify("Apenas Administradores podem marcar pagamentos em lote.", "error");
        return;
      }
      setPagLoteModo(true);
      return;
    }
    setPagLoteModo(false);
    setPagLoteIds(new Set());
  }

  function alternarSelecaoLote(preceptorId) {
    setPagLoteIds(prev => {
      const proximo = new Set(prev);
      if (proximo.has(preceptorId)) proximo.delete(preceptorId);
      else proximo.add(preceptorId);
      return proximo;
    });
  }

  function selecionarLotePagina() {
    const elegiveis = gruposPaginados.filter(g => !estadoLoteGrupoBase(g).bloqueioLote).map(g => g.preceptor_id);
    if (elegiveis.length === 0) {
      notify("Nenhum preceptor elegível nesta página.", "error");
      return;
    }
    setPagLoteIds(prev => {
      const proximo = new Set(prev);
      elegiveis.forEach(id => proximo.add(id));
      return proximo;
    });
  }

  function selecionarLoteTodosFiltrados() {
    const elegiveis = pagLoteElegiveis.map(g => g.preceptor_id);
    if (elegiveis.length === 0) {
      notify("Nenhum preceptor elegível com os filtros aplicados.", "error");
      return;
    }
    setPagLoteIds(prev => {
      const proximo = new Set(prev);
      elegiveis.forEach(id => proximo.add(id));
      return proximo;
    });
  }

  function limparSelecaoLote() {
    setPagLoteIds(new Set());
  }

  function abrirModalPagamentoLote() {
    if (pagLoteExecutando || solicitacaoNotaLoading) return;
    if (pagLoteResumo.qtd === 0) {
      notify("Selecione ao menos um preceptor elegível.", "error");
      return;
    }
    const now = new Date();
    const mes = Number(apurFiltroMes || now.getMonth() + 1);
    const ano = Number(apurFiltroAno || now.getFullYear());
    const ids = Array.from(pagLoteIds);
    const primeiroGrupo = pagLoteGruposBase[ids[0]];
    const competenciaId = primeiroGrupo?.vinculos?.[0]?.competencia_id || rows[0]?.competencia_id;

    if (!competenciaId) {
      notify("Competência não encontrada para os preceptores selecionados.", "error");
      return;
    }

    const dadosModal = {
      mode: "pag-lote",
      title: `Pagamento em lote — ${apuracaoMesLabel(mes, ano)}`,
      competencia: `${ano}-${String(mes).padStart(2, '0')}`,
      competenciaLabel: apuracaoMesLabel(mes, ano),
      competenciaId,
      preceptorIds: ids,
      qtdSelecionada: ids.length,
      valorTela: pagLoteResumo.valor,
      dataPagamento: new Date().toISOString().slice(0, 10),
      observacao: "",
      previa: null,
      previaCarregando: true,
      previaErro: null
    };
    setModal(dadosModal);
    carregarPreviaPagamentoLote(dadosModal);
  }

  async function carregarPreviaPagamentoLote(dadosModal) {
    try {
      const previa = await previaPagamentoLote(dadosModal.competenciaId, dadosModal.preceptorIds);
      setModal(m => (m && m.mode === "pag-lote" ? { ...m, previa, previaCarregando: false, previaErro: null } : m));
    } catch (e) {
      console.warn("[controle-financeiro] Prévia de pagamento em lote indisponível:", e);
      setModal(m => (m && m.mode === "pag-lote"
        ? { ...m, previaCarregando: false, previaErro: mensagemErroAmigavel(e, "Não foi possível carregar a prévia de pagamento. Tente novamente.") }
        : m));
    }
  }

  async function handleExecutarPagamentoLote(modalData) {
    if (solicitacaoNotaLoading || pagLoteExecutando) return;
    const { competenciaId, preceptorIds, dataPagamento, observacao, valorTela } = modalData;
    if (!Array.isArray(preceptorIds) || preceptorIds.length === 0) {
      notify("Nenhum preceptor selecionado.", "error");
      return;
    }
    if (!dataPagamento) {
      notify("Informe a data do pagamento.", "error");
      return;
    }

    setSolicitacaoNotaLoading(true);
    setPagLoteExecutando(true);
    try {
      // Prévia obrigatória imediatamente antes da confirmação.
      const previa = await previaPagamentoLote(competenciaId, preceptorIds);
      const validos = Array.isArray(previa?.validos) ? previa.validos : [];
      const bloqueios = Array.isArray(previa?.bloqueios) ? previa.bloqueios : [];
      const idsPrevistos = new Set([...validos, ...bloqueios].map(v => v.preceptor_id).filter(Boolean));
      const mesmoConjunto = idsPrevistos.size === preceptorIds.length && preceptorIds.every(id => idsPrevistos.has(id));
      const competenciaOk = !!previa?.competencia?.id && previa.competencia.id === competenciaId;
      const qtdBloqueada = Number(previa?.resumo?.qtd_bloqueada || 0);
      const valorValido = Number(previa?.resumo?.valor_total_valido || 0);

      if (!mesmoConjunto || !competenciaOk) {
        setModal(m => (m && m.mode === "pag-lote" ? { ...m, previa, previaCarregando: false } : m));
        notify("A seleção da tela divergiu da prévia do banco. Nenhum pagamento foi registrado. Atualize a tela e tente novamente.", "error");
        return;
      }

      if (qtdBloqueada > 0) {
        const detalhes = bloqueios.map(b => `${b.preceptor_nome || "Preceptor"}: ${b.motivo || b.codigo || "bloqueado"}`).join("; ");
        setModal(m => (m && m.mode === "pag-lote" ? { ...m, previa, previaCarregando: false } : m));
        notify(`Há ${qtdBloqueada} registro(s) bloqueado(s). Nenhum pagamento foi registrado. ${detalhes}`, "error");
        return;
      }

      if (Math.abs(valorValido - Number(valorTela || 0)) > 0.01) {
        setModal(m => (m && m.mode === "pag-lote" ? { ...m, previa, previaCarregando: false } : m));
        notify(`O valor da seleção da tela (${formatCurrencyBRL(Number(valorTela || 0))}) diverge da prévia (${formatCurrencyBRL(valorValido)}). Nenhum pagamento foi registrado.`, "error");
        return;
      }

      const res = await executarPagamentoLote({
        competenciaId,
        preceptorIds,
        dataPagamento,
        observacao: observacao || ""
      });

      const qtdProcessada = Number(res?.qtd_processada ?? preceptorIds.length);
      const valorPago = Number(res?.valor_total_pago ?? valorValido);
      notify(`Pagamento em lote concluído: ${qtdProcessada} preceptor${qtdProcessada === 1 ? "" : "es"} — ${formatCurrencyBRL(valorPago)}.`);
      setModal(null);
      setPagLoteIds(new Set());

      const now = new Date();
      const mes = Number(apurFiltroMes || now.getMonth() + 1);
      const ano = Number(apurFiltroAno || now.getFullYear());
      try { await consultarFilaExistente(); }
      catch (refErr) { console.warn("[controle-financeiro] Atualização pós-pagamento em lote:", refErr); }
      try { await verificarDesatualizacao(mes, ano); }
      catch (desatErr) { console.warn("[controle-financeiro] Atualização de desatualização pós-lote:", desatErr); }
    } catch (e) {
      console.warn("[controle-financeiro] Falha no pagamento em lote:", e);
      notify(mensagemErroAmigavel(e, "Não foi possível registrar o pagamento em lote. Nenhum registro foi alterado."), "error");
    } finally {
      setSolicitacaoNotaLoading(false);
      setPagLoteExecutando(false);
    }
  }

  async function handleAbrirRefazerVinculo(r){
    if(!isAdmin){
      notify("Acesso negado. Somente Administradores podem refazer vínculos.","error");
      return;
    }
    const nowPago=new Date();
    const compPago=`${apurFiltroAno||nowPago.getFullYear()}-${String(apurFiltroMes||nowPago.getMonth()+1).padStart(2,'0')}`;
    const solPago=solicitacoesFiscais.find(s=>s.preceptor_id===r.preceptor_id&&s.competencia===compPago&&s.situacao==='pago');
    if(solPago){
      notify("Não é possível refazer o vínculo: pagamento já registrado para este preceptor nesta competência.","error");
      return;
    }
    const vinculoAdmId=r.vinculo_adm_id||null;
    const vinculoInternatoId=r.vinculo_internato_id||null;
    if(!vinculoAdmId&&!vinculoInternatoId){
      notify("Vínculo não encontrado.","error");
      return;
    }
    setRefazerVinculoModal({row:r,vinculoAdmId,vinculoInternatoId});
    setRefazerVinculoPrevia(null);
    setRefazerVinculoCarregando(true);
    try{
      const previa=await previaRefazerVinculo({vinculoAdmId,vinculoInternatoId});
      setRefazerVinculoPrevia(previa);
    }catch(e){
      notify(e.message||"Erro ao buscar prévia.","error");
      setRefazerVinculoModal(null);
    }
    setRefazerVinculoCarregando(false);
  }

  function fecharRefazerVinculo(){
    if(refazerVinculoExecutando)return;
    setRefazerVinculoModal(null);
    setRefazerVinculoPrevia(null);
  }

  async function handleExecutarRefazerVinculo(){
    if(!refazerVinculoModal||!refazerVinculoPrevia||refazerVinculoPrevia.bloqueado)return;
    setRefazerVinculoExecutando(true);
    try{
      await refazerVinculo({
        vinculoAdmId:refazerVinculoModal.vinculoAdmId,
        vinculoInternatoId:refazerVinculoModal.vinculoInternatoId,
        confirmar:true
      });
      setRefazerVinculoModal(null);
      setRefazerVinculoPrevia(null);
      notify("Vínculo liberado para refazer a escala.");
      const now=new Date();
      const mes=Number(apurFiltroMes||now.getMonth()+1);
      const ano=Number(apurFiltroAno||now.getFullYear());
      await consultarFilaExistente();
      await verificarDesatualizacao(mes,ano);
      setPage("escalas");
    }catch(e){
      notify(e.message||"Erro ao refazer vínculo.","error");
    }
    setRefazerVinculoExecutando(false);
  }

  async function handleAbrirExcluirVinculo(vinc,tipo){
    if(!isAdmin){
      notify("Acesso negado. Somente Administradores podem excluir vínculos.","error");
      return;
    }
    const vinculoAdmId=tipo==="adm"?vinc.id:null;
    const vinculoInternatoId=tipo==="internato"?vinc.id:null;
    if(!vinculoAdmId&&!vinculoInternatoId){
      notify("Vínculo não encontrado.","error");
      return;
    }
    setExcluirVinculoModal({vinc,vinculoAdmId,vinculoInternatoId});
    setExcluirVinculoPrevia(null);
    setExcluirVinculoTexto("");
    setExcluirVinculoCarregando(true);
    try{
      const previa=await previaExcluirVinculo({vinculoAdmId,vinculoInternatoId});
      setExcluirVinculoPrevia(previa);
    }catch(e){
      notify(e.message||"Erro ao buscar prévia.","error");
      setExcluirVinculoModal(null);
    }
    setExcluirVinculoCarregando(false);
  }

  function fecharExcluirVinculo(){
    if(excluirVinculoExecutando)return;
    setExcluirVinculoModal(null);
    setExcluirVinculoPrevia(null);
    setExcluirVinculoTexto("");
  }

  async function handleExecutarExcluirVinculo(){
    if(!excluirVinculoModal||!excluirVinculoPrevia||excluirVinculoPrevia.bloqueado)return;
    if(excluirVinculoTexto.trim()!=="EXCLUIR"){
      notify("Digite EXCLUIR para confirmar a exclusão permanente.","error");
      return;
    }
    setExcluirVinculoExecutando(true);
    try{
      await excluirVinculo({
        vinculoAdmId:excluirVinculoModal.vinculoAdmId,
        vinculoInternatoId:excluirVinculoModal.vinculoInternatoId,
        confirmar:true
      });
      setExcluirVinculoModal(null);
      setExcluirVinculoPrevia(null);
      setExcluirVinculoTexto("");
      notify("Vínculo excluído permanentemente.");
      setEditVinculosRefresh(n=>n+1);
      loadPage();
    }catch(e){
      notify(e.message||"Erro ao excluir vínculo.","error");
    }
    setExcluirVinculoExecutando(false);
  }

  async function handleAbrirExcluirPreceptor(preceptorId){
    if(!isAdmin){
      notify("Acesso negado. Somente Administradores podem excluir preceptores.","error");
      return;
    }
    if(!preceptorId){
      notify("Preceptor não encontrado.","error");
      return;
    }
    setExcluirPreceptorModal({preceptorId});
    setExcluirPreceptorPrevia(null);
    setExcluirPreceptorTexto("");
    setExcluirPreceptorCarregando(true);
    try{
      const previa=await previaExcluirPreceptor(preceptorId);
      setExcluirPreceptorPrevia(previa);
    }catch(e){
      notify(e.message||"Erro ao buscar prévia.","error");
      setExcluirPreceptorModal(null);
    }
    setExcluirPreceptorCarregando(false);
  }

  function fecharExcluirPreceptor(){
    if(excluirPreceptorExecutando)return;
    setExcluirPreceptorModal(null);
    setExcluirPreceptorPrevia(null);
    setExcluirPreceptorTexto("");
  }

  async function handleExecutarExcluirPreceptor(){
    if(!excluirPreceptorModal||!excluirPreceptorPrevia||excluirPreceptorPrevia.bloqueado)return;
    if(excluirPreceptorTexto.trim()!=="EXCLUIR"){
      notify("Digite EXCLUIR para confirmar a exclusão permanente.","error");
      return;
    }
    setExcluirPreceptorExecutando(true);
    try{
      await excluirPreceptor(excluirPreceptorModal.preceptorId,{confirmar:true});
      setExcluirPreceptorModal(null);
      setExcluirPreceptorPrevia(null);
      setExcluirPreceptorTexto("");
      notify("Preceptor excluído permanentemente.");
      loadPage();
    }catch(e){
      notify(e.message||"Erro ao excluir preceptor.","error");
    }
    setExcluirPreceptorExecutando(false);
  }

  function renderApuracaoMensalTable(){
    const meses=["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const now=new Date();
    const anoAtual=now.getFullYear();
    const toggleGrupo=(id)=>setGruposExpandidos(p=>({...p,[id]:!p[id]}));

    const hasActiveFilters=!!(
      search.trim()||
      apurFiltroModalidade!=="todos"||
      apurFiltroDisciplina!=="todos"||
      apurFiltroPeriodo!=="todos"||
      apurFiltroLocal!=="todos"||
      apurFiltroSetor!=="todos"||
      apurFiltroSituacao!=="todos"||
      apurFiltroNecessitaRecalculo!=="todos"
    );

    const handleClearAllFilters=()=>{
      setSearch("");
      setApurFiltroModalidade("todos");
      setApurFiltroDisciplina("todos");
      setApurFiltroPeriodo("todos");
      setApurFiltroLocal("todos");
      setApurFiltroSetor("todos");
      setApurFiltroSituacao("todos");
      setApurFiltroNecessitaRecalculo("todos");
    };

    const rowsVisiveis=gruposPorPreceptor.flatMap(g=>g.vinculos);
    const pendenciasCount=rowsVisiveis.filter(r=>!r.regra_nome||r.regra_nome==="Regra financeira pendente"||(r.observacoes&&r.observacoes!=="Calculado")).length;

    return <div className={"finance-page apuracao-page"+(pagLoteModo?" com-barra-lote":"")}>
      <section className="finance-competencia-banner">
        <div><small>Competência financeira</small><b>{apuracaoMesLabel(apurFiltroMes||now.getMonth()+1,apurFiltroAno||anoAtual)}</b></div>
        <div><small>Período considerado</small><b>{periodoCompetencia({ano:Number(apurFiltroAno||anoAtual),mes:Number(apurFiltroMes||now.getMonth()+1)})}</b></div>
      </section>

      <section className="finance-controlbar apuracao-controlbar">
        <div className="apuracao-search-filter-row">
          <label className="finance-name-search apuracao-search-input">
            <Search size={16}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por preceptor, disciplina/internato, local ou setor..." aria-label="Buscar por preceptor, disciplina, local ou setor"/>
            {search&&<button type="button" className="apuracao-clear-search" onClick={()=>setSearch("")} title="Limpar busca"><X size={14}/></button>}
          </label>
          <button type="button" className={"finance-btn-filter"+(apurFiltrosPainelAberto?" active":"")+(hasActiveFilters?" has-badge":"")} onClick={()=>setApurFiltrosPainelAberto(p=>!p)} title="Filtros">
            <Filter size={16}/>
            <span>Filtros</span>
            {hasActiveFilters&&<span className="filter-badge-dot"/>}
          </button>
        </div>

        <div className="finance-period">
          <span>Referência</span>
          <select value={apurFiltroMes} onChange={e=>setApurFiltroMes(e.target.value)} aria-label="Mês">
            <option value="">{meses[now.getMonth()+1]}</option>
            {meses.slice(1).map((m,i)=><option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={apurFiltroAno} onChange={e=>setApurFiltroAno(e.target.value)} aria-label="Ano">
            <option value="">{anoAtual}</option>
            {[anoAtual-1,anoAtual,anoAtual+1].map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="finance-filterset">
          <button className="finance-refresh" onClick={()=>{
            const mes=Number(apurFiltroMes||now.getMonth()+1), ano=Number(apurFiltroAno||anoAtual);
            systemConfirm('Deseja recalcular todos os valores desta competência?','Recalcular competência',{confirmLabel:'Confirmar recálculo',busyLabel:'Recalculando competência...',icon:<RotateCw size={16}/>,details:<><div><b>Competência</b><span>{apuracaoMesLabel(mes,ano)}</span></div><div><b>Período</b><span>{periodoCompetencia({ano,mes})}</span></div><div><b>Preceptores</b><span>{gruposPorPreceptor.length}</span></div><div><b>Valor atual</b><span>{formatCurrencyBRL(rowsFiltradasApuracao.reduce((a,r)=>a+Number(r.total_bruto||0),0))}</span></div></>,onConfirm:()=>handleCalcularCompetencia(mes,ano)});
          }} disabled={apurCalculando}>{apurCalculando?<Loader2 size={16} className="spin"/>:<RotateCw size={16}/>} Recalcular competência</button>
        </div>
      </section>

      {/* FILTROS RÁPIDOS DE PAGAMENTO E ENTRADA NO MODO DE SELEÇÃO */}
      {page==="controle-financeiro"&&<section className="apuracao-lote-barra">
        <div className="escalas-quickfilter apuracao-lote-quickfilter" role="group" aria-label="Filtros rápidos de pagamento">
          {PAG_LOTE_FILTROS.map(([k,l])=>
            <button key={k} type="button" className={"eqf-btn"+(pagLoteFiltro===k?" active":"")} onClick={()=>setPagLoteFiltro(k)} aria-pressed={pagLoteFiltro===k}>{l}</button>
          )}        </div>
        <div className="apuracao-lote-modo">
          <button type="button" className={"apuracao-lote-btn"+(pagLoteModo?" claro":" escuro")} onClick={alternarModoSelecaoLote} aria-pressed={pagLoteModo}>
            {pagLoteModo?<><X size={15}/><span>Sair da seleção</span></>:<><CheckCheck size={15}/><span>Selecionar para pagamento</span></>}
          </button>
        </div>
      </section>}

      {page==="controle-financeiro"&&pagLoteModo&&<section className="apuracao-lote-selecionar" aria-label="Seleção para pagamento em lote">
        <div className="apuracao-lote-selecionar-info">
          <strong>{pagLoteResumo.qtd} preceptor{pagLoteResumo.qtd===1?"":"s"} selecionado{pagLoteResumo.qtd===1?"":"s"}</strong>
          <span>Valor total selecionado: <b>{formatCurrencyBRL(pagLoteResumo.valor)}</b></span>
          <small>{pagLoteElegiveis.length} elegível(is) nesta lista · {gruposPaginados.filter(g=>!estadoLoteGrupoBase(g).bloqueioLote).length} nesta página</small>
        </div>
        <div className="apuracao-lote-selecionar-acoes">
          <button type="button" className="apuracao-lote-btn secundario" onClick={selecionarLotePagina}>Selecionar esta página</button>
          <button type="button" className="apuracao-lote-btn secundario" onClick={selecionarLoteTodosFiltrados}>Selecionar todos os resultados filtrados ({pagLoteElegiveis.length})</button>
          <button type="button" className="apuracao-lote-btn secundario" onClick={limparSelecaoLote} disabled={pagLoteResumo.qtd===0}>Limpar seleção</button>
        </div>
      </section>}

      {/* PAINEL DE FILTROS DESKTOP */}
      {apurFiltrosPainelAberto&&<div className="apuracao-filtro-panel-desktop">
        <div className="apuracao-filtro-grid">
          <div className="apuracao-filtro-campo">
            <label>Tipo de Atuação</label>
            <select value={apurFiltroModalidade} onChange={e=>setApurFiltroModalidade(e.target.value)}>
              <option value="todos">Todos os tipos</option>
              <option value="internato">Internato</option>
              <option value="adm">Prática</option>
            </select>
          </div>
          <div className="apuracao-filtro-campo">
            <label>Internato / Disciplina</label>
            <select value={apurFiltroDisciplina} onChange={e=>setApurFiltroDisciplina(e.target.value)}>
              <option value="todos">Todas as disciplinas</option>
              {apurOpcoesFiltros.disciplinas.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="apuracao-filtro-campo">
            <label>Período</label>
            <select value={apurFiltroPeriodo} onChange={e=>setApurFiltroPeriodo(e.target.value)}>
              <option value="todos">Todos os períodos</option>
              {apurOpcoesFiltros.periodos.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="apuracao-filtro-campo">
            <label>Local</label>
            <select value={apurFiltroLocal} onChange={e=>setApurFiltroLocal(e.target.value)}>
              <option value="todos">Todos os locais</option>
              {apurOpcoesFiltros.locais.map(l=><option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="apuracao-filtro-campo">
            <label>Setor</label>
            <select value={apurFiltroSetor} onChange={e=>setApurFiltroSetor(e.target.value)}>
              <option value="todos">Todos os setores</option>
              {apurOpcoesFiltros.setores.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="apuracao-filtro-campo">
            <label>Situação do cálculo</label>
            <select value={apurFiltroSituacao} onChange={e=>setApurFiltroSituacao(e.target.value)}>
              <option value="todos">Todas as situações</option>
              {apurOpcoesFiltros.situacoes.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="apuracao-filtro-campo">
            <label>Necessita recálculo</label>
            <select value={apurFiltroNecessitaRecalculo} onChange={e=>setApurFiltroNecessitaRecalculo(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
        </div>
        <div className="apuracao-filtro-acoes">
          <button type="button" className="btn btn-secondary" onClick={handleClearAllFilters}>Limpar</button>
          <button type="button" className="btn btn-primary" onClick={()=>setApurFiltrosPainelAberto(false)}>Aplicar</button>
        </div>
      </div>}

      {/* PAINEL DE FILTROS MOBILE (BOTTOM SHEET) */}
      {apurFiltrosPainelAberto&&<div className="apuracao-filtro-mobile-backdrop" onClick={()=>setApurFiltrosPainelAberto(false)}>
        <div className="apuracao-filtro-mobile-sheet" onClick={e=>e.stopPropagation()}>
          <div className="sheet-header">
            <h3>Filtros de Apuração</h3>
            <button type="button" onClick={()=>setApurFiltrosPainelAberto(false)} aria-label="Fechar filtros"><X size={20}/></button>
          </div>
          <div className="sheet-body">
            <div className="apuracao-filtro-campo">
              <label>Tipo de Atuação</label>
              <select value={apurFiltroModalidade} onChange={e=>setApurFiltroModalidade(e.target.value)}>
                <option value="todos">Todos os tipos</option>
                <option value="internato">Internato</option>
                <option value="adm">Prática</option>
              </select>
            </div>
            <div className="apuracao-filtro-campo">
              <label>Internato / Disciplina</label>
              <select value={apurFiltroDisciplina} onChange={e=>setApurFiltroDisciplina(e.target.value)}>
                <option value="todos">Todas as disciplinas</option>
                {apurOpcoesFiltros.disciplinas.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="apuracao-filtro-campo">
              <label>Período</label>
              <select value={apurFiltroPeriodo} onChange={e=>setApurFiltroPeriodo(e.target.value)}>
                <option value="todos">Todos os períodos</option>
                {apurOpcoesFiltros.periodos.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="apuracao-filtro-campo">
              <label>Local</label>
              <select value={apurFiltroLocal} onChange={e=>setApurFiltroLocal(e.target.value)}>
                <option value="todos">Todos os locais</option>
                {apurOpcoesFiltros.locais.map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="apuracao-filtro-campo">
              <label>Setor</label>
              <select value={apurFiltroSetor} onChange={e=>setApurFiltroSetor(e.target.value)}>
                <option value="todos">Todos os setores</option>
                {apurOpcoesFiltros.setores.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="apuracao-filtro-campo">
              <label>Situação do cálculo</label>
              <select value={apurFiltroSituacao} onChange={e=>setApurFiltroSituacao(e.target.value)}>
                <option value="todos">Todas as situações</option>
                {apurOpcoesFiltros.situacoes.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="apuracao-filtro-campo">
              <label>Necessita recálculo</label>
              <select value={apurFiltroNecessitaRecalculo} onChange={e=>setApurFiltroNecessitaRecalculo(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
          </div>
          <div className="sheet-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClearAllFilters}>Limpar</button>
            <button type="button" className="btn btn-primary" onClick={()=>setApurFiltrosPainelAberto(false)}>Aplicar</button>
          </div>
        </div>
      </div>}

      {/* CHIPS DE FILTROS ATIVOS E CONTADOR DE ENCONTRADOS */}
      {hasActiveFilters&&<div className="apuracao-chips-bar">
        <div className="apuracao-resultado-info">
          <span>Encontrados: <strong>{gruposPorPreceptor.length}</strong> {gruposPorPreceptor.length===1?'preceptor':'preceptores'} (<strong>{rowsVisiveis.length}</strong> {rowsVisiveis.length===1?'atuação':'atuações'})</span>
        </div>
        <div className="apuracao-chips-list">
          {search.trim()&&<span className="apur-chip">Busca: "{search.trim()}"<button type="button" onClick={()=>setSearch("")} title="Remover filtro de busca"><X size={12}/></button></span>}
          {apurFiltroModalidade!=="todos"&&<span className="apur-chip">Tipo: {apurFiltroModalidade==='adm'?'Prática':'Internato'}<button type="button" onClick={()=>setApurFiltroModalidade("todos")} title="Remover filtro de tipo"><X size={12}/></button></span>}
          {apurFiltroDisciplina!=="todos"&&<span className="apur-chip">Disciplina: {apurFiltroDisciplina}<button type="button" onClick={()=>setApurFiltroDisciplina("todos")} title="Remover filtro de disciplina"><X size={12}/></button></span>}
          {apurFiltroPeriodo!=="todos"&&<span className="apur-chip">Período: {apurFiltroPeriodo}<button type="button" onClick={()=>setApurFiltroPeriodo("todos")} title="Remover filtro de período"><X size={12}/></button></span>}
          {apurFiltroLocal!=="todos"&&<span className="apur-chip">Local: {apurFiltroLocal}<button type="button" onClick={()=>setApurFiltroLocal("todos")} title="Remover filtro de local"><X size={12}/></button></span>}
          {apurFiltroSetor!=="todos"&&<span className="apur-chip">Setor: {apurFiltroSetor}<button type="button" onClick={()=>setApurFiltroSetor("todos")} title="Remover filtro de setor"><X size={12}/></button></span>}
          {apurFiltroSituacao!=="todos"&&<span className="apur-chip">Situação: {apurFiltroSituacao}<button type="button" onClick={()=>setApurFiltroSituacao("todos")} title="Remover filtro de situação"><X size={12}/></button></span>}
          {apurFiltroNecessitaRecalculo!=="todos"&&<span className="apur-chip">Recálculo: {apurFiltroNecessitaRecalculo==='sim'?'Sim':'Não'}<button type="button" onClick={()=>setApurFiltroNecessitaRecalculo("todos")} title="Remover filtro de recálculo"><X size={12}/></button></span>}
          <button type="button" className="apur-chip-limpar-todos" onClick={handleClearAllFilters}>Limpar todos</button>
        </div>
      </div>}

      <section className="finance-summary" aria-label="Resumo da apuração">
        <article><UsersRound/><div><strong>{gruposPorPreceptor.length}</strong><span>Preceptores</span></div></article>
        <article><CalendarCheck/><div><strong>{rowsVisiveis.reduce((a,r)=>a+Number(r.quantidade_presencas||0),0)}</strong><span>Turnos confirmados</span></div></article>
        <article className="money"><CircleDollarSign/><div><strong>{formatCurrencyBRL(rowsVisiveis.reduce((a,r)=>a+Number(r.total_bruto||0),0))}</strong><span>Valor calculated</span></div></article>
        <article className={pendenciasCount?"attention":""}><AlertCircle/><div><strong>{pendenciasCount}</strong><span>Pendências</span></div></article>
      </section>

      {apurDesatualizacao&&apurDesatualizacao.possui_desatualizacao&&<section className="finance-alert">
        <div className="finance-alert-header">
          <AlertCircle size={18}/>
          <div>
            <strong>Esta competência possui alterações posteriores ao último cálculo.</strong>
            {apurDesatualizacao.ultima_apuracao&&<small>Última apuração: {fmtTimestamp(apurDesatualizacao.ultima_apuracao)}</small>}
          </div>
        </div>
        {apurDesatualizacao.vinculos_desatualizados&&apurDesatualizacao.vinculos_desatualizados.length>0&&<div className="finance-alert-section">
          <span className="finance-alert-label">Vínculos desatualizados ({apurDesatualizacao.vinculos_desatualizados.length}):</span>
          {apurDesatualizacao.vinculos_desatualizados.map((v,i)=>(
            <span key={i} className="finance-alert-item">{v.preceptor_nome||"Preceptor"} — {v.tipo_atuacao==="internato"?"Internato":"Prática"} ({v.qtd_presencas} presença{v.qtd_presencas===1?"":"s"})</span>
          ))}
        </div>}
        {apurDesatualizacao.vinculos_nao_calculados&&apurDesatualizacao.vinculos_nao_calculados.length>0&&<div className="finance-alert-section">
          <span className="finance-alert-label">Vínculos ainda não calculados ({apurDesatualizacao.vinculos_nao_calculados.length}):</span>
          {apurDesatualizacao.vinculos_nao_calculados.map((v,i)=>(
            <span key={i} className="finance-alert-item">{v.preceptor_nome||"Preceptor"} — {v.tipo_atuacao==="internato"?"Internato":"Prática"} ({v.qtd_presencas} presença{v.qtd_presencas===1?"":"s"})</span>
          ))}
        </div>}
      </section>}

      {apurCalculando&&<div className="finance-progress"><Loader2 size={17} className="spin"/> Atualizando presenças e cálculos...</div>}

      {rowsFiltradasApuracao.length===0&&!apurCalculando?<section className="finance-empty">
        <FileSearch size={32}/><h3>Nenhum resultado encontrado</h3>
        <p>{hasActiveFilters?"Tente ajustar os filtros ou a busca aplicada para encontrar registros.":"Somente preceptores com presença confirmada no período aparecem aqui automaticamente."}</p>
      </section>:rowsVisiveis.length===0&&!apurCalculando?<section className="finance-empty">
        <FileSearch size={32}/><h3>Nenhum preceptor neste filtro rápido</h3>
        <p>Nenhum preceptor corresponde ao filtro "{PAG_LOTE_FILTROS.find(([k])=>k===pagLoteFiltro)?.[1]||"Todos"}". Selecione "Todos" para ver a lista completa.</p>
      </section>:<section className="apuracao-compacta">
        {gruposPaginados.map(grupo=>{
          const vincPend=vinculosPendentesPorPreceptor[grupo.preceptor_id]||[];
          const expandido=!!gruposExpandidos[grupo.preceptor_id];
          const temDesatualizacao=grupo.vinculos.some(r=>(apurDesatualizacao?.vinculos_desatualizados||[]).find(d=>d.vinculo_internato_id===r.vinculo_internato_id||d.vinculo_adm_id===r.vinculo_adm_id));
          const temPendente=vincPend.length>0;
          const revisadasCount=grupo.vinculos.filter(r=>isAtuacaoRevisada(r)).length;
          const totalAtuacoesGroup=grupo.vinculos.length;
          const elegibilidadeDemo=avaliarElegibilidadeDemonstrativo(grupo.vinculos);
          const loteEstado=estadoLoteGrupoBase(grupo);

          const compIdStr = grupo.vinculos[0]?.competencia_id || rows[0]?.competencia_id;
          const sol = situacaoFiscalDoGrupo(grupo);
          const estadoFiscal = sol?.situacao || null;

          const isPago = estadoFiscal === 'pago';
          const isRegistroAntigo = estadoFiscal === 'nota_recebida' || estadoFiscal === 'em_pagamento';
          const isEmailEnviado = estadoFiscal === 'solicitada';
          const isNaoPago = isEmailEnviado || isRegistroAntigo;
          const isEmailPreparado = estadoFiscal === 'preparada';
          const isRevisado = revisadasCount === totalAtuacoesGroup && totalAtuacoesGroup > 0;

          let situacaoGrupo = "Aguardando Revisão";
          let situacaoClass = "aguardando-revisao";

          if (temDesatualizacao) {
            situacaoGrupo = "Necessita Recálculo";
            situacaoClass = "desatualizado";
          } else if (isPago) {
            situacaoGrupo = "Pago";
            situacaoClass = "pago";
          } else if (isNaoPago) {
            situacaoGrupo = "Não pago";
            situacaoClass = "nf-recebida";
          } else if (isEmailPreparado) {
            situacaoGrupo = "E-mail preparado";
            situacaoClass = "email-enviado";
          } else if (isRevisado) {
            situacaoGrupo = "Cálculo conferido";
            situacaoClass = "revisado";
          } else if (temPendente) {
            situacaoGrupo = "Pendências";
            situacaoClass = "pendente";
          }

          const totalTurnos=grupo.vinculos.reduce((a,r)=>a+Number(r.quantidade_presencas||0),0);
          return <div className={"apuracao-grupo-compacto"+(expandido?" expandido":"")} key={grupo.preceptor_id}>
            <div className="apuracao-linha-preceptor" onClick={()=>toggleGrupo(grupo.preceptor_id)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggleGrupo(grupo.preceptor_id)}}}>
              {page==="controle-financeiro"&&pagLoteModo&&<span className="apuracao-lote-check" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
                <input
                  type="checkbox"
                  id={`pag-lote-${grupo.preceptor_id}`}
                  checked={pagLoteIds.has(grupo.preceptor_id)}
                  disabled={!!loteEstado.bloqueioLote}
                  onChange={()=>alternarSelecaoLote(grupo.preceptor_id)}
                  aria-label={`Selecionar ${grupo.nome} para pagamento em lote`}
                  title={loteEstado.bloqueioLote?loteEstado.motivoBloqueio:"Selecionar para pagamento em lote"}
                />
                {loteEstado.bloqueioLote&&<small className="apuracao-lote-check-motivo" title={loteEstado.motivoBloqueio}>não elegível</small>}
              </span>}
              <span className="apuracao-expandir-icon">{expandido?<ChevronDown size={16}/>:<ChevronRight size={16}/>}</span>
              <span className="apuracao-linha-avatar">{String(grupo.nome||"P").split(" ").slice(0,2).map(n=>n[0]).join("")}</span>
              <span className="apuracao-linha-nome">{grupo.nome}</span>
              <span className="apuracao-linha-competencia apuracao-linha-hide-sm">{apuracaoMesLabel(grupo.mes,grupo.ano)}</span>
              <span className="apuracao-linha-atuacoes">{grupo.vinculos.length} atuação{grupo.vinculos.length===1?"":"s"} <small className="apuracao-revisao-count">({revisadasCount} de {totalAtuacoesGroup} revisada{revisadasCount===1?"":"s"})</small></span>
              <span className="apuracao-linha-turnos apuracao-linha-hide-sm">{totalTurnos} turno{totalTurnos===1?"":"s"}</span>
              <span className="apuracao-linha-valor">{formatCurrencyBRL(grupo.totalGrupo)}</span>
              <span className={`apuracao-linha-situacao ${situacaoClass}`}>{situacaoGrupo}</span>
              <span className="apuracao-linha-refazer" onClick={e=>{e.stopPropagation();handleAbrirRefazerFluxo(grupo)}} title="Refazer fluxo"><RotateCw size={14}/></span>
            </div>

            {/* AÇÕES FINANCEIRAS VISÍVEIS POR PRECEPTOR */}
            <div className="apuracao-linha-acoes" onClick={e=>e.stopPropagation()}>
              <button
                type="button"
                className="fin-act-btn btn-view"
                onClick={()=>toggleGrupo(grupo.preceptor_id)}
                title="Visualizar atuações e detalhes do cálculo"
              >
                <Eye size={14}/> <span>Visualizar</span>
              </button>

              {!isPago&&<>
              <button
                type="button"
                className={"fin-act-btn btn-pdf"+(elegibilidadeDemo.elegivel?"":" is-disabled")}
                aria-disabled={!elegibilidadeDemo.elegivel}
                onClick={()=>{
                  if(!elegibilidadeDemo.elegivel){
                    systemAlert(elegibilidadeDemo.motivo||"PDF indisponível: não há cálculos válidos e atualizados.","PDF Indisponível");
                    return;
                  }
                  handleGerarDemonstrativoPDF(grupo.preceptor_id,compIdStr,{calculoIds:grupo.vinculos.map(v=>v.id).filter(Boolean),mes:grupo.mes,ano:grupo.ano});
                }}
                title={elegibilidadeDemo.elegivel?"Gerar demonstrativo financeiro em PDF":(elegibilidadeDemo.motivo||"PDF indisponível — sem cálculos válidos")}
              >
                <FileText size={14}/> <span>PDF</span>
              </button>

              <button
                type="button"
                className={"fin-act-btn btn-email"+(elegibilidadeDemo.elegivel?"":" is-disabled")}
                aria-disabled={!elegibilidadeDemo.elegivel}
                onClick={()=>{
                  if(!elegibilidadeDemo.elegivel){
                    systemAlert(elegibilidadeDemo.motivo||"E-mail indisponível: não há cálculos válidos e atualizados.","E-mail Indisponível");
                    return;
                  }
                  (async()=>{
                    await handlePrepararEmailOutlook(grupo.preceptor_id, compIdStr,{calculoIds:grupo.vinculos.map(v=>v.id).filter(Boolean),mes:grupo.mes,ano:grupo.ano});
                    await carregarSolicitacoesFiscais();
                  })();
                }}
                title={elegibilidadeDemo.elegivel?"Abrir Outlook com demonstrativo preenchido":(elegibilidadeDemo.motivo||"E-mail indisponível — sem cálculos válidos")}
              >
                <Mail size={14}/> <span>E-mail</span>
              </button>
              </>}

              {solicitacoesFiscaisErro ? (
                <span className="fin-status-tag tag-erro" role="alert">
                  <AlertCircle size={13}/>
                  <span>{solicitacoesFiscaisErro}</span>
                  <button
                    type="button"
                    className="fin-corrige-btn"
                    onClick={()=>carregarSolicitacoesFiscais()}
                    title="Tentar carregar a situação fiscal novamente"
                  >
                    Tentar novamente
                  </button>
                </span>
              ) : (solicitacoesFiscaisCarregando && !sol) ? (
                <span className="fin-status-tag tag-carregando">
                  <Loader2 size={13} className="spin"/> <span>Carregando situação fiscal...</span>
                </span>
              ) : (
                <>
                  {estadoFiscal === 'preparada' && (
                    <button
                      type="button"
                      className="fin-act-btn btn-mark-email"
                      onClick={()=>handleMarcarEmailEnviado(grupo)}
                      disabled={solicitacaoNotaLoading}
                      title="Marcar e-mail como enviado"
                    >
                      <Send size={14}/> <span>Marcar E-mail Enviado</span>
                    </button>
                  )}

                  {isEmailEnviado && (
                    <span className="fin-status-tag tag-email" title={`E-mail enviado em ${fmtTimestamp(sol?.enviado_em || sol?.updated_at)}. Pagamento ainda não registrado.`}>
                      <Send size={13}/>
                      <span>Não pago — enviado em {fmtTimestamp(sol?.enviado_em || sol?.updated_at)}</span>
                      {isAdmin && (
                        <button
                          type="button"
                          className="fin-corrige-btn"
                          onClick={()=>handleCorrigirEmailEnviado(grupo)}
                          disabled={solicitacaoNotaLoading}
                          title="Corrigir confirmação de envio de e-mail"
                        >
                          (Corrigir)
                        </button>
                      )}
                    </span>
                  )}

                  {isRegistroAntigo && (
                    <span className="fin-status-tag tag-email" title="Pagamento ainda não registrado para esta competência.">
                      <Send size={13}/>
                      <span>Não pago</span>
                    </span>
                  )}

                  {isNaoPago && (
                    <button
                      type="button"
                      className="fin-act-btn btn-mark-pago"
                      onClick={()=>handleMarcarPagoModal(grupo)}
                      disabled={solicitacaoNotaLoading}
                      title="Marcar pagamento como efetuado"
                    >
                      <CreditCard size={14}/> <span>Marcar como pago</span>
                    </button>
                  )}

                  {isPago && (
                    <span className="fin-status-tag tag-pago" title={`Pago em ${fmtTimestamp(sol?.updated_at)}`}>
                      <CheckCheck size={13}/> <span>Pago</span>
                    </span>
                  )}

                  {sol && (
                    <button
                      type="button"
                      className="fin-act-btn btn-view"
                      onClick={()=>abrirModalHistorico(grupo, sol)}
                      title="Histórico da solicitação fiscal"
                    >
                      <History size={14}/> <span>Histórico</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {vincPend.length>0&&<div className="apuracao-grupo-pendente">
              <AlertCircle size={15}/>
              <span>{vincPend.length} vínculo{vincPend.length===1?"":"s"} com presenças aguardando apuração.</span>
            </div>}

            {expandido&&<div className="apuracao-expandido">
              <div className="apuracao-tabela-desktop">
                <table className="apuracao-tabela-compacta">
                  <thead><tr>
                    <th>Tipo</th><th>Internato / Disciplina</th><th>Período</th><th>Local</th><th>Setor</th><th>Presenças</th><th>Regra</th><th>Versão</th><th>Valor</th><th>Situação</th><th>Ações</th>
                  </tr></thead>
                  <tbody>
                    {grupo.vinculos.map(r=>{
                      const desat=(apurDesatualizacao?.vinculos_desatualizados||[]).find(d=>d.vinculo_internato_id===r.vinculo_internato_id||d.vinculo_adm_id===r.vinculo_adm_id);
                      const rev=isAtuacaoRevisada(r);
                      let badgeClass="situacao-badge";
                      let badgeLabel="Aguardando Revisão";
                      if(desat){badgeClass+=" desatualizado";badgeLabel="Necessita Recálculo"}
                      else if(rev){badgeClass+=" revisado";badgeLabel="Revisado"}
                      else{badgeClass+=" aguardando-revisao";badgeLabel="Aguardando Revisão"}
                      return <tr key={r.id} className={desat?"linha-desatualizada":""}>
                        <td><span className="vinculo-badge-tabela">{r.modalidade==="adm"?"Prática":"Internato"}</span></td>
                        <td className="td-nome">{r.internato_nome||r.disciplina_nome||"-"}</td>
                        <td>{r.periodo_nome||"-"}</td>
                        <td>{r.local_nome||"-"}</td>
                        <td>{r.setor_nome||"-"}</td>
                        <td className="td-center">{r.quantidade_presencas||0}</td>
                        <td className={r.regra_nome&&r.regra_nome!=="Regra financeira pendente"?"" :"td-pendente"}>{r.regra_nome&&r.regra_nome!=="Regra financeira pendente"?r.regra_nome:"Pendente"}</td>
                        <td className="td-center">v{r.versao||1}</td>
                        <td className="td-valor">{formatCurrencyBRL(Number(r.total_bruto||0))}</td>
                        <td><span className={badgeClass}>{badgeLabel}</span></td>
                        <td className="td-acoes">
                          <button className="tabela-acao-btn" onClick={()=>handleVerDetalhesCalculo(r.id)} title="Visualizar cálculo"><Eye size={15}/></button>
                          <button className="tabela-acao-btn btn-danger-subtle" onClick={()=>handleAbrirRefazerVinculo(r)} title="Refazer vínculo"><RotateCw size={14}/> Refazer vínculo</button>
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
              <div className="apuracao-cards-mobile">
                {grupo.vinculos.map(r=>{
                  const desat=(apurDesatualizacao?.vinculos_desatualizados||[]).find(d=>d.vinculo_internato_id===r.vinculo_internato_id||d.vinculo_adm_id===r.vinculo_adm_id);
                  const rev=isAtuacaoRevisada(r);
                  let badgeClass="situacao-badge";
                  let badgeLabel="Aguardando Revisão";
                  if(desat){badgeClass+=" desatualizado";badgeLabel="Necessita Recálculo"}
                  else if(rev){badgeClass+=" revisado";badgeLabel="Revisado"}
                  else{badgeClass+=" aguardando-revisao";badgeLabel="Aguardando Revisão"}
                  return <div className={"apuracao-card-compacto"+(desat?" desatualizado":"")} key={r.id}>
                    <div className="card-compacto-header">
                      <span className="vinculo-badge-tabela">{r.modalidade==="adm"?"Prática":"Internato"}</span>
                      <strong>{r.internato_nome||r.disciplina_nome||"-"}</strong>
                      <span className="card-compacto-valor">{formatCurrencyBRL(Number(r.total_bruto||0))}</span>
                    </div>
                    <div className="card-compacto-linha">
                      {r.local_nome&&<span><b>Local:</b> {r.local_nome}</span>}
                      {r.setor_nome&&<span><b>Setor:</b> {r.setor_nome}</span>}
                      <span><b>Turnos:</b> {r.quantidade_presencas||0}</span>
                      <span><b>Regra:</b> {r.regra_nome&&r.regra_nome!=="Regra financeira pendente"?r.regra_nome:"Pendente"}</span>
                      <span><b>v</b>{r.versao||1}</span>
                      <span className={badgeClass}>{badgeLabel}</span>
                    </div>
                    <div className="card-compacto-acoes">
                      <button className="card-acao-btn" onClick={()=>handleVerDetalhesCalculo(r.id)}><Eye size={15}/> Ver detalhes</button>
                      <button className="card-acao-btn" onClick={()=>handleAbrirRefazerVinculo(r)} style={{color:"#dc2626"}}><RotateCw size={14}/> Refazer vínculo</button>
                    </div>
                    {desat&&<div className="vinculo-desatualizado-badge"><AlertCircle size={13}/> Necessita recálculo</div>}
                  </div>;
                })}
              </div>
            </div>}
          </div>;
        })}

        {/* CONTROLES DE PAGINAÇÃO DA APURAÇÃO */}
        {totalGruposApur>0&&<div className="apuracao-paginacao" aria-label="Paginação de preceptores">
          <div className="apuracao-paginacao-info">
            {totalGruposApur===1?(
              <span>Exibindo <strong>1</strong> de <strong>1</strong> preceptor</span>
            ):(
              <span>
                Exibindo <strong>{(paginaValidaApur-1)*apurItensPorPagina+1}</strong> a <strong>{Math.min(paginaValidaApur*apurItensPorPagina,totalGruposApur)}</strong> de <strong>{totalGruposApur}</strong> preceptores
              </span>
            )}
          </div>

          <div className="apuracao-paginacao-controles">
            <div className="apuracao-paginacao-limite">
              <label htmlFor="apur-limite-select">Exibir por página:</label>
              <select
                id="apur-limite-select"
                value={apurItensPorPagina}
                onChange={e=>{
                  setApurItensPorPagina(Number(e.target.value));
                  setApurPaginaAtual(1);
                  setGruposExpandidos({});
                }}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="apuracao-paginacao-botoes">
              <button
                type="button"
                className="paginacao-btn"
                onClick={()=>{setGruposExpandidos({});setApurPaginaAtual(1)}}
                disabled={paginaValidaApur===1}
                title="Primeira página"
                aria-label="Primeira página"
              >
                <ChevronsLeft size={16}/>
              </button>

              <button
                type="button"
                className="paginacao-btn"
                onClick={()=>{setGruposExpandidos({});setApurPaginaAtual(p=>Math.max(1,p-1))}}
                disabled={paginaValidaApur===1}
                title="Página anterior"
                aria-label="Página anterior"
              >
                <ChevronLeft size={16}/>
              </button>

              <span className="paginacao-indicador">
                Página <strong>{paginaValidaApur}</strong> de <strong>{totalPaginasApur}</strong>
              </span>

              <button
                type="button"
                className="paginacao-btn"
                onClick={()=>{setGruposExpandidos({});setApurPaginaAtual(p=>Math.min(totalPaginasApur,p+1))}}
                disabled={paginaValidaApur===totalPaginasApur}
                title="Próxima página"
                aria-label="Próxima página"
              >
                <ChevronRight size={16}/>
              </button>

              <button
                type="button"
                className="paginacao-btn"
                onClick={()=>{setGruposExpandidos({});setApurPaginaAtual(totalPaginasApur)}}
                disabled={paginaValidaApur===totalPaginasApur}
                title="Última página"
                aria-label="Última página"
              >
                <ChevronsRight size={16}/>
              </button>
            </div>
          </div>
        </div>}
      </section>}

      {/* BARRA FIXA DE SELEÇÃO PARA PAGAMENTO EM LOTE */}
      {page==="controle-financeiro"&&pagLoteModo&&<div className="apuracao-lote-selecao-barra" role="region" aria-label="Resumo da seleção para pagamento em lote">
        <div className="apuracao-lote-selecao-info">
          <strong>{pagLoteResumo.qtd} preceptor{pagLoteResumo.qtd===1?"":"s"} selecionado{pagLoteResumo.qtd===1?"":"s"}</strong>
          <span>Valor total selecionado: <b>{formatCurrencyBRL(pagLoteResumo.valor)}</b></span>
        </div>
        <div className="apuracao-lote-selecao-acoes">
          <button type="button" className="apuracao-lote-btn claro" onClick={limparSelecaoLote} disabled={pagLoteResumo.qtd===0}>Limpar seleção</button>
          <button type="button" className="apuracao-lote-btn escuro" onClick={abrirModalPagamentoLote} disabled={pagLoteResumo.qtd===0||solicitacaoNotaLoading||pagLoteExecutando}>
            <CreditCard size={15}/><span>Marcar selecionados como pagos</span>
          </button>
        </div>
      </div>}
    </div>;
  }

  function renderGenericTable(){
    return <tbody>{filteredRows.map((r,i)=><tr key={r.id||i}>
      {meta.cols.map((_,j)=><td key={j}>{typeof r==="object"?(Object.values(r)[j+1]||"-"):"-"}</td>)}
      <td><span className="actions"><button><Eye/></button></span></td>
    </tr>)}</tbody>;
  }

  const handleLogout=async()=>{await supabase.auth.signOut();setSession(null);window.location.href="/login";};

  if(authLoading)return <main className="login-screen"><div className="login-card"><Logo variant="completa"/><Loader2 size={32} className="spin"/><p>Verificando sessao...</p></div></main>;
  if(!session||forceLogin)return <LoginScreen onLogin={(s)=>setSession(s)}/>;
  if(permissionLoading)return <main className="login-screen"><div className="login-card"><Logo variant="completa"/><Loader2 size={32} className="spin"/><p>Carregando permissões...</p></div></main>;
  if(authError){return <main className="login-screen"><div className="login-card"><Logo variant="completa"/><AlertCircle size={32} style={{color:"#ef4444"}}/><p style={{color:"#ef4444",textAlign:"center",margin:"12px 0"}}>{authError}</p><button className="btn" onClick={async()=>{await supabase.auth.signOut();setSession(null);setAuthError("");setAuthLoading(true);window.location.href="/login";}}>Voltar ao login</button></div></main>}
  if(!authorized){return <main className="login-screen"><div className="login-card"><Logo variant="completa"/><AlertCircle size={32} style={{color:"#ef4444"}}/><p style={{color:"#ef4444",textAlign:"center",margin:"12px 0"}}>Sem permissões para acessar o painel.</p><button className="btn" onClick={async()=>{await supabase.auth.signOut();setSession(null);window.location.href="/login";}}>Voltar ao login</button></div></main>}
  if(primeiroAcessoPendente){return <PrimeiroAcessoScreen onComplete={()=>setPrimeiroAcessoPendente(false)}/>}

  return <main className={collapsed?"sidebar-collapsed":""}>
    <SystemDialogHost/>
    <aside className="sidebar">
      <div className="brand"><Logo variant="completa"/></div>
      <nav><Navigation/></nav>
      <div className="user"><b>{isAdmin?"AD":"CO"}</b><span><strong>{isAdmin?"Administrador":"Coordenação"}</strong><small>{session.user?.email||"Admin"}</small></span><button className="user-logout" onClick={handleLogout} title="Sair"><LogOut size={16}/></button></div>
    </aside>

    {menu&&<div className="overlay" onClick={()=>setMenu(false)}>
      <aside className="mobile" onClick={e=>e.stopPropagation()}>
        <button className="close" onClick={()=>setMenu(false)} aria-label="Fechar menu"><X/></button><Navigation/>
      </aside>
    </div>}

    <section className="content">
      <div className="title">
        <button type="button" className="menubtn" onClick={handleMenuClick} aria-label={menu?"Fechar menu":"Abrir menu"} title={collapsed?"Expandir menu":"Recolher menu"}><Menu size={20}/></button>
        <div><small>GESTÃO DE PRECEPTORIA</small><h1>{meta.title}</h1><p>{meta.desc}</p></div>
        <div className="title-actions">
          {meta.btn&&page!=="presencas"&&page!=="regras"&&<Btn onClick={()=>{setModal(page==="usuarios"?{mode:"user-create",title:meta.btn}:{mode:"form",title:meta.btn,page})}}>{meta.btn}</Btn>}
          {page==="presencas"&&<Btn icon={Plus} onClick={()=>setModal({mode:"registro-presenca",title:"Registrar Presença"})}>{meta.btn}</Btn>}
          {page==="regras"&&<Btn icon={Plus} onClick={()=>setModal({mode:"regra-create",title:"Nova Regra Financeira"})}>{meta.btn}</Btn>}
        </div>
      </div>
      <div className="workspace">
{page==="cadastros-auxiliares"?<CadastrosAuxiliares onNotify={notify}/>:
          page==="registrar-presencas"?<RegistrarPresencasPage userId={session?.user?.id}/>:
          page==="controle-financeiro"?renderApuracaoMensalTable():
          page==="apuracao-mensal"?renderApuracaoMensalTable():
           page==="dashboard"?<DashboardPage onAbrirControle={abrirControleFiltrado}/>:
        <div className={"panel"+(page==="regras"?" rules-panel":"")}>
          {page==="regras"&&<div className="rules-overview"><div><small>REGRAS CADASTRADAS</small><strong>{rows.length}</strong></div><div><small>ATIVAS</small><strong>{rows.filter(r=>r.status==="ativo").length}</strong></div><div><small>PRÁTICA</small><strong>{rows.filter(r=>r.tipo_atuacao==="adm").length}</strong></div><div><small>INTERNATO</small><strong>{rows.filter(r=>r.tipo_atuacao==="internato").length}</strong></div></div>}
          {pageFilterConfigs[page]?<SearchFilterBar
            search={search} setSearch={setSearch}
            placeholder={page==="escalas"?"Buscar por preceptor, Internato, local ou setor":page==="presencas"?"Buscar por preceptor, competência ou local":page==="usuarios"?"Buscar por nome, email...":page==="regras"?"Buscar por nome, unidade, disciplina...":page==="auditoria"?"Buscar por tabela, operação...":`Buscar por nome, CPF, profissão, unidade...`}
            panelFilters={panelFilters} onApplyFilters={setPanelFilters}
            onClearFilters={()=>setPanelFilters({})} panelOpen={panelOpen} setPanelOpen={setPanelOpen}
            filters={pageFilterConfigs[page]||[]} rows={rows}
            resultCount={page==="escalas"?escalasFilteredRows.length:page==="presencas"?presencasFilteredRows.length:filteredRows.length}
            resultLabel={page==="escalas"?"vínculo(s) encontrado(s)":page==="presencas"?"registro(s) encontrado(s)":undefined}
            emptyLabel="Nenhum registro encontrado com os filtros aplicados"
          />:<div className="toolbar">
            <label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Buscar em ${meta.title.toLowerCase()}...`}/></label>
          </div>}
          {page==="escalas"&&<div className="escalas-quickfilter">
            {[["todos","Todos"],["sem_escala","Sem escala"],["ativa","Com escala ativa"],["inativa","Escala inativa"]].map(([k,l])=>
              <button key={k} className={"eqf-btn"+(escalasFilter===k?" active":"")} onClick={()=>setEscalasFilter(k)}>{l}</button>
            )}
          </div>}
          {page==="presencas"&&<div className="escalas-quickfilter">
            {[["todos","Todos"],["manha","Manhã"],["tarde","Tarde"],["noite","Noite"]].map(([k,l])=>
              <button key={k} className={"eqf-btn"+(presencasFilter===k?" active":"")} onClick={()=>setPresencasFilter(k)}>{l}</button>
            )}
          </div>}
          {loadingData?<div className="empty"><Loader2 size={24} className="spin"/><b>Carregando dados...</b></div>
          :errorData?<div className="empty"><AlertCircle/><b>Erro ao carregar: {errorData}</b></div>
          :page==="escalas"?renderEscalasCards()
          :page==="presencas"?<>
            <div className="tablewrap pres-desktop-table">
              <table>
                <thead><tr>{meta.cols.map(c=><th key={c}>{c}</th>)}<th>Ações</th></tr></thead>
                {renderTable()}
              </table>
            </div>
            <div className="pres-mobile-cards">
              {renderPresencasCards()}
            </div>
          </>
          :<><div className="tablewrap">
            <table>
              <thead><tr>{meta.cols.map(c=><th key={c}>{c}</th>)}<th>Ações</th></tr></thead>
              {renderTable()}
            </table>
          </div>
          {!filteredRows.length&&<div className="empty"><FileSearch/><b>Nenhum registro encontrado</b>{search.trim()&&<span> para "{search.trim()}"</span>}{Object.values(panelFilters).flat().length>0&&<small> Tente ajustar os filtros aplicados.</small>}</div>}</>
          }
        </div>}
      </div>
      <footer style={{textAlign:'center',padding:'24px 16px 20px',fontSize:12,color:'var(--text-muted)',letterSpacing:'.02em'}}>Desenvolvido por <span style={{color:'var(--gold-500)',fontWeight:600}}>V3L0Z</span></footer>
    </section>

    {modal&&<div className="overlay modal">
      <div className={"dialog"+((isPreceptorPage&&modal.mode==="detail")||modal.mode==="escala-detail"?" ficha":(modal.mode==="regra-create"||modal.mode==="regra-edit")?" regra":modal.mode==="folha-presenca"?" folha":modal.mode==="apuracao-detalhe"?" calculo-dialog":"")}>
        <div className="modalhead">
          <div>
            <small>{modal.mode==="folha-presenca"?"FOLHA DE PRESENÇA":modal.mode==="escala-detail"?"DETALHES DA ESCALA":modal.mode==="detail"?(isPreceptorPage?"FICHA DO PRECEPTOR":"DETALHES DO REGISTRO"):modal.mode==="user-create"||modal.mode==="user-edit"||modal.mode==="user-view"?"GERENCIAR USUÁRIOS":modal.mode==="pag-lote"?"PAGAMENTO EM LOTE":"CADASTRO E OPERAÇÃO"}</small>
            {modal.mode==="escala-detail" ? (
              <div className="escala-modalhead-title">
                <h2>Escala — {modal.row.preceptor_nome}</h2>
                <span className="ficha-tag">{modal.row.tipo_atuacao==="adm"?"Prática":modal.row.tipo_atuacao==="internato"?"Internato":(modal.row.modalidade_label||"Internato")}</span>
                <em className={statusBadge(modal.row.escala_status==="ativa"?"ativo":modal.row.escala_status==="inativa"?"inativo":"inativo")}>
                  {modal.row.escala_status==="ativa"?"Ativa":modal.row.escala_status==="inativa"?"Inativa":"Sem escala"}
                </em>
              </div>
            ) : (
              <h2>{modal.title}</h2>
            )}
          </div>
          <button onClick={()=>setModal(null)} aria-label="Fechar"><X/></button>
        </div>
        {modal.mode==="folha-presenca"?<FolhaPresenca row={modal.row} onClose={()=>setModal(null)}/>:
        modal.mode==="regra-create"||modal.mode==="regra-edit"?<RegraFinanceiraFormModal modal={modal} options={formOptions} optionsLoading={formOptionsLoading} onClose={()=>setModal(null)} onSaved={()=>{loadPage();setModal(null);notify(modal.mode==="regra-create"?"Regra financeira salva com sucesso!":"Regra financeira atualizada com sucesso!");}}/>:
        modal.mode==="regra-detail"?<RegraFinanceiraDetailModal row={modal.row} onClose={()=>setModal(null)} onEdit={()=>setModal({mode:"regra-edit",title:`Editar: ${modal.row.nome}`,row:modal.row})}/>:
        modal.mode==="registro-presenca"?<RegistrarPresencaCoordenador userId={session?.user?.id} onClose={()=>setModal(null)} onSaved={()=>{loadPage();setModal(null);notify('Presença registrada com sucesso!');}}/>:
        modal.mode==="escala-incompleta"?<EscalaIncompleta row={modal.row} onClose={()=>setModal(null)} onCompletar={()=>handleCompletarCadastro(modal.row)}/>:
         modal.mode==="escala-detail"?<EscalaDetail row={modal.row} onClose={()=>setModal(null)} onEdit={(esc)=>{
      const itens=(esc.itens||[]).map(i=>({data:i.data,turno:i.turno,setor_id:i.setor_id??null}));
          setFormData({
            tipo_atuacao:esc.tipo_atuacao,
            vinculo_local_id:esc.vinculo_local_id,
            vinculo_adm_id:esc.vinculo_adm_id,
            vinculo_internato_id:esc.vinculo_internato_id,
            data_inicio:esc.data_inicio||"",
            data_fim:esc.data_fim||"",
            status:esc.status||"ativo",
            _itens:itens,
            _escala_id:esc.id,
            _auto_preceptor:modal.row.preceptor_nome||"",
            _auto_unidade:modal.row.unidade_nome||"",
            _auto_atividade:modal.row.tipo_atuacao==="adm"?modal.row.disciplina_nome:modal.row.internato_nome,
            _auto_periodo:modal.row.periodo_nome||"",
            _auto_local:modal.row.local_nome||"",
            _auto_setor:modal.row.setor_nome||"",
            _auto_semestre:modal.row.semestre_codigo||""
          });
          setModal({mode:"form",title:`Editar: ${modal.row.preceptor_nome}`,page,editId:esc.id});
        }}/>:
         modal.mode==="apuracao-detalhe"?<div className="calculo-modal">
          {apurDetalhe&&(() => {
            const desat = (apurDetalhe.vinculo_internato_id && setVinculosDesatualizados.has(apurDetalhe.vinculo_internato_id)) ||
                          (apurDetalhe.vinculo_adm_id && setVinculosDesatualizados.has(apurDetalhe.vinculo_adm_id));
            const revisada = isAtuacaoRevisada(apurDetalhe);
            const vigenciaRegra = modal.vinculoRegra?.data_inicio
              ? `${fmtData(modal.vinculoRegra.data_inicio)}${modal.vinculoRegra.data_fim ? ` até ${fmtData(modal.vinculoRegra.data_fim)}` : ' (vigente)'}`
              : null;
            const periodoNome = modal.vinculoContexto?.periodo?.numero
              ? `${modal.vinculoContexto.periodo.numero}º período`
              : (modal.vinculoContexto?.periodo?.nome || null);
            const saldoSemestral = modal.vinculoContexto?.valor_inicial != null
              ? formatCurrencyBRL(modal.vinculoContexto.valor_inicial)
              : null;
            const disciplinaOuInternato = apurDetalhe.tipo_atuacao === 'adm'
              ? modal.vinculoContexto?.disciplina?.nome
              : modal.vinculoContexto?.internato?.nome;

            return <>
            <div className="calculo-modal-body">
              <section className="calculo-hero">
                <div>
                  <span>Valor calculado</span>
                  <strong>{formatCurrencyBRL(apurDetalhe.total_liquido||apurDetalhe.total_bruto||0)}</strong>
                </div>
                <em className="info">{apurDetalhe.tipo_atuacao==="adm"?"Prática":"Internato"}</em>
              </section>

              {desat && <div className="calculo-bloqueio-banner">
                <AlertCircle size={20}/>
                <div>
                  <strong>Recálculo necessário</strong>
                  <small>Esta atuação possui alterações de presença, escala ou regra posteriores ao último cálculo. Recalcule a competência antes de revisar.</small>
                </div>
              </div>}

              {!desat && revisada && <div className="calculo-revisao-banner">
                <ClipboardCheck size={20}/>
                <div>
                  <strong>Atuação revisada</strong>
                  <small>Revisado{modal.revisao?.profile?.nome_completo ? ` por ${modal.revisao.profile.nome_completo}` : ''} em {fmtTimestamp(modal.revisao?.decidido_em)}.</small>
                </div>
              </div>}

              <section className="calculo-grid-info">
                {apurDetalhe.preceptor?.nome_completo && <article><small>Preceptor</small><b>{apurDetalhe.preceptor.nome_completo}</b></article>}
                {apurDetalhe.competencia && <article><small>Competência financeira</small><b>{`${["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][apurDetalhe.competencia.mes]}/${apurDetalhe.competencia.ano}`}</b></article>}
                {disciplinaOuInternato && <article><small>{apurDetalhe.tipo_atuacao==="adm"?"Disciplina":"Internato"}</small><b>{disciplinaOuInternato}</b></article>}
                {periodoNome && <article><small>Período</small><b>{periodoNome}</b></article>}
                {modal.vinculoContexto?.unidade?.nome && <article><small>Unidade</small><b>{modal.vinculoContexto.unidade.nome}</b></article>}
                {modal.vinculoContexto?.local?.nome && <article><small>Local</small><b>{modal.vinculoContexto.local.nome}</b></article>}
                {modal.vinculoContexto?.setor?.nome && <article><small>Setor</small><b>{modal.vinculoContexto.setor.nome}</b></article>}
                {saldoSemestral && <article><small>Saldo semestral da atuação</small><b>{saldoSemestral}</b></article>}
                {modal.regra?.nome && <article><small>Regra financeira</small><b>{modal.regra.nome}</b></article>}
                {vigenciaRegra && <article><small>Vigência da regra</small><b>{vigenciaRegra}</b></article>}
                <article><small>Versão do cálculo</small><b>v{apurDetalhe.versao || 1}</b></article>
                <article><small>Calculado em</small><b>{fmtTimestamp(apurDetalhe.calculado_em)}</b></article>
                <article><small>Situação de atualização</small><b>{desat ? "Necessita recálculo" : "Atualizado"}</b></article>
              </section>

              {modal.regra&&<section className="calculo-section">
                <div className="calculo-section-title"><SlidersHorizontal size={15}/><h4>Regra financeira aplicada</h4></div>
                <div className="calculo-regra"><b>{modal.regra.nome}</b><div>{(modal.regra.componentes||[]).map(c=><span key={c.id||c.descricao}>{c.descricao||c.tipo}: <strong>{formatCurrencyBRL(c.valor||0)}{c.valor_extra?` + ${formatCurrencyBRL(c.valor_extra)}`:""}</strong></span>)}</div></div>
              </section>}

              <section className="calculo-section">
                <div className="calculo-section-title"><CalendarCheck size={15}/><h4>Presenças consideradas</h4><em className="neutral">{(modal.presencas||[]).length}</em></div>
                {(modal.presencas||[]).length===0?<div className="calculo-empty">Nenhuma presença registrada.</div>:<div className="calculo-tablewrap"><table className="calculo-table">
                  <thead><tr><th>Data</th><th>Turno</th><th>Local</th><th>Situação</th></tr></thead>
                  <tbody>{modal.presencas.map(p=><tr key={p.id}><td>{fmtData(p.data_presenca)}</td><td>{turnoLabel(p.turno)}</td><td>{p.local?.nome||""}</td><td><em className={p.status==="confirmada"?"ok":"warn"}>{p.status}</em></td></tr>)}</tbody>
                </table></div>}
              </section>

              <section className="calculo-section">
                <div className="calculo-section-title"><Calculator size={15}/><h4>Memória de cálculo</h4></div>
                {apurDetalheItens.length===0?<div className="calculo-empty">Nenhum item registrado.</div>:<div className="calculo-tablewrap"><table className="calculo-table">
                  <thead><tr><th>Descrição</th><th>Tipo</th><th>Qtd.</th><th>Valor unitário</th><th>Total</th></tr></thead>
                  <tbody>{apurDetalheItens.map(it=><tr key={it.id}><td><b>{it.descricao||""}</b></td><td>{it.tipo||""}</td><td>{it.quantidade||0}</td><td>{formatCurrencyBRL(it.valor_unitario)}</td><td><b>{formatCurrencyBRL(it.valor_total)}</b></td></tr>)}</tbody>
                </table></div>}
              </section>
            </div>
            <footer className="calculo-modal-footer">
              {isAdmin && !desat && !revisada && <Btn
                style={{ background: "#059669", borderColor: "#059669", color: "#ffffff" }}
                icon={revisandoId === apurDetalhe.id ? Loader2 : ClipboardCheck}
                disabled={revisandoId === apurDetalhe.id}
                onClick={() => handleMarcarRevisado(apurDetalhe.id)}
              >
                {revisandoId === apurDetalhe.id ? "Salvando..." : "Marcar como revisado"}
              </Btn>}
              {modal.notaSituacao!=="pago"&&<Btn secondary icon={RotateCw} onClick={()=>{
                const r=apurDetalhe;
                setModal(null);
                handleAbrirRefazerVinculo(r);
              }}>Refazer vínculo</Btn>}
              <Btn icon={Check} onClick={()=>setModal(null)}>Fechar</Btn>
            </footer>
            </>;
          })()}
        </div>:

         modal.mode==="detail"?isPreceptorPage?<>
          <PreceptorFicha row={modal.row} page={modal.page}
            onAddVinculo={isInternato?()=>setModal({mode:"vinculo-edit",title:`Novo vínculo — ${modal.row.nome_completo}`,preceptor:modal.row,vinculo:null,page:modal.page}):undefined}
            onEditVinculo={isInternato?(v)=>setModal({mode:"vinculo-edit",title:`Editar vínculo — ${modal.row.nome_completo}`,preceptor:modal.row,vinculo:v,page:modal.page}):undefined}
            onInactivateVinculo={isInternato?async(v)=>{
              const isAtivo=v.status==="ativo";
              if(!await systemConfirm(`Tem certeza que deseja ${isAtivo?"inativar":"reativar"} este vínculo?`,`${isAtivo?"Inativar":"Reativar"} vínculo`))return;
              try{
                if(isAtivo)await inativarVinculoInternato(v.id);
                else await reativarVinculoInternato(v.id);
                notify(`Vínculo ${isAtivo?"inativado":"reativado"} com sucesso!`);
                loadPage();setModal(null);
              }catch(e){notify("Erro: "+(e.message||"tente novamente."),"error");}
            }:undefined}
          />
          <footer className="ficha-footer">
            <Btn secondary icon={Pencil} onClick={()=>setModal({mode:"form",title:`Editar: ${modal.row.nome_completo}`,page:modal.page,editId:modal.row.id,editData:modal.row})}>Editar</Btn>
            <Btn icon={Check} onClick={()=>setModal(null)}>Fechar</Btn>
          </footer>
        </>:<div className="details">
          <div className="grid">{Array.isArray(modal.row)
            ?(typeof modal.row[0]==="object"&&!Array.isArray(modal.row[0])
              ?Object.entries(modal.row[0]).filter(([k])=>!k.startsWith("_")).map(([k,v])=><div className="detail" key={k}><small>{k}</small><b>{String(v?._id||v||"-")}</b></div>)
              :modal.row.map((v,i)=><div className="detail" key={i}><small>{meta.cols[i]||`Campo ${i+1}`}</small><b>{typeof v==="object"?JSON.stringify(v):String(v||"-")}</b></div>)
            )
            :(typeof modal.row==="object"&&modal.row&&!Array.isArray(modal.row)
               ?Object.entries(modal.row).filter(([k])=>!k.startsWith("_")&&k!=="id"&&k!=="created_at"&&k!=="updated_at"&&k!=="created_by"&&k!=="updated_by").map(([k,v])=>
                 <div className="detail" key={k}><small>{k==="valor_inicial"?"saldo semestral":k.replace(/_/g," ")}</small><b>{k==="valor_inicial"&&v!=null?formatCurrencyBRL(v):v&&typeof v==="object"?(v.nome||v.nome_completo||v.codigo||JSON.stringify(v)):String(v||"-")}</b></div>)
              :<div className="detail"><small>Dados</small><b>-</b></div>)}
          </div>
          <footer>
            {!isPreceptorPage&&modal.row&&typeof modal.row==="object"&&!Array.isArray(modal.row)&&modal.row.status&&
              <Btn secondary icon={Trash2} onClick={()=>{const tbl=page==="preceptores-pratica"||page==="preceptores-internato"?"preceptores":page;handleInativar(modal.row.id,tbl);setModal(null)}}>Inativar</Btn>}
            <Btn icon={Check} onClick={()=>setModal(null)}>Concluir</Btn>
          </footer>
        </div>:modal.mode==="user-view"?<div className="form">
          <div className="ficha">
            <div className="ficha-body">
              <section className="ficha-section">
                <h4 className="ficha-section-title"><UserRound size={15}/> Dados do Usuário</h4>
                <div className="ficha-grid">
                  <div className="ficha-item wide"><small>Nome completo</small><b>{modal.user?.nome_completo||"-"}</b></div>
                  <div className="ficha-item"><small>E-mail</small><b>{modal.user?.email||"-"}</b></div>
                  <div className="ficha-item"><small>Telefone</small><b>{modal.user?.telefone||"Não informado"}</b></div>
                  <div className="ficha-item"><small>Perfil</small><b>{(Array.isArray(modal.user?.roles)?modal.user.roles:[]).map(r=>ROLE_LABELS[r]||r).join(", ")||"-"}</b></div>
                  <div className="ficha-item"><small>Situação</small><b><em className={modal.user?.ativo?(modal.user?.primeiro_acesso_pendente?"warn":"ok"):"bad"}>
                    {modal.user?.ativo?(modal.user?.primeiro_acesso_pendente?"Primeiro acesso pendente":"Ativo"):"Inativo"}
                  </em></b></div>
                  <div className="ficha-item"><small>Último acesso</small><b>{modal.user?.ultimo_acesso?fmtTimestamp(modal.user.ultimo_acesso):"Nunca"}</b></div>
                  <div className="ficha-item"><small>Data troca de senha</small><b>{modal.user?.data_troca_senha?fmtTimestamp(modal.user.data_troca_senha):"-"}</b></div>
                  <div className="ficha-item"><small>Criado em</small><b>{modal.user?.created_at?fmtTimestamp(modal.user.created_at):"-"}</b></div>
                  {modal.user?.responsavel_ultima_alteracao&&<div className="ficha-item"><small>Última alteração por</small><b>{modal.user.responsavel_ultima_alteracao}</b></div>}
                  {modal.user?.motivo_bloqueio_inativacao&&<div className="ficha-item"><small>Motivo inativação</small><b>{modal.user.motivo_bloqueio_inativacao}</b></div>}
                </div>
              </section>
            </div>
          </div>
          <footer><Btn secondary icon={X} onClick={()=>setModal(null)}>Fechar</Btn></footer>
        </div>:modal.mode==="user-create"||modal.mode==="user-edit"?<UserForm modal={modal} close={()=>setModal(null)} onSaved={()=>{notify(modal.mode==="user-create"?"Usuário criado com sucesso!":"Usuário atualizado com sucesso!");loadPage();setModal(null)}}/>:
        modal.mode==="vinculo-edit"?<VinculoForm preceptor={modal.preceptor} vinculo={modal.vinculo} page={modal.page} onClose={()=>setModal(null)} onSaved={()=>{notify(modal.vinculo?"Vínculo atualizado com sucesso!":"Vínculo criado com sucesso!");setEditVinculosRefresh(n=>n+1);loadPage();setModal(null)}}/>:
        modal.mode==="marcar-pago"?<div className="form" style={{maxWidth:480,margin:"0 auto",padding:20}}>
          <h3 style={{marginBottom:12,color:"var(--navy-800)"}}>Marcar como pago</h3>
          <p style={{fontSize:13,marginBottom:16,color:"var(--text-muted)"}}>Preceptor: <strong>{modal.grupo?.nome}</strong></p>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)"}}>
                <span>Competência</span>
                <strong style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"#f8fafc"}}>{modal.competencia||"—"}</strong>
              </div>
              <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)"}}>
                <span>Data do Pagamento *</span>
                <input type="date" value={modal.dataPagamento||""} onChange={e=>setModal({...modal,dataPagamento:e.target.value})} style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)"}}/>
              </label>
              <div style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)"}}>
                <span>Valor Solicitado (R$)</span>
                <strong style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"#f8fafc"}}>{formatCurrencyBRL(Number(modal.sol?.valor_total_solicitado||0))}</strong>
              </div>
            </div>
            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)"}}>
              <span>Valor Pago (R$) *</span>
              <input type="number" step="0.01" value={modal.valorPago} onChange={e=>setModal({...modal,valorPago:e.target.value})} placeholder="0.00" style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)"}}/>
            </label>
            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)"}}>
              <span>Observação do Pagamento (opcional)</span>
              <textarea value={modal.observacao} onChange={e=>setModal({...modal,observacao:e.target.value})} placeholder="Comprovante, banco ou observações..." rows={3} style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)"}}/>
            </label>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20}}>
            <Btn secondary onClick={()=>setModal(null)} disabled={solicitacaoNotaLoading}>Cancelar</Btn>
            <Btn icon={CheckCheck} disabled={solicitacaoNotaLoading} onClick={()=>handleExecutarMarcarPago(modal)}>{solicitacaoNotaLoading?"Registrando...":"Confirmar pagamento"}</Btn>
          </div>
        </div>:
        modal.mode==="pag-lote"?<div className="form pag-lote-form" style={{maxWidth:520,margin:"0 auto",padding:20}}>
          <h3 style={{marginBottom:8,color:"var(--navy-800)"}}>Marcar selecionados como pagos</h3>
          <p style={{fontSize:13,marginBottom:16,color:"var(--text-muted)"}}>Pagamento em lote da competência <strong>{modal.competenciaLabel}</strong>. A prévia do banco é obrigatória antes de confirmar.</p>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="pag-lote-resumo" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)"}}>
                <span>Competência</span>
                <strong style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"#f8fafc"}}>{modal.competenciaLabel}</strong>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)"}}>
                <span>Preceptores selecionados</span>
                <strong style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"#f8fafc"}}>{modal.qtdSelecionada}</strong>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)"}}>
                <span>Valor total selecionado</span>
                <strong style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"#f8fafc"}}>{formatCurrencyBRL(Number(modal.valorTela||0))}</strong>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)"}}>
                <span>Bloqueados</span>
                <strong style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"#f8fafc",color:modal.previa&&Number(modal.previa.resumo?.qtd_bloqueada||0)>0?"var(--danger)":"var(--navy-800)"}}>
                  {modal.previaCarregando?"—":Number(modal.previa?.resumo?.qtd_bloqueada||0)}
                </strong>
              </div>
            </div>

            {modal.previaCarregando&&<div className="pag-lote-previa" style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,color:"var(--text-muted)",padding:"10px 12px",borderRadius:10,background:"var(--surface-soft)",border:"1px solid var(--border)"}}>
              <Loader2 size={15} className="spin"/> Carregando prévia de pagamento...
            </div>}

            {!modal.previaCarregando&&modal.previaErro&&<div className="pag-lote-previa" style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:12.5,color:"var(--danger)",padding:"10px 12px",borderRadius:10,background:"var(--danger-bg)",border:"1px solid #f3c1bd"}}>
              <AlertCircle size={15} style={{flex:"none",marginTop:1}}/> <span>{modal.previaErro}</span>
            </div>}

            {!modal.previaCarregando&&!modal.previaErro&&modal.previa&&<div className="pag-lote-previa" style={{display:"flex",flexDirection:"column",gap:6,fontSize:12.5,color:"var(--text)",padding:"10px 12px",borderRadius:10,background:"var(--surface-soft)",border:"1px solid var(--border)"}}>
              <span><b>Prévia:</b> {Number(modal.previa.resumo?.qtd_valida||0)} registro(s) válido(s) — {formatCurrencyBRL(Number(modal.previa.resumo?.valor_total_valido||0))}</span>
              <span><b>Bloqueados:</b> {Number(modal.previa.resumo?.qtd_bloqueada||0)}</span>
              {(modal.previa.bloqueios||[]).map((b,i)=>(
                <span key={i} style={{color:"var(--danger)"}}>• {b.preceptor_nome||"Preceptor"}: {b.motivo||b.codigo||"bloqueado"}</span>
              ))}
            </div>}

            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)"}}>
              <span>Data do Pagamento *</span>
              <input type="date" value={modal.dataPagamento||""} onChange={e=>setModal({...modal,dataPagamento:e.target.value})} disabled={solicitacaoNotaLoading||pagLoteExecutando} style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)"}}/>
            </label>
            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)"}}>
              <span>Observação (opcional)</span>
              <textarea value={modal.observacao||""} onChange={e=>setModal({...modal,observacao:e.target.value})} placeholder="Comprovante, banco ou observações comuns a todos..." rows={3} disabled={solicitacaoNotaLoading||pagLoteExecutando} style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)"}}/>
            </label>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20,flexWrap:"wrap"}}>
            <Btn secondary onClick={()=>setModal(null)} disabled={solicitacaoNotaLoading||pagLoteExecutando}>Cancelar</Btn>
            <Btn icon={CheckCheck} disabled={solicitacaoNotaLoading||pagLoteExecutando||modal.previaCarregando||!!modal.previaErro} onClick={()=>handleExecutarPagamentoLote(modal)}>{(solicitacaoNotaLoading||pagLoteExecutando)?"Registrando...":"Confirmar pagamentos"}</Btn>
          </div>
        </div>:
        <Form page={modal.page} close={()=>setModal(null)} save={handleSave} formData={formData} setFormData={setFormData} formOptions={formOptions} optionsLoading={formOptionsLoading} optionsErrors={formOptionsErrors} saving={saving} isEdit={!!modal.editId} vinculos={editVinculos} editSetModal={setModal} editId={modal.editId} onDeleteVinculo={isAdmin?handleAbrirExcluirVinculo:null} onDeletePreceptor={isAdmin?handleAbrirExcluirPreceptor:null} isAdmin={isAdmin} emailsCopiaLoading={emailsCopiaLoading}/>}
      </div>
    </div>}

    {refazerFluxoModal&&<div className="system-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!refazerFluxoExecutando){setRefazerFluxoModal(null);setRefazerFluxoPrevia(null);setRefazerFluxoEscopo("")}}}>
      <section className="system-dialog refazer-fluxo-dialog" role="dialog" aria-modal="true">
        <header>
          <div className="system-dialog-icon"><RotateCw/></div>
          <div>
            <small>GESTÃO DE PRECEPTORIA</small>
            <h3>Refazer fluxo</h3>
          </div>
          <button onClick={()=>{setRefazerFluxoModal(null);setRefazerFluxoPrevia(null);setRefazerFluxoEscopo("")}} disabled={refazerFluxoExecutando} aria-label="Fechar"><X/></button>
        </header>
        <div className="system-dialog-body" style={{overflowY:"auto",maxHeight:"70vh"}}>
          {refazerFluxoCarregando?<div style={{textAlign:"center",padding:32}}><Loader2 size={28} className="spin"/><p style={{marginTop:12,color:"var(--text-muted)"}}>Carregando prévia...</p></div>
          :refazerFluxoPrevia&&<>
            <div className="refazer-fluxo-info">
              <div className="refazer-fluxo-row"><b>Preceptor</b><span>{refazerFluxoModal.grupo.nome}</span></div>
              <div className="refazer-fluxo-row"><b>Competência</b><span>{apuracaoMesLabel(refazerFluxoModal.mes,refazerFluxoModal.ano)}</span></div>
            </div>

            {refazerFluxoPrevia.bloqueado&&<div className="finance-alert" style={{marginBottom:16}}>
              <div className="finance-alert-header">
                <AlertCircle size={18}/>
                <div>
                  <strong>Bloqueado</strong>
                  <small>{refazerFluxoPrevia.motivo_bloqueio||"Existe pagamento concluído e não pode ser reiniciado diretamente."}</small>
                </div>
              </div>
            </div>}

            {!refazerFluxoPrevia.bloqueado&&<>

              <div className="refazer-fluxo-escopo">
                <b>Escolha o escopo:</b>
                <label className={"refazer-fluxo-opcao"+(refazerFluxoEscopo==="uma"?" selected":"")}>
                  <input type="radio" name="refazer-escopo" value="uma" checked={refazerFluxoEscopo==="uma"} onChange={()=>setRefazerFluxoEscopo("uma")}/>
                  <div><b>Somente esta competência deste preceptor</b><small>{refazerFluxoPrevia.resumo?.total_calculos||0} cálculo(s) será(ão) removido(s)</small></div>
                </label>
              </div>

              {refazerFluxoPrevia.resumo&&<div className="refazer-fluxo-resumo">
                <div className="refazer-fluxo-resumo-title"><Calculator size={15}/><b>O que será removido:</b></div>
                <div className="refazer-fluxo-resumo-grid">
                  <div className="refazer-fluxo-resumo-item"><span>Cálculos</span><strong>{refazerFluxoPrevia.resumo.total_calculos||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Itens de cálculo</span><strong>{refazerFluxoPrevia.resumo.total_itens||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Solicitações NF</span><strong>{refazerFluxoPrevia.resumo.total_solicitacoes_nf||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Eventos NF</span><strong>{refazerFluxoPrevia.resumo.total_eventos_nf||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Aprovações</span><strong>{refazerFluxoPrevia.resumo.total_aprovacoes||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Presenças</span><strong>{refazerFluxoPrevia.resumo.total_presencas||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Escalas removidas</span><strong>{refazerFluxoPrevia.resumo.total_escalas_removidas||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Escalas preservadas</span><strong>{refazerFluxoPrevia.resumo.total_escalas_preservadas||0}</strong></div>
                </div>
              </div>}

              {refazerFluxoPrevia.calculos&&refazerFluxoPrevia.calculos.length>0&&<div className="refazer-fluxo-resumo">
                <div className="refazer-fluxo-resumo-title"><FileText size={15}/><b>Detalhes por cálculo:</b></div>
                {refazerFluxoPrevia.calculos.map((c,i)=>(
                  <div key={i} className="refazer-fluxo-calculo-detalhe">
                    <div className="refazer-fluxo-calculo-header">
                      <span className="vinculo-badge">{c.tipo_atuacao==="internato"?"Internato":"Prática"}</span>
                      <b>{c.preceptor_nome}</b>
                      {c.local_nome&&<small>{c.local_nome}</small>}
                    </div>
                    <div className="refazer-fluxo-calculo-dados">
                      <span>Valor: <strong>{formatCurrencyBRL(c.total_bruto||0)}</strong></span>
                      <span>Versão: <strong>v{c.versao||1}</strong></span>
                      <span>Itens: <strong>{c.itens_count||0}</strong></span>
                      <span>NF: <strong>{c.solicitacoes_count||0}</strong></span>
                      {c.aprovacoes_count>0&&<span>Aprovações: <strong>{c.aprovacoes_count}</strong></span>}
                    </div>
                    {c.calculo_status==="pago"&&<div className="refazer-fluxo-pago-badge"><LockKeyhole size={13}/> Pago</div>}
                  </div>
                ))}
              </div>}

              {refazerFluxoPrevia.escalas&&refazerFluxoPrevia.escalas.length>0&&<div className="refazer-fluxo-resumo">
                <div className="refazer-fluxo-resumo-title"><CalendarDays size={15}/><b>Escalas afetadas:</b></div>
                {refazerFluxoPrevia.escalas.map((e,i)=>(
                  <div key={i} className="refazer-fluxo-escala-item">
                    <span className={"refazer-fluxo-escala-badge"+(e.preservada?" preservada":" removida")}>{e.preservada?"Preservada":"Removida"}</span>
                    <span>{e.preceptor_nome} — {e.local_nome||"-"}</span>
                    {e.itens_dentro_competencia>0&&<small>{e.itens_dentro_competencia} item(ns) na competência</small>}
                  </div>
                ))}
              </div>}

              <div className="finance-alert" style={{marginTop:16}}>
                <div className="finance-alert-header">
                  <AlertCircle size={18}/>
                  <div>
                    <strong>Os dados operacionais e financeiros indicados serão removidos para permitir que o fluxo seja iniciado novamente pela Escala.</strong>
                    <small>O cadastro do preceptor e das atuações será preservado.</small>
                  </div>
                </div>
              </div>

              {!refazerFluxoEscopo&&<p style={{fontSize:12,color:"var(--text-muted)",textAlign:"center",marginTop:12}}>Selecione o escopo para habilitar a confirmação.</p>}
            </>}
          </>}
        </div>
        <footer className="calculo-modal-footer" style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="btn secondary" onClick={()=>{setRefazerFluxoModal(null);setRefazerFluxoPrevia(null);setRefazerFluxoEscopo("")}} disabled={refazerFluxoExecutando}>Cancelar</button>
          {!refazerFluxoPrevia?.bloqueado&&<button className="btn danger" onClick={handleExecutarRefazerFluxo} disabled={refazerFluxoExecutando||!refazerFluxoEscopo}>
            {refazerFluxoExecutando?<><Loader2 size={16} className="spin"/> Apagando...</>:<><Trash2 size={16}/> Apagar e refazer</>}
          </button>}
        </footer>
      </section>
    </div>}

    {refazerVinculoModal&&<div className="system-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!refazerVinculoExecutando)fecharRefazerVinculo()}}>
      <section className="system-dialog refazer-fluxo-dialog" role="dialog" aria-modal="true">
        <header>
          <div className="system-dialog-icon"><RotateCw/></div>
          <div>
            <small>GESTÃO DE PRECEPTORIA</small>
            <h3>Refazer vínculo</h3>
          </div>
          <button onClick={fecharRefazerVinculo} disabled={refazerVinculoExecutando} aria-label="Fechar"><X/></button>
        </header>
        <div className="system-dialog-body" style={{overflowY:"auto",maxHeight:"70vh"}}>
          {refazerVinculoCarregando?<div style={{textAlign:"center",padding:32}}><Loader2 size={28} className="spin"/><p style={{marginTop:12,color:"var(--text-muted)"}}>Carregando prévia...</p></div>
          :refazerVinculoPrevia&&<>
            <div className="refazer-fluxo-info">
              <div className="refazer-fluxo-row"><b>Preceptor</b><span>{refazerVinculoPrevia.vinculo?.preceptor_nome||refazerVinculoModal.row?.preceptor_nome||"-"}</span></div>
              <div className="refazer-fluxo-row"><b>Vínculo</b><span>{refazerVinculoPrevia.vinculo?.tipo==="adm"?"Prática":"Internato"} — {refazerVinculoPrevia.vinculo?.descricao||"-"}</span></div>
              <div className="refazer-fluxo-row"><b>Local / Setor</b><span>{refazerVinculoPrevia.vinculo?.local_nome||"-"} / {refazerVinculoPrevia.vinculo?.setor_nome||"-"}</span></div>
            </div>

            {refazerVinculoPrevia.bloqueado&&<div className="finance-alert" style={{marginBottom:16}}>
              <div className="finance-alert-header">
                <AlertCircle size={18}/>
                <div>
                  <strong>Bloqueado</strong>
                  <small>{refazerVinculoPrevia.motivo_bloqueio||"Existe pagamento concluído e este vínculo não pode ser refazido diretamente."}</small>
                </div>
              </div>
            </div>}

            {!refazerVinculoPrevia.bloqueado&&<>
              {refazerVinculoPrevia.resumo&&<div className="refazer-fluxo-resumo">
                <div className="refazer-fluxo-resumo-title"><Calculator size={15}/><b>O que será removido:</b></div>
                <div className="refazer-fluxo-resumo-grid">
                  <div className="refazer-fluxo-resumo-item"><span>Escalas</span><strong>{refazerVinculoPrevia.resumo.total_escalas||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Itens de escala</span><strong>{refazerVinculoPrevia.resumo.total_escalas_itens||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Presenças</span><strong>{refazerVinculoPrevia.resumo.total_presencas||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Cálculos</span><strong>{refazerVinculoPrevia.resumo.total_calculos||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Itens de cálculo</span><strong>{refazerVinculoPrevia.resumo.total_calculo_itens||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Revisões financeiras</span><strong>{refazerVinculoPrevia.resumo.total_aprovacoes||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Itens de solicitação NF</span><strong>{refazerVinculoPrevia.resumo.total_solicitacoes_itens||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Eventos NF</span><strong>{refazerVinculoPrevia.resumo.total_eventos_nf||0}</strong></div>
                </div>
              </div>}

              <div className="finance-alert" style={{marginTop:16}}>
                <div className="finance-alert-header">
                  <AlertCircle size={18}/>
                  <div>
                    <strong>O cadastro do preceptor e do vínculo será preservado. A escala, as presenças, os cálculos e as etapas posteriores deste vínculo serão removidos para permitir começar novamente pela criação da escala.</strong>
                  </div>
                </div>
              </div>
            </>}
          </>}
        </div>
        <footer className="calculo-modal-footer" style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="btn secondary" onClick={fecharRefazerVinculo} disabled={refazerVinculoExecutando}>Cancelar</button>
          {!refazerVinculoPrevia?.bloqueado&&<button className="btn danger" onClick={handleExecutarRefazerVinculo} disabled={refazerVinculoExecutando||refazerVinculoCarregando||!refazerVinculoPrevia}>
            {refazerVinculoExecutando?<><Loader2 size={16} className="spin"/> Apagando...</>:<><Trash2 size={16}/> Apagar e refazer</>}
          </button>}
        </footer>
      </section>
    </div>}

    {excluirVinculoModal&&<div className="system-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!excluirVinculoExecutando)fecharExcluirVinculo()}}>
      <section className="system-dialog refazer-fluxo-dialog" role="dialog" aria-modal="true">
        <header>
          <div className="system-dialog-icon" style={{color:"#dc2626"}}><Trash2/></div>
          <div>
            <small>GESTÃO DE PRECEPTORIA</small>
            <h3>Excluir vínculo permanentemente</h3>
          </div>
          <button onClick={fecharExcluirVinculo} disabled={excluirVinculoExecutando} aria-label="Fechar"><X/></button>
        </header>
        <div className="system-dialog-body" style={{overflowY:"auto",maxHeight:"70vh"}}>
          {excluirVinculoCarregando?<div style={{textAlign:"center",padding:32}}><Loader2 size={28} className="spin"/><p style={{marginTop:12,color:"var(--text-muted)"}}>Carregando prévia...</p></div>
          :excluirVinculoPrevia&&<>
            <div className="refazer-fluxo-info">
              <div className="refazer-fluxo-row"><b>Preceptor</b><span>{excluirVinculoPrevia.vinculo?.preceptor_nome||"-"}</span></div>
              <div className="refazer-fluxo-row"><b>Vínculo</b><span>{excluirVinculoPrevia.vinculo?.tipo==="adm"?"Prática":"Internato"} — {excluirVinculoPrevia.vinculo?.descricao||"-"}</span></div>
              <div className="refazer-fluxo-row"><b>Local / Setor</b><span>{excluirVinculoPrevia.vinculo?.local_nome||"-"} / {excluirVinculoPrevia.vinculo?.setor_nome||"-"}</span></div>
            </div>

            {excluirVinculoPrevia.bloqueado&&<div className="finance-alert" style={{marginBottom:16}}>
              <div className="finance-alert-header">
                <AlertCircle size={18}/>
                <div>
                  <strong>Bloqueado</strong>
                  <small>{excluirVinculoPrevia.motivo_bloqueio||"Existe pagamento concluído e este vínculo não pode ser excluído diretamente."}</small>
                </div>
              </div>
            </div>}

            {!excluirVinculoPrevia.bloqueado&&<>
              {excluirVinculoPrevia.resumo&&<div className="refazer-fluxo-resumo">
                <div className="refazer-fluxo-resumo-title"><Calculator size={15}/><b>O que será excluído permanentemente:</b></div>
                <div className="refazer-fluxo-resumo-grid">
                  <div className="refazer-fluxo-resumo-item"><span>Escalas</span><strong>{excluirVinculoPrevia.resumo.total_escalas||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Itens de escala</span><strong>{excluirVinculoPrevia.resumo.total_escalas_itens||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Presenças</span><strong>{excluirVinculoPrevia.resumo.total_presencas||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Cálculos</span><strong>{excluirVinculoPrevia.resumo.total_calculos||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Itens de cálculo</span><strong>{excluirVinculoPrevia.resumo.total_calculo_itens||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Revisões financeiras</span><strong>{excluirVinculoPrevia.resumo.total_aprovacoes||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Solicitações fiscais</span><strong>{excluirVinculoPrevia.resumo.total_solicitacoes||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Itens de solicitação NF</span><strong>{excluirVinculoPrevia.resumo.total_solicitacoes_itens||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Pagamentos</span><strong>{excluirVinculoPrevia.resumo.total_pagamentos||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Movimentos de saldo</span><strong>{excluirVinculoPrevia.resumo.total_saldo_movimentos||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Coordenadores</span><strong>{excluirVinculoPrevia.resumo.total_coordenadores||0}</strong></div>
                </div>
              </div>}

              <div className="finance-alert" style={{marginTop:16}}>
                <div className="finance-alert-header">
                  <AlertCircle size={18}/>
                  <div>
                    <strong>Esta ação excluirá permanentemente o vínculo selecionado e todos os dados dependentes. O cadastro do preceptor e os demais vínculos serão preservados.</strong>
                  </div>
                </div>
              </div>

              <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)",marginTop:16}}>
                <span>Digite <b>EXCLUIR</b> para confirmar</span>
                <input type="text" value={excluirVinculoTexto} onChange={e=>setExcluirVinculoTexto(e.target.value)} placeholder="EXCLUIR" autoComplete="off" style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)"}}/>
              </label>
            </>}
          </>}
        </div>
        <footer className="calculo-modal-footer" style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="btn secondary" onClick={fecharExcluirVinculo} disabled={excluirVinculoExecutando}>Cancelar</button>
          {!excluirVinculoPrevia?.bloqueado&&<button className="btn danger" onClick={handleExecutarExcluirVinculo} disabled={excluirVinculoExecutando||excluirVinculoCarregando||!excluirVinculoPrevia||excluirVinculoTexto.trim()!=="EXCLUIR"}>
            {excluirVinculoExecutando?<><Loader2 size={16} className="spin"/> Excluindo...</>:<><Trash2 size={16}/> Excluir permanentemente</>}
          </button>}
        </footer>
      </section>
    </div>}

    {excluirPreceptorModal&&<div className="system-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!excluirPreceptorExecutando)fecharExcluirPreceptor()}}>
      <section className="system-dialog refazer-fluxo-dialog" role="dialog" aria-modal="true">
        <header>
          <div className="system-dialog-icon" style={{color:"#dc2626"}}><Trash2/></div>
          <div>
            <small>GESTÃO DE PRECEPTORIA</small>
            <h3>Excluir preceptor permanentemente</h3>
          </div>
          <button onClick={fecharExcluirPreceptor} disabled={excluirPreceptorExecutando} aria-label="Fechar"><X/></button>
        </header>
        <div className="system-dialog-body" style={{overflowY:"auto",maxHeight:"70vh"}}>
          {excluirPreceptorCarregando?<div style={{textAlign:"center",padding:32}}><Loader2 size={28} className="spin"/><p style={{marginTop:12,color:"var(--text-muted)"}}>Carregando prévia...</p></div>
          :excluirPreceptorPrevia&&<>
            <div className="refazer-fluxo-info">
              <div className="refazer-fluxo-row"><b>Preceptor</b><span>{excluirPreceptorPrevia.preceptor?.nome||"-"}</span></div>
              <div className="refazer-fluxo-row"><b>CPF</b><span>{excluirPreceptorPrevia.preceptor?.cpf||"-"}</span></div>
              <div className="refazer-fluxo-row"><b>E-mail principal</b><span>{excluirPreceptorPrevia.preceptor?.email||"-"}</span></div>
            </div>

            {excluirPreceptorPrevia.bloqueado&&<div className="finance-alert" style={{marginBottom:16}}>
              <div className="finance-alert-header">
                <AlertCircle size={18}/>
                <div>
                  <strong>Bloqueado</strong>
                  <small>{excluirPreceptorPrevia.motivo_bloqueio||"Existe pagamento concluído e este preceptor não pode ser excluído."}</small>
                </div>
              </div>
            </div>}

            {!excluirPreceptorPrevia.bloqueado&&<>
              {excluirPreceptorPrevia.resumo&&<div className="refazer-fluxo-resumo">
                <div className="refazer-fluxo-resumo-title"><Calculator size={15}/><b>O que será excluído permanentemente:</b></div>
                <div className="refazer-fluxo-resumo-grid">
                  <div className="refazer-fluxo-resumo-item"><span>Vínculos</span><strong>{excluirPreceptorPrevia.resumo.total_vinculos||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Coordenadores associados</span><strong>{excluirPreceptorPrevia.resumo.total_coordenadores||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Escalas</span><strong>{excluirPreceptorPrevia.resumo.total_escalas||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Itens de escala</span><strong>{excluirPreceptorPrevia.resumo.total_escalas_itens||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Presenças</span><strong>{excluirPreceptorPrevia.resumo.total_presencas||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Cálculos</span><strong>{excluirPreceptorPrevia.resumo.total_calculos||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Itens de cálculo</span><strong>{excluirPreceptorPrevia.resumo.total_calculo_itens||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Revisões financeiras</span><strong>{excluirPreceptorPrevia.resumo.total_aprovacoes||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Solicitações fiscais</span><strong>{excluirPreceptorPrevia.resumo.total_solicitacoes||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Itens de solicitação NF</span><strong>{excluirPreceptorPrevia.resumo.total_solicitacoes_itens||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Eventos fiscais</span><strong>{excluirPreceptorPrevia.resumo.total_solicitacoes_eventos||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Pagamentos</span><strong>{excluirPreceptorPrevia.resumo.total_pagamentos||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Itens de pagamento</span><strong>{excluirPreceptorPrevia.resumo.total_processo_calculos||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Movimentos de saldo</span><strong>{excluirPreceptorPrevia.resumo.total_saldo_movimentos||0}</strong></div>
                  <div className="refazer-fluxo-resumo-item"><span>Arquivos e registros dependentes</span><strong>{excluirPreceptorPrevia.resumo.total_arquivos_registros||0}</strong></div>
                </div>
              </div>}

              <div className="finance-alert" style={{marginTop:16}}>
                <div className="finance-alert-header">
                  <AlertCircle size={18}/>
                  <div>
                    <strong>Esta ação excluirá permanentemente o preceptor, todos os vínculos e todos os dados dependentes. A ação não poderá ser desfeita.</strong>
                  </div>
                </div>
              </div>

              <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,fontWeight:600,color:"var(--navy-800)",marginTop:16}}>
                <span>Digite <b>EXCLUIR</b> para confirmar</span>
                <input type="text" value={excluirPreceptorTexto} onChange={e=>setExcluirPreceptorTexto(e.target.value)} placeholder="EXCLUIR" autoComplete="off" style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)"}}/>
              </label>
            </>}
          </>}
        </div>
        <footer className="calculo-modal-footer" style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="btn secondary" onClick={fecharExcluirPreceptor} disabled={excluirPreceptorExecutando}>Cancelar</button>
          {!excluirPreceptorPrevia?.bloqueado&&<button className="btn danger" onClick={handleExecutarExcluirPreceptor} disabled={excluirPreceptorExecutando||excluirPreceptorCarregando||!excluirPreceptorPrevia||excluirPreceptorTexto.trim()!=="EXCLUIR"}>
            {excluirPreceptorExecutando?<><Loader2 size={16} className="spin"/> Excluindo...</>:<><Trash2 size={16}/> Excluir permanentemente</>}
          </button>}
        </footer>
      </section>
    </div>}


    {/* ============ MODAL: CONFIRMAR ENVIO ============ */}
    {modalConfirmarEnvio && (() => {
      const { grupo, solicitacao } = modalConfirmarEnvio;
      const dataPrep = solicitacao?.criada_em || solicitacao?.atualizada_em;
      return (
        <div className="system-dialog-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalConfirmarEnvio(null); }}>
          <section className="system-dialog nota-modal" role="dialog" aria-modal="true" aria-labelledby="modal-confirmar-envio-title">
            <header>
              <div className="system-dialog-icon"><Send/></div>
              <div>
                <small>SOLICITAÇÃO FISCAL</small>
                <h3 id="modal-confirmar-envio-title">Confirmar envio da solicitação</h3>
              </div>
              <button onClick={() => setModalConfirmarEnvio(null)} aria-label="Fechar"><X/></button>
            </header>
            <div className="system-dialog-body">
              <div className="finance-alert" style={{marginBottom:16,borderLeft:'4px solid var(--accent-warning,#f59e0b)'}}>
                <div className="finance-alert-header">
                  <AlertCircle size={18}/>
                  <div>
                    <strong>Confirme somente depois de enviar o e-mail pelo Outlook.</strong>
                    <small>Esta ação registrará que a solicitação de nota fiscal foi enviada ao preceptor.</small>
                  </div>
                </div>
              </div>
              <div className="nota-modal-resumo">
                <div className="nota-modal-resumo-row"><span>Preceptor</span><strong>{grupo.nome}</strong></div>
                <div className="nota-modal-resumo-row"><span>Competência</span><strong>{solicitacao?.competencia_rotulo || apuracaoMesLabel(grupo.mes, grupo.ano)}</strong></div>
                <div className="nota-modal-resumo-row"><span>Atuações incluídas</span><strong>{solicitacao?.qtd_atuacoes || grupo.vinculos?.length || 0}</strong></div>
                <div className="nota-modal-resumo-row"><span>Valor total solicitado</span><strong>{formatCurrencyBRL(solicitacao?.valor_total_solicitado || grupo.totalGrupo || 0)}</strong></div>
                {dataPrep && <div className="nota-modal-resumo-row"><span>E-mail preparado em</span><strong>{fmtTimestamp(dataPrep)}</strong></div>}
              </div>
            </div>
            <footer className="calculo-modal-footer" style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn secondary" onClick={() => setModalConfirmarEnvio(null)} disabled={solicitacaoNotaLoading}>Cancelar</button>
              <button className="btn primary nota-btn-confirmar" id="btn-confirmar-envio-final" disabled={solicitacaoNotaLoading} onClick={async () => {
                if (solicitacaoNotaLoading) return;
                setSolicitacaoNotaLoading(true);
                try {
                  await confirmarEnvioSolicitacaoNota(solicitacao.id);
                  setModalConfirmarEnvio(null);
                  await carregarSolicitacoesFiscais();
                  notify('Envio da solicitação confirmado com sucesso!');
                } catch (e) {
                  await systemAlert(mensagemErroAmigavel(e, 'Não foi possível confirmar o envio da solicitação. Tente novamente.'), 'Erro');
                } finally { setSolicitacaoNotaLoading(false); }
              }}>
                {solicitacaoNotaLoading ? <><Loader2 size={15} className="spin"/> Confirmando...</> : <><Send size={15}/> Confirmar envio</>}
              </button>
            </footer>
          </section>
        </div>
      );
    })()}

    {/* ============ MODAL: CORRIGIR CONFIRMAÇÃO (Admin) ============ */}
    {modalCorrigirEnvio && (() => {
      const { grupo, solicitacao, motivo } = modalCorrigirEnvio;
      return (
        <div className="system-dialog-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !solicitacaoNotaLoading) setModalCorrigirEnvio(null); }}>
          <section className="system-dialog nota-modal" role="dialog" aria-modal="true" aria-labelledby="modal-corrigir-envio-title">
            <header>
              <div className="system-dialog-icon"><RotateCw/></div>
              <div>
                <small>CORREÇÃO DE CONFIRMAÇÃO — ADMIN</small>
                <h3 id="modal-corrigir-envio-title">Corrigir confirmação de envio</h3>
              </div>
              <button onClick={() => setModalCorrigirEnvio(null)} disabled={solicitacaoNotaLoading} aria-label="Fechar"><X/></button>
            </header>
            <div className="system-dialog-body">
              <div className="finance-alert" style={{marginBottom:16,borderLeft:'4px solid var(--accent-danger,#ef4444)'}}>
                <div className="finance-alert-header">
                  <AlertCircle size={18}/>
                  <div>
                    <strong>Ação reservada para Administradores</strong>
                    <small>A solicitação voltará para o estado "preparada". O registro do envio anterior será preservado no histórico.</small>
                  </div>
                </div>
              </div>
              <div className="nota-modal-resumo" style={{marginBottom:16}}>
                <div className="nota-modal-resumo-row"><span>Preceptor</span><strong>{grupo.nome}</strong></div>
                <div className="nota-modal-resumo-row"><span>Competência</span><strong>{solicitacao?.competencia_rotulo || apuracaoMesLabel(grupo.mes, grupo.ano)}</strong></div>
              </div>
              <label className="nota-modal-label">
                Motivo da correção <span style={{color:'var(--accent-danger,#ef4444)'}}>*</span>
                <textarea
                  className="nota-modal-textarea"
                  rows={3}
                  maxLength={300}
                  placeholder="Descreva brevemente o motivo da correção..."
                  value={motivo}
                  onChange={e => setModalCorrigirEnvio(prev => ({ ...prev, motivo: e.target.value }))}
                />
                <small style={{color:'var(--text-muted)'}}>{motivo?.length || 0}/300</small>
              </label>
            </div>
            <footer className="calculo-modal-footer" style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn secondary" onClick={() => setModalCorrigirEnvio(null)} disabled={solicitacaoNotaLoading}>Cancelar</button>
              <button className="btn danger" id="btn-corrigir-envio-final" disabled={solicitacaoNotaLoading || !motivo?.trim()} onClick={async () => {
                if (solicitacaoNotaLoading || !motivo?.trim()) return;
                setSolicitacaoNotaLoading(true);
                try {
                  await corrigirConfirmacaoEnvioNota(solicitacao.id, motivo.trim(), currentProfileId);
                  setModalCorrigirEnvio(null);
                  await carregarSolicitacoesFiscais();
                  notify('Confirmação corrigida. Solicitação retornou para "preparada".');
                } catch (e) {
                  await systemAlert('Erro ao corrigir confirmação: ' + (e.message || e), 'Erro');
                } finally { setSolicitacaoNotaLoading(false); }
              }}>
                {solicitacaoNotaLoading ? <><Loader2 size={15} className="spin"/> Corrigindo...</> : <><RotateCw size={15}/> Corrigir confirmação</>}
              </button>
            </footer>
          </section>
        </div>
      );
    })()}

    {/* ============ MODAL: HISTÓRICO ============ */}
    {modalHistoricoNota && (() => {
      const { grupo, solicitacao, historico, loading: histLoading } = modalHistoricoNota;
      const eventoLabel = (tipo) => {
        const labels = {
          'preparada': 'E-mail preparado',
          'email_preparado': 'E-mail preparado',
          'enviada': 'Solicitação confirmada como enviada',
          'confirmacao_corrigida': 'Correção de confirmação',
          'nota_recebida': 'Nota fiscal recebida',
          'nota_recebida_divergencia': 'Nota fiscal recebida com divergência',
          'divergencia': 'Divergência registrada',
        };
        return labels[tipo] || tipo?.replaceAll('_', ' ') || 'Evento';
      };
      return (
        <div className="system-dialog-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalHistoricoNota(null); }}>
          <section className="system-dialog nota-modal nota-historico-modal" role="dialog" aria-modal="true" aria-labelledby="modal-historico-title">
            <header>
              <div className="system-dialog-icon"><History/></div>
              <div>
                <small>HISTÓRICO DA SOLICITAÇÃO FISCAL</small>
                <h3 id="modal-historico-title">{grupo.nome}</h3>
              </div>
              <button onClick={() => setModalHistoricoNota(null)} aria-label="Fechar"><X/></button>
            </header>
            <div className="system-dialog-body" style={{overflowY:'auto',maxHeight:'60vh'}}>
              {histLoading ? (
                <div style={{textAlign:'center',padding:32}}><Loader2 size={28} className="spin"/><p style={{marginTop:12,color:'var(--text-muted)'}}>Carregando histórico...</p></div>
              ) : historico.length === 0 ? (
                <div style={{textAlign:'center',padding:32,color:'var(--text-muted)'}}>
                  <History size={32} style={{opacity:.4}}/><p style={{marginTop:12}}>Nenhum evento registrado ainda.</p>
                </div>
              ) : (
                <ol className="nota-historico-timeline">
                  {historico.map((ev, i) => (
                    <li key={ev.id || i} className={`nota-historico-item ${ev.tipo_evento?.includes('divergencia') || ev.tipo_evento?.includes('corrigida') ? 'nota-historico-aviso' : ''}`}>
                      <div className="nota-historico-icone">
                        {ev.tipo_evento?.includes('enviada') ? <Send size={14}/> :
                         ev.tipo_evento?.includes('recebida') ? <ReceiptText size={14}/> :
                         ev.tipo_evento?.includes('divergencia') ? <AlertCircle size={14}/> :
                         ev.tipo_evento?.includes('corrigida') ? <RotateCw size={14}/> :
                         <Mail size={14}/>}
                      </div>
                      <div className="nota-historico-corpo">
                        <strong>{eventoLabel(ev.tipo_evento)}</strong>
                        <span className="nota-historico-meta">
                          {ev.usuario_nome && <>{ev.usuario_nome} · </>}
                          {fmtTimestamp(ev.criado_em)}
                        </span>
                        {ev.observacao && <p className="nota-historico-obs">{ev.observacao}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <footer className="calculo-modal-footer" style={{display:'flex',justifyContent:'flex-end'}}>
              <button className="btn secondary" onClick={() => setModalHistoricoNota(null)}>Fechar</button>
            </footer>
          </section>
        </div>
      );
    })()}

    {toast&&<div className={"toast "+toastType}><i>{toastType==="error"?<AlertCircle/>:<Check/>}</i>{toast}</div>}
  </main>;
}

function FolhaPresenca({ row, onClose }) {
  const [gerando, setGerando] = useState(false);
  const [correcao, setCorrecao] = useState(null);
  const [correcaoData, setCorrecaoData] = useState('');
  const [correcaoTurno, setCorrecaoTurno] = useState('');
  const [correcaoJustificativa, setCorrecaoJustificativa] = useState('');
  const [corrigindo, setCorrigindo] = useState(false);
  const [correcaoErro, setCorrecaoErro] = useState('');
  const [pdfError, setPdfError] = useState(null);

  const itens = Array.isArray(row.itens) ? row.itens : [];

  const meses = useMemo(() => {
    const porMes = {};
    itens.forEach(i => {
      if (!i.data_presenca) return;
      const mk = String(i.data_presenca).slice(0, 7);
      if (!porMes[mk]) porMes[mk] = {};
      if (!porMes[mk][i.data_presenca]) porMes[mk][i.data_presenca] = { manha: '', tarde: '', noite: '' };
      porMes[mk][i.data_presenca][i.turno] = 'X';
    });
    return Object.keys(porMes).sort().map(mk => ({
      key: mk,
      label: fmtCompetencia(mk),
      dias: Object.keys(porMes[mk]).sort().map(dk => ({ data: dk, ...porMes[mk][dk] }))
    }));
  }, [itens]);

  const handleBaixarPDF = async () => {
    setGerando(true); setPdfError(null);
    try {
      const rows = await fetchFolhaPresenca({ preceptorId: row.preceptor_id, competencia: row.competencia });
      const detalhe = (rows || []).find(r => r.preceptor_id === row.preceptor_id && r.competencia === row.competencia && r.local_id === row.local_id) || (rows || [])[0];
      if (!detalhe) throw new Error('Nenhum registro real de presença encontrado.');
      gerarFolhaPresencaPDF(detalhe);
    } catch (e) {
      const msg = String(e.message || e || '');
      if (msg.includes('out of range') || msg.includes('date/time field')) {
        setPdfError('Erro ao consultar presenças: período com data inválida. Tente novamente ou selecione outro mês.');
      } else {
        setPdfError(msg || 'Erro ao gerar o PDF.');
      }
    } finally {
      setGerando(false);
    }
  };

  async function salvarCorrecao(){
    if(!correcao||!correcaoData||!correcaoTurno||correcaoJustificativa.trim().length<10){setCorrecaoErro('Informe data, turno e uma justificativa com pelo menos 10 caracteres.');return;}
    setCorrigindo(true);setCorrecaoErro('');
    try{
      await corrigirPresencaAdministrativa({presencaId:correcao.id,novaData:correcaoData,novoTurno:correcaoTurno,justificativa:correcaoJustificativa.trim()});
      setCorrecao(null);
      window.location.reload();
    }catch(e){setCorrecaoErro(e.message||'Não foi possível corrigir a presença.');}
    finally{setCorrigindo(false);}
  }
  return <div className="folha">
    <div className="folha-corpo">
      <div className="folha-brand">
        <Logo variant="completa" className="folha-logo" />
        <div className="folha-titulo">
          <small>MEDICINA UNINASSAU</small>
          <h3>Folha de Presença da Preceptoria</h3>
        </div>
      </div>

      <div className="ficha-grid">
        <div className="ficha-item"><small>Preceptor</small><b>{row.preceptor_nome}</b></div>
        <div className="ficha-item"><small>Competência</small><b>{row.competencia_label || row.competencia}</b></div>
        <div className="ficha-item"><small>Modalidade</small><b>{row.modalidade_label}</b></div>
        {row.unidade_nome && row.unidade_nome !== '-' && <div className="ficha-item"><small>Unidade</small><b>{row.unidade_nome}</b></div>}
        {row.tipo_atuacao === 'adm' && row.disciplina_nome && <div className="ficha-item"><small>Disciplina</small><b>{row.disciplina_nome}</b></div>}
        {row.tipo_atuacao === 'internato' && row.internato_nome && <div className="ficha-item"><small>Internato</small><b>{row.internato_nome}</b></div>}
        {row.periodo_nome && <div className="ficha-item"><small>Período</small><b>{row.periodo_nome}</b></div>}
        {row.local_nome && row.local_nome !== '-' && <div className="ficha-item"><small>Local</small><b>{row.local_nome}</b></div>}
        {row.setor_nome && <div className="ficha-item"><small>Setor</small><b>{row.setor_nome}</b></div>}
        <div className="ficha-item"><small>Total de turnos confirmados</small><b>{row.total_turnos || 0}</b></div>
      </div>

      <div className="folha-tablewrap">
        <table className="folha-table">
          <thead>
            <tr><th>Data</th><th>Dia da semana</th><th>Manhã</th><th>Tarde</th><th>Noite</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {meses.length === 0 && <tr><td colSpan={6} className="folha-vazio">Nenhuma presença real registrada.</td></tr>}
            {meses.map(m => (
              <React.Fragment key={m.key}>
                <tr className="folha-mes"><td colSpan={6}>{m.label}</td></tr>
                {m.dias.map(d => (
                  <tr key={d.data}>
                    <td>{fmtData(d.data)}</td>
                    <td>{diaSemanaStr(d.data)}</td>
                    <td className={d.manha ? 'folha-marcado' : ''}>{d.manha}</td>
                    <td className={d.tarde ? 'folha-marcado' : ''}>{d.tarde}</td>
                    <td className={d.noite ? 'folha-marcado' : ''}>{d.noite}</td>
                    <td><button className="presence-correct-btn" onClick={()=>{const item=itens.find(i=>i.data_presenca===d.data);if(item){setCorrecao(item);setCorrecaoData(item.data_presenca);setCorrecaoTurno(item.turno);setCorrecaoJustificativa('');setCorrecaoErro('');}}}><Pencil size={14}/> Corrigir</button></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    {correcao&&<div className="presence-correction-box">
      <div className="presence-correction-head"><div><small>CORREÇÃO ADMINISTRATIVA</small><b>Corrigir presença registrada</b></div><button onClick={()=>setCorrecao(null)}><X size={18}/></button></div>
      <p>A correção preservará o registro anterior na auditoria e poderá alterar a apuração financeira.</p>
      <div className="presence-correction-grid">
        <label><span>Data correta</span><input type="date" value={correcaoData} onChange={e=>setCorrecaoData(e.target.value)}/></label>
        <label><span>Turno correto</span><select value={correcaoTurno} onChange={e=>setCorrecaoTurno(e.target.value)}><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option></select></label>
        <label className="wide"><span>Justificativa obrigatória</span><textarea value={correcaoJustificativa} onChange={e=>setCorrecaoJustificativa(e.target.value)} placeholder="Explique o motivo da correção..." rows={3}/></label>
      </div>
      {correcaoErro&&<div className="presence-correction-error">{correcaoErro}</div>}
      <div className="presence-correction-actions"><Btn secondary icon={X} onClick={()=>setCorrecao(null)}>Cancelar</Btn><Btn icon={Check} onClick={salvarCorrecao} disabled={corrigindo}>{corrigindo?'Salvando...':'Salvar correção'}</Btn></div>
    </div>}
    <div className="folha-footer">
      {pdfError && <small className="folha-erro">{pdfError}</small>}
      <Btn icon={Download} onClick={handleBaixarPDF} disabled={gerando}>{gerando ? 'Gerando PDF...' : 'Baixar PDF'}</Btn>
      <Btn secondary icon={X} onClick={onClose}>Fechar</Btn>
    </div>
  </div>;
}

function RegistrarPresencaCoordenador({ userId, onClose, onSaved }) {
  const [dataSel, setDataSel] = useState(() => { const d = new Date(); d.setHours(12,0,0,0); return d; });
  const [calMes, setCalMes] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [preceptores, setPreceptores] = useState([]);
  const [loadingPrec, setLoadingPrec] = useState(false);
  const [preceptorSel, setPreceptorSel] = useState(null);
  const [turnosSel, setTurnosSel] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erroLocal, setErroLocal] = useState('');

  const dataStr = useMemo(() => {
    const d = dataSel;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }, [dataSel]);

  useEffect(() => {
    setPreceptorSel(null); setTurnosSel([]); setErroLocal('');
    setLoadingPrec(true);
    fetchPreceptoresComEscalaNoDia(dataStr)
      .then(d => setPreceptores(Array.isArray(d) ? d : []))
      .catch(e => setErroLocal('Erro ao buscar preceptores: ' + e.message))
      .finally(() => setLoadingPrec(false));
  }, [dataStr]);

  const turnosPrevistos = useMemo(() => {
    if (!preceptorSel) return [];
    const arr = preceptorSel.turnos_previstos;
    return Array.isArray(arr) ? arr.map(String) : [];
  }, [preceptorSel]);

  const turnosJaRegistrados = useMemo(() => {
    if (!preceptorSel) return [];
    const arr = preceptorSel.turnos_ja_registrados;
    return Array.isArray(arr) ? arr.map(String) : [];
  }, [preceptorSel]);

  function toggleTurno(t) { setTurnosSel(prev => prev.includes(t) ? prev.filter(x => x!==t) : [...prev, t]); }

  const diasNoMes = useMemo(() => {
    const primeiro = new Date(calMes.getFullYear(), calMes.getMonth(), 1);
    const ultimo = new Date(calMes.getFullYear(), calMes.getMonth()+1, 0);
    const dias = [];
    const offset = primeiro.getDay()===0 ? 6 : primeiro.getDay()-1;
    for (let i=0; i<offset; i++) dias.push(null);
    for (let d=1; d<=ultimo.getDate(); d++) dias.push(new Date(calMes.getFullYear(), calMes.getMonth(), d));
    return dias;
  }, [calMes]);

  function prevMes() { setCalMes(m => { const n = new Date(m); n.setMonth(n.getMonth()-1); return n; }); }
  function nextMes() { setCalMes(m => { const n = new Date(m); n.setMonth(n.getMonth()+1); return n; }); }
  function selecionarDia(d) { setDataSel(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)); }
  function isDataSel(d) { return d && d.getDate()===dataSel.getDate() && d.getMonth()===dataSel.getMonth() && d.getFullYear()===dataSel.getFullYear(); }

  const dataLabel = dataSel.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const mesLabel = calMes.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
  const DIAS_SEMANA = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const TURNO_LABELS = { manha:'Manhã', tarde:'Tarde', noite:'Noite' };

  async function confirmar() {
    if (!preceptorSel) { setErroLocal('Selecione um preceptor.'); return; }
    if (!turnosSel.length) { setErroLocal('Selecione pelo menos um turno.'); return; }
    setErroLocal(''); setEnviando(true);
    try {
      await registrarPresencaCoordenador({ escala_id: preceptorSel.escala_id, preceptor_id: preceptorSel.preceptor_id, data: dataStr, turnos: turnosSel, registrado_por: userId });
      onSaved && onSaved();
    } catch(e) { setErroLocal(e.message || 'Erro ao registrar presença.'); }
    finally { setEnviando(false); }
  }

  return (
    <div className="form">
      <div style={{display:'flex',gap:24,flexWrap:'wrap',alignItems:'flex-start'}}>
        <div style={{flex:'0 0 auto',minWidth:260}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <button type="button" style={{background:'none',border:'none',cursor:'pointer',padding:4}} onClick={prevMes}><ChevronLeft size={16}/></button>
            <b style={{fontSize:13,textTransform:'capitalize'}}>{mesLabel}</b>
            <button type="button" style={{background:'none',border:'none',cursor:'pointer',padding:4}} onClick={nextMes}><ChevronRight size={16}/></button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,textAlign:'center'}}>
            {DIAS_SEMANA.map(d => <span key={d} style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',padding:'3px 0'}}>{d}</span>)}
            {diasNoMes.map((d,i) => (
              <button key={i} type="button" disabled={!d} onClick={() => d && selecionarDia(d)}
                style={{padding:'6px 2px',border:'none',borderRadius:6,cursor:d?'pointer':'default',fontSize:13,
                  background:d&&isDataSel(d)?'var(--gold-500,#b8930a)':'transparent',
                  color:d&&isDataSel(d)?'#fff':d?'var(--navy-900,#0f172a)':'transparent',
                  fontWeight:d&&isDataSel(d)?700:400}}>
                {d ? d.getDate() : ''}
              </button>
            ))}
          </div>
          <div style={{marginTop:10,padding:'8px 10px',background:'var(--surface-soft,#f8fafc)',borderRadius:8,fontSize:12,color:'var(--text-muted)',textAlign:'center',textTransform:'capitalize'}}>{dataLabel}</div>
        </div>

        <div style={{flex:'1 1 260px'}}>
          <b style={{display:'block',fontSize:12,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em'}}>Preceptores escalados nesta data</b>
          {loadingPrec
            ? <div style={{display:'flex',gap:8,alignItems:'center',padding:'12px 0'}}><Loader2 size={16} className="spin"/><span style={{fontSize:13}}>Buscando preceptores...</span></div>
            : preceptores.length===0
              ? <div style={{padding:'12px 0',fontSize:13,color:'var(--text-muted)'}}>Nenhum preceptor escalado para esta data.</div>
              : <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {preceptores.map(p => (
                    <button key={p.preceptor_id} type="button" onClick={() => { setPreceptorSel(p); setTurnosSel([]); setErroLocal(''); }}
                      style={{padding:'10px 14px',borderRadius:8,border:`2px solid ${preceptorSel?.preceptor_id===p.preceptor_id?'var(--gold-500,#b8930a)':'var(--border-soft,#e2e8f0)'}`,
                        background:preceptorSel?.preceptor_id===p.preceptor_id?'rgba(184,147,10,.08)':'var(--surface,#fff)',cursor:'pointer',textAlign:'left',transition:'all .15s'}}>
                      <div style={{fontWeight:700,fontSize:13}}>{p.preceptor_nome}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{p.modalidade_label} — {p.local_nome}{p.setor_nome?` — ${p.setor_nome}`:""}</div>
                    </button>
                  ))}
                </div>
          }

          {preceptorSel && (
            <div style={{marginTop:18}}>
              <b style={{display:'block',fontSize:12,color:'var(--text-muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.05em'}}>Turnos previstos na escala</b>
              {turnosPrevistos.length===0
                ? <span style={{fontSize:13,color:'var(--text-muted)'}}>Nenhum turno previsto para este dia.</span>
                : <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {turnosPrevistos.map(t => {
                      const jaReg = turnosJaRegistrados.includes(t);
                      const sel = turnosSel.includes(t);
                      return (
                        <button key={t} type="button" disabled={jaReg} onClick={() => !jaReg && toggleTurno(t)}
                          style={{padding:'10px 20px',borderRadius:8,fontWeight:700,fontSize:13,transition:'all .15s',cursor:jaReg?'not-allowed':'pointer',opacity:jaReg?0.65:1,
                            border:`2px solid ${sel?'var(--gold-500,#b8930a)':jaReg?'#d1d5db':'var(--border-soft,#e2e8f0)'}`,
                            background:sel?'var(--gold-500,#b8930a)':jaReg?'#f3f4f6':'var(--surface,#fff)',
                            color:sel?'#fff':jaReg?'#9ca3af':'var(--navy-900,#0f172a)'}}>
                          {TURNO_LABELS[t]||t}
                          {jaReg && <span style={{marginLeft:6,fontSize:11,fontWeight:400}}>✓ registrado</span>}
                        </button>
                      );
                    })}
                  </div>
              }
            </div>
          )}
        </div>
      </div>

      {erroLocal && <div className="login-erro" style={{marginTop:12}}><AlertCircle size={14}/> {erroLocal}</div>}

      <footer>
        <Btn secondary icon={X} onClick={onClose}>Cancelar</Btn>
        <Btn icon={enviando?Loader2:Check} onClick={confirmar} disabled={enviando||!preceptorSel||!turnosSel.length}>
          {enviando ? <><Loader2 size={14} className="spin"/> Registrando...</> : 'Confirmar presença'}
        </Btn>
      </footer>
    </div>
  );
}

const TIPO_COMPONENTE_LABELS = {
  por_turno: "Por turno",
  fixo_mensal: "Fixo mensal",
  por_ocorrencia: "Por ocorrência ou dia",
  valor_dividido: "Valor dividido",
  por_turno_mais_fixo: "Por turno mais valor fixo",
  parcela_total: "Parcela de um total",
  adicional_fixo: "Adicional fixo",
  desconto: "Desconto fixo",
  sem_pagamento: "Sem pagamento"
};

const TIPOS_COMPONENTE_VISIVEIS = ['por_turno','fixo_mensal','adicional_fixo','desconto','sem_pagamento'];
const TIPO_COMPONENTE_AJUDA = {
  por_turno: 'Multiplica o valor pela quantidade de turnos confirmados.',
  fixo_mensal: 'Aplica o valor principal uma única vez na competência.',
  adicional_fixo: 'Soma este valor uma única vez. As presenças não multiplicam o adicional.',
  desconto: 'Subtrai este valor uma única vez do cálculo da competência.',
  sem_pagamento: 'Registra a atuação e as presenças, mas o valor financeiro será R$ 0,00.'
};

// ── Campos dinâmicos por tipo de componente ──
const COMP_TIPOS_COM_VALOR = ['por_turno','fixo_mensal','por_ocorrencia','valor_dividido','por_turno_mais_fixo','parcela_total','adicional_fixo','desconto'];
const COMP_TIPOS_COM_VALOR_EXTRA = ['por_turno_mais_fixo']; // parcela fixa (valor_extra)
const COMP_TIPOS_COM_MOTIVO = ['adicional_fixo','desconto','sem_pagamento'];
const COMP_TIPOS_COM_CRITERIO = ['valor_dividido'];
// Tipos que já dependem naturalmente dos turnos/dias/ocorrências registrados: sem condição própria.
// Tipos que exibem a seção "Condição para liberação".
const COMP_TIPOS_COM_CONDICAO = ['fixo_mensal','adicional_fixo','parcela_total','valor_dividido','por_turno_mais_fixo'];

function ComponenteCard({ comp, idx, total, onChange, onRemove }) {
  const temValor = COMP_TIPOS_COM_VALOR.includes(comp.tipo);
  const temValorExtra = COMP_TIPOS_COM_VALOR_EXTRA.includes(comp.tipo);
  const temMotivo = COMP_TIPOS_COM_MOTIVO.includes(comp.tipo);
  const temCriterio = COMP_TIPOS_COM_CRITERIO.includes(comp.tipo);
  const temCondicao = COMP_TIPOS_COM_CONDICAO.includes(comp.tipo);
  const semPagamento = comp.tipo === 'sem_pagamento';
  const condicaoAtiva = comp.exige_presenca !== false;

  const rotuloValor =
    comp.tipo === 'por_turno' || comp.tipo === 'por_turno_mais_fixo' ? 'Valor por turno (R$) *'
    : comp.tipo === 'por_ocorrencia' ? 'Valor unitário (R$) *'
    : comp.tipo === 'fixo_mensal' ? 'Valor mensal (R$) *'
    : comp.tipo === 'valor_dividido' ? 'Valor total (R$) *'
    : comp.tipo === 'parcela_total' ? 'Valor da parcela (R$) *'
    : comp.tipo === 'desconto' ? 'Valor do desconto (R$) *'
    : 'Valor (R$) *';

  return (
    <div className="regra-comp">
      <div className="regra-comp-head">
        <b>Componente {idx + 1}</b>
        {total > 1 && (
          <button type="button" onClick={onRemove} title="Remover componente">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* 1) Tipo de cálculo */}
      {/* 2) Descrição */}
      <div className="regra-grid2" style={{ marginBottom: 10 }}>
        <div className="regra-field">
          <label>Tipo de cálculo *</label>
          <select value={comp.tipo} onChange={e => onChange('tipo', e.target.value)}>
            {!TIPOS_COMPONENTE_VISIVEIS.includes(comp.tipo) && <option value={comp.tipo}>{TIPO_COMPONENTE_LABELS[comp.tipo] || comp.tipo} (regra antiga)</option>}
            {TIPOS_COMPONENTE_VISIVEIS.map(k => <option key={k} value={k}>{TIPO_COMPONENTE_LABELS[k]}</option>)}
          </select>
          <small className="regra-type-help">{TIPO_COMPONENTE_AJUDA[comp.tipo] || 'Tipo preservado apenas para regras antigas.'}</small>
        </div>
        <div className="regra-field">
          <label>Descrição *</label>
          <input
            value={comp.descricao}
            onChange={e => onChange('descricao', e.target.value)}
            placeholder={semPagamento ? 'Ex: Registro institucional sem pagamento' : 'Ex: Valor por turno de plantão'}
          />
        </div>
      </div>

      {/* 3) Campos monetários correspondentes */}
      <div className="regra-grid2" style={{ marginBottom: temCondicao ? 10 : 0 }}>
        {semPagamento ? (
          <div className="regra-field">
            <label>Valor (R$)</label>
            <input type="text" disabled value="Sem pagamento" style={{ background: 'var(--surface-soft)', color: 'var(--text-muted)' }} />
          </div>
        ) : (
          <div className="regra-field">
            <label>{rotuloValor}</label>
            <input
              type="text"
              value={comp.valor}
              onChange={e => onChange('valor', maskBRL(e.target.value))}
              placeholder="R$ 0,00"
            />
          </div>
        )}

        {temValorExtra ? (
          <div className="regra-field">
            <label>Parcela fixa (R$) *</label>
            <input
              type="text"
              value={comp.valor_extra || ''}
              onChange={e => onChange('valor_extra', maskBRL(e.target.value))}
              placeholder="R$ 0,00"
            />
          </div>
        ) : temMotivo ? (
          <div className="regra-field">
            <label>{semPagamento ? 'Motivo / Critério *' : 'Motivo *'}</label>
            <input
              value={comp.motivo || ''}
              onChange={e => onChange('motivo', e.target.value)}
              placeholder={semPagamento ? 'Ex: Atividade institucional sem remuneração' : 'Ex: Adicional de coordenação'}
            />
          </div>
        ) : temCriterio ? (
          <div className="regra-field">
            <label>Critério de divisão</label>
            <input
              value={comp.criterio || ''}
              onChange={e => onChange('criterio', e.target.value)}
              placeholder="Ex: Por participante ativo no mês"
            />
          </div>
        ) : null}
      </div>

      {/* 4) Condição para liberação (somente quando aplicável) */}
      {temCondicao && (
        <div className="regra-condicao">
          <div className="regra-condicao-title">Condição para liberação</div>
          <div className="regra-grid3">
            <div className="regra-field">
              <label>Exige atuação confirmada?</label>
              <div className="regra-toggle">
                <button type="button" className={comp.exige_presenca ? 'active' : ''} onClick={() => onChange('exige_presenca', true)}>Sim</button>
                <button type="button" className={!comp.exige_presenca ? 'active' : ''} onClick={() => onChange('exige_presenca', false)}>Não</button>
              </div>
            </div>

            {condicaoAtiva && (
              <>
                <div className="regra-field">
                  <label>Quantidade mínima para liberação</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={comp.quantidade_minima}
                    onChange={e => onChange('quantidade_minima', e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="regra-field">
                  <label>Contabilizar por</label>
                  <select value={comp.contagem_tipo || 'turnos'} onChange={e => onChange('contagem_tipo', e.target.value)}>
                    <option value="turnos">Turnos</option>
                    <option value="dias">Dias</option>
                    <option value="ocorrencias">Ocorrências</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {condicaoAtiva && (
            <p className="regra-hint" style={{ marginBottom: 0 }}>
              <Info size={13} />
              {comp.tipo === 'por_turno_mais_fixo'
                ? 'A parcela fixa será liberada somente quando o preceptor atingir a quantidade mínima selecionada na competência. O valor por turno depende dos turnos confirmados.'
                : 'O componente será liberado somente quando o preceptor atingir a quantidade mínima selecionada na competência.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RegraFinanceiraFormModal({ modal, options, optionsLoading, onClose, onSaved }) {
  const isEdit = modal.mode === "regra-edit" && modal.row;
  const initialRow = isEdit ? modal.row : {};

  const [form, setForm] = useState({
    id: initialRow.id || null,
    nome: initialRow.nome || "",
    tipo_atuacao: initialRow.tipo_atuacao || "internato",
    unidade_id: initialRow.unidade_id || "",
    profissao_id: initialRow.profissao_id || "",
    internato_id: initialRow.internato_id || "",
    disciplina_id: initialRow.disciplina_id || "",
    local_id: initialRow.local_id || "",
    setor_id: initialRow.setor_id || "",
    preceptor_id: initialRow.preceptor_id || "",
    status: initialRow.status || "ativo",
    observacoes: initialRow.observacoes || ""
  });

  const [componentes, setComponentes] = useState(() => {
    if (isEdit && Array.isArray(initialRow.componentes) && initialRow.componentes.length) {
      return initialRow.componentes.map((c, i) => ({
        id: c.id || null,
        _key: c.id || `comp_init_${i}_${Date.now()}`,
        descricao: c.descricao || "",
        tipo: c.tipo || "por_turno",
        valor: formatInitialValueBRL(c.valor),
        valor_extra: formatInitialValueBRL(c.valor_extra),
        motivo: c.motivo || "",
        criterio: c.criterio || "",
        exige_presenca: c.exige_presenca !== false,
        quantidade_minima: c.quantidade_minima != null && String(c.quantidade_minima).trim() !== "" ? String(c.quantidade_minima) : (c.exige_presenca !== false ? "1" : ""),
        contagem_tipo: c.contagem_tipo || "turnos",
        status: c.status || "ativo"
      }));
    }
    return [{ id: null, _key: `comp_new_0_${Date.now()}`, descricao: "Valor por turno", tipo: "por_turno", valor: "", valor_extra: "", motivo: "", criterio: "", exige_presenca: true, quantidade_minima: "1", contagem_tipo: "turnos", status: "ativo" }];
  });

  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [versionInfo, setVersionInfo] = useState(null);

  function handleChange(field, val) {
    setForm(f => {
      const next = { ...f, [field]: val };
      if (field === "tipo_atuacao") {
        if (val !== "internato") next.internato_id = "";
        next.preceptor_id = "";
      }
      return next;
    });
    setErro("");
  }

  function handleCompChange(idx, field, val) {
    setComponentes(list => list.map((c, i) => {
      if (i !== idx) return c;
      let next = { ...c, [field]: val };

      if (field === 'tipo') {
        if (COMP_TIPOS_COM_CONDICAO.includes(val)) {
          next = {
            ...next,
            quantidade_minima: c.quantidade_minima != null && String(c.quantidade_minima).trim() !== "" ? c.quantidade_minima : "1",
            contagem_tipo: c.contagem_tipo || "turnos"
          };
        } else {
          next = { ...next, quantidade_minima: "", contagem_tipo: "turnos" };
        }
      }

      if (field === 'exige_presenca') {
        if (val === false) {
          next = { ...next, quantidade_minima: "", contagem_tipo: "turnos" };
        } else {
          next = {
            ...next,
            quantidade_minima: c.quantidade_minima != null && String(c.quantidade_minima).trim() !== "" ? c.quantidade_minima : "1",
            contagem_tipo: c.contagem_tipo || "turnos"
          };
        }
      }

      return next;
    }));
    setErro("");
  }

  function addComponente() {
    const tempKey = `comp_new_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
    setComponentes(list => [
      ...list,
      { id: null, _key: tempKey, descricao: "", tipo: "por_turno", valor: "", valor_extra: "", motivo: "", criterio: "", exige_presenca: true, quantidade_minima: "1", contagem_tipo: "turnos", status: "ativo" }
    ]);
  }

  function removeComponente(idx) {
    if (componentes.length <= 1) { setErro("A regra deve ter pelo menos um componente."); return; }
    setComponentes(list => list.filter((_, i) => i !== idx));
  }

  const preceptorList = useMemo(() => {
    return form.tipo_atuacao === "internato" ? (options.preceptoresInternato || []) : (options.preceptoresPratica || []);
  }, [form.tipo_atuacao, options.preceptoresInternato, options.preceptoresPratica]);

  const isFormValid = useMemo(() => {
    if (!form.nome.trim() || !form.tipo_atuacao || !form.status || !componentes.length) return false;
    return componentes.every(c => {
      if (!c.descricao.trim()) return false;
      if (c.tipo === "sem_pagamento") return true;
      const dec = parseBRLDecimal(c.valor);
      if (dec === null || isNaN(dec)) return false;
      if (c.tipo === "por_turno_mais_fixo") {
        const decExtra = parseBRLDecimal(c.valor_extra);
        return decExtra !== null && !isNaN(decExtra);
      }
      return true;
    });
  }, [form.nome, form.tipo_atuacao, form.status, componentes]);

  async function handleSalvar(e) {
    e.preventDefault();
    if (!form.nome.trim()) { setErro("Informe o nome da regra."); return; }
    if (!componentes.length) { setErro("Adicione pelo menos um componente à regra."); return; }

    const compConvertidos = [];
    for (let i = 0; i < componentes.length; i++) {
      const c = componentes[i];
      if (!c.descricao.trim()) { setErro(`Componente #${i+1}: informe a descrição.`); return; }
      let decimalVal = null;
      if (c.tipo !== "sem_pagamento") {
        decimalVal = parseBRLDecimal(c.valor);
        if (decimalVal === null) {
          setErro(`Componente #${i+1} (${TIPO_COMPONENTE_LABELS[c.tipo]}): informe um valor válido em BRL (ex: R$ 476,40).`);
          return;
        }
      }
      if (c.tipo === "por_turno_mais_fixo") {
        const decimalExtra = parseBRLDecimal(c.valor_extra);
        if (decimalExtra === null) {
          setErro(`Componente #${i+1} (${TIPO_COMPONENTE_LABELS[c.tipo]}): informe a parcela fixa em BRL (ex: R$ 3.200,00).`);
          return;
        }
        compConvertidos.push({ ...c, valor: decimalVal, valor_extra: decimalExtra });
        continue;
      }
      compConvertidos.push({ ...c, valor: decimalVal });
    }

    setSaving(true); setErro("");
    try {
      const result = await salvarRegraFinanceira(form, compConvertidos);
      // Detectar se foi criada nova versão (id diferente do original)
      if (isEdit && result && result.id !== form.id) {
        setVersionInfo(`Nova versão criada (ID: ${result.id.slice(0,8)}…). A versão anterior foi preservada para os cálculos existentes.`);
      }
      onSaved && onSaved();
    } catch(err) {
      setErro(err.message || "Erro ao salvar regra financeira.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Body scrollável */}
      <div className="regra-body">
        {erro && (
          <div className="login-erro" style={{ marginBottom: 14 }}>
            <AlertCircle size={15} /> {erro}
          </div>
        )}
        {versionInfo && (
          <div className="regra-version-info">
            <Info size={15} />
            <span>{versionInfo}</span>
          </div>
        )}

        {/* SEÇÃO 1 — IDENTIFICAÇÃO */}
        <div className="regra-section">
          <div className="regra-section-title">
            <span style={{ display:'flex', alignItems:'center', gap:6 }}><FileText size={13} />Identificação</span>
          </div>

          {/* Nome (full width) */}
          <div className="regra-field" style={{ marginBottom: 12 }}>
            <label>Nome da regra *</label>
            <input
              name="nome"
              required
              value={form.nome}
              onChange={e => handleChange("nome", e.target.value)}
              placeholder="Ex: Regra Internato 2 – Ginecologia e Cirurgia"
            />
          </div>

          {/* Modalidade | Situação | Observações numa grade de 3 */}
          <div className="regra-grid3">
            <div className="regra-field">
              <label>Modalidade *</label>
              <select value="internato" disabled aria-label="Modalidade temporariamente exclusiva">
                <option value="internato">Internato</option>
              </select>
            </div>
            <div className="regra-field">
              <label>Situação *</label>
              <select value={form.status} onChange={e => handleChange("status", e.target.value)}>
                <option value="ativo">Ativa</option>
                <option value="inativo">Inativa</option>
              </select>
            </div>
            <div className="regra-field">
              <label>Observações / Justificativa</label>
              <textarea
                rows={2}
                value={form.observacoes}
                onChange={e => handleChange("observacoes", e.target.value)}
                placeholder="Motivo ou critério desta regra…"
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 2 — ONDE SE APLICA */}
        <div className="regra-section">
          <div className="regra-section-title">
            <span style={{ display:'flex', alignItems:'center', gap:6 }}><MapPin size={13} />Onde se aplica</span>
          </div>
          <p className="regra-hint">
            <Info size={13} />
            Campos não selecionados significam aplicação geral para aquele critério.
          </p>

          {/* Linha 1: Unidade | Profissão | [Internato se Internato] | Disciplina */}
          <div className={form.tipo_atuacao === "internato" ? "regra-grid4" : "regra-grid3"} style={{ marginBottom: 12 }}>
            <div className="regra-field">
              <label>Unidade</label>
              <select value={form.unidade_id} onChange={e => handleChange("unidade_id", e.target.value)}>
                <option value="">Todas as unidades</option>
                {(options.unidades || []).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div className="regra-field">
              <label>Profissão</label>
              <select value={form.profissao_id} onChange={e => handleChange("profissao_id", e.target.value)}>
                <option value="">Todas as profissões</option>
                {(options.profissoes || []).length === 0 && <option disabled>(Nenhuma cadastrada)</option>}
                {(options.profissoes || []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            {form.tipo_atuacao === "internato" && (
              <div className="regra-field">
                <label>Internato</label>
                <select value={form.internato_id} onChange={e => handleChange("internato_id", e.target.value)}>
                  <option value="">Todos os internatos</option>
                  {(options.internatos || []).length === 0 && <option disabled>(Nenhum cadastrado)</option>}
                  {(options.internatos || []).map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
              </div>
            )}
            <div className="regra-field">
              <label>Disciplina</label>
              <select value={form.disciplina_id} onChange={e => handleChange("disciplina_id", e.target.value)}>
                <option value="">Todas as disciplinas</option>
                {(options.disciplinas || []).length === 0 && <option disabled>(Nenhuma cadastrada)</option>}
                {(options.disciplinas || []).map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Linha 2: Local | Setor | Preceptor específico */}
          <div className="regra-grid3">
            <div className="regra-field">
              <label>Local</label>
              <select value={form.local_id} onChange={e => handleChange("local_id", e.target.value)}>
                <option value="">Todos os locais</option>
                {(options.locais || []).length === 0 && <option disabled>(Nenhum cadastrado)</option>}
                {(options.locais || []).map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
            <div className="regra-field">
              <label>Setor</label>
              <select value={form.setor_id} onChange={e => handleChange("setor_id", e.target.value)}>
                <option value="">Todos os setores</option>
                {(options.setores || []).length === 0 && <option disabled>(Nenhum cadastrado)</option>}
                {(options.setores || []).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div className="regra-field">
              <label>
                Preceptor específico
                <span className="regra-badge">Exceção</span>
              </label>
              <select value={form.preceptor_id} onChange={e => handleChange("preceptor_id", e.target.value)}>
                <option value="">Todos os preceptores (regra geral)</option>
                {preceptorList.length === 0 && <option disabled>(Nenhum cadastrado)</option>}
                {preceptorList.map(p => <option key={p.id} value={p.id}>★ {p.nome_completo}</option>)}
              </select>
              <small style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                {form.tipo_atuacao === "internato" ? "Preceptores do Internato ativos" : "Preceptores Prática ativos"}
              </small>
            </div>
          </div>
        </div>

        {/* SEÇÃO 3 — COMO SERÁ CALCULADO */}
        <div className="regra-section">
          <div className="regra-section-title">
            <span style={{ display:'flex', alignItems:'center', gap:6 }}><Calculator size={13} />Como será calculado</span>
            <button type="button" className="btn secondary" style={{ padding:'5px 12px', fontSize:12, minHeight:30 }} onClick={addComponente}>
              <Plus size={13} /> Adicionar componente
            </button>
          </div>

          {componentes.map((c, idx) => (
            <ComponenteCard
              key={c._key || c.id || `comp_${idx}`}
              comp={c}
              idx={idx}
              total={componentes.length}
              onChange={(field, val) => handleCompChange(idx, field, val)}
              onRemove={() => removeComponente(idx)}
            />
          ))}
        </div>
      </div>

      {/* Footer fixo */}
      <div className="regra-footer">
        <Btn secondary icon={X} onClick={onClose}>Cancelar</Btn>
        <Btn icon={saving ? Loader2 : Check} type="button" disabled={saving || !isFormValid} onClick={handleSalvar}>
          {saving ? "Salvando…" : "Salvar regra"}
        </Btn>
      </div>
    </>
  );
}

function RegraFinanceiraDetailModal({ row, onClose, onEdit }) {
  const componentes = Array.isArray(row.componentes) ? row.componentes : [];
  return (
    <div className="details">
      <div className="grid">
        <div className="detail"><small>Nome da regra</small><b>{row.nome}</b></div>
        <div className="detail"><small>Modalidade</small><b>{row.tipo_atuacao === "adm" ? "Prática" : "Internato"}</b></div>
        <div className="detail"><small>Unidade</small><b>{row.unidade?.nome || "(Todas)"}</b></div>
        {row.tipo_atuacao === "internato" && <div className="detail"><small>Internato</small><b>{row.internato?.nome || "(Todos)"}</b></div>}
        <div className="detail"><small>Disciplina</small><b>{row.disciplina?.nome || "(Todas)"}</b></div>
        <div className="detail"><small>Local</small><b>{row.local?.nome || "(Todos)"}</b></div>
        <div className="detail"><small>Setor</small><b>{row.setor?.nome || "(Todos)"}</b></div>
        <div className="detail"><small>Preceptor exceção</small><b>{row.preceptor?.nome_completo ? `★ ${row.preceptor.nome_completo}` : "Geral (Todos os preceptores)"}</b></div>
        <div className="detail"><small>Vigência</small><b>{fmtData(row.data_inicio)} {row.data_fim ? `até ${fmtData(row.data_fim)}` : "(vigente)"}</b></div>
        <div className="detail"><small>Situação</small><b><em className={statusBadge(row.status)}>{row.status === "ativo" ? "Ativa" : "Inativa"}</em></b></div>
      </div>

      {row.observacoes && (
        <div className="detail" style={{ marginTop: 12 }}>
          <small>Observações / Justificativa</small>
          <p style={{ fontSize: 13, margin: 0, marginTop: 4 }}>{row.observacoes}</p>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <small style={{ fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Componentes da Regra</small>
        <div className="presencas-itens-list" style={{ marginTop: 8 }}>
          {componentes.map((c, i) => (
            <div key={c.id || i} style={{ padding: "8px 12px", background: "var(--surface-soft,#f8fafc)", borderRadius: 6, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <b>{c.descricao}</b>
                <span className="ficha-tag" style={{ marginLeft: 8 }}>{TIPO_COMPONENTE_LABELS[c.tipo] || c.tipo}</span>
              </div>
              <b>{c.valor != null ? formatCurrencyBRL(c.valor) : "Sem valor"}</b>
            </div>
          ))}
          {!componentes.length && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhum componente cadastrado.</div>}
        </div>
      </div>

      <footer>
        <Btn secondary icon={Pencil} onClick={onEdit}>Editar</Btn>
        <Btn icon={Check} onClick={onClose}>Concluir</Btn>
      </footer>
    </div>
  );
}

function RegistrarPresencasPage({ userId, compact }) {
  const HOJE = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }, []);
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState(() => new Date().getMonth() + 1);
  const [dataSel, setDataSel] = useState(HOJE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTurno, setFiltroTurno] = useState('todos');
  const [modalReg, setModalReg] = useState(null);
  const [turnosSel, setTurnosSel] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [panelFilters, setPanelFilters] = useState({});
  const [panelOpen, setPanelOpen] = useState(false);
  const TURNO_LABELS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

  const fetchCalendar = useCallback(async () => {
    setLoading(true); setErro('');
    try { setData(await fetchCalendarioPresencas(ano, mes)); }
    catch (e) { setErro(e.message || 'Erro ao carregar dados.'); }
    setLoading(false);
  }, [ano, mes, refreshKey]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  const diasNoMes = useMemo(() => {
    const primeiro = new Date(ano, mes - 1, 1);
    const ultimo = new Date(ano, mes, 0);
    const dias = [];
    const offset = primeiro.getDay() === 0 ? 6 : primeiro.getDay() - 1;
    for (let i = 0; i < offset; i++) dias.push(null);
    for (let d = 1; d <= ultimo.getDate(); d++) dias.push(d);
    return dias;
  }, [ano, mes]);

  const mesLabel = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const dataLabel = useMemo(() => {
    const [y, m, d] = dataSel.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }, [dataSel]);

  function prevMes() { setMes(m => { if (m === 1) { setAno(y => y - 1); return 12; } return m - 1; }); setDataSel(''); }
  function nextMes() { setMes(m => { if (m === 12) { setAno(y => y + 1); return 1; } return m + 1; }); setDataSel(''); }

  function getDiaInfo(d) {
    if (!data?.calendario) return null;
    const iso = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return data.calendario.find(c => c.data === iso) || null;
  }

  function getDiaCor(d) {
    const info = getDiaInfo(d);
    if (!info || info.escalados === 0) return { bg: '#f1f5f9', border: '#e2e8f0', text: '#94a3b8', dot: '#cbd5e1' };
    const isPassado = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}` < HOJE;
    if (info.total_confirmados === info.total_previstos && info.total_previstos > 0) return { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46', dot: '#10b981' };
    if (info.total_confirmados === 0) return { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', dot: '#3b82f6' };
    if (isPassado && info.total_confirmados < info.total_previstos) return { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', dot: '#ef4444' };
    return { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', dot: '#f97316' };
  }

  const preceptoresDia = useMemo(() => {
    if (!dataSel || !data?.calendario) return [];
    const dia = data.calendario.find(c => c.data === dataSel);
    return dia?.preceptores || [];
  }, [dataSel, data]);

  const listaFiltrada = useMemo(() => {
    let result = preceptoresDia;
    if (busca.trim()) { const s = busca.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); result = result.filter(p => (p.preceptor_nome||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(s)); }
    if (filtroStatus !== 'todos') result = result.filter(p => p.status_lista === filtroStatus);
    if (panelFilters.local_nome) { const vals = Array.isArray(panelFilters.local_nome) ? panelFilters.local_nome : [panelFilters.local_nome]; result = result.filter(p => vals.includes(p.local_nome)); }
    if (panelFilters.atividade_nome) { const vals = Array.isArray(panelFilters.atividade_nome) ? panelFilters.atividade_nome : [panelFilters.atividade_nome]; result = result.filter(p => vals.includes(p.atividade_nome)); }
    if (panelFilters.turno) { const vals = Array.isArray(panelFilters.turno) ? panelFilters.turno : [panelFilters.turno]; result = result.filter(p => vals.some(t => p.turnos_previstos.includes(t))); }
    return result;
  }, [preceptoresDia, busca, filtroStatus, panelFilters]);

  const totaisDia = useMemo(() => {
    const dia = data?.calendario?.find(c => c.data === dataSel);
    if (!dia) return { escalados: 0, confirmados: 0, pendentes: 0 };
    return { escalados: dia.escalados, confirmados: dia.com_confirmacao, pendentes: dia.pendentes };
  }, [dataSel, data]);

  const unidades = useMemo(() => [...new Set(preceptoresDia.map(p => p.unidade_nome))].sort(), [preceptoresDia]);
  const locais = useMemo(() => [...new Set(preceptoresDia.map(p => p.local_nome))].sort(), [preceptoresDia]);
  const internatos = useMemo(() => [...new Set(preceptoresDia.map(p => p.atividade_nome).filter(Boolean))].sort(), [preceptoresDia]);

  const panelFiltersConfig = useMemo(() => [
    { key: 'local_nome', label: 'Local', options: locais.map(l => ({ value: l, label: l })) },
    { key: 'atividade_nome', label: 'Internato', options: internatos.map(i => ({ value: i, label: i })) },
    { key: 'turno', label: 'Turno', options: [
      { value: 'manha', label: 'Manhã' },
      { value: 'tarde', label: 'Tarde' },
      { value: 'noite', label: 'Noite' },
    ]},
  ], [locais, internatos]);

  function limparFiltros() { setBusca(''); setFiltroStatus('todos'); setPanelFilters({}); }

  async function handleRegistrar() {
    if (!modalReg || !turnosSel.length) return;
    setEnviando(true);
    try {
      const resolvedUserId = userId || (await supabase.auth.getUser()).data?.user?.id;
      await registrarPresencaCoordenador({ escala_id: modalReg.escala_id, preceptor_id: modalReg.preceptor_id, data: dataSel, turnos: turnosSel, registrado_por: resolvedUserId });
      setRefreshKey(k => k + 1);
      setModalReg(null); setTurnosSel([]);
    } catch (e) {
      if (ehMensagemConflito(e.message)) await mostrarConflito(e.message);
      else await systemAlert(e.message || 'Erro ao registrar.','Não foi possível registrar');
    }
    setEnviando(false);
  }

  const [modalDetalhe, setModalDetalhe] = useState(null);

  return (
    <div className={compact ? 'compact-presencas-page' : 'reg-presencas-page'}>
      {compact && (
        <div className="compact-presencas-header">
          <img src="/logo-horizontal-clara.png" alt="IF SERTÃO" className="compact-presencas-logo" />
          <h1 className="compact-presencas-title">Confirmação de Presença</h1>
          <p className="compact-presencas-subtitle">Acesse suas escalas e confirme sua presença</p>
          {dataSel && (
            <p className="compact-presencas-date">
              {new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {dataSel === HOJE && <span className="compact-today-badge">Hoje</span>}
            </p>
          )}
        </div>
      )}

      <div className={compact ? 'compact-presencas-body' : 'reg-presencas-body'}>
        <div className={compact ? 'compact-presencas-cal' : 'reg-presencas-cal'}>
          {!compact && (
            <div className="reg-cal-header">
              <button type="button" onClick={prevMes}><ChevronLeft size={18}/></button>
              <b>{mesLabel}</b>
              <button type="button" onClick={nextMes}><ChevronRight size={18}/></button>
            </div>
          )}
          {compact && (
            <div className="compact-cal-header">
              <button type="button" onClick={prevMes} className="compact-cal-nav"><ChevronLeft size={20}/></button>
              <b className="compact-cal-month">{mesLabel}</b>
              <button type="button" onClick={nextMes} className="compact-cal-nav"><ChevronRight size={20}/></button>
            </div>
          )}
          <div className={compact ? 'compact-cal-weekdays' : 'reg-cal-weekdays'}>
            {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => <span key={d}>{d}</span>)}
          </div>
          <div className={compact ? 'compact-cal-grid' : 'reg-cal-grid'}>
            {diasNoMes.map((d, i) => {
              if (!d) return <div key={`empty-${i}`}/>;
              const cor = getDiaCor(d);
              const iso = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const sel = iso === dataSel;
              const info = getDiaInfo(d);
              const isToday = iso === HOJE;
              return (
                <button key={iso} type="button" onClick={() => setDataSel(iso)}
                  className={compact ? 'compact-cal-day' : 'reg-cal-day'}
                  style={{ background: cor.bg, borderColor: sel ? 'var(--gold-500)' : cor.border, color: cor.text, fontWeight: isToday ? 800 : 500, boxShadow: sel ? '0 0 0 2px var(--gold-400)' : undefined, position: 'relative' }}>
                  <span style={{ fontSize: compact ? 15 : 14, fontWeight: isToday ? 800 : 600 }}>{d}</span>
                  {info && info.escalados > 0 && (
                    <span className={compact ? 'compact-cal-day-info' : 'reg-cal-day-info'}>
                      <span className={compact ? 'compact-cal-dot' : 'reg-cal-dot'} style={{ background: cor.dot }}/>
                      <span className={compact ? 'compact-cal-day-text' : 'reg-cal-day-text'}>{info.escalados} esc</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className={compact ? 'compact-presencas-list' : 'reg-presencas-list'}>
          {dataSel && (
            <>
              {!compact && (
                <div className="reg-date-info">
                  <div className="reg-date-info-header">
                    <b style={{ textTransform: 'capitalize' }}>{dataLabel}</b>
                    {dataSel === HOJE && <span className="reg-today-badge">Hoje</span>}
                  </div>
                  <div className="reg-date-stats">
                    <div className="reg-stat reg-stat-escalados"><b>{totaisDia.escalados}</b><span>escalados</span></div>
                    <div className="reg-stat reg-stat-confirmados"><b>{totaisDia.confirmados}</b><span>confirmados</span></div>
                    <div className="reg-stat reg-stat-pendentes"><b>{totaisDia.pendentes}</b><span>pendentes</span></div>
                  </div>
                </div>
              )}

              {compact && (
                <div className="compact-date-info">
                  <div className="compact-date-stats">
                    <div className="compact-stat compact-stat-escalados"><b>{totaisDia.escalados}</b><span>escalados</span></div>
                    <div className="compact-stat compact-stat-confirmados"><b>{totaisDia.confirmados}</b><span>confirmados</span></div>
                    <div className="compact-stat compact-stat-pendentes"><b>{totaisDia.pendentes}</b><span>pendentes</span></div>
                  </div>
                </div>
              )}

              {!compact && (
                <div className="rp-quickfilter">
                  {[['todos','Todos'],['pendente','Pendentes'],['parcial','Parciais'],['confirmada','Confirmados']].map(([k,l]) =>
                    <button key={k} className={"eqf-btn"+(filtroStatus===k?" active":"")} onClick={() => setFiltroStatus(k)}>{l}</button>
                  )}
                </div>
              )}

              <SearchFilterBar
                search={busca} setSearch={setBusca}
                placeholder="Buscar por nome do preceptor..."
                panelFilters={panelFilters} onApplyFilters={setPanelFilters}
                onClearFilters={() => setPanelFilters({})}
                panelOpen={panelOpen} setPanelOpen={setPanelOpen}
                filters={panelFiltersConfig} rows={preceptoresDia}
                resultCount={listaFiltrada.length}
                resultLabel="preceptor(es) encontrado(s)"
                emptyLabel="Nenhum preceptor encontrado"
              />

              {!compact && (
                <div className="reg-date-stats-inline">
                  <div className="reg-stat reg-stat-escalados"><b>{totaisDia.escalados}</b><span>escalados</span></div>
                  <div className="reg-stat reg-stat-confirmados"><b>{totaisDia.confirmados}</b><span>confirmados</span></div>
                  <div className="reg-stat reg-stat-pendentes"><b>{totaisDia.pendentes}</b><span>pendentes</span></div>
                </div>
              )}

              <div className={compact ? 'compact-preceptor-list' : 'reg-preceptor-list'}>
                {listaFiltrada.length === 0 ? (
                  <div className="empty"><FileSearch/><b>Nenhum preceptor encontrado</b></div>
                ) : (
                  listaFiltrada.map(p => (
                    <div key={`${p.escala_id}-${p.preceptor_id}`} className={compact ? 'compact-preceptor-card' : 'reg-preceptor-card'}>
                      <div className="reg-preceptor-main">
                        <div className="reg-preceptor-info">
                          <b>{p.preceptor_nome}</b>
                          <span className="reg-preceptor-meta">
                            <span className={"ficha-tag"} style={{ fontSize: 10 }}>{p.modalidade_label}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{p.unidade_nome} · {p.local_nome}{p.setor_nome?` · ${p.setor_nome}`:""}</span>
                          </span>
                          <span className="reg-preceptor-turnos">
                            {p.turnos_previstos.map(t => (
                              <span key={t} className={"reg-turno-badge reg-turno-" + (p.turnos_confirmados.includes(t) ? 'ok' : 'pend')}>{TURNO_LABELS[t] || t}</span>
                            ))}
                          </span>
                        </div>
                        <div className="reg-preceptor-status">
                          <em className={p.status_lista === 'confirmada' ? 'ok' : p.status_lista === 'parcial' ? 'warn' : 'bad'}>
                            {p.status_lista === 'confirmada' ? 'Confirmada' : p.status_lista === 'parcial' ? 'Parcial' : 'Pendente'}
                          </em>
                        </div>
                        <div className="reg-preceptor-actions">
                          {p.turnos_pendentes.length > 0 && (
                            <button className="btn" onClick={() => { setModalReg(p); setTurnosSel([]); }} style={{ minHeight: 36, padding: '0 14px', fontSize: 12 }}>
                              <Check size={14}/> Registrar
                            </button>
                          )}
                          <button className="btn secondary" onClick={() => setModalDetalhe(p)} style={{ minHeight: 36, padding: '0 10px' }}>
                            <Eye size={15}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
          {!dataSel && !loading && (
            <div className={compact ? 'compact-empty' : 'empty'} style={{ minHeight: compact ? 200 : 300 }}>
              <CalendarDays size={32}/>
              <b>{compact ? 'Selecione uma data' : 'Selecione uma data no calendário'}</b>
            </div>
          )}
        </div>
      </div>

      {modalReg && (
        <div className="overlay modal" onClick={() => setModalReg(null)}>
          <div className="dialog rp-modal" onClick={e => e.stopPropagation()}>
            <div className="modalhead">
              <div><small>REGISTRAR PRESENÇA</small><h2>{modalReg.preceptor_nome}</h2></div>
              <button onClick={() => setModalReg(null)}><X/></button>
            </div>
            <div className="rp-modal__body">
              <div className="rp-modal__tags">
                <span className="ficha-tag">{modalReg.modalidade_label}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{modalReg.unidade_nome} · {modalReg.local_nome}</span>
              </div>
              <div className="rp-modal__shifts">
                <b className="rp-modal__label">Turnos realmente trabalhados</b>
                <p className="actual-shift-help">A escala é apenas uma previsão. Marque os turnos que realmente foram realizados neste dia.</p>
                <div className="rp-modal__turnos">
                  {['manha','tarde','noite'].map(t => {
                    const jaConf = modalReg.turnos_confirmados.includes(t);
                    const sel = turnosSel.includes(t);
                    return (
                      <button key={t} type="button" disabled={jaConf} onClick={() => !jaConf && setTurnosSel(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                        className={"rp-turno-btn"+(sel?" sel":"")+(jaConf?" done":"")}>
                        {TURNO_LABELS[t] || t}
                        {modalReg.turnos_previstos.includes(t) && <span className="shift-planned">Previsto</span>}
                        {jaConf && <span className="rp-turno-check"><Check size={14}/></span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rp-modal__actions">
                <Btn secondary icon={X} onClick={() => setModalReg(null)}>Cancelar</Btn>
                <Btn icon={Check} onClick={handleRegistrar} disabled={!turnosSel.length || enviando}>{enviando ? 'Confirmando...' : 'Confirmar'}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalDetalhe && (
        <div className="overlay modal" onClick={() => setModalDetalhe(null)}>
          <div className="dialog rp-modal" onClick={e => e.stopPropagation()}>
            <div className="modalhead">
              <div><small>DETALHES</small><h2>{modalDetalhe.preceptor_nome}</h2></div>
              <button onClick={() => setModalDetalhe(null)}><X/></button>
            </div>
            <div className="rp-modal__body">
              <div className="ficha-grid" style={{ marginBottom: 16 }}>
                <div className="ficha-item"><small>Modalidade</small><b>{modalDetalhe.modalidade_label}</b></div>
                <div className="ficha-item"><small>Unidade</small><b>{modalDetalhe.unidade_nome}</b></div>
                <div className="ficha-item"><small>Atividade</small><b>{modalDetalhe.atividade_nome}</b></div>
                <div className="ficha-item"><small>Período</small><b>{modalDetalhe.periodo_nome}</b></div>
                <div className="ficha-item"><small>Local</small><b>{modalDetalhe.local_nome}</b></div>
                {modalDetalhe.setor_nome && <div className="ficha-item"><small>Setor</small><b>{modalDetalhe.setor_nome}</b></div>}
              </div>
              <b className="rp-modal__label">Turnos</b>
              <div className="rp-modal__turno-list">
                {modalDetalhe.turnos_previstos.map(t => {
                  const conf = modalDetalhe.turnos_confirmados.includes(t);
                  return <div key={t} className={"rp-turno-item"+(conf?" ok":"")}>
                    <span>{TURNO_LABELS[t] || t}</span>
                    <em className={conf ? 'ok' : 'bad'}>{conf ? 'Confirmado' : 'Pendente'}</em>
                  </div>;
                })}
              </div>
              <div className="rp-modal__actions">
                <Btn icon={Check} onClick={() => setModalDetalhe(null)}>Fechar</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { RegistrarPresencasPage };

