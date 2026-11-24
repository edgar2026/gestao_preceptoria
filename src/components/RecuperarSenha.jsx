import React, { useState } from 'react';
import { Loader2, AlertCircle, Mail, ArrowLeft, CheckCircle, Copy, Check } from 'lucide-react';
import { solicitarRecuperacaoAcesso } from '../services/queries';
import Logo from './Logo';

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [responsavel, setResponsavel] = useState(null);
  const [copiadoIdx, setCopiadoIdx] = useState(null);

  const handle = async (e) => {
    e.preventDefault();
    setErro('');

    const normEmail = email.trim().toLowerCase();
    if (!normEmail) {
      setErro('Informe seu e-mail.');
      return;
    }
    if (!isValidEmail(normEmail)) {
      setErro('E-mail inválido.');
      return;
    }

    setCarregando(true);
    try {
      const res = await solicitarRecuperacaoAcesso(normEmail);
      if (!res?.sucesso) {
        setErro(res?.mensagem || 'Não foi possível registrar a solicitação.');
        setCarregando(false);
        return;
      }

      const lista = (Array.isArray(res.contatos) && res.contatos.length > 0)
        ? res.contatos
        : (res.responsavel_email ? [{ nome: res.responsavel_nome, email: res.responsavel_email }] : []);

      setResponsavel({
        configurado: res.responsavel_configurado,
        nome: res.responsavel_nome,
        email: res.responsavel_email,
        contatos: lista
      });
      setEnviado(true);
    } catch (err) {
      setErro(err?.message || 'Falha ao registrar a solicitação. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const handleCopiarEmail = async (emailTexto, idx) => {
    if (!emailTexto) return;
    try {
      await navigator.clipboard.writeText(emailTexto);
      setCopiadoIdx(idx);
      setTimeout(() => setCopiadoIdx(null), 2500);
    } catch {
      // Fallback
    }
  };

  if (enviado) {
    return (
      <div className="login-screen">
        <div className="login-card auth-card" style={{ maxWidth: 480 }}>
          <Logo variant="completa" />
          <div className="auth-success-icon" style={{ marginTop: 16 }}>
            <CheckCircle size={44} style={{ color: 'var(--success, #16a34a)' }} />
          </div>
          <h2 style={{ fontSize: 20, marginTop: 12, marginBottom: 8 }}>Solicitação de recuperação registrada</h2>

          {responsavel?.contatos?.length > 0 ? (
            <div style={{ textAlign: 'left', marginTop: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--navy-800)', fontWeight: 600 }}>
                {responsavel.contatos.length > 1
                  ? 'Para recuperar o acesso, entre em contato com um dos responsáveis abaixo:'
                  : 'Para recuperar o acesso, entre em contato com o responsável:'}
              </p>
              {responsavel.contatos.map((c, idx) => (
                <div key={idx} style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Responsável: </span>
                    <strong>{c.nome}</strong>
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 10 }}>
                    <span style={{ color: 'var(--text-muted)' }}>E-mail: </span>
                    <strong>{c.email}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => handleCopiarEmail(c.email, idx)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 34, fontSize: 12 }}
                  >
                    {copiadoIdx === idx ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
                    {copiadoIdx === idx ? 'E-mail copiado!' : 'Copiar e-mail'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="auth-success-text" style={{ fontSize: 13, margin: '16px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Solicitação registrada. O contato responsável pela recuperação de acesso ainda não foi configurado. Entre em contato com a Administração do sistema.
            </p>
          )}

          <a href="/login" className="btn" style={{ width: '100%', textAlign: 'center', minHeight: 40, textDecoration: 'none' }}>
            Fechar
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card auth-card" style={{ maxWidth: 440 }}>
        <Logo variant="completa" />
        <h2>Recuperar acesso</h2>
        <p>Informe o e-mail associado à sua conta de Administrador ou Coordenador.</p>
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
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <a href="/login" className="btn secondary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
              Cancelar
            </a>
            <button className="btn" type="submit" disabled={carregando} style={{ flex: 1 }}>
              {carregando ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Mail size={16} />
              )}{' '}
              Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
