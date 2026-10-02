import React,{useEffect,useState,useMemo,useCallback}from"react";
import{CalendarDays,Check,ChevronDown,Clock3,Loader2,MapPin,Send,Stethoscope,XCircle,AlertTriangle}from"lucide-react";
import{supabase}from"./supabase";
import logoHorizontal from"./assets/branding/logo-horizontal-clara.png";
function dataCompleta(d){return new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(d)}
function turnoLabel(t){return{manha:"Manhã",tarde:"Tarde",noite:"Noite"}[t]||t}
const TURNOS=[{id:"manha",nome:"Manhã"},{id:"tarde",nome:"Tarde"},{id:"noite",nome:"Noite"}];
export default function RegistroPresencaToken(){
  const token=useMemo(()=>{
    const p=window.location.pathname;
    const parts=p.replace(/\/+$/,"").split("/");
    return parts[parts.length-1]||"";
  },[]);
  const[loading,setLoading]=useState(true);
  const[erro,setErro]=useState("");
  const[nome,setNome]=useState("");
  const[escalas,setEscalas]=useState([]);
  const[selecionada,setSelecionada]=useState(null);
  const[turnoSel,setTurnoSel]=useState(null);
  const[enviando,setEnviando]=useState(false);
  const[mensagem,setMensagem]=useState("");
  const hoje=new Date();
  const dataHoje=dataCompleta(hoje);
  const carregarDados=useCallback(async()=>{
    if(!token){setErro("Link invalido.");setLoading(false);return}
    const{data:valida,err:errV}=await supabase.rpc("validar_acesso_token",{p_token:token});
    if(errV||!valida||!valida.valido){
      setErro(valida?.erro||"Link invalido ou expirado.");setLoading(false);return}
    setNome(valida.nome);
    const{data:esc,err:errE}=await supabase.rpc("buscar_escalas_token",{p_token:token});
    if(errE){setErro("Erro ao buscar escalas.");setLoading(false);return}
    setEscalas(esc||[]);
    setLoading(false);
  },[token]);
  useEffect(()=>{carregarDados()},[carregarDados]);
  const escalasPorTurno=useMemo(()=>{
    const map={};
    escalas.forEach(e=>{
      if(!map[e.turno])map[e.turno]=[];
      map[e.turno].push(e);
    });
    return map;
  },[escalas]);
  const turnosDisponiveis=useMemo(()=>TURNOS.filter(t=>escalasPorTurno[t.id]?.length>0),[escalasPorTurno]);
  const locaisNoTurno=useMemo(()=>{
    if(!turnoSel)return[];
    const escs=escalasPorTurno[turnoSel]||[];
    const map={};
    escs.forEach(e=>{
      if(!map[e.local_id])map[e.local_id]={local:e.local,local_id:e.local_id,escalas:[]};
      map[e.local_id].escalas.push(e);
    });
    return Object.values(map);
  },[turnoSel,escalasPorTurno]);
  const escalasFiltradas=useMemo(()=>{
    if(!turnoSel)return[];
    const escs=escalasPorTurno[turnoSel]||[];
    if(locaisNoTurno.length===1)return escs;
    if(!selecionada)return[];
    return escs.filter(e=>e.local_id===selecionada);
  },[turnoSel,escalasPorTurno,locaisNoTurno,selecionada]);
  const enviar=useCallback(async()=>{
    if(!turnoSel||!escalasFiltradas.length||enviando)return;
    setEnviando(true);setMensagem("");
    const promisses=escalasFiltradas.filter(e=>!e.ja_registrada).map(async e=>{
      const{data,err}=await supabase.rpc("registrar_presenca_token",{p_token:token,p_escala_id:e.escala_id,p_turno:turnoSel});
      return{data,err,escala:e};
    });
    const resultados=await Promise.all(promisses);
    const sucessos=resultados.filter(r=>!r.err&&r.data?.sucesso);
    const falhas=resultados.filter(r=>r.err||!r.data?.sucesso);
    if(sucessos.length>0){
      const nomes=sucessos.map(r=>`${r.escala.atividade} - ${r.escala.local}`).join("; ");
      setMensagem(`Presença registrada: ${nomes}.`);
      carregarDados();
    }
    if(falhas.length>0){
      const ehConflito=falhas.some(r=>/^Conflito de escala/i.test(String(r.data?.erro||"").trim()));
      const erros=falhas.map(r=>r.data?.erro||"Erro desconhecido").join("\n\n");
      setMensagem(ehConflito?erros:`Erro: ${erros}`);
    }
    setEnviando(false);
  },[turnoSel,escalasFiltradas,token,enviando,carregarDados]);
  const toggleTurno=(id)=>{
    setTurnoSel(id);
    setSelecionada(null);
    setMensagem("");
  };
  if(loading)return<main className="presence-page"><div className="presence-shell"><div className="presence-loading"><Loader2 size={32} className="spin"/><p>Validando acesso...</p></div></div></main>;
  if(erro)return<main className="presence-page"><div className="presence-shell"><div className="presence-error"><XCircle size={40}/><h2>Acesso indisponível</h2><p>{erro}</p></div></div></main>;
  const jaRegistra=escalasFiltradas.some(e=>e.ja_registrada);
  const podeEnviar=turnoSel&&escalasFiltradas.length>0&&!jaRegistra&&!enviando;
  return<main className="presence-page"><div className="presence-shell">
    <header className="presence-hero"><img className="presence-logo" src={logoHorizontal} alt="Medicina UNINASSAU"/><div><p>CONTROLE DE PRESENÇA</p><h1>Olá, {nome}!</h1><span>Registre sua presença para o dia atual.</span></div><div className="today"><Clock3/> <span>{dataHoje}</span></div></header>
    <section className="presence-section">
      <div className="presence-title"><div><h2>Turnos disponíveis</h2><p>Selecione o turno e confirme sua presença</p></div>{escalas.length>0&&<b>{escalas.length}</b>}</div>
      {escalas.length===0&&<div className="empty-schedule"><AlertTriangle size={36}/><b>Não existe atividade programada</b><p>Procure a coordenação para verificar suas escalas.</p></div>}
      {escalas.length>0&&<>
        <div className="token-turns">{TURNOS.filter(t=>escalasPorTurno[t.id]?.length>0).map(t=>{
          const sel=turnoSel===t.id;
          const qtd=escalasPorTurno[t.id]?.filter(e=>!e.ja_registrada).length||0;
          const todosJaRegistrados=escalasPorTurno[t.id]?.every(e=>e.ja_registrada);
          return<button key={t.id} className={`token-turn-btn${sel?" selected":""}${todosJaRegistrados?" done":""}`} onClick={()=>toggleTurno(t.id)} disabled={todosJaRegistrados}>
            {sel&&<i><Check/></i>}<b>{t.nome}</b>
            <small>{todosJaRegistrados?"Registrado":`${qtd} escala${qtd>1?"s":""}`}</small>
          </button>
        })}</div>
        {turnoSel&&locaisNoTurno.length>1&&!selecionada&&<>
          <p className="token-label">ESCOLHA O LOCAL</p>
          <div className="token-locations">{locaisNoTurno.map(loc=><button key={loc.local_id} className="token-loc-btn" onClick={()=>setSelecionada(loc.local_id)}>
            <MapPin size={18}/><span>{loc.local}</span><small>{loc.escalas.length} escala{loc.escalas.length>1?"s":""}</small>
          </button>)}</div>
        </>}
        {turnoSel&&(locaisNoTurno.length===1||selecionada)&&<>
          <p className="token-label">ATIVIDADES DO TURNO</p>
          <div className="token-activities">{escalasFiltradas.map(e=><div key={e.escala_id} className={`token-act-card${e.ja_registrada?" done":""}`}>
            <div className="token-act-head"><Stethoscope size={18}/><b>{e.atividade}</b>{e.ja_registrada&&<span className="token-badge"><Check size={12}/></span>}</div>
            <div className="token-act-details"><span><MapPin size={14}/>{e.local}{e.setor!=="-"?` - ${e.setor}`:""}</span>{e.hora_inicio&&<span><Clock3 size={14}/>{e.hora_inicio} - {e.hora_fim}</span>}</div>
            {e.ja_registrada&&<p className="token-act-note">Presença já registrada hoje</p>}
          </div>)}</div>
          {!jaRegistra&&escalasFiltradas.filter(e=>!e.ja_registrada).length>0&&<button className="token-send" disabled={!podeEnviar} onClick={enviar}>
            {enviando?<Loader2 size={18} className="spin"/>:<Send size={18}/>}Registrar presença
          </button>}
        </>}
        {selecionada&&locaisNoTurno.length>1&&<button className="token-back" onClick={()=>setSelecionada(null)}>← Trocar local</button>}
      </>}
      {mensagem&&<div className={`token-msg${(mensagem.includes("Erro")||mensagem.startsWith("Conflito"))?" bad":""}`}>{mensagem}</div>}
    </section>
  </div></main>
}
