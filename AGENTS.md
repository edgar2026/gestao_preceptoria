# Instruções para agentes de desenvolvimento

1. Leia `docs/DOCUMENTACAO_VIVA_PLANILHAS_PRECEPTORIA.md` antes de alterar regras.
2. Não remova RLS, auditoria, vigências ou memória de cálculo.
3. A rota do preceptor deve continuar mobile-first e exibir apenas presença.
4. O painel administrativo é desktop-first.
5. Preceptor Prática e Internato são vínculos diferentes do mesmo cadastro pessoal.
6. Não use planilhas como banco operacional.
7. Rode migrações primeiro em ambiente de desenvolvimento.

8. Preserve a rota pública controlada `/preceptor/presenca` no mesmo aplicativo.
9. A rota mobile deve chamar a RPC `registrar_presenca` e nunca inserir diretamente na tabela `presencas`.

10. A rota `/p/:token` fornece acesso individual e seguro por preceptor.
11. O token bruto NUNCA é armazenado; apenas o hash SHA-256 fica gravado na tabela `preceptor_acesso_presenca`.
12. Cada preceptor ativo possui no máximo um link ativo. Gerar novo link invalida o anterior automaticamente.
13. A rota `/p/:token` chama RPCs públicas (`validar_acesso_token`, `buscar_escalas_token`, `registrar_presenca_token`) via `anon`.
14. Não exponha o token em logs, URLs de navegação persistente ou mensagens de erro.
15. Ao inativar um preceptor, bloqueie o acesso sem apagar o histórico.
16. O link permanece disponível enquanto o preceptor estiver ativo e pelo menos um vínculo estiver ativo.
17. A tela `/p/:token` é mobile-first: mostra "Olá, [nome]", data atual e somente escalas ativas do dia.
18. Se houver uma única escala, selecione automaticamente atividade, local e setor.
19. Se houver múltiplas escalas em turnos diferentes, mostre cartões com turno, atividade e local.
20. Se houver dois locais no mesmo turno, solicite primeiro a escolha do local.
21. Permita mais de uma atuação no dia somente quando forem escalas diferentes.
22. Impeça duplicidade no mesmo vínculo, local, data e turno.
23. Mantenha a interface mobile extremamente simples e preserve o visual aprovado.
24. Preceptores Prática: período obrigatório de 1º ao 8º. Preceptores do Internato: período obrigatório de 9º ao 12º.
25. Validação de período aplicada no frontend (Form) e no banco (trigger `fn_validate_vinculo_periodo`).
26. Ao criar préceptor, criar o vínculo na mesma operação; se o vínculo falhar, inativar o préceptor criado.
27. Ao editar, pré-selecionar o período e vínculo existentes; se período incompatível, mostrar aviso.
