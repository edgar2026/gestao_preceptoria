import React,{useMemo,useState,useCallback,useEffect,useRef}from "react";
import{
  CalendarCheck,CalendarDays,Check,
  ChevronDown,ChevronLeft,ChevronRight,CircleDollarSign,ClipboardCheck,Eye,EyeOff,
  FileClock,FileSearch,Filter,History,
  Landmark,LockKeyhole,Menu,MoreHorizontal,Pencil,Plus,
  ReceiptText,Search,Settings,SlidersHorizontal,Stethoscope,
  Trash2,UsersRound,WalletCards,X,
  Shield,ShieldOff,Loader2,AlertCircle,LogIn,LogOut,
  UserRound,BriefcaseBusiness,MessageSquareText,
  Download,FileText,Printer,
  Info,MapPin,Calculator,RotateCw,BarChart3,Mail,FileSpreadsheet,Send,Paperclip
} from "lucide-react";
import {supabase} from "./supabase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import Logo from "./components/Logo";
import{
    fetchPreceptores,fetchPreceptoresPratica,fetchPreceptoresInternato,buscarPreceptorPorCpf,
    fetchVinculosPratica,fetchVinculosInternato,fetchVinculoLocais,
    insertPreceptor,updatePreceptor,inativarPreceptor,inativarVinculoPratica,reativarVinculoPratica,inativarVinculoInternato,reativarVinculoInternato,insertVinculoPratica,insertVinculoInternato,updateVinculoPratica,updateVinculoInternato,
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
    fetchRegrasFinanceirasAtivas,salvarVinculoRegraFinanceira,getRegraAtiva,isVinculoCompleto,getVinculoCamposFaltantes,
    formatCurrencyBRL,formatInitialValueBRL,
    fetchCompetencias,criarCompetencia,calcularCompetencia,fetchApuracoes,fetchDetalhesCalculo,fetchResumoApuracao,
    autoApurarFilaFinanceira,buscarFilaFinanceira,atualizarChamado,fetchDetalhesCalculoCompleto,
    apuracaoMesLabel,CHAMADO_STATUS_OPTIONS,fetchPainelPagamentos,registrarSolicitacaoNota,
    statusBadge,fmtData,fmtTimestamp,turnoLabel,diaLabel,fmtCompetencia
  } from "./services/queries";


function systemDialog(options={}){
  return new Promise(resolve=>window.dispatchEvent(new CustomEvent('system-dialog',{detail:{...options,resolve}})));
}
function systemConfirm(message,title='Confirmar ação',extra={}){return systemDialog({type:'confirm',title,message,...extra});}
function systemAlert(message,title='Atenção',extra={}){return systemDialog({type:'alert',title,message,...extra});}
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
function validateCpf(v){
  const d=String(v||"").replace(/\D/g,"");
  if(d.length===0)return true;
  if(d.length!==11)return false;
  if(/^(\d)\1{10}$/.test(d))return false;
  let sum=0;
  for(let i=0;i<9;i++)sum+=parseInt(d[i])*(10-i);
  let r=sum%11;if(r<2)r=0;else r=11-r;
  if(parseInt(d[9])!==r)return false;
  sum=0;
  for(let i=0;i<10;i++)sum+=parseInt(d[i])*(11-i);
  r=sum%11;if(r<2)r=0;else r=11-r;
  return parseInt(d[10])===r;
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
  ["Financeiro",[["regras","Regras financeiras",SlidersHorizontal],["apuracao-mensal","Apuração mensal",LockKeyhole],["pagamentos","Pagamentos",WalletCards],["dashboard","Dashboard",BarChart3]]],
  ["Cadastros",[["preceptores-internato","Preceptores do Internato",Stethoscope],["cadastros-auxiliares","Cadastros auxiliares",ClipboardCheck]]],
  ["Governança",[["auditoria","Auditoria",History],["configuracoes","Configurações",Settings]]]
];
const COORDENACAO_ALLOWED=["escalas","registrar-presencas"];

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
      return[grupo,items.filter(([id])=>["escalas","registrar-presencas"].includes(id))];
    }
    return null;
  }).filter(Boolean);
}

const PAGE_META={
  "preceptores-pratica":{title:"Preceptores Prática",desc:"Cadastros e vínculos com disciplinas, períodos, escalas e vigências.",btn:"Novo preceptor Prática",cols:["Unidade","Nome","Profissão","Disciplina","Período","Modalidade","Valor","Situação"]},
  "preceptores-internato":{title:"Preceptores do Internato",desc:"Vínculos com internatos, hospitais, setores, escalas e vigências.",btn:"Novo preceptor do Internato",cols:["Unidade","Nome","Profissão","Internato","Período","Local","Modalidade de pagamento","Saldo semestral","Situação"]},
  "cadastros-auxiliares":{title:"Cadastros auxiliares",desc:"Profissões, disciplinas, locais e setores de estágio e prática.",btn:null,cols:["Nome","Situação","Ações"]},
  escalas:{title:"Escalas",desc:"Preceptores ativos, vínculos, dias, turnos e vigências.",btn:null,cols:["Preceptor","Modalidade","Unidade","Disciplina/Internato","Período","Local","Situação da escala","Ações"]},
  "registrar-presencas":{title:"Registrar Presenças",desc:"Calendário operacional com escalas e presenças do mês. Selecione uma data para registrar.",btn:null,cols:[]},
  presencas:{title:"Presenças",desc:"Presenças reais confirmadas, consolidadas por preceptor, unidade e local.",btn:"Registrar presença",cols:["Preceptor","Unidade","Local","Quantidade de turnos"]},
  regras:{title:"Regras financeiras",desc:"Valores, formas de cálculo, condições, prioridades e vigências.",btn:"Nova regra financeira",cols:["Regra","Aplicação","Cálculo","Vigência","Situação"]},
  "apuracao-mensal":{title:"Apuração mensal",desc:"Fila financeira automática baseada em presenças confirmadas.",btn:"",cols:["Preceptor","Ref. Mensal","Unidade","Disciplina/Internato","Local","Presenças","Regra","Valor","Chamado","Status","Observação","Ações"]},
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

function PreceptorFicha({row,page}){
  const isPratica=page==="preceptores-pratica";
  const vinc=isPratica?row.vinculo_adm:row.vinculo_internato;
  const txt=(v)=>(v===null||v===undefined||v===""||v==="-")?FICHA_NI:String(v);
  const dataFmt=(v)=>v?fmtData(v):FICHA_NI;
  const money=(v)=>v!=null&&v!==""?formatCurrencyBRL(v):FICHA_NI;
  const cpfFmt=(v)=>{const d=String(v||"").replace(/\D/g,"");return d.length===11?maskCpf(d):txt(v);};
  const cnpjFmt=(v)=>{const d=String(v||"").replace(/\D/g,"");return d.length===14?maskCnpj(d):txt(v);};
  const docId=row.cpf?cpfFmt(row.cpf):txt(row.rg);
  const situacao=row.vinculo_status==="ativo"||row.vinculo_status==="inativo"?row.vinculo_status:"-";

  return <div className="ficha">
    <div className="ficha-body">
      <section className="ficha-section">
        <h4 className="ficha-section-title"><UserRound size={15}/> Identificação</h4>
        <div className="ficha-grid">
          <div className="ficha-item wide"><small>Nome completo</small><b>{txt(row.nome_completo)}</b></div>
          <div className="ficha-item"><small>CPF / RG</small><b>{docId}</b></div>
          <div className="ficha-item"><small>Número do conselho</small><b>{txt(row.conselho_numero)}</b></div>
          <div className="ficha-item"><small>E-mail</small><b>{txt(row.email)}</b></div>
          <div className="ficha-item"><small>Telefone</small><b>{txt(row.telefone)}</b></div>
          <div className="ficha-item"><small>Profissão</small><b>{txt(row.profissao)}</b></div>
        </div>
      </section>

      <section className="ficha-section">
        <h4 className="ficha-section-title"><WalletCards size={15}/> Pagamento</h4>
        <div className="ficha-grid">
          <div className="ficha-item"><small>Modalidade de pagamento</small><b>{txt(row.modalidade_ref?.nome)}</b></div>
          <div className="ficha-item"><small>CNPJ</small><b>{row.cnpj?cnpjFmt(row.cnpj):FICHA_NI}</b></div>
          <div className="ficha-item"><small>Razão social</small><b>{txt(row.razao_social)}</b></div>
          <div className="ficha-item"><small>Saldo semestral</small><b>{money(row.valor_inicial)}</b></div>
        </div>
      </section>

      <section className="ficha-section">
        <h4 className="ficha-section-title"><BriefcaseBusiness size={15}/> Vínculo</h4>
        <div className="ficha-grid">
          <div className="ficha-item"><small>Unidade</small><b>{txt(vinc?.unidade?.nome||row.unidade)}</b></div>
          <div className="ficha-item"><small>Tipo de vínculo</small><b><span className="ficha-tag">{isPratica?"Prática":"Internato"}</span></b></div>
          {isPratica&&<div className="ficha-item"><small>Disciplina</small><b>{txt(vinc?.disciplina?.nome||row.disciplina)}</b></div>}
          {!isPratica&&<div className="ficha-item"><small>Internato</small><b>{txt(vinc?.internato?.nome||row.internato)}</b></div>}
          <div className="ficha-item"><small>Período</small><b>{txt(vinc?.periodo?.numero ? `${vinc.periodo.numero}º período` : row.periodo)}</b></div>
          <div className="ficha-item"><small>Local</small><b>{txt(vinc?.local?.nome||row.local)}</b></div>
          <div className="ficha-item"><small>Setor</small><b>{txt(vinc?.setor?.nome)}</b></div>
          <div className="ficha-item"><small>Semestre</small><b>{txt(vinc?.semestre?.codigo)}</b></div>
          <div className="ficha-item"><small>Data inicial</small><b>{dataFmt(vinc?.data_inicio)}</b></div>
          <div className="ficha-item"><small>Data final</small><b>{dataFmt(vinc?.data_fim)}</b></div>
          <div className="ficha-item"><small>Situação</small><b><em className={statusBadge(situacao)}>{situacao==="ativo"?"Ativo":situacao==="inativo"?"Inativo":"Sem vínculo"}</em></b></div>
        </div>
      </section>

      <section className="ficha-section">
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
      </section>

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

  const datasPorMes = useMemo(() => {
    return datasTurnos.reduce((acc, item) => {
      const date = new Date(item.iso + 'T00:00:00');
      const mesAnoStr = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const mesAnoCap = mesAnoStr.charAt(0).toUpperCase() + mesAnoStr.slice(1);
      if (!acc[mesAnoCap]) acc[mesAnoCap] = [];
      acc[mesAnoCap].push(item);
      return acc;
    }, {});
  }, [datasTurnos]);

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
              <h4 className="ficha-section-title"><CalendarCheck size={15}/> Datas e Turnos</h4>
              {Object.keys(datasPorMes).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma data cadastrada nesta escala.</div>
              ) : (
                Object.entries(datasPorMes).map(([mesAno, items]) => (
                  <div key={mesAno} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold-600)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '.05em' }}>
                      {mesAno}
                    </div>
                    {items.map((item, idx) => (
                      <div key={item.iso || idx} className="escala-data-row">
                        <span className="data-date-str">{item.dataFmtStr}</span>
                        <span className="data-divider">|</span>
                        <span className="data-weekday">{item.diaSemanaCap}</span>
                        <span className="data-divider">|</span>
                        <div className="turnos-badges">
                          {item.turnos.map((t, tIdx) => (
                            <span key={tIdx} className={`turno-badge turno-${t.toLowerCase()}`}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
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

function EscalasCalendar({formData,set,v}){
  const isPratica=v("tipo_atuacao")==="adm";
  const itens=formData._itens||[];
  const today=new Date();
  const[calMonth,setCalMonth]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1));
  const[selDate,setSelDate]=useState(null);
  const calYear=calMonth.getFullYear();
  const calMon=calMonth.getMonth();
  const firstDay=new Date(calYear,calMon,1).getDay();
  const daysInMonth=new Date(calYear,calMon+1,0).getDate();
  const monthNames=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const dayLabels=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const turnoLabels={manha:"Manhã",tarde:"Tarde",noite:"Noite"};

  function fmtDateISO(d,m,y){
    const mm=String(m+1).padStart(2,"0");
    const dd=String(d).padStart(2,"0");
    return `${y}-${mm}-${dd}`;
  }

  function isDateDisabled(d,m,y){
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
    if(isDateDisabled(d,m,y))return;
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
      next.push({data:iso,turno});
    }
    set("_itens",next);
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
        const selected=isDateSelected(d,calMon,calYear);
        const isToday=isDateToday(d,calMon,calYear);
        const iso=fmtDateISO(d,calMon,calYear);
        const hasItems=itens.some(it=>it.data===iso);
        return <button key={iso} type="button" onClick={()=>toggleDate(d,calMon,calYear)}
          className="escala-cal-day"
          disabled={disabled}
          style={{
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            padding:"6px 2px",borderRadius:6,cursor:disabled?"not-allowed":"pointer",
            border:selected?"2px solid #4f46e5":isToday?"1px solid #4f46e5":"1px solid transparent",
            background:selected?"#eef2ff":"transparent",
            opacity:disabled?0.35:1,fontSize:12,fontWeight:isToday?700:400,
            color:disabled?"#aaa":selected?"#4f46e5":"var(--text)",
            position:"relative",minHeight:32
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
      <b style={{fontSize:11,color:"#566880",display:"block",marginBottom:6}}>Datas e turnos selecionados:</b>
      {uniqueDates.map(iso=>{
        const itemsForDate=getItensForDate(iso);
        const dateObj=new Date(iso+"T12:00:00");
        const label=dateObj.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
        const dowLabel=dateObj.toLocaleDateString("pt-BR",{weekday:"short"});
        return <div key={iso} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,fontSize:12,padding:"4px 8px",background:"var(--surface)",borderRadius:6}}>
          <span style={{fontWeight:600,minWidth:60,color:"var(--text)"}}>{label}</span>
          <span style={{color:"var(--text-muted)",minWidth:30}}>{dowLabel}</span>
          <div style={{display:"flex",gap:4,flex:1}}>
            {itemsForDate.map(it=>
              <span key={it.turno} style={{display:"inline-flex",alignItems:"center",gap:2,background:"#eef2ff",color:"#4f46e5",padding:"2px 8px",borderRadius:4,fontSize:11}}>
                {turnoLabels[it.turno]}
                <button type="button" onClick={()=>removeItem(iso,it.turno)} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:"#4f46e5",display:"flex"}}><X size={10}/></button>
              </span>
            )}
          </div>
        </div>;
      })}
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

function Form({page,close,save,formData,setFormData,formOptions,optionsLoading,optionsErrors,saving,isEdit}){
  const opts=formOptions||{};
  const v=(field)=>formData[field]||"";
  const set=(field,val)=>setFormData(prev=>({...prev,[field]:val}));
  const[maskedCpf,setMaskedCpf]=useState(v("cpf")?maskCpf(v("cpf")):"");
  const[cpfError,setCpfError]=useState("");
  const[maskedCnpj,setMaskedCnpj]=useState(v("cnpj")?maskCnpj(v("cnpj")):"");
  const[maskedValor,setMaskedValor]=useState(formData.valor_inicial!=null?formatCurrencyBRL(formData.valor_inicial):"");
  const isPreceptor=page.includes("preceptores");
  const isInternato=page==="preceptores-internato";
  useEffect(()=>{setMaskedCpf(v("cpf")?maskCpf(v("cpf")):"");setCpfError("");setMaskedCnpj(v("cnpj")?maskCnpj(v("cnpj")):"");setMaskedValor(formData.valor_inicial!=null?formatCurrencyBRL(formData.valor_inicial):"");},[formData]);
  const financial=["regras","apuracao-mensal","pagamentos","dashboard"].includes(page);
  const selectedModalidade=(opts.modalidades||[]).find(m=>m.id===formData.modalidade_pagamento_id);
  const isNFS=selectedModalidade?.nome?.toLowerCase().includes("nfs");
  const setores=(opts.setores||[]);

  const camposFaltantesForm=(()=>{
    if(!isPreceptor)return [];
    const f=[];
    if(!v("nome_completo").trim())f.push("Nome completo");
    if(!(v("unidade_id")||v("unidade_vinculo_id")))f.push("Unidade");
    if(!v("profissao_id"))f.push("Profissão");
    if(isInternato){if(!v("internato_id"))f.push("Internato")}else{if(!v("disciplina_id"))f.push("Disciplina")}
    if(!v("periodo_id"))f.push("Período");
    if(!v("local_id"))f.push("Local de atuação");
    if(!v("semestre_id"))f.push("Semestre");
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
        <span>Preencha os campos marcados com <b>*</b> para liberar este preceptor na tela de Escalas.</span>
        {camposFaltantesForm.length>0&&<span className="vinculo-aviso-pendencias"><AlertCircle size={12}/> Pendente: {camposFaltantesForm.join(", ")}</span>}
        {camposFaltantesForm.length===0&&<span className="vinculo-aviso-ok"><Check size={12}/> Cadastro completo para Escala</span>}
      </div>}
      {isPreceptor&&<>
        <label><b>Nome completo *</b><input value={v("nome_completo")} onChange={e=>set("nome_completo",e.target.value)} placeholder="Nome completo"/></label>
        <label><b>CPF</b><input value={maskedCpf} onChange={e=>{
          const raw=e.target.value.replace(/\D/g,"").slice(0,11);
          setMaskedCpf(maskCpf(raw));
          set("cpf",raw||null);
          if(raw.length===11){setCpfError(validateCpf(raw)?"":"CPF inválido");}
          else{setCpfError(raw.length>0&&raw.length<11?"CPF incompleto":"");}
        }} placeholder="000.000.000-00" className={cpfError?"input-error":""}/>{cpfError&&<span className="field-error">{cpfError}</span>}</label>
        <label><b>RG</b><input value={v("rg")||""} onChange={e=>set("rg",e.target.value||null)} placeholder="RG"/></label>
        <label><b>E-mail</b><input type="email" value={v("email")} onChange={e=>set("email",e.target.value)} placeholder="email@exemplo.com"/></label>
        <label><b>Telefone</b><input value={v("telefone")} onChange={e=>set("telefone",e.target.value)} placeholder="(00) 00000-0000"/></label>
        <label><b>Unidade *</b><span className="select"><select value={v("unidade_id")} onChange={e=>set("unidade_id",e.target.value)}>
          <option value="">Selecione</option>
          {renderOptions("unidades", opts.unidades || [], u => u.nome, "Nenhuma unidade cadastrada.")}
        </select><ChevronDown size={16}/></span></label>
        <label><b>Profissão *</b><span className="select"><select value={v("profissao_id")} onChange={e=>set("profissao_id",e.target.value)}>
          <option value="">Selecione</option>
          {renderOptions("profissoes", opts.profissoes || [], p => p.nome, "Nenhuma profissão cadastrada.")}
        </select><ChevronDown size={16}/></span></label>
        <label><b>Nº conselho</b><input value={v("conselho_numero")||""} onChange={e=>set("conselho_numero",e.target.value||null)} placeholder="Nº do conselho profissional"/></label>
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
        <label><b>Setor</b><span className="select"><select value={v("setor_id")} onChange={e=>set("setor_id",e.target.value)}>
          <option value="">Selecione</option>
          {renderOptions("setores", setores, s => s.nome, "Nenhum setor cadastrado.")}
        </select><ChevronDown size={16}/></span></label>
        <label><b>Semestre *</b><span className="select"><select value={v("semestre_id")} onChange={e=>set("semestre_id",e.target.value)}>
          <option value="">Selecione</option>
          {renderOptions("semestres", opts.semestres || [], s => s.codigo, "Nenhum semestre cadastrado.")}
        </select><ChevronDown size={16}/></span></label>
        <label><b>Início vínculo</b><input type="date" value={v("data_inicio")} onChange={e=>set("data_inicio",e.target.value)}/></label>
        <label><b>Fim vínculo</b><input type="date" value={v("data_fim")} onChange={e=>set("data_fim",e.target.value)}/></label>
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
        <small style={{display:"block",marginTop:3,color:"var(--text-muted,#64748b)",fontSize:12}}>Valor autorizado para pagamento do preceptor no semestre.</small></label>
        <label><b>Observações</b><input value={v("observacoes")} onChange={e=>set("observacoes",e.target.value)} placeholder="Observações"/></label>
        <label><b>Situação *</b><span className="select"><select value={v("status")||"ativo"} onChange={e=>set("status",e.target.value)}>
          <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
        </select><ChevronDown size={16}/></span></label>
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
      {page==="escalas"&&<>
        <EscalasCalendar formData={formData} set={set} v={v}/>
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
  </div><footer><Btn secondary icon={X} onClick={close}>Cancelar</Btn><Btn icon={Check} onClick={save} disabled={saving||isEscalaSemSel}>{saving?"Salvando...":"Salvar"}</Btn></footer></div>;
}

const ALL_ROLES=["admin","coordenacao"];
const ROLE_LABELS={admin:"Administrador",coordenacao:"Coordenação"};

function UserForm({modal,close,onSaved}){
  const user=modal.user||null;
  const isCreate=modal.mode==="user-create";
  const[nome,setNome]=useState(user?.nome_completo||"");
  const[email,setEmail]=useState(user?.email||"");
  const[telefone,setTelefone]=useState(user?.telefone||"");
  const[roles,setRoles]=useState(user?.roles||["coordenacao"]);
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
   const[modal,setModal]=useState(null);
    const[saving,setSaving]=useState(false);
    const isSetores=activeTab==="setores";

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
    if(!search.trim())return data;
    const s=search.toLowerCase();
    return data.filter(r=>{
      if(activeTab==="periodos")return String(r.numero).includes(s)||(r.nome||"").toLowerCase().includes(s);
      if(activeTab==="semestres")return(r.codigo||"").toLowerCase().includes(s);
      if(activeTab==="unidades")return(r.nome||"").toLowerCase().includes(s)||(r.codigo||"").toLowerCase().includes(s);
      if(activeTab==="modalidades")return(r.nome||"").toLowerCase().includes(s);
      if(activeTab==="internatos")return r.nome?.toLowerCase().includes(s)||String(r.numero).includes(s);
      return r.nome?.toLowerCase().includes(s)||(r.local?.nome||"").toLowerCase().includes(s);
    });
  },[data,search,activeTab]);

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
       {AUX_TABS.map(t=><button key={t.id} className={"aux-tab"+(activeTab===t.id?" active":"")} onClick={()=>{setActiveTab(t.id);setSearch("")}}>{t.label}</button>)}
     </div>
     <div className="aux-card">
       <div className="aux-toolbar">
         <label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Buscar em ${TAB_PLACEHOLDERS[activeTab]}...`}/></label>
          <Btn icon={Plus} onClick={()=>setModal({mode:"aux-form",title:TAB_BTN_LABELS[activeTab],formData:isPeriodo?{numero:"",status:"ativo"}:isSemestre?{codigo:"",status:"ativo"}:isUnidade?{nome:""}:isModalidade?{nome:"",status:"ativo"}:isInternato?{nome:""}:isSetores?{nome:""}:{nome:"",status:"ativo"}})}>{TAB_BTN_LABELS[activeTab]}</Btn>
       </div>
       <div className="aux-content">
         {loading?<div className="empty"><Loader2 size={24} className="spin"/><b>Carregando...</b></div>
         :filtered.length===0?<div className="empty"><FileSearch/><b>Nenhum registro encontrado</b></div>
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


function FinanceFilters({f,onChange,rows}){
 const opts=k=>[...new Set(rows.map(r=>r[k]).filter(Boolean))].sort();
 return <div className="fin-screen-filters">
  <label><span>Competência</span><input type="month" value={f.competencia} onChange={e=>onChange({...f,competencia:e.target.value})}/></label>
  <label><span>Unidade</span><select value={f.unidade} onChange={e=>onChange({...f,unidade:e.target.value})}><option value="">Todas</option>{opts('unidade_nome').map(x=><option key={x}>{x}</option>)}</select></label>
  <label><span>Internato</span><select value={f.internato} onChange={e=>onChange({...f,internato:e.target.value})}><option value="">Todos</option>{opts('internato_nome').map(x=><option key={x}>{x}</option>)}</select></label>
  <label><span>Local</span><select value={f.local} onChange={e=>onChange({...f,local:e.target.value})}><option value="">Todos</option>{opts('local_nome').map(x=><option key={x}>{x}</option>)}</select></label>
  <label><span>Status</span><select value={f.status} onChange={e=>onChange({...f,status:e.target.value})}><option value="">Todos</option><option value="nao_solicitada">Não solicitada</option><option value="preparada">Preparada</option><option value="solicitada">Solicitada</option><option value="nota_recebida">Nota recebida</option><option value="pago">Pago</option></select></label>
 </div>;
}
function filtrarFinanceiro(rows,f){return rows.filter(r=>(!f.competencia||`${r.ano}-${String(r.mes).padStart(2,'0')}`===f.competencia)&&(!f.unidade||r.unidade_nome===f.unidade)&&(!f.internato||r.internato_nome===f.internato)&&(!f.local||r.local_nome===f.local)&&(!f.status||(r.situacao_nota||'nao_solicitada')===f.status));}
function gerarDemonstrativoPagamento(r){
 const doc=new jsPDF();doc.setFillColor(12,35,70);doc.rect(0,0,210,34,'F');doc.setTextColor(226,183,78);doc.setFontSize(18);doc.text('MEDICINA UNINASSAU',15,16);doc.setTextColor(255,255,255);doc.setFontSize(11);doc.text('Demonstrativo de serviços de preceptoria',15,26);doc.setTextColor(15,34,65);doc.setFontSize(15);doc.text(r.preceptor_nome||'Preceptor',15,48);autoTable(doc,{startY:56,theme:'grid',head:[['Informação','Detalhe']],body:[['Competência',apuracaoMesLabel(r.mes,r.ano)],['Período',`${fmtData(r.data_inicio)} a ${fmtData(r.data_fim)}`],['Internato',r.internato_nome||'-'],['Unidade',r.unidade_nome||'-'],['Local',r.local_nome||'-'],['Turnos confirmados',String(r.quantidade_presencas||0)],['Regra aplicada',r.regra_nome||'-'],['Valor calculado',formatCurrencyBRL(Number(r.total_bruto||0))],['Chamado',r.chamado_numero||'-']]});doc.save(`demonstrativo-${(r.preceptor_nome||'preceptor').replace(/\s+/g,'-').toLowerCase()}-${r.ano}-${String(r.mes).padStart(2,'0')}.pdf`);
}
function PagamentosPage(){
 const now=new Date(),[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[err,setErr]=useState(''),[f,setF]=useState({competencia:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`,unidade:'',internato:'',local:'',status:''});
 const[modalChamado,setModalChamado]=useState(null);
 const[chamadoForm,setChamadoForm]=useState({numero:'',observacao:''});
 const[chamadoSaving,setChamadoSaving]=useState(false);
 const[chamadoError,setChamadoError]=useState('');
 const chamadoRef=useRef(null);
 const load=useCallback(async()=>{setLoading(true);setErr('');try{setRows(await fetchPainelPagamentos());}catch(e){setErr(e.message)}finally{setLoading(false)}},[]);useEffect(()=>{load()},[load]);
 const data=useMemo(()=>filtrarFinanceiro(rows,f),[rows,f]);
 useEffect(()=>{if(!modalChamado)return;function onKey(e){if(e.key==='Escape'&&!chamadoSaving)setModalChamado(null)}document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[modalChamado,chamadoSaving]);
 async function mudarNota(r,situacao){if(r.situacao_nota==='pago')return;try{await registrarSolicitacaoNota(r.id,situacao);setRows(a=>a.map(x=>x.id===r.id?{...x,situacao_nota:situacao}:x));}catch(e){await systemAlert(e.message||'Não foi possível atualizar a nota fiscal.','Erro ao atualizar')}}
 async function outlook(r){if(!r.preceptor_email){await systemAlert('Não foi possível localizar o e-mail atual do preceptor. Verifique o cadastro ou a integração com o banco.','E-mail não localizado');return;}const assunto=`Solicitação de nota fiscal - ${r.preceptor_nome} - ${apuracaoMesLabel(r.mes,r.ano)}`;const corpo=`Olá, ${r.preceptor_nome}.\n\nSolicitamos o envio da nota fiscal referente aos serviços de preceptoria prestados no período abaixo:\n\nCompetência: ${apuracaoMesLabel(r.mes,r.ano)}\nPeríodo considerado: ${fmtData(r.data_inicio)} a ${fmtData(r.data_fim)}\nInternato: ${r.internato_nome||'-'}\nUnidade: ${r.unidade_nome||'-'}\nLocal: ${r.local_nome||'-'}\nQuantidade de turnos confirmados: ${r.quantidade_presencas||0}\nValor calculado: ${formatCurrencyBRL(Number(r.total_bruto||0))}\nChamado: ${r.chamado_numero||'-'}\n\nO demonstrativo detalhado foi baixado e deve ser anexado antes do envio.\n\nPor favor, encaminhe a nota fiscal conforme as orientações institucionais.\n\nAtenciosamente,`;
 try{await mudarNota(r,'preparada');}catch(e){}window.open(`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(r.preceptor_email)}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`,'_blank','noopener,noreferrer');}
 function notaLabel(s){return s==='pago'?'Recebida':s==='nota_recebida'?'Recebida':s==='solicitada'?'Solicitada':s==='preparada'?'Preparada':(s||'Não solicitada').replaceAll('_',' ');}
 function hasChamado(r){return r.chamado_numero||r.chamado_status&&r.chamado_status!=='nao_aberto';}
 function chamadoStatusLabel(v){return v==='deferido'?'Deferido':v==='concluido'?'Concluído':v==='em_analise'?'Em análise':v==='aberto'?'Aberto':v==='indeferido'?'Indeferido':'Não aberto';}
 function openChamadoModal(r){setChamadoForm({numero:'',observacao:''});setChamadoError('');setModalChamado(r);setTimeout(()=>chamadoRef.current?.focus(),80);}
 async function confirmarChamado(){
  if(!modalChamado)return;
  const num=chamadoForm.numero.trim();
  if(!num){setChamadoError('Informe o número do chamado.');chamadoRef.current?.focus();return;}
  setChamadoError('');setChamadoSaving(true);
  try{
   const result=await atualizarChamado(modalChamado.id,{chamadoNumero:num,chamadoStatus:'aberto',chamadoObservacao:chamadoForm.observacao||null});
   if(result?.erro){setChamadoError(result.erro);setChamadoSaving(false);return;}
   setRows(a=>a.map(x=>x.id===modalChamado.id?{...x,chamado_numero:num,chamado_status:'aberto',chamado_observacao:chamadoForm.observacao||null}:x));
   setModalChamado(null);
  }catch(e){setChamadoError(e.message||'Erro ao abrir chamado.');}finally{setChamadoSaving(false);}
 }
 function renderFooter(r){
  const s=r.situacao_nota||'nao_solicitada';
  const finais=['deferido','concluido'];
  if(finais.includes(r.chamado_status)||s==='pago')return <><button className="btn secondary" onClick={()=>gerarDemonstrativoPagamento(r)}><FileText size={15}/> Gerar PDF</button></>;
  if(s==='nota_recebida'&&!hasChamado(r))return <><button className="btn secondary" onClick={()=>gerarDemonstrativoPagamento(r)}><FileText size={15}/> Gerar PDF</button><button className="btn" onClick={()=>openChamadoModal(r)}><FileText size={15}/> Abrir chamado</button></>;
  if(s==='nota_recebida'&&hasChamado(r))return <><button className="btn secondary" onClick={()=>gerarDemonstrativoPagamento(r)}><FileText size={15}/> Gerar PDF</button></>;
  if(s==='solicitada')return <><button className="btn secondary" onClick={()=>gerarDemonstrativoPagamento(r)}><FileText size={15}/> Gerar PDF</button><button className="btn secondary" onClick={()=>outlook(r)}><Mail size={15}/> Reenviar solicitação</button><button className="btn" onClick={()=>mudarNota(r,'nota_recebida')}><Check size={15}/> Nota recebida</button></>;
  if(s==='preparada')return <><button className="btn secondary" onClick={()=>gerarDemonstrativoPagamento(r)}><FileText size={15}/> Gerar PDF</button><button className="btn secondary" onClick={()=>outlook(r)}><Mail size={15}/> Abrir no Outlook</button><button className="btn" onClick={()=>mudarNota(r,'solicitada')}><Send size={15}/> Marcar solicitada</button></>;
  return <><button className="btn secondary" onClick={()=>gerarDemonstrativoPagamento(r)}><FileText size={15}/> Gerar PDF</button><button className="btn secondary" onClick={()=>outlook(r)}><Mail size={15}/> Abrir no Outlook</button></>;
 }
 function renderGrid(r){
  const s=r.situacao_nota||'nao_solicitada';
  const finais=['deferido','concluido'];
  const isFinal=finais.includes(r.chamado_status)||s==='pago';
  return <>
   <span><b>Competência</b>{apuracaoMesLabel(r.mes,r.ano)}</span>
   <span><b>Internato</b>{r.internato_nome||'-'}</span>
   <span><b>Unidade / Local</b>{r.unidade_nome||'-'} · {r.local_nome||'-'}</span>
   <span><b>Turnos</b>{r.quantidade_presencas||0}</span>
   <span><b>Nota fiscal</b><em className="info">{notaLabel(s)}</em></span>
   {isFinal&&<span><b>Pagamento</b><em className="ok">Confirmado</em></span>}
   {!isFinal&&hasChamado(r)&&<span><b>Chamado</b><em className={r.chamado_status==='deferido'||r.chamado_status==='concluido'?'ok':r.chamado_status==='aberto'||r.chamado_status==='em_analise'?'info':'warn'}>{r.chamado_numero} — {chamadoStatusLabel(r.chamado_status)}</em></span>}
   {!isFinal&&s==='nota_recebida'&&!hasChamado(r)&&<span className="info"><b>Status</b>Nota recebida, aguardando abertura do chamado</span>}
   {!isFinal&&!hasChamado(r)&&s!=='nota_recebida'&&<span><b>Chamado</b>{r.chamado_numero||'Não informado'}</span>}
  </>;
 }
 return <div className="fin-screen"><FinanceFilters f={f} onChange={setF} rows={rows}/>{err&&<div className="fin-error">{err}</div>}{loading?<div className="fin-loading"><Loader2 className="spin"/> Carregando...</div>:<div className="payment-list">{data.length===0?<div className="empty"><ReceiptText/><b>Nenhum cálculo disponível para esta seleção.</b></div>:data.map(r=><article className="payment-card" key={r.id}><header><div><small>PRECEPTOR</small><h3>{r.preceptor_nome}</h3><p>{r.preceptor_email||'E-mail não cadastrado'}</p></div><strong>{formatCurrencyBRL(Number(r.total_bruto||0))}</strong></header><div className="payment-grid">{renderGrid(r)}</div><footer>{renderFooter(r)}</footer></article>)}</div>}
 {modalChamado&&<div className="overlay" style={{display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>!chamadoSaving&&setModalChamado(null)}><div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:16,width:'100%',maxWidth:600,maxHeight:'90vh',overflow:'hidden',boxShadow:'0 28px 80px #07122657',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
  <div style={{background:'linear-gradient(135deg,var(--navy-900),var(--navy-700))',color:'#fff',padding:'16px 20px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}><div style={{width:34,height:34,color:'var(--gold-400)',background:'rgba(255,255,255,.12)',borderRadius:10,display:'grid',placeItems:'center',flexShrink:0}}><FileText size={17}/></div><h3 style={{margin:0,flex:1,fontSize:15,fontWeight:700}}>Abrir chamado</h3><button onClick={()=>!chamadoSaving&&setModalChamado(null)} style={{color:'#fff',background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.18)',borderRadius:8,cursor:'pointer',width:30,height:30,display:'grid',placeItems:'center',flexShrink:0,transition:'background .15s'}} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.22)'} onMouseOut={e=>e.currentTarget.style.background='rgba(255,255,255,.12)'}><X size={15}/></button></div>
  <div style={{padding:'16px 20px 0',flex:'1 1 auto',overflowY:'auto'}}>
   <div style={{background:'var(--surface-soft)',border:'1px solid var(--border-soft)',borderRadius:10,padding:'10px 14px',marginBottom:18,fontSize:12.5,lineHeight:1.6,color:'var(--text-soft)',display:'flex',flexWrap:'wrap',gap:'4px 16px'}}>
    <span><b style={{color:'var(--navy-800)',fontWeight:650}}>Preceptor</b> {modalChamado.preceptor_nome}</span>
    <span><b style={{color:'var(--navy-800)',fontWeight:650}}>Competência</b> {apuracaoMesLabel(modalChamado.mes,modalChamado.ano)}</span>
    <span><b style={{color:'var(--navy-800)',fontWeight:650}}>Valor</b> {formatCurrencyBRL(Number(modalChamado.total_bruto||0))}</span>
    <span><b style={{color:'var(--navy-800)',fontWeight:650}}>Nota fiscal</b> <span style={{color:'var(--success)',fontWeight:650}}>Recebida</span></span>
   </div>
   {chamadoError&&<div style={{color:'var(--danger)',background:'var(--danger-bg)',border:'1px solid #fecaca',borderRadius:8,alignItems:'center',gap:6,margin:'0 0 14px',padding:'8px 12px',fontSize:12.5,fontWeight:600,display:'flex'}}><AlertCircle size={14} style={{flexShrink:0}}/>{chamadoError}</div>}
   <label style={{display:'block',marginBottom:14}}><span style={{display:'block',marginBottom:5,fontSize:12.5,fontWeight:650,color:'var(--navy-800)'}}>Número do chamado *</span><input ref={chamadoRef} value={chamadoForm.numero} onChange={e=>{setChamadoForm(p=>({...p,numero:e.target.value}));if(chamadoError)setChamadoError('');}} placeholder="Ex: 12345678" style={{width:'100%',height:42,border:'1px solid var(--border)',borderRadius:10,padding:'0 12px',fontSize:13.5,outline:'none',boxSizing:'border-box',transition:'border-color .18s,box-shadow .18s'}} onFocus={e=>{e.target.style.borderColor='var(--gold-500)';e.target.style.boxShadow='0 0 0 3px #d8b45f29'}} onBlur={e=>{e.target.style.borderColor='var(--border)';e.target.style.boxShadow='none'}}/></label>
   <label style={{display:'block',marginBottom:14}}><span style={{display:'block',marginBottom:5,fontSize:12.5,fontWeight:650,color:'var(--navy-800)'}}>Status inicial</span><input value="Aberto" readOnly style={{width:'100%',height:42,border:'1px solid var(--border)',borderRadius:10,padding:'0 12px',fontSize:13.5,color:'var(--text-muted)',background:'var(--surface-soft)',cursor:'default',outline:'none',boxSizing:'border-box'}}/></label>
   <label style={{display:'block',marginBottom:0}}><span style={{display:'block',marginBottom:5,fontSize:12.5,fontWeight:650,color:'var(--navy-800)'}}>Observação</span><textarea value={chamadoForm.observacao} onChange={e=>setChamadoForm(p=>({...p,observacao:e.target.value}))} placeholder="Observação opcional..." rows={4} style={{width:'100%',minHeight:110,border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px',fontSize:13.5,resize:'vertical',outline:'none',boxSizing:'border-box',lineHeight:1.5,transition:'border-color .18s,box-shadow .18s'}} onFocus={e=>{e.target.style.borderColor='var(--gold-500)';e.target.style.boxShadow='0 0 0 3px #d8b45f29'}} onBlur={e=>{e.target.style.borderColor='var(--border)';e.target.style.boxShadow='none'}}/></label>
  </div>
  <div style={{borderTop:'1px solid var(--border-soft)',padding:'14px 20px',display:'flex',gap:8,justifyContent:'flex-end',flexShrink:0}}>
   <button className="btn secondary" onClick={()=>setModalChamado(null)} disabled={chamadoSaving} style={{minHeight:40}}>Cancelar</button>
   <button className="btn" onClick={confirmarChamado} disabled={chamadoSaving||!chamadoForm.numero.trim()} style={{minHeight:40,gap:6,display:'inline-flex',alignItems:'center'}}>{chamadoSaving?<><Loader2 size={15} className="spin"/> Abrindo chamado...</>:<><FileText size={15}/> Confirmar abertura</>}</button>
  </div>
 </div></div>}
 </div>;
}
function DashboardPage(){
 const now=new Date(),[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[f,setF]=useState({competencia:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`,unidade:'',internato:'',local:'',status:''});
 useEffect(()=>{setLoading(true);fetchPainelPagamentos({incluirTodos:true}).then(setRows).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
 const data=useMemo(()=>filtrarFinanceiro(rows,f),[rows,f]);
  const resumo=useMemo(()=>{
    const saldos={};
    data.forEach(r=>{if(r.preceptor_id&&!saldos[r.preceptor_id])saldos[r.preceptor_id]=Number(r.saldo_semestral||0)});
    const saldo=Object.values(saldos).reduce((a,v)=>a+v,0);
    const pago=data.filter(r=>r.situacao_nota==='pago').reduce((a,r)=>a+Number(r.total_bruto||0),0);
    const calculado=data.reduce((a,r)=>a+Number(r.total_bruto||0),0);
    const notas={
      aguardando:data.filter(r=>(r.situacao_nota||'nao_solicitada')==='nao_solicitada').length,
      solicitadas:data.filter(r=>r.situacao_nota==='solicitada').length,
      recebidas:data.filter(r=>r.situacao_nota==='nota_recebida').length
    };
    const porInternato={};
    data.filter(r=>r.situacao_nota==='pago').forEach(r=>{const nome=r.internato_nome||'Internato nao informado';porInternato[nome]=(porInternato[nome]||0)+Number(r.total_bruto||0)});
    const ranking=Object.entries(porInternato).map(([nome,valor])=>({nome,valor})).sort((a,b)=>b.valor-a.valor);
    return{saldo,pago,disponivel:saldo-pago,calculado,notas,ranking,maxInternato:Math.max(1,...ranking.map(x=>x.valor))};
  },[data]);
  function excel(){const cols=['Preceptor','E-mail','Competencia','Internato','Unidade','Local','Saldo semestral','Valor calculado','Valor pago por deferimento','Saldo disponivel','Chamado','Status chamado','Situacao da nota'];const vals=data.map(r=>{const pago=r.situacao_nota==='pago'?Number(r.total_bruto||0):0;return[r.preceptor_nome,r.preceptor_email,apuracaoMesLabel(r.mes,r.ano),r.internato_nome,r.unidade_nome,r.local_nome,r.saldo_semestral,r.total_bruto,pago,Number(r.saldo_semestral||0)-pago,r.chamado_numero,r.chamado_status,r.situacao_nota]});const html=`<html><meta charset="UTF-8"><table><tr>${cols.map(x=>`<th>${x}</th>`).join('')}</tr>${vals.map(a=>`<tr>${a.map(x=>`<td>${x??''}</td>`).join('')}</tr>`).join('')}</table></html>`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'application/vnd.ms-excel'}));a.download=`dashboard-internato-${f.competencia||'geral'}.xls`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
 const percentualPago=resumo.saldo>0?Math.min(100,Math.max(0,(resumo.pago/resumo.saldo)*100)):0;
 return <div className="fin-screen dashboard-impact"><div className="dashboard-actions"><FinanceFilters f={f} onChange={setF} rows={rows}/><button className="btn dashboard-export" onClick={excel}><FileSpreadsheet size={18}/> Exportar Excel</button></div>{error&&<div className="fin-error">{error}</div>}{loading?<div className="fin-loading"><Loader2 className="spin"/> Carregando...</div>:<>
   <section className="dashboard-hero"><div><small>VISAO FINANCEIRA DO INTERNATO</small><h2>{f.competencia?new Date(`${f.competencia}-02T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):'Todas as competencias'}</h2><p>Pagamentos sao registrados quando o chamado e deferido. O saldo disponivel e atualizado automaticamente.</p></div><div className="dashboard-hero-value"><span>Saldo disponível</span><strong>{formatCurrencyBRL(resumo.disponivel)}</strong><small>{percentualPago.toFixed(1).replace('.',',')}% do saldo utilizado</small></div></section>
   <div className="dashboard-kpis dashboard-kpis-finance"><div><CircleDollarSign/><span><b>{formatCurrencyBRL(resumo.saldo)}</b>Saldo semestral</span></div><div><WalletCards/><span><b>{formatCurrencyBRL(resumo.pago)}</b>Pago por deferimento</span></div><div><Shield/><span><b>{formatCurrencyBRL(resumo.disponivel)}</b>Saldo disponível</span></div><div><Calculator/><span><b>{formatCurrencyBRL(resumo.calculado)}</b>Valor calculado</span></div><div><Mail/><span><b>{resumo.notas.aguardando}</b>Aguardando solicitação</span></div><div><ReceiptText/><span><b>{resumo.notas.recebidas}</b>Notas fiscais recebidas</span></div></div>
   <div className="dashboard-main-grid">   <section className="dashboard-chart-card dashboard-internato-chart"><header><div><small>DISTRIBUICAO DOS PAGAMENTOS</small><h3>Gastos pagos por Internato</h3><p>Notas fiscais marcadas como pago (chamado deferido)</p></div><strong>{formatCurrencyBRL(resumo.pago)}</strong></header>{resumo.ranking.length===0?<div className="dashboard-chart-empty"><BarChart3/><b>Nenhum chamado deferido nesta seleção.</b><span>O gráfico será preenchido assim que houver pagamentos.</span></div>:<div className="internato-bars">{resumo.ranking.map((item,index)=><div className="internato-bar-row" key={item.nome}><span className="internato-rank">{String(index+1).padStart(2,'0')}</span><div className="internato-bar-info"><div><b>{item.nome}</b><strong>{formatCurrencyBRL(item.valor)}</strong></div><i><u style={{width:`${Math.max(4,(item.valor/resumo.maxInternato)*100)}%`}}/></i></div></div>)}</div>}</section>
   <section className="dashboard-chart-card dashboard-balance-card"><header><div><small>ORÇAMENTO</small><h3>Consumo do saldo semestral</h3><p>Saldo autorizado menos valores deferidos</p></div></header><div className="balance-ring" style={{'--progress':`${percentualPago*3.6}deg`}}><div><strong>{percentualPago.toFixed(1).replace('.',',')}%</strong><span>utilizado</span></div></div><div className="balance-legend"><div><i className="authorized"/><span>Saldo autorizado</span><b>{formatCurrencyBRL(resumo.saldo)}</b></div><div><i className="paid"/><span>Pago</span><b>{formatCurrencyBRL(resumo.pago)}</b></div><div><i className="available"/><span>Disponível</span><b>{formatCurrencyBRL(resumo.disponivel)}</b></div></div></section></div>
   <section className="dashboard-fiscal-flow"><header><div><small>FLUXO DOCUMENTAL</small><h3>Acompanhamento das notas fiscais</h3><p>Apos o recebimento da nota, abra o chamado. Ao deferir, o pagamento e registrado automaticamente.</p></div></header><div className="fiscal-steps"><div className={resumo.notas.aguardando?'pending':''}><span><Mail/></span><b>{resumo.notas.aguardando}</b><strong>Aguardando solicitação</strong><small>Pagamento deferido, e-mail ainda não confirmado</small></div><div className={resumo.notas.solicitadas?'active':''}><span><Send/></span><b>{resumo.notas.solicitadas}</b><strong>Solicitação enviada</strong><small>Pedido de nota fiscal enviado ao preceptor</small></div><div className={resumo.notas.recebidas?'done':''}><span><ReceiptText/></span><b>{resumo.notas.recebidas}</b><strong>Nota fiscal recebida</strong><small>Documento confirmado pelo Financeiro</small></div></div></section>
 </>}</div>;
}

export default function App({forceLogin=false}){
  const[session,setSession]=useState(null);
  const[authLoading,setAuthLoading]=useState(true);
  const[permissionLoading,setPermissionLoading]=useState(false);
  const[userRoles,setUserRoles]=useState([]);
  const[authError,setAuthError]=useState("");
  const[page,setPage]=useState("preceptores-internato");
  const[menu,setMenu]=useState(false);
  const[collapsed,setCollapsed]=useState(()=>{try{return sessionStorage.getItem("sidebarCollapsed")==="1"}catch(e){return false}});
  const[escalasFiltrosAbertos,setEscalasFiltrosAbertos]=useState(false);
  const[search,setSearch]=useState("");
  const[usuariosFiltroNome,setUsuariosFiltroNome]=useState("");
  const[usuariosFiltroEmail,setUsuariosFiltroEmail]=useState("");
  const[usuariosFiltroPerfil,setUsuariosFiltroPerfil]=useState("");
  const[usuariosFiltroSituacao,setUsuariosFiltroSituacao]=useState("");
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

  const isAdmin=userRoles.includes("admin");
  const isCoordenacao=userRoles.includes("coordenacao");
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
        setSession(null);setUserRoles([]);setAuthError("");
      }else if(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"){
        setSession(s);
        if(event==="SIGNED_IN"&&s&&userRoles.length===0){
          setPermissionLoading(true);
          const{data:profile}=await supabase.from("profiles").select("id,ativo").eq("user_id",s.user.id).single();
          if(profile&&profile.ativo){
            const{data:roles}=await supabase.from("user_roles").select("role,ativo").eq("profile_id",profile.id);
            const activeRoles=(roles||[]).filter(r=>r.ativo===true).map(r=>r.role);
            setUserRoles(activeRoles);
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
    setLoadingData(true);setErrorData("");if(page!=="apuracao-mensal")setRows([]);
    try{
      switch(page){
          case"preceptores-pratica":{
            setRows(await fetchPreceptoresPratica());break;
          }
          case"preceptores-internato":{
            setRows(await fetchPreceptoresInternato());break;
          }
        case"cadastros-auxiliares":{setRows([]);break}
        case"escalas":{setRows((await fetchVinculosParaEscalasPage()).filter(r=>r.tipo_atuacao==="internato"));break}
        case"registrar-presencas":{setRows([]);break}
        case"presencas":{setRows((await fetchFolhaPresenca()).filter(r=>r.tipo_atuacao==="internato"));break}
        case"regras":{setRows((await fetchRegrasFinanceiras()).filter(r=>r.tipo_atuacao==="internato"));break}
        case"apuracao-mensal":{break}
        case"ajustes":{setRows(await fetchAjustes());break}
        case"auditoria":{setRows(await fetchAuditLogs());break}
        case"configuracoes":{setRows(await fetchConfiguracoes());break}
        case"usuarios":{setRows(await fetchUsuarios());break}
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
        ]);
      } else if(page==="escalas"){
        await Promise.allSettled([
          sett('vinculosLocais', fetchVinculosLocaisParaEscalas),
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

  const filteredRows=useMemo(()=>{
    if(!rows.length)return[];
    if(!search.trim())return rows;
    const s=search.toLowerCase();
    return rows.filter(r=>{
      if(typeof r==="object"&&!Array.isArray(r)){
        return Object.values(r).some(v=>v&&String(v).toLowerCase().includes(s));
      }
      return false;
    });
  },[rows,search]);

  const filteredUsuarios=useMemo(()=>{
    if(!rows.length)return[];
    let result=rows;
    if(usuariosFiltroNome.trim()){
      const s=usuariosFiltroNome.toLowerCase();
      result=result.filter(r=>(r.nome_completo||"").toLowerCase().includes(s));
    }
    if(usuariosFiltroEmail.trim()){
      const s=usuariosFiltroEmail.toLowerCase();
      result=result.filter(r=>(r.email||"").toLowerCase().includes(s));
    }
    if(usuariosFiltroPerfil){
      result=result.filter(r=>(Array.isArray(r.roles)?r.roles:[]).includes(usuariosFiltroPerfil));
    }
    if(usuariosFiltroSituacao){
      switch(usuariosFiltroSituacao){
        case"ativo":result=result.filter(r=>r.ativo&&!r.primeiro_acesso_pendente);break;
        case"inativo":result=result.filter(r=>!r.ativo);break;
        case"bloqueado":result=result.filter(r=>!r.ativo);break;
        case"pendente":result=result.filter(r=>r.primeiro_acesso_pendente);break;
      }
    }
    return result;
  },[rows,usuariosFiltroNome,usuariosFiltroEmail,usuariosFiltroPerfil,usuariosFiltroSituacao]);

  function notify(t,type){setToast(t);setToastType(type||"success");setModal(null);setTimeout(()=>setToast(""),3000)}
  function toastError(t){setToast(t);setToastType("error");setTimeout(()=>setToast(""),4500)}
  function go(id){
    if(id==="usuarios"&&!isAdmin){notify("Acesso restrito a Administradores.","error");return}
    if(!isAdmin&&isCoordenacao&&!COORDENACAO_ALLOWED.includes(id)){
      notify("Acesso restrito ao perfil Coordenação.","error");return;
    }
    if(collapsed)setCollapsed(false);
    setPage(id);setSearch("");setUsuariosFiltroNome("");setUsuariosFiltroEmail("");setUsuariosFiltroPerfil("");setUsuariosFiltroSituacao("");setMenu(false);const g=NAV.find(([,items])=>items.some(([sid])=>sid===id));if(g)setOpenGroup(g[0]);
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
      if(cpf.length>0&&cpf.length<11){toastError("CPF incompleto. Informe todos os 11 dígitos.");return}
      if(cpf.length===11&&!validateCpf(cpf)){toastError("CPF inválido. Verifique os dígitos verificadores.");return}
      if(cpf.length===11){
        try{
          const duplicado=await buscarPreceptorPorCpf(cpf,modal.editId||null);
          if(duplicado){toastError("CPF já cadastrado para outro preceptor.");return}
        }catch(e){console.warn("[Pre-check CPF indisponível, o banco fará a validação final]",e)}
      }
      if(!formData.nome_completo?.trim()){toastError("Informe o nome completo.");return}
      const selModalPre=(opts.modalidades||[]).find(m=>m.id===formData.modalidade_pagamento_id);
      const isNFSpre=selModalPre?.nome?.toLowerCase().includes("nfs");
      if(isNFSpre&&formData.cnpj){
        const cnpjRaw=formData.cnpj.replace(/\D/g,"");
        if(cnpjRaw.length!==14){toastError("CNPJ inválido. Informe 14 dígitos.");return}
      }
    }
    if(page==="escalas"){
      const itensPre=formData._itens||[];
      if(!formData.tipo_atuacao||!formData.vinculo_local_id){notify("Complete o vínculo do preceptor antes de criar a escala.","error");return}
      if(itensPre.length===0){notify("Selecione pelo menos uma data e um turno.","error");return}
    }
    setSaving(true);
    try{
      switch(page){
        case"preceptores-pratica":case"preceptores-internato":{
          const saveData={...formData};
          const selModal=(opts.modalidades||[]).find(m=>m.id===saveData.modalidade_pagamento_id);
          const isNFS=selModal?.nome?.toLowerCase().includes("nfs");
          if(!isNFS){saveData.cnpj=null;saveData.razao_social=null}
          saveData.status=formData.status||"ativo";
          let vinculoId=modal.editId?formData.vinculo_id:null;
          const regraSel=formData.regra_financeira_id||"";
          const regraAnteriorId=formData._regraAnteriorId||"";
          const mudouRegra=regraSel!==regraAnteriorId;
          if(mudouRegra&&!regraSel&&regraAnteriorId&&!formData.justificativa_regra?.trim()){
            toastError("Justificativa obrigatória para remover a regra financeira.");setSaving(false);return
          }
          if(modal.editId){
            await updatePreceptor(modal.editId,saveData);
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
              if(isInternato){vincData.internato_id=formData.internato_id||null}
              else{vincData.disciplina_id=formData.disciplina_id||null}
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
            }
          }else{
            const preceptor=await insertPreceptor(saveData);
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
            if(isInternato){vincData.internato_id=saveData.internato_id||null}
            else{vincData.disciplina_id=saveData.disciplina_id||null}
            try{
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
      toastError(msg);
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
      turno:i.turno
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
    }catch(e){notify("Erro: "+(e.message||"tente novamente."),"error");}
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
      _auto_semestre:vinculo.semestre_codigo
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
      const itens=(esc.itens||[]).map(i=>({data:i.data,turno:i.turno}));
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
        _auto_semestre:vinculo.semestre_codigo
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
    }catch(e){notify("Erro: "+(e.message||"tente novamente."),"error")}
  }

  function renderTable(){
    if(page==="cadastros-auxiliares")return null;
    if(page==="escalas")return renderEscalasTable();
    if(page==="presencas")return renderPresencasTable();
    if(page==="regras")return renderRegrasTable();
    if(page==="apuracao-mensal")return renderApuracaoMensalTable();
    if(page==="auditoria")return renderAuditTable();
    if(page==="configuracoes")return renderConfigTable();
    if(page==="usuarios")return renderUsuariosTable();
    if(isPreceptorPage)return renderPreceptorTable();
    return renderGenericTable();
  }

   function renderPreceptorTable(){
     return <tbody>{filteredRows.map(r=>{
       const isInactive=r.vinculo_status!=="ativo";
       const vCompleto=r.vinculo_completo!==false;
       const regraOk=!!r.regraAtiva;
       const vincBadge=isInactive?"neutral":!vCompleto?"bad":regraOk?"ok":"warn";
       const vincLabel=isInactive?"Preceptor inativo":!vCompleto?"Cadastro incompleto para Escala":regraOk?"Liberado":"Regra financeira pendente";
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
         <td>{r.internato||"-"}</td>
         <td>{r.periodo||"-"}</td>
         <td>{r.local||"-"}</td>
       </>}
       <td>{r.modalidade}</td>
        <td>{r.valor_inicial!=null?formatCurrencyBRL(r.valor_inicial):"-"}</td>
        <td><em className={vincBadge} title={camposFaltantes.length?"Campos faltantes: "+camposFaltantes.join(", "):""}>{vincLabel}</em></td>
        <td><span className="actions">
          <button onClick={()=>setModal({mode:"detail",title:r.nome_completo,row:r,page})}><Eye/></button>
          {!vCompleto&&!isInactive&&<button title="Completar cadastro" onClick={()=>setModal({mode:"form",title:`Completar cadastro — ${r.nome_completo}`,page,editId:r.id,editData:r})}><AlertCircle/></button>}
          {vCompleto&&!isInactive&&<button onClick={()=>setModal({mode:"form",title:`Editar: ${r.nome_completo}`,page,editId:r.id,editData:r})}><Pencil/></button>}
          {isInactive&&<button onClick={()=>setModal({mode:"form",title:`Editar: ${r.nome_completo}`,page,editId:r.id,editData:r})}><Pencil/></button>}
          {page==="preceptores-pratica"&&r.vinculo_adm&&r.vinculo_status!==null&&
            (r.vinculo_status==="ativo"?
              <button title="Inativar vínculo" onClick={()=>handleToggleVinculo(r,r.vinculo_adm.id,"pratica")}><LogOut/></button>:
              <button title="Reativar vínculo" onClick={()=>handleToggleVinculo(r,r.vinculo_adm.id,"pratica")}><LogIn/></button>)}
          {page==="preceptores-internato"&&r.vinculo_internato&&r.vinculo_status!==null&&
            (r.vinculo_status==="ativo"?
              <button title="Inativar vínculo" onClick={()=>handleToggleVinculo(r,r.vinculo_internato.id,"internato")}><LogOut/></button>:
              <button title="Reativar vínculo" onClick={()=>handleToggleVinculo(r,r.vinculo_internato.id,"internato")}><LogIn/></button>)}
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

  const[apurCompetencias,setApurCompetencias]=useState([]);
  const[apurCompetenciaId,setApurCompetenciaId]=useState("");
  const[apurFilter,setApurFilter]=useState("internato");
  const[apurSituacao,setApurSituacao]=useState("");
  const[apurResumo,setApurResumo]=useState({preceptores:0,turnos:0,valorTotal:0,pendencias:0});
  const[apurCalculando,setApurCalculando]=useState(false);
  const[apurDetalhe,setApurDetalhe]=useState(null);
  const[apurDetalheItens,setApurDetalheItens]=useState([]);
  const[apurFiltroMes,setApurFiltroMes]=useState("");
  const[apurFiltroAno,setApurFiltroAno]=useState("");
  const[apurChamadoEdit,setApurChamadoEdit]=useState({});
  const periodoCompetencia=(comp)=>{
    if(!comp)return "Período não informado";
    const inicio=comp.data_inicio||`${comp.ano}-${String(comp.mes).padStart(2,"0")}-01`;
    const fim=comp.data_fim||`${comp.ano}-${String(comp.mes).padStart(2,"0")}-${String(new Date(comp.ano,comp.mes,0).getDate()).padStart(2,"0")}`;
    return `${fmtData(inicio)} a ${fmtData(fim)}`;
  };

  const apuracaoCacheKey=()=>{
    const now=new Date();
    return `apuracao:${apurFiltroAno||now.getFullYear()}:${apurFiltroMes||now.getMonth()+1}:${apurFilter}:${apurSituacao}:${search.trim()}`;
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
    const now=new Date();
    const filtros={mes:apurFiltroMes?parseInt(apurFiltroMes):now.getMonth()+1,ano:apurFiltroAno?parseInt(apurFiltroAno):now.getFullYear()};
    if(apurFilter==="pratica")filtros.modalidade="adm";
    else if(apurFilter==="internato")filtros.modalidade="internato";
    if(apurSituacao)filtros.situacao=apurSituacao;
    if(search.trim())filtros.search=search.trim();
    const data=await buscarFilaFinanceira(filtros);
    setRows(data);
    aplicarResumoApuracao(data);
    try{sessionStorage.setItem(apuracaoCacheKey(),JSON.stringify(data))}catch{}
    return data;
  },[apurFiltroMes,apurFiltroAno,apurFilter,apurSituacao,search]);

  // Abrir, filtrar ou voltar à aba consulta somente cálculos existentes. Nunca recalcula.
  useEffect(()=>{
    if(page!=="apuracao-mensal")return;
    try{
      const cached=JSON.parse(sessionStorage.getItem(apuracaoCacheKey())||"null");
      if(Array.isArray(cached)){setRows(cached);aplicarResumoApuracao(cached)}
    }catch{}
    const timer=setTimeout(()=>{consultarFilaExistente().catch(e=>console.error("[buscarFilaFinanceira]",e))},250);
    return()=>clearTimeout(timer);
  },[page,consultarFilaExistente]);

  // Recalcula somente quando uma presença realmente muda e apenas no mês afetado.
  useEffect(()=>{
    if(page!=="apuracao-mensal")return;
    const channel=supabase.channel("apuracao-presencas-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"presencas"},async(payload)=>{
        const registro=payload.new&&Object.keys(payload.new).length?payload.new:payload.old;
        const data=registro?.data_presenca;
        if(!data)return;
        const [ano,mes]=String(data).split("-").map(Number);
        try{await autoApurarFilaFinanceira(mes,ano);await consultarFilaExistente()}catch(e){console.error("[apuracaoRealtime]",e)}
      }).subscribe();
    return()=>{supabase.removeChannel(channel)};
  },[page,consultarFilaExistente]);

  useEffect(()=>{
    document.querySelectorAll(".tablewrap table").forEach(table=>{
      const labels=Array.from(table.querySelectorAll("thead th")).map(th=>th.textContent||"");
      table.querySelectorAll("tbody tr").forEach(tr=>{
        Array.from(tr.children).forEach((td,i)=>{if(labels[i])td.setAttribute("data-label",labels[i])});
      });
    });
  },[page,filteredRows,escalasFilter,loadingData]);

  function renderEscalasTable(){
    return <tbody>{escalasFilteredRows.map(r=>{
      const vinculoCompleto=r.vinculo_completo!==false;
      const camposFaltantes=r.vinculo_campos_faltantes||[];
      let badgeClass, badgeLabel;
      if(!vinculoCompleto){badgeClass="bad";badgeLabel="Vínculo incompleto";}
      else if(r.escala_status==="ativa"){badgeClass="ok";badgeLabel="Escala ativa";}
      else if(r.escala_status==="inativa"){badgeClass="neutral";badgeLabel="Escala inativa";}
      else{badgeClass="bad";badgeLabel="Sem escala";}
      return <tr key={r.vinculo_id}>
        <td>
          <div><b>{r.preceptor_nome}</b></div>
          {!r.regraAtiva&&<div><em className="warn" title="Vínculo liberado para escala, mas sem regra financeira associada. Cálculos financeiros futuros ficam bloqueados.">Regra financeira pendente</em></div>}
        </td>
        <td>{r.modalidade_label||"-"}</td>
        <td>{r.unidade_nome||"-"}</td>
        <td>{r.tipo_atuacao==="adm"?r.disciplina_nome:r.internato_nome||"-"}</td>
        <td>{r.periodo_nome||"-"}</td>
        <td>{r.local_nome||"-"}</td>
        <td><em className={badgeClass} title={!vinculoCompleto&&camposFaltantes.length?`Campos faltantes: ${camposFaltantes.join(", ")}`:""}>{badgeLabel}</em></td>
        <td><span className="actions">
          {!vinculoCompleto&&<button title="Completar cadastro" onClick={()=>setModal({mode:"escala-incompleta",title:"Vínculo incompleto",row:r,page})}><AlertCircle/></button>}
          {r.escala_status==="sem_escala"&&vinculoCompleto&&
            <button title="Criar escala" onClick={()=>handleCriarEscala(r)}><Plus size={16}/></button>}
          {r.escala_status!=="sem_escala"&&vinculoCompleto&&<>
            <button title="Visualizar escala" onClick={()=>handleVerEscalas(r)}><Eye/></button>
            <button title="Editar escala" onClick={()=>handleEditEscalaFromVinculo(r)}><Pencil/></button>
            {r.escala_status==="ativa"
              ?<button title="Inativar escala" onClick={()=>handleToggleTodasEscalas(r,false)}><LogOut/></button>
              :<button title="Reativar escala" onClick={()=>handleToggleTodasEscalas(r,true)}><LogIn/></button>}
          </>}
        </span></td>
      </tr>;
    })}</tbody>;
  }

  function renderPresencasTable(){
    return <tbody>{filteredRows.map((r)=>{
      const key=[r.preceptor_id,r.tipo_atuacao,r.competencia,r.unidade_id,r.local_id].filter(Boolean).join('-');
      return <tr key={key}>
        <td><b>{r.preceptor_nome||'-'}</b></td>
        <td>{r.unidade_nome||'-'}</td>
        <td>{r.local_nome||'-'}</td>
        <td><b style={{fontSize:16}}>{r.total_turnos||0}</b> <small style={{color:'var(--text-muted)'}}>turno{(r.total_turnos||0)!==1?'s':''}</small></td>
        <td><span className="actions">
          <button title="Visualizar folha de presença" onClick={()=>setModal({mode:"folha-presenca",title:`Folha de Presença — ${r.preceptor_nome}`,row:r})}><Eye/></button>
        </span></td>
      </tr>;
    })}</tbody>;
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
    return <tbody>{filteredUsuarios.map((r,i)=>{
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
      notify("Cálculo atualizado com sucesso!");
    }catch(e){notify(e.message||"Erro ao atualizar cálculo.","error")}
    setApurCalculando(false);
  }

  async function handleVerDetalhesCalculo(calcId){
    try{
      const{calculo,itens,presencas,vinculoContexto,regra}=await fetchDetalhesCalculoCompleto(calcId);
      setApurDetalhe(calculo);
      setApurDetalheItens(itens);
      setModal({mode:"apuracao-detalhe",title:"Detalhes do cálculo",presencas,vinculoContexto,regra});
    }catch(e){notify(e.message||"Erro ao carregar detalhes.","error")}
  }

  async function handleAtualizarChamado(calculoId){
    const edits=apurChamadoEdit[calculoId];
    if(!edits)return;
    try{
      const result=await atualizarChamado(calculoId,{
        chamadoNumero:edits.chamado_numero,
        chamadoStatus:edits.chamado_status,
        chamadoObservacao:edits.chamado_observacao
      });
      if(result?.erro){
        notify(result.erro,"error");
        return;
      }
      notify("Chamado atualizado!");
      const updated={...edits};
      if(edits.chamado_status==='deferido'||edits.chamado_status==='concluido'){updated.situacao_nota='pago';}
      setRows(prev=>prev.map(r=>r.id===calculoId?{...r,...updated}:r));
    }catch(e){
      const msg=e.message||"Erro ao salvar chamado.";
      if(msg.includes('nota_nao_recebida')||msg.includes('nota fiscal antes')){
        notify("Necessario registrar o recebimento da nota fiscal antes de atualizar o chamado.","error");
      }else{notify(msg,"error")}
    }
  }

  function handleChamadoEditChange(calculoId,field,value){
    setApurChamadoEdit(prev=>({...prev,[calculoId]:{...(prev[calculoId]||{}),[field]:value}}));
  }

  function renderApuracaoMensalTable(){
    const meses=["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const now=new Date();
    const anoAtual=now.getFullYear();
    const statusLabel=(v)=>CHAMADO_STATUS_OPTIONS.find(o=>o.value===v)?.label||"Não aberto";
    const statusClass=(v)=>v==="concluido"||v==="deferido"?"ok":v==="indeferido"?"bad":v==="em_analise"?"info":v==="aberto"?"warn":"neutral";
    return <div className="finance-page apuracao-page">
      <section className="finance-competencia-banner"><div><small>Competência financeira</small><b>{apuracaoMesLabel(apurFiltroMes||now.getMonth()+1,apurFiltroAno||anoAtual)}</b></div><div><small>Período considerado</small><b>{periodoCompetencia({ano:Number(apurFiltroAno||anoAtual),mes:Number(apurFiltroMes||now.getMonth()+1)})}</b></div></section>
      <section className="finance-controlbar">
        <label className="finance-name-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar preceptor pelo nome..." aria-label="Buscar preceptor pelo nome"/></label>
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
          <div className="finance-segment" aria-label="Modalidade">
            <button className="active" type="button">Internato</button>
          </div>
          <select value={apurSituacao} onChange={e=>setApurSituacao(e.target.value)} aria-label="Status do chamado">
            <option value="">Todos os status</option>
            {CHAMADO_STATUS_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className="finance-refresh" onClick={()=>{
            const mes=Number(apurFiltroMes||now.getMonth()+1), ano=Number(apurFiltroAno||anoAtual);
            systemConfirm('Deseja recalcular todos os valores desta competência?','Recalcular competência',{confirmLabel:'Confirmar recálculo',busyLabel:'Recalculando competência...',icon:<RotateCw size={16}/>,details:<><div><b>Competência</b><span>{apuracaoMesLabel(mes,ano)}</span></div><div><b>Período</b><span>{periodoCompetencia({ano,mes})}</span></div><div><b>Preceptores</b><span>{apurResumo.totalPreceptores||rows.length}</span></div><div><b>Valor atual</b><span>{formatCurrencyBRL(apurResumo.valorTotal||0)}</span></div></>,warning:'Números, status e observações dos chamados serão preservados.',onConfirm:()=>handleCalcularCompetencia(mes,ano)});
          }} disabled={apurCalculando}>{apurCalculando?<Loader2 size={16} className="spin"/>:<RotateCw size={16}/>} Recalcular competência</button>

        </div>
      </section>

      <section className="finance-summary" aria-label="Resumo da apuração">
        <article><UsersRound/><div><strong>{apurResumo.preceptores}</strong><span>Preceptores</span></div></article>
        <article><CalendarCheck/><div><strong>{rows.reduce((a,r)=>a+Number(r.quantidade_presencas||0),0)}</strong><span>Turnos confirmados</span></div></article>
        <article className="money"><CircleDollarSign/><div><strong>{formatCurrencyBRL(apurResumo.valorTotal)}</strong><span>Valor calculado</span></div></article>
        <article className={apurResumo.pendencias?"attention":""}><AlertCircle/><div><strong>{apurResumo.pendencias}</strong><span>Pendências</span></div></article>
      </section>

      {apurCalculando&&<div className="finance-progress"><Loader2 size={17} className="spin"/> Atualizando presenças e cálculos...</div>}

      {rows.length===0&&!apurCalculando?<section className="finance-empty">
        <FileSearch size={32}/><h3>Nenhum preceptor na fila financeira</h3>
        <p>Somente preceptores com presença confirmada no período aparecem aqui automaticamente.</p>
      </section>:<section className="finance-list">
        {rows.map(r=>{
          const edits=apurChamadoEdit[r.id]||{};
          const numero=edits.chamado_numero??r.chamado_numero??"";
          const chamadoStatus=edits.chamado_status??r.chamado_status??"nao_aberto";
          const observacao=edits.chamado_observacao??r.chamado_observacao??"";
          const dirty=Object.keys(edits).length>0;
          return <article className="finance-card" key={r.id}>
            <header>
              <div className="finance-person">
                <div className="finance-avatar">{String(r.preceptor_nome||"P").split(" ").slice(0,2).map(n=>n[0]).join("")}</div>
                <div><h3>{r.preceptor_nome||"Preceptor"}</h3><p>{r.modalidade==="adm"?"Prática":"Internato"} · Competência {apuracaoMesLabel(r.mes,r.ano)} · {periodoCompetencia({ano:r.ano,mes:r.mes,data_inicio:r.data_inicio,data_fim:r.data_fim})}</p></div>
              </div>
              <div className="finance-value"><span>Valor calculado</span><strong>{formatCurrencyBRL(Number(r.total_bruto||0))}</strong></div>
            </header>
            <div className="finance-context">
              <span><b>Unidade</b>{r.unidade_nome||"-"}</span>
              <span><b>{r.modalidade==="adm"?"Disciplina":"Internato"}</b>{r.modalidade==="adm"?(r.disciplina_nome||"-"):(r.internato_nome||"-")}</span>
              <span><b>Local</b>{r.local_nome||"-"}</span>
              <span><b>Presenças</b>{r.quantidade_presencas||0} turno{Number(r.quantidade_presencas||0)===1?"":"s"}</span>
              <span className="rule"><b>Regra aplicada</b>{r.regra_nome&&r.regra_nome!=="Regra financeira pendente"?r.regra_nome:<em className="warn">Regra pendente</em>}</span>
            </div>
            <div className="finance-followup">
              <label><span>Número do chamado</span><input value={numero} onChange={e=>handleChamadoEditChange(r.id,"chamado_numero",e.target.value)} placeholder="Informe o número"/></label>
              <label><span>Status do chamado</span><select value={chamadoStatus} onChange={e=>handleChamadoEditChange(r.id,"chamado_status",e.target.value)}>{CHAMADO_STATUS_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
              <label className="notes"><span>Observação</span><textarea value={observacao} onChange={e=>handleChamadoEditChange(r.id,"chamado_observacao",e.target.value)} placeholder="Digite a observação do chamado..." rows={3}/></label>
              <em className={statusClass(chamadoStatus)}>{statusLabel(chamadoStatus)}</em>
            </div>
            <footer>
              <button className="finance-link" onClick={()=>handleVerDetalhesCalculo(r.id)}><Eye size={16}/> Visualizar cálculo</button>
              <button className="btn" disabled={!dirty} onClick={()=>handleAtualizarChamado(r.id)}><Check size={15}/> Salvar acompanhamento</button>
            </footer>
          </article>;
        })}
      </section>}
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
         page==="apuracao-mensal"?renderApuracaoMensalTable():
         page==="pagamentos"?<PagamentosPage/>:
         page==="dashboard"?<DashboardPage/>:
        <div className={"panel"+(page==="regras"?" rules-panel":"")}>
          {page==="regras"&&<div className="rules-overview"><div><small>REGRAS CADASTRADAS</small><strong>{rows.length}</strong></div><div><small>ATIVAS</small><strong>{rows.filter(r=>r.status==="ativo").length}</strong></div><div><small>PRÁTICA</small><strong>{rows.filter(r=>r.tipo_atuacao==="adm").length}</strong></div><div><small>INTERNATO</small><strong>{rows.filter(r=>r.tipo_atuacao==="internato").length}</strong></div></div>}
          <div className="toolbar">
            <label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Buscar em ${meta.title.toLowerCase()}...`}/></label>
            {page==="escalas"?<div className="escalas-filter-wrap">
              <button type="button" className="escalas-filters-toggle" onClick={()=>setEscalasFiltrosAbertos(a=>!a)} aria-expanded={escalasFiltrosAbertos}>
                <Filter size={14}/> Filtros <ChevronDown size={14} className={"navgroup-arrow"+(escalasFiltrosAbertos?" open":"")}/>
              </button>
              <div className={"escalas-filters"+(escalasFiltrosAbertos?" open":"")}>
                {[["todos","Todos"],["sem_escala","Sem escala"],["ativa","Com escala ativa"],["inativa","Escala inativa"]].map(([k,l])=>
                  <button key={k} className={"escalas-filter-btn"+(escalasFilter===k?" active":"")} onClick={()=>setEscalasFilter(k)}>{l}</button>
                )}
              </div>
            </div>:<div>
              <Btn secondary icon={Filter}>Filtros</Btn>
              <Btn secondary icon={FileSearch} onClick={()=>notify(`${filteredRows.length} registro(s) encontrado(s)`)}>Consultar</Btn>
            </div>}
          </div>
          {loadingData?<div className="empty"><Loader2 size={24} className="spin"/><b>Carregando dados...</b></div>
          :errorData?<div className="empty"><AlertCircle/><b>Erro ao carregar: {errorData}</b></div>
          :<><div className="tablewrap">
            <table>
              <thead><tr>{meta.cols.map(c=><th key={c}>{c}</th>)}<th>Ações</th></tr></thead>
              {renderTable()}
            </table>
          </div>
          {!filteredRows.length&&!escalasFilteredRows.length&&<div className="empty"><FileSearch/><b>Nenhum registro encontrado</b></div>}</>}
        </div>}
      </div>
      <footer style={{textAlign:'center',padding:'24px 16px 20px',fontSize:12,color:'var(--text-muted)',letterSpacing:'.02em'}}>Desenvolvido por <span style={{color:'var(--gold-500)',fontWeight:600}}>V3L0Z</span></footer>
    </section>

    {modal&&<div className="overlay modal">
      <div className={"dialog"+((isPreceptorPage&&modal.mode==="detail")||modal.mode==="escala-detail"?" ficha":(modal.mode==="regra-create"||modal.mode==="regra-edit")?" regra":modal.mode==="folha-presenca"?" folha":modal.mode==="apuracao-detalhe"?" calculo-dialog":"")}>
        <div className="modalhead">
          <div>
            <small>{modal.mode==="folha-presenca"?"FOLHA DE PRESENÇA":modal.mode==="escala-detail"?"DETALHES DA ESCALA":modal.mode==="detail"?(isPreceptorPage?"FICHA DO PRECEPTOR":"DETALHES DO REGISTRO"):modal.mode==="user-create"||modal.mode==="user-edit"||modal.mode==="user-view"?"GERENCIAR USUÁRIOS":"CADASTRO E OPERAÇÃO"}</small>
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
      const itens=(esc.itens||[]).map(i=>({data:i.data,turno:i.turno}));
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
          {apurDetalhe&&<>
            <div className="calculo-modal-body">
              <section className="calculo-hero">
                <div>
                  <span>Valor calculado</span>
                  <strong>{formatCurrencyBRL(apurDetalhe.total_liquido||0)}</strong>
                </div>
                <em className="info">{apurDetalhe.tipo_atuacao==="adm"?"Prática":"Internato"}</em>
              </section>

              <section className="calculo-grid-info">
                <article><small>Preceptor</small><b>{apurDetalhe.preceptor?.nome_completo||"-"}</b></article>
                <article><small>Competência financeira</small><b>{apurDetalhe.competencia?`${["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][apurDetalhe.competencia.mes]}/${apurDetalhe.competencia.ano}`:"-"}</b></article><article><small>Período considerado</small><b>{periodoCompetencia(apurDetalhe.competencia)}</b></article>
                {modal.vinculoContexto&&<>
                  <article><small>Unidade</small><b>{modal.vinculoContexto.unidade?.nome||"-"}</b></article>
                  <article><small>{apurDetalhe.tipo_atuacao==="adm"?"Disciplina":"Internato"}</small><b>{apurDetalhe.tipo_atuacao==="adm"?(modal.vinculoContexto.disciplina?.nome||"-"):(modal.vinculoContexto.internato?.nome||"-")}</b></article>
                  <article><small>Local</small><b>{modal.vinculoContexto.local?.nome||"-"}</b></article>
                  <article><small>Calculado em</small><b>{fmtTimestamp(apurDetalhe.calculado_em)}</b></article>
                </>}
              </section>

              {modal.regra&&<section className="calculo-section">
                <div className="calculo-section-title"><SlidersHorizontal size={15}/><h4>Regra financeira aplicada</h4></div>
                <div className="calculo-regra"><b>{modal.regra.nome}</b><div>{(modal.regra.componentes||[]).map(c=><span key={c.id||c.descricao}>{c.descricao||c.tipo}: <strong>{formatCurrencyBRL(c.valor||0)}{c.valor_extra?` + ${formatCurrencyBRL(c.valor_extra)}`:""}</strong></span>)}</div></div>
              </section>}

              <section className="calculo-section">
                <div className="calculo-section-title"><CalendarCheck size={15}/><h4>Presenças consideradas</h4><em className="neutral">{(modal.presencas||[]).length}</em></div>
                {(modal.presencas||[]).length===0?<div className="calculo-empty">Nenhuma presença registrada.</div>:<div className="calculo-tablewrap"><table className="calculo-table">
                  <thead><tr><th>Data</th><th>Turno</th><th>Local</th><th>Situação</th></tr></thead>
                  <tbody>{modal.presencas.map(p=><tr key={p.id}><td>{fmtData(p.data_presenca)}</td><td>{turnoLabel(p.turno)}</td><td>{p.local?.nome||"-"}</td><td><em className={p.status==="confirmada"?"ok":"warn"}>{p.status}</em></td></tr>)}</tbody>
                </table></div>}
              </section>

              <section className="calculo-section">
                <div className="calculo-section-title"><Calculator size={15}/><h4>Memória de cálculo</h4></div>
                {apurDetalheItens.length===0?<div className="calculo-empty">Nenhum item registrado.</div>:<div className="calculo-tablewrap"><table className="calculo-table">
                  <thead><tr><th>Descrição</th><th>Tipo</th><th>Qtd.</th><th>Valor unitário</th><th>Total</th></tr></thead>
                  <tbody>{apurDetalheItens.map(it=><tr key={it.id}><td><b>{it.descricao||"-"}</b></td><td>{it.tipo||"-"}</td><td>{it.quantidade||0}</td><td>{formatCurrencyBRL(it.valor_unitario)}</td><td><b>{formatCurrencyBRL(it.valor_total)}</b></td></tr>)}</tbody>
                </table></div>}
              </section>
            </div>
            <footer className="calculo-modal-footer"><Btn icon={Check} onClick={()=>setModal(null)}>Fechar</Btn></footer>
          </>}
        </div>:

         modal.mode==="detail"?isPreceptorPage?<>
          <PreceptorFicha row={modal.row} page={modal.page}/>
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
        </div>:modal.mode==="user-create"||modal.mode==="user-edit"?<UserForm modal={modal} close={()=>setModal(null)} onSaved={()=>{notify(modal.mode==="user-create"?"Usuário criado com sucesso!":"Usuário atualizado com sucesso!");loadPage();setModal(null)}}/>:<Form page={modal.page} close={()=>setModal(null)} save={handleSave} formData={formData} setFormData={setFormData} formOptions={formOptions} optionsLoading={formOptionsLoading} optionsErrors={formOptionsErrors} saving={saving} isEdit={!!modal.editId}/>}
      </div>
    </div>}

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
      setPdfError(e.message || 'Erro ao gerar o PDF.');
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
                      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{p.modalidade_label} — {p.local_nome}</div>
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
  const [filtroModalidade, setFiltroModalidade] = useState('internato');
  const [filtroUnidade, setFiltroUnidade] = useState('todos');
  const [filtroLocal, setFiltroLocal] = useState('todos');
  const [filtroSetor, setFiltroSetor] = useState('todos');
  const [filtroTurno, setFiltroTurno] = useState('todos');
  const [modalReg, setModalReg] = useState(null);
  const [turnosSel, setTurnosSel] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
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
    if (busca.trim()) { const s = busca.toLowerCase(); result = result.filter(p => p.preceptor_nome.toLowerCase().includes(s)); }
    if (filtroStatus !== 'todos') result = result.filter(p => p.status_lista === filtroStatus);
    if (filtroModalidade !== 'todos') result = result.filter(p => filtroModalidade === 'pratica' ? p.tipo_atuacao === 'adm' : p.tipo_atuacao === 'internato');
    if (filtroUnidade !== 'todos') result = result.filter(p => p.unidade_nome === filtroUnidade);
    if (filtroLocal !== 'todos') result = result.filter(p => p.local_nome === filtroLocal);
    if (filtroSetor !== 'todos') result = result.filter(p => p.setor_nome === filtroSetor);
    if (filtroTurno !== 'todos') result = result.filter(p => p.turnos_previstos.includes(filtroTurno));
    return result;
  }, [preceptoresDia, busca, filtroStatus, filtroModalidade, filtroUnidade, filtroLocal, filtroSetor, filtroTurno]);

  const totaisDia = useMemo(() => {
    const dia = data?.calendario?.find(c => c.data === dataSel);
    if (!dia) return { escalados: 0, confirmados: 0, pendentes: 0 };
    return { escalados: dia.escalados, confirmados: dia.com_confirmacao, pendentes: dia.pendentes };
  }, [dataSel, data]);

  const unidades = useMemo(() => [...new Set(preceptoresDia.map(p => p.unidade_nome))].sort(), [preceptoresDia]);
  const locais = useMemo(() => [...new Set(preceptoresDia.map(p => p.local_nome))].sort(), [preceptoresDia]);
  const setores = useMemo(() => [...new Set(preceptoresDia.map(p => p.setor_nome).filter(Boolean))].sort(), [preceptoresDia]);

  function limparFiltros() { setBusca(''); setFiltroStatus('todos'); setFiltroModalidade('internato'); setFiltroUnidade('todos'); setFiltroLocal('todos'); setFiltroSetor('todos'); setFiltroTurno('todos'); }

  async function handleRegistrar() {
    if (!modalReg || !turnosSel.length) return;
    setEnviando(true);
    try {
      const resolvedUserId = userId || (await supabase.auth.getUser()).data?.user?.id;
      await registrarPresencaCoordenador({ escala_id: modalReg.escala_id, preceptor_id: modalReg.preceptor_id, data: dataSel, turnos: turnosSel, registrado_por: resolvedUserId });
      setRefreshKey(k => k + 1);
      setModalReg(null); setTurnosSel([]);
    } catch (e) { await systemAlert(e.message || 'Erro ao registrar.','Não foi possível registrar'); }
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

              {compact && (
                <button type="button" className="compact-filters-toggle" onClick={() => setFiltrosAbertos(!filtrosAbertos)}>
                  <SlidersHorizontal size={16}/> Filtros
                  <ChevronDown size={16} style={{ transform: filtrosAbertos ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}/>
                </button>
              )}

              {!compact && (
                <button type="button" className="reg-filters-toggle" onClick={() => setFiltrosAbertos(!filtrosAbertos)} aria-expanded={filtrosAbertos}>
                  <SlidersHorizontal size={16}/> Filtros
                  <ChevronDown size={16} className={"reg-filters-chev"+(filtrosAbertos?" open":"")}/>
                </button>
              )}

              {(compact ? filtrosAbertos : true) && (
                <div className={compact ? 'compact-filters' : 'reg-filters' + (filtrosAbertos ? ' open' : '')}>
                  <div className="reg-filter-row">
                    <label className="reg-search"><Search size={16}/><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome..."/></label>
                    <button type="button" className="btn secondary" onClick={limparFiltros} style={{ minHeight: 38, padding: '0 14px', fontSize: 12 }}><RotateCw size={14}/> Limpar</button>
                  </div>
                  <div className="reg-filter-row">
                    <div className="reg-filter-group">
                      {[['todos','Todos'],['pendente','Pendentes'],['parcial','Parciais'],['confirmada','Confirmados']].map(([k,l]) =>
                        <button key={k} className={"escalas-filter-btn"+(filtroStatus===k?" active":"")} onClick={() => setFiltroStatus(k)}>{l}</button>
                      )}
                    </div>
                    <div className="reg-filter-group">
                      <button className="escalas-filter-btn active" type="button">Internato</button>
                    </div>
                  </div>
                  <div className="reg-filter-row">
                    {unidades.length > 1 && (
                      <select className="reg-filter-select" value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)}>
                        <option value="todos">Todas as unidades</option>
                        {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    )}
                    {locais.length > 1 && (
                      <select className="reg-filter-select" value={filtroLocal} onChange={e => setFiltroLocal(e.target.value)}>
                        <option value="todos">Todos os locais</option>
                        {locais.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    )}
                    {setores.length > 0 && (
                      <select className="reg-filter-select" value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)}>
                        <option value="todos">Todos os setores</option>
                        {setores.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                    <select className="reg-filter-select" value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
                      <option value="todos">Todos os turnos</option>
                      <option value="manha">Manhã</option>
                      <option value="tarde">Tarde</option>
                      <option value="noite">Noite</option>
                    </select>
                  </div>
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
                            <span style={{ color: 'var(--text-muted)' }}>{p.unidade_nome} · {p.local_nome}</span>
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
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <div className="modalhead">
              <div><small>REGISTRAR PRESENÇA</small><h2>{modalReg.preceptor_nome}</h2></div>
              <button onClick={() => setModalReg(null)}><X/></button>
            </div>
            <div style={{ padding: 22 }}>
              <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span className="ficha-tag">{modalReg.modalidade_label}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{modalReg.unidade_nome} · {modalReg.local_nome}</span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <b style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Turnos realmente trabalhados</b>
                <p className="actual-shift-help">A escala é apenas uma previsão. Marque os turnos que realmente foram realizados neste dia.</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {['manha','tarde','noite'].map(t => {
                    const jaConf = modalReg.turnos_confirmados.includes(t);
                    const sel = turnosSel.includes(t);
                    return (
                      <button key={t} type="button" disabled={jaConf} onClick={() => !jaConf && setTurnosSel(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                        style={{ padding: '12px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: jaConf ? 'not-allowed' : 'pointer', opacity: jaConf ? 0.5 : 1, transition: 'all .15s', border: `2px solid ${sel ? 'var(--gold-500)' : jaConf ? '#d1d5db' : 'var(--border)'}`, background: sel ? 'var(--gold-500)' : jaConf ? '#f1f5f9' : 'var(--white)', color: sel ? '#fff' : jaConf ? '#94a3b8' : 'var(--navy-900)' }}>
                        {TURNO_LABELS[t] || t}
                        {modalReg.turnos_previstos.includes(t) && <span className="shift-planned">Previsto</span>}
                        {jaConf && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn secondary icon={X} onClick={() => setModalReg(null)}>Cancelar</Btn>
                <Btn icon={Check} onClick={handleRegistrar} disabled={!turnosSel.length || enviando}>{enviando ? 'Confirmando...' : 'Confirmar'}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalDetalhe && (
        <div className="overlay modal" onClick={() => setModalDetalhe(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <div className="modalhead">
              <div><small>DETALHES</small><h2>{modalDetalhe.preceptor_nome}</h2></div>
              <button onClick={() => setModalDetalhe(null)}><X/></button>
            </div>
            <div style={{ padding: 22 }}>
              <div className="ficha-grid" style={{ marginBottom: 16 }}>
                <div className="ficha-item"><small>Modalidade</small><b>{modalDetalhe.modalidade_label}</b></div>
                <div className="ficha-item"><small>Unidade</small><b>{modalDetalhe.unidade_nome}</b></div>
                <div className="ficha-item"><small>Atividade</small><b>{modalDetalhe.atividade_nome}</b></div>
                <div className="ficha-item"><small>Período</small><b>{modalDetalhe.periodo_nome}</b></div>
                <div className="ficha-item"><small>Local</small><b>{modalDetalhe.local_nome}</b></div>
                {modalDetalhe.setor_nome && <div className="ficha-item"><small>Setor</small><b>{modalDetalhe.setor_nome}</b></div>}
              </div>
              <b style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Turnos</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {modalDetalhe.turnos_previstos.map(t => {
                  const conf = modalDetalhe.turnos_confirmados.includes(t);
                  return <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: conf ? 'var(--success-bg)' : 'var(--surface-soft)', border: `1px solid ${conf ? '#bdebd9' : 'var(--border)'}`, borderRadius: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{TURNO_LABELS[t] || t}</span>
                    <em className={conf ? 'ok' : 'bad'}>{conf ? 'Confirmado' : 'Pendente'}</em>
                  </div>;
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
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

