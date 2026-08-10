import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, CheckCircle, XCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabase';
import Logo from './Logo';

const REGRAS = [
  { id: 'len', label: 'Mínimo de 8 caracteres', test: s => s.length >= 8 },
  { id: 'upper', label: 'Uma letra maiúscula', test: s => /[A-Z]/.test(s) },
  { id: 'lower', label: 'Uma letra minúscula', test: s => /[a-z]/.test(s) },
  { id: 'num', label: 'Um número', test: s => /[0-9]/.test(s) },
  { id: 'special', label: 'Um caractere especial (!@#$%^&*)', test: s => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(s) }
];

function RegraItem({ ok, texto }) {
  return (
    <li className={`pw-rule ${ok ? 'pw-rule-ok' : ''}`}>
      {ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
      <span>{texto}</span>
    </li>
  );
}

export default function RedefinirSenha() {
  const [sessionValida, setSessionValida] = useState(false);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmacao, setShowConfirmacao] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setSessionValida(true);
        setCarregandoSessao(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session) {
        setSessionValida(true);
      }
      setCarregandoSessao(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const regrasOk = REGRAS.every(r => r.test(senha));
  const senhasIguais = senha.length > 0 && senha === confirmacao;
  const podeSalvar = regrasOk && senhasIguais && !carregando;

  const handle = useCallback(async (e) => {
    e.preventDefault();
    setErro('');

    if (!regrasOk) {
      setErro('A senha não atende todos os requisitos.');
      return;
    }
    if (!senhasIguais) {
      setErro('As senhas não coincidem.');
      return;
    }

    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);

    if (error) {
      setErro('Erro ao redefinir senha. O link pode ter expirado. Solicite um novo link.');
      return;
    }

    await supabase.auth.signOut();
    setSucesso(true);
  }, [senha, confirmacao, regrasOk, senhasIguais, carregando]);

  if (carregandoSessao) {
    return (
      <div className="login-screen">
        <div className="login-card auth-card">
          <Logo variant="completa" />
          <div className="auth-loading">
            <Loader2 size={32} className="spin" />
            <p>Validando link de recuperação...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionValida) {
    return (
      <div className="login-screen">
        <div className="login-card auth-card">
          <Logo variant="completa" />
          <div className="auth-error-icon">
            <AlertCircle size={48} />
          </div>
          <h2>Link inválido ou expirado</h2>
          <p className="auth-error-text">
            O link de redefinição de senha não é válido ou já foi utilizado.
            Solicite um novo link de recuperação.
          </p>
          <a href="/recuperar-senha" className="btn" style={{ width: '100%', marginTop: 16 }}>
            Solicitar novo link
          </a>
          <a href="/login" className="auth-back-link">
            Voltar ao login
          </a>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="login-screen">
        <div className="login-card auth-card">
          <Logo variant="completa" />
          <div className="auth-success-icon">
            <CheckCircle size={48} />
          </div>
          <h2>Senha redefinida</h2>
          <p className="auth-success-text">
            Sua senha foi atualizada com sucesso. Você já pode acessar o sistema
            com a nova senha.
          </p>
          <a href="/login" className="btn" style={{ width: '100%', marginTop: 16 }}>
            Acessar o sistema
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card auth-card">
        <Logo variant="completa" />
        <h2>Redefinir senha</h2>
        <p>Crie uma nova senha para sua conta.</p>
        <form onSubmit={handle}>
          <label>
            <b>Nova Senha</b>
            <div className="pw-input-wrap">
              <input
                type={showSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Nova senha"
                autoFocus
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowSenha(!showSenha)}
                tabIndex={-1}
              >
                {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {senha.length > 0 && (
            <ul className="pw-rules">
              {REGRAS.map(r => (
                <RegraItem key={r.id} ok={r.test(senha)} texto={r.label} />
              ))}
            </ul>
          )}
          <label>
            <b>Confirmar Nova Senha</b>
            <div className="pw-input-wrap">
              <input
                type={showConfirmacao ? 'text' : 'password'}
                value={confirmacao}
                onChange={e => setConfirmacao(e.target.value)}
                placeholder="Confirme a nova senha"
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowConfirmacao(!showConfirmacao)}
                tabIndex={-1}
              >
                {showConfirmacao ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {confirmacao.length > 0 && (
            <div className={`pw-match ${senhasIguais ? 'pw-match-ok' : 'pw-match-bad'}`}>
              {senhasIguais ? <CheckCircle size={14} /> : <XCircle size={14} />}
              <span>{senhasIguais ? 'Senhas coincidem' : 'Senhas não coincidem'}</span>
            </div>
          )}
          {erro && (
            <div className="login-erro">
              <AlertCircle size={14} /> {erro}
            </div>
          )}
          <button className="btn" type="submit" disabled={!podeSalvar}>
            {carregando ? <Loader2 size={16} className="spin" /> : <Lock size={16} />}
            Salvar nova senha
          </button>
        </form>
        <a href="/login" className="auth-back-link">
          Voltar ao login
        </a>
      </div>
    </div>
  );
}
