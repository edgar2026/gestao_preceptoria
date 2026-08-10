import React, { useState } from 'react';
import { Loader2, AlertCircle, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';
import Logo from './Logo';

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setErro('');

    if (!email.trim()) {
      setErro('Informe seu e-mail.');
      return;
    }
    if (!isValidEmail(email)) {
      setErro('E-mail inválido.');
      return;
    }

    setCarregando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`
    });
    setCarregando(false);

    if (error) {
      setErro('Falha ao enviar o link. Tente novamente.');
      return;
    }

    setEnviado(true);
  };

  if (enviado) {
    return (
      <div className="login-screen">
        <div className="login-card auth-card">
          <Logo variant="completa" />
          <div className="auth-success-icon">
            <CheckCircle size={48} />
          </div>
          <h2>Link enviado</h2>
          <p className="auth-success-text">
            Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá
            um link para redefinir sua senha. Verifique sua caixa de entrada e
            também a pasta de spam.
          </p>
          <a href="/login" className="auth-back-link">
            <ArrowLeft size={16} /> Voltar ao login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card auth-card">
        <Logo variant="completa" />
        <h2>Recuperar senha</h2>
        <p>Informe o e-mail associado à sua conta.</p>
        <form onSubmit={handle}>
          <label>
            <b>E-mail</b>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoFocus
            />
          </label>
          {erro && (
            <div className="login-erro">
              <AlertCircle size={14} /> {erro}
            </div>
          )}
          <button className="btn" type="submit" disabled={carregando}>
            {carregando ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Mail size={16} />
            )}{' '}
            Enviar link de recuperação
          </button>
        </form>
        <a href="/login" className="auth-back-link">
          <ArrowLeft size={16} /> Voltar ao login
        </a>
      </div>
    </div>
  );
}
