import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { RegistrarPresencasPage } from './App';
import RegistroPresencaToken from './RegistroPresencaToken';
import RecuperarSenha from './components/RecuperarSenha';
import RedefinirSenha from './components/RedefinirSenha';
import './styles.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((items) => {
    items.forEach((item) => item.unregister());
  });
}

const normalizedPath = window.location.pathname.replace(/\/$/, '') || '/';
let Component = App;
let componentProps = {};

if (normalizedPath === '/login') {
  Component = (props) => <App forceLogin {...props} />;
} else if (normalizedPath === '/recuperar-senha') {
  Component = RecuperarSenha;
} else if (normalizedPath === '/redefinir-senha') {
  Component = RedefinirSenha;
} else if (normalizedPath === '/preceptor/presenca') {
  Component = RegistrarPresencasPage;
  componentProps = { compact: true };
} else if (normalizedPath.startsWith('/p/') && normalizedPath.length > 3) {
  Component = RegistroPresencaToken;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><Component {...componentProps} /></React.StrictMode>,
);
