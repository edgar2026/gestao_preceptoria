# Documentação Viva das Planilhas de Preceptoria

**Projeto:** Sistema Integrado de Gestão e Pagamento de Preceptores  
**Responsável pelo levantamento:** Edgar Tavares do Espirito Santo  
**Objetivo:** substituir integralmente as planilhas por um sistema único, com banco de dados, regras financeiras, registro de presença, auditoria e operação administrativa.  
**Status:** levantamento em andamento  
**Modelos de planilha distintos previstos:** 4  
**Modelos distintos analisados:** 4 de 4

---

## 1. Princípio central do projeto

O sistema não será um visualizador, importador permanente ou exportador de planilhas. As planilhas atuais serão utilizadas somente como fonte de levantamento das regras, dos campos, dos históricos e das exceções existentes.

Depois da implantação:

- os preceptores serão cadastrados no sistema;
- as atividades e escalas serão cadastradas no sistema;
- os valores e regras de pagamento serão cadastrados pela equipe autorizada;
- os preceptores registrarão apenas a presença na rota exclusiva;
- o sistema relacionará a presença à atividade, local, escala e regra financeira vigentes;
- os cálculos serão produzidos pelo sistema;
- aprovações, ajustes, processos, saldos e pagamentos serão controlados no painel administrativo;
- todas as alterações relevantes deverão deixar histórico de auditoria;
- a planilha deixará de ser necessária na operação diária.

### Regra de projeto

> Nenhuma tela, tabela ou banco definitivo deverá ser fechado antes da análise das sete planilhas.

Cada nova planilha deverá atualizar este documento, sem apagar decisões anteriores. Quando houver conflitos entre planilhas, o conflito deverá ser registrado para decisão posterior.

---

## 2. Método de análise das sete planilhas

Para cada planilha recebida, registrar:

1. nome e finalidade do arquivo;
2. abas existentes;
3. período e curso abrangidos;
4. campos cadastrais;
5. campos acadêmicos e operacionais;
6. campos financeiros;
7. fórmulas e cálculos;
8. regras implícitas em observações;
9. status e etapas de aprovação;
10. duplicidades e inconsistências;
11. vínculos com planilhas já analisadas;
12. novas entidades necessárias no banco;
13. novas telas ou funções sugeridas;
14. dúvidas que precisam de decisão humana.

---

# PLANILHA 1 DE 7

## 3. Identificação

**Arquivo:** `GES FOR 57 - 2026.1 MEDICINA (nova).xlsx`  
**Referência:** Medicina, semestre 2026.1  
**Finalidade observada:** cadastro de preceptores e atividades, cálculo de despesas, controle de saldos, acompanhamento de processos e pagamentos mensais.

## 4. Abas identificadas

Foram identificadas 12 abas:

1. FERIADOS NACIONAIS;
2. ACOMPANHAMENTO DE PGTO;
3. GES-FOR-57 - GERAL;
4. GES-FOR-57_FEV;
5. GES-FOR-57_MAR;
6. GES-FOR-57 - ABR;
7. GES-FOR-57 - MAIO;
8. GES-FOR-57 - JUN;
9. GES-FOR-57 - JUl;
10. CHAMADOS DE SALDOS;
11. CONTROLE DE SALDOS;
12. estrutura auxiliar adicional existente no arquivo.

> Observação: a nomenclatura e a quantidade definitiva das abas deverão ser verificadas novamente durante a preparação da migração, porque há abas mensais e estruturas auxiliares com funções sobrepostas.

---

## 5. Dimensão e características da base

### GES-FOR-57 geral

- 405 registros de vínculos ou atividades;
- 334 nomes distintos após normalização básica do texto;
- 343 registros classificados como NFS;
- 31 registros classificados como RPA;
- 31 vínculos marcados como CLT;
- predominância da profissão Médico, com registros também de Enfermagem e outras profissões.

### Acompanhamento de pagamento

- 331 linhas com nome preenchido;
- aproximadamente 296 nomes distintos;
- acompanhamento mensal entre fevereiro e julho de 2026;
- presença de valores, números de CH ou processo, movimentos, deferimentos, total pago e saldo disponível.

### Valores encontrados no acompanhamento

Os valores abaixo são diagnósticos da planilha e ainda não são números homologados para o futuro sistema:

- total numérico encontrado em “Total já pago”: aproximadamente R$ 4,76 milhões;
- total numérico encontrado em “Saldo disponível”: aproximadamente R$ 1,66 milhão;
- 32 saldos zerados;
- 6 saldos negativos.

Esses totais precisam ser reconciliados com as outras planilhas, duplicidades, registros de períodos anteriores e erros existentes.

---

## 6. Grupos de informações encontrados

### 6.1 Cadastro do preceptor

- nome completo;
- profissão;
- conselho profissional;
- telefone;
- e-mail;
- RG e CPF;
- vínculo CLT com a instituição.

### 6.2 Dados fiscais e forma de pagamento

- modalidade de pagamento;
- CPF para RPA;
- CNPJ para NFS;
- razão social;
- empresa vinculada;
- exceções autorizadas;
- indicação de docente ou colaborador CLT.

### 6.3 Atividade acadêmica

- curso e IES;
- disciplina, internato ou prática;
- período;
- carga horária autorizada;
- local de estágio ou prática;
- setor;
- data de início;
- data de término;
- quantidade de alunos;
- quantidade de grupos.

### 6.4 Escala e execução

- dias da semana;
- turnos;
- horários de início e término;
- quantidade de turnos;
- carga horária diária;
- carga horária executada;
- feriados aplicáveis.

### 6.5 Regras financeiras

- valor por turno da especialidade;
- valor de internato;
- valor por hora;
- valor fixo mensal;
- valor por grupo;
- valor mensal;
- valor semestral;
- saldo solicitado;
- saldo disponível;
- total pago;
- ajustes e exceções escritos em observações.

### 6.6 Processo de pagamento

- competência ou mês;
- número do CH;
- número do processo;
- número do movimento;
- validação de regra;
- deferimento da coordenação;
- solicitação de NF ou RPA;
- etapa do chamado de saldo;
- histórico de pagamento.

---

## 7. Problemas e riscos identificados

### 7.1 Repetição de cadastro

O mesmo preceptor aparece em várias linhas, atividades, locais, períodos e abas. Dados pessoais e fiscais são repetidos, podendo divergir entre linhas.

### 7.2 Identificação por nome

Os nomes apresentam variações de grafia, espaços, acentos, abreviações e observações junto ao nome. O sistema não poderá usar o nome como chave principal.

### 7.3 Pessoas e empresas não são a mesma entidade

Há CNPJs compartilhados por mais de um preceptor e preceptores com alterações de empresa. O sistema deverá separar:

- pessoa/preceptor;
- empresa ou favorecido;
- vínculo financeiro entre preceptor e favorecido;
- vigência desse vínculo.

### 7.4 Regras financeiras misturadas em observações

Existem valores fixos, complementos de coordenação, mudanças de turno, trocas de PJ, pagamentos adicionais e outras exceções descritas em texto livre. Essas regras precisam virar cadastros estruturados.

### 7.5 Dados incompletos

Na aba geral foram encontrados, por verificação básica:

- 172 registros sem CPF/RG claramente preenchido;
- 163 registros sem telefone;
- 60 registros sem CNPJ;
- 35 registros sem e-mail;
- 30 registros sem modalidade de pagamento claramente definida.

Essas contagens são por linha de atividade, não necessariamente por pessoa única.

### 7.6 Erros de fórmula

Foram encontradas ocorrências de:

- `#DIV/0!`;
- `#VALUE!`;
- `#REF!`.

O levantamento preliminar apontou aproximadamente 1.330 ocorrências nas abas analisadas. O sistema deverá substituir fórmulas frágeis por regras de cálculo validadas e testáveis.

### 7.7 Períodos misturados

Há referências a 2025.2 dentro do arquivo de 2026.1. O sistema deverá separar semestre, competência financeira, vigência da atividade e data efetiva do pagamento.

### 7.8 Saldos negativos

Há registros com saldo negativo, indicando pagamento acima do saldo, duplicidade, remanejamento ou outra exceção. O sistema deverá bloquear ou exigir autorização explícita para situações semelhantes.

---

## 8. Decisões já tomadas

### 8.1 Rota do preceptor

A rota do preceptor será simples e mobile-first. O preceptor poderá:

- localizar ou acessar a própria identificação;
- registrar presença do dia atual;
- selecionar Manhã, Tarde e/ou Noite;
- enviar o registro;
- receber confirmação.

A rota do preceptor não exibirá valores, saldos, processos, pagamentos ou funções administrativas.

### 8.2 Registros fora do dia

O preceptor não lançará presença retroativa pela rota comum. Correções ou inclusões referentes a outros dias serão tratadas pelo administrador, mediante solicitação e registro de auditoria.

### 8.3 Área administrativa

A área administrativa será projetada principalmente para computador. A área deverá controlar cadastro, atividades, escalas, valores, presenças, fechamento, processos, saldos, pagamentos, exceções e auditoria.

### 8.4 Eliminação das planilhas

O sistema não terá “exportar relatório para continuar trabalhando no Excel” como fluxo principal. Exportações futuras, se existirem, serão apenas relatórios opcionais ou exigências externas. A operação oficial ocorrerá no sistema e no banco de dados.

---

## 9. Fluxo conceitual preliminar

```text
Cadastro do preceptor
        ↓
Cadastro do favorecido e modalidade de pagamento
        ↓
Cadastro da atividade e da vigência
        ↓
Cadastro da escala e do local
        ↓
Cadastro da regra financeira pela equipe autorizada
        ↓
Registro de presença pelo preceptor
        ↓
Validações automáticas
        ↓
Conferência e ajustes administrativos
        ↓
Fechamento da competência
        ↓
Geração dos valores devidos
        ↓
Validação acadêmica e financeira
        ↓
Processo, movimento e pagamento
        ↓
Baixa e histórico de auditoria
```

---

## 10. Variáveis financeiras já identificadas

O cálculo não poderá ser simplesmente “presença × valor do turno”. A primeira planilha indica suporte futuro para:

- valor por turno;
- valor por especialidade;
- valor diferente para internato;
- valor por hora;
- valor por grupo;
- valor fixo mensal;
- adicional de coordenação;
- quantidade de alunos;
- quantidade de grupos;
- atividade em mais de um local;
- modalidade RPA, NFS ou vínculo CLT;
- vigência da regra;
- saldo autorizado;
- feriados;
- ajustes positivos ou negativos;
- pagamentos complementares;
- substituição de preceptor;
- troca de empresa ou CNPJ;
- bloqueio por vínculo CLT;
- exceções aprovadas.

Essas variáveis são preliminares e serão revisadas após as demais planilhas.

---

## 11. Modelo conceitual preliminar do banco

Ainda não é o esquema definitivo. Entidades candidatas:

- usuários;
- perfis e permissões;
- preceptores;
- dados profissionais;
- documentos e contatos;
- favorecidos/empresas;
- vínculos financeiros do preceptor;
- cursos;
- disciplinas e atividades;
- locais e setores;
- períodos e semestres;
- escalas;
- regras financeiras;
- vigências de valores;
- presenças;
- ajustes de presença;
- competências financeiras;
- cálculos mensais;
- saldos autorizados;
- processos e movimentos;
- aprovações;
- pagamentos;
- ajustes financeiros;
- feriados;
- observações estruturadas;
- auditoria.

---

## 12. Telas administrativas candidatas

A definição final será feita somente após a sétima planilha.

1. visão geral;
2. cadastro de preceptores;
3. favorecidos e dados fiscais;
4. atividades e vigências;
5. locais e setores;
6. escalas;
7. tabela de valores e regras;
8. presenças;
9. solicitações e correções;
10. fechamento mensal;
11. memória de cálculo;
12. validação acadêmica;
13. saldos e autorizações;
14. processos e movimentos;
15. pagamentos;
16. divergências;
17. auditoria;
18. configurações.

---

## 13. Pontos que permanecem em aberto

- forma oficial de identificação única do preceptor;
- relação entre CPF, CNPJ e favorecido;
- regras exatas de cálculo por curso, atividade e especialidade;
- significado operacional de cada tipo de saldo;
- origem e momento de criação do CH;
- regras de deferimento;
- tratamento de docentes e vínculos CLT;
- forma de registrar substituições;
- tratamento de feriados;
- política de fechamento e reabertura;
- regra de pagamento acima do saldo;
- documentos obrigatórios para RPA e NFS;
- integrações externas necessárias.

---

## 14. Registro das próximas análises

# PLANILHA 2 DE 7

## 16. Identificação

**Arquivo:** `PRECEPTORES ADM.xlsx`  
**Aba:** `Planilha1`  
**Finalidade observada:** relação administrativa simples de preceptores por disciplina e período do curso.

## 17. Estrutura encontrada

A planilha possui somente três colunas:

- Nome;
- Disciplina;
- Período.

Foram encontrados:

- 157 vínculos entre preceptor, disciplina e período;
- 147 nomes distintos após normalização básica;
- 28 disciplinas distintas;
- nenhum campo vazio nas três colunas utilizadas;
- períodos do 1º ao 8º, sem registros do 2º período nesta planilha.

### Distribuição por período

- 1º período: 4 vínculos;
- 3º período: 6 vínculos;
- 4º período: 3 vínculos;
- 5º período: 42 vínculos;
- 6º período: 39 vínculos;
- 7º período: 39 vínculos;
- 8º período: 24 vínculos.

### Disciplinas com maior número de vínculos

- Cirurgia: 13;
- Ginecologia: 11;
- Obstetrícia: 9;
- Pneumologia: 8;
- Saúde da Criança: 8;
- Saúde do Idoso: 8;
- Endocrinologia: 7;
- Otorrino: 7.

## 18. Interpretação para o futuro sistema

Apesar de ser chamada de cadastro de preceptores, esta planilha não contém um cadastro completo de pessoas. Cada linha representa, na prática, uma associação entre:

```text
Preceptor + Disciplina + Período
```

Portanto, o sistema deverá separar:

1. cadastro único do preceptor;
2. cadastro padronizado da disciplina;
3. cadastro do período do curso;
4. vínculo do preceptor com a disciplina e o período;
5. vigência semestral desse vínculo;
6. situação ativa ou inativa.

Essa associação será importante para definir quais preceptores aparecem na rota de presença e para relacionar cada presença à atividade correta.

## 19. Duplicidades e vínculos múltiplos

Foram encontrados nove nomes normalizados repetidos, somando dez linhas adicionais. As repetições não devem ser removidas automaticamente, porque algumas indicam atuação em mais de uma disciplina ou período.

Exemplos de vínculos múltiplos:

- Bruno Rafael;
- Felipe Torres;
- Fernanda Abdulmassih;
- Isabel Carvalho;
- Joanna Bertolino;
- Lorena Cavalcanti;
- Mariana Tavares;
- Michelly Patricia;
- Remilson Nunes.

Também há repetições aparentes na mesma disciplina, como Lorena Cavalcanti em Pneumologia e Remilson Nunes em Ginecologia. Esses casos precisam ser verificados para saber se representam duplicidade acidental, locais diferentes, turmas diferentes ou mais de um vínculo.

## 20. Comparação com a GES-FOR-57

A comparação automática baseada em nomes indicou:

- 125 nomes com correspondência provável na GES-FOR-57;
- 4 nomes abreviados com mais de uma correspondência possível;
- 18 nomes sem correspondência automática segura.

As diferenças decorrem principalmente de:

- nomes abreviados;
- títulos incorporados ao nome, como `ENF.`;
- erros de digitação;
- ausência de sobrenomes;
- variações de grafia;
- nomes que podem representar preceptores novos.

Exemplos que exigem validação manual:

- José Airton, que pode corresponder a mais de uma pessoa;
- José Eduardo, que pode corresponder a mais de uma pessoa;
- Maria Eduarda, com várias possibilidades;
- Silvana, sem sobrenome;
- nomes como `Betriz Brandão`, `Gabriella Felix`, `Alexandre Bisolli` e `Fernando Noberto`, que parecem conter variações de grafia.

## 21. Decisão de modelagem derivada desta planilha

O nome não será usado como identificador do preceptor. O banco deverá usar um identificador interno e, após saneamento dos dados, CPF ou outro documento institucional como chave de conferência.

O relacionamento preliminar passa a incluir:

```text
preceptores
    ↓
preceptor_atividades
    ├── disciplina_id
    ├── periodo_id
    ├── semestre_id
    ├── data_inicio
    ├── data_fim
    └── status
```

A disciplina e o período não devem ser gravados como texto livre em cada presença. A presença deverá apontar para um vínculo ativo previamente cadastrado.

## 22. Impacto na rota de presença

A lista de nomes da rota dos preceptores deverá ser alimentada pelos vínculos ativos do semestre. Entretanto, a planilha mostra que apenas selecionar o nome pode ser insuficiente quando a mesma pessoa atua em mais de uma disciplina.

O comportamento definitivo deverá ser decidido após as demais planilhas. Possibilidades:

- o sistema identifica automaticamente a atividade pela escala do dia;
- após selecionar o nome, o sistema mostra somente as atividades previstas para aquele dia;
- se houver apenas uma atividade possível, a seleção ocorre automaticamente;
- se houver mais de uma, o preceptor escolhe a atividade antes de marcar o turno.

A interface deve continuar simples e não exibir opções desnecessárias.

## 23. Novos controles administrativos sugeridos

A segunda planilha reforça a necessidade futura de:

- cadastro único de preceptores;
- cadastro padronizado de disciplinas;
- cadastro de períodos;
- gestão dos vínculos por semestre;
- ativação e inativação de vínculos;
- prevenção de duplicidades;
- tela de conciliação de nomes durante a migração;
- histórico das disciplinas em que cada preceptor atuou.

## 24. Situação da análise

A segunda planilha é simples e não introduz novos cálculos financeiros. A principal contribuição é confirmar que o sistema precisa modelar o preceptor separadamente dos vínculos acadêmicos.

**Planilhas analisadas:** 2 de 7.  
**Próxima etapa:** receber e analisar a planilha 3 de 7.

# PLANILHA 3 DE 7

## 25. Identificação

**Arquivo:** `PLANILHA DE PRECEPTORES DO INTERNATO.xlsx`  
**Aba:** `Planilha1`  
**Área:** Coordenação de Estágios em Saúde, Medicina, Internato.  
**Finalidade observada:** relação dos preceptores do internato, indicando o número do internato e o local de atuação.

## 26. Estrutura encontrada

A planilha possui três campos operacionais:

- nome do preceptor;
- internato;
- local de atuação.

Foram encontrados:

- 160 vínculos de internato;
- 157 preceptores distintos após normalização do nome;
- internatos do 2 ao 8;
- 24 descrições brutas diferentes de local;
- nenhum campo vazio nas três colunas utilizadas;
- 6 linhas contendo mais de um local na mesma célula.

### Distribuição dos vínculos por internato

- Internato 2: 25;
- Internato 3: 36;
- Internato 4: 12;
- Internato 5: 31;
- Internato 6: 23;
- Internato 7: 21;
- Internato 8: 12.

### Locais com maior presença na planilha

- Hospital dos Servidores do Estado de Pernambuco: 50 vínculos;
- Hospital Guararapes: 41 vínculos;
- Hospital Evangélico: 12 vínculos;
- Hospital dos Servidores do Estado de Pernambuco - CEMPRE: 7 vínculos;
- Hospital Memorial Guararapes: 7 vínculos;
- Hospital Santa Casa de Misericórdia do Recife: 5 vínculos;
- Clínica Escola de Psicologia Graças: 5 vínculos;
- Hospital Memorial Jaboatão: 5 vínculos.

## 27. Comparação com a GES-FOR-57

Após normalização dos nomes, os 157 preceptores distintos tiveram correspondência exata com nomes existentes na aba geral da GES-FOR-57.

Isso indica que esta planilha funciona como um recorte operacional da base principal, concentrado nos preceptores do internato e nos respectivos locais de atuação.

A correspondência por nome serve apenas para diagnóstico. Na migração definitiva, a conciliação deverá utilizar identificadores internos e documentos, evitando dependência do nome.

## 28. Vínculos múltiplos

Foram identificados três preceptores com dois vínculos diferentes na planilha:

- Barbara Faeirstein, Internatos 2 e 5;
- Fernanda Beatriz Abdulmassi, Internatos 2 e 5;
- Luanna Silveira dos Santos, Internatos 2 e 5.

Essas repetições representam vínculos acadêmicos diferentes e não devem ser tratadas automaticamente como duplicidade de cadastro.

Também existem preceptores associados a vários locais na mesma célula. No banco, cada local deverá ser uma entidade separada e o vínculo deverá permitir múltiplos locais, sem armazenar uma lista concatenada em texto livre.

## 29. Padronização necessária dos locais

A planilha apresenta diferentes maneiras de escrever locais que podem representar a mesma instituição ou unidades relacionadas, por exemplo:

- Hospital Santa Casa de Misericórdia do Recife;
- Hospital da Santa Casa;
- Hospital Evangélico e Hospital Evangelico;
- Hospital Memorial Jaboatão e Hospital Memorial Jaboatão com variação de grafia;
- CEMPRE isolado e Hospital dos Servidores do Estado de Pernambuco - CEMPRE;
- Hospital Guararapes e Hospital Guararapes - Humanize.

O sistema deverá possuir cadastro próprio de locais e, quando necessário, cadastro de unidades ou setores internos.

Exemplo conceitual:

```text
local
├── Hospital dos Servidores do Estado de Pernambuco
│   └── unidade/setor: CEMPRE
├── Hospital Guararapes
│   └── unidade/setor: Humanize
└── Santa Casa de Misericórdia do Recife
```

A normalização final dependerá da validação administrativa, pois nomes semelhantes podem representar locais, setores ou contratos distintos.

## 30. Impacto direto na presença

Esta planilha confirma que o registro de presença precisa estar ligado, no mínimo, a:

```text
Preceptor + Internato + Local + Data + Turno
```

O preceptor continuará com uma tela simples. O sistema deverá usar previamente os vínculos e escalas para reduzir escolhas:

1. identificar o preceptor;
2. localizar os vínculos ativos para o dia;
3. identificar o internato e o local previstos;
4. selecionar automaticamente quando houver apenas uma possibilidade;
5. solicitar escolha somente quando houver mais de um vínculo válido no mesmo dia;
6. registrar a presença vinculada à atividade correta.

Essa associação é necessária porque o valor poderá variar conforme internato, local, escala, regra financeira e vigência.

## 31. Impacto no modelo conceitual

A terceira planilha reforça as seguintes entidades e relacionamentos:

```text
preceptores
internatos
locais
unidades_setores
semestres
preceptor_internatos
preceptor_internato_locais
escalas
presencas
```

O vínculo de internato deverá conter vigência e situação. A relação com locais deverá aceitar mais de um local para o mesmo vínculo.

Estrutura preliminar:

```text
preceptor_internatos
├── id
├── preceptor_id
├── internato_id
├── semestre_id
├── data_inicio
├── data_fim
└── status

preceptor_internato_locais
├── id
├── preceptor_internato_id
├── local_id
├── setor_id
└── status
```

## 32. Novos controles administrativos sugeridos

A planilha confirma a necessidade futura de:

- cadastro padronizado de internatos;
- cadastro padronizado de hospitais e demais locais;
- cadastro de unidades e setores;
- associação de um preceptor a mais de um internato;
- associação de um vínculo a mais de um local;
- vigência semestral;
- situação ativa ou inativa;
- escala por dia e turno;
- filtros por internato e local;
- histórico de movimentações entre locais;
- validação de conflitos de escala.

## 33. Situação da análise

A terceira planilha não contém valores financeiros, mas é essencial para determinar o contexto correto da presença. Ela define quem atua no internato, em qual internato e em qual local.

**Planilhas analisadas:** 3 de 7.  
**Próxima etapa:** receber e analisar a planilha 4 de 7.

# PLANILHA 4 DE 4

## 34. Identificação

**Arquivo:** `CALCULADORA GINECO E OBST_INTERNATO.xlsx`  
**Aba:** `CALC INT 2 E 5`  
**Finalidade observada:** calcular pagamentos do Internato 2 e 5 para Ginecologia e Obstetrícia, incluindo valores por setor, valores mensais, distribuição por local e adicionais de coordenação.

## 35. Função que será substituída no sistema

Esta planilha representa o módulo de **regras de cálculo financeiro do internato**. O sistema deverá substituir as fórmulas por regras cadastráveis, com vigência, contexto e memória de cálculo.

A calculadora mostra que o pagamento pode combinar diferentes componentes:

- quantidade de turnos multiplicada por valor unitário;
- valor mensal fixo por setor;
- valor dividido entre preceptores;
- componente por hospital ou unidade;
- soma de Ginecologia e Obstetrícia;
- adicional de coordenação;
- total individual do preceptor.

## 36. Regras encontradas na calculadora

### Ginecologia

Foram identificados valores associados a setores ou tipos de atividade:

- Evolução: R$ 357,30 por turno;
- Ambulatório: R$ 357,30 por turno;
- Cirurgia: R$ 476,40 por turno;
- Seminário/Clube: R$ 357,30 por turno;
- Ambulatório SUS: R$ 2.382,04 no modelo atual.

A planilha calcula o total como quantidade de turnos multiplicada pelo valor do setor. No exemplo preenchido, 19 turnos de Evolução geram R$ 6.788,70 e 38 turnos de Cirurgia geram R$ 18.103,20, totalizando R$ 24.891,90.

### Obstetrícia

Foram identificados valores mensais ou componentes fixos:

- Sala de parto: R$ 1.000,00;
- Sala de parto dividido: R$ 500,00;
- Ambulatório SUS: R$ 2.382,04;
- Alojamento conjunto/Evolução: R$ 4.000,00;
- Seminário: R$ 1.429,20.

### Distribuição individual

A planilha mantém valores por preceptor em colunas diferentes:

- Obstetrícia;
- Ginecologia HMG;
- Ginecologia HSE;
- total individual.

Isso revela que o mesmo preceptor pode receber componentes de atividades e locais diferentes na mesma competência.

### Coordenação

Também existe uma composição específica para coordenadores:

```text
Valor do setor + adicional de coordenação = total
```

Exemplos da planilha:

- Alexandre Marlon: R$ 9.885,34 do setor + R$ 6.400,00 de coordenação;
- Helaine: R$ 8.382,04 do setor + R$ 3.200,00 de coordenação.

## 37. Decisão de modelagem derivada da calculadora

O sistema não deverá possuir apenas uma tabela simples de “valor por turno”. Será necessário um mecanismo de regras financeiras capaz de representar:

```text
Regra financeira
├── tipo de atuação: ADM ou Internato
├── curso
├── disciplina ou internato
├── setor/atividade
├── local ou unidade
├── forma de cálculo
│   ├── por turno
│   ├── valor mensal fixo
│   ├── valor dividido
│   ├── por grupo
│   ├── por hora
│   └── adicional
├── valor
├── vigência inicial
├── vigência final
├── prioridade
└── situação
```

O cálculo mensal deverá gerar itens separados, e não somente um total final. Exemplo:

```text
Preceptor X, competência 2026-03
├── 8 turnos de Cirurgia × R$ 476,40
├── 4 turnos de Evolução × R$ 357,30
├── valor fixo de Ambulatório SUS
├── adicional de coordenação
└── total calculado
```

## 38. Ligação com a presença

Nem todos os componentes financeiros dependem diretamente da presença:

- valores por turno dependem da presença validada;
- valores fixos mensais dependem do vínculo ativo e das regras de elegibilidade;
- adicionais de coordenação dependem da função e vigência;
- valores divididos dependem da regra de rateio;
- ajustes dependem de autorização administrativa.

Por isso, o motor de cálculo deverá trabalhar com **eventos financeiros** separados:

1. presença confirmada;
2. parcela fixa mensal;
3. adicional de função;
4. rateio;
5. ajuste manual autorizado;
6. estorno ou correção.

## 39. Riscos que o sistema deverá eliminar

A planilha possui fórmulas que somam células com números e textos como “NÃO TEM”. Embora alguns resultados estejam armazenados, esse modelo é frágil e não deve ser reproduzido.

O sistema deverá:

- usar zero ou ausência de componente de forma estruturada;
- impedir mistura de texto e número no mesmo campo financeiro;
- guardar a origem de cada parcela;
- registrar quem cadastrou ou alterou a regra;
- impedir alteração retroativa sem auditoria;
- congelar a regra aplicada no momento do fechamento;
- permitir recalcular somente quando a competência estiver aberta;
- mostrar memória de cálculo completa.

## 40. Situação da análise

A calculadora confirma que as regras de pagamento são compostas e variam por setor, local, tipo de atividade, quantidade de turnos, valores fixos e adicionais.

**Modelos distintos analisados:** 4 de 4.  
Os demais arquivos mencionados são versões dos mesmos modelos em datas ou competências diferentes e serão tratados como histórico para migração, não como novos módulos do sistema.

---

## 15. Regra de atualização deste documento

Ao receber uma nova planilha:

1. manter todo o histórico anterior;
2. atualizar a contagem de planilhas analisadas;
3. criar uma seção específica para o novo arquivo;
4. registrar sobreposições e diferenças;
5. atualizar variáveis financeiras;
6. atualizar entidades candidatas do banco;
7. atualizar telas candidatas;
8. registrar conflitos e dúvidas;
9. não fechar a arquitetura antes da análise completa;
10. ao final, produzir a documentação definitiva do sistema e o plano de migração.


---

# ANÁLISE CONSOLIDADA PARA O DESENHO DO SISTEMA

## 41. Modelos operacionais identificados

Após a análise conjunta, os arquivos representam quatro funções diferentes que serão absorvidas pelo sistema:

1. **GES-FOR-57:** cadastro detalhado, atividades, valores, saldos, processos e acompanhamento de pagamento;
2. **Preceptores Prática:** vínculo do preceptor com disciplina e período;
3. **Preceptores do Internato:** vínculo do preceptor com internato e local de atuação;
4. **Calculadora do Internato:** regras e composição do cálculo financeiro.

As versões com outras datas são históricos dessas mesmas funções. Elas poderão ser utilizadas posteriormente para carga histórica, validação e testes de cálculo.

## 42. Estrutura funcional recomendada

```text
Sistema de Gestão de Preceptoria
├── Rota do preceptor, mobile
│   └── Registro simples de presença
│
└── Painel administrativo, desktop
    ├── Cadastros gerais
    │   ├── Pessoas/preceptores
    │   ├── Empresas/favorecidos
    │   ├── Cursos
    │   ├── Disciplinas
    │   ├── Internatos
    │   ├── Períodos
    │   ├── Locais
    │   └── Setores/unidades
    │
    ├── Preceptores Prática
    │   ├── vínculo com disciplina
    │   ├── período
    │   ├── local
    │   ├── escala
    │   └── vigência
    │
    ├── Preceptores do Internato
    │   ├── vínculo com internato
    │   ├── hospital/local
    │   ├── setor
    │   ├── escala
    │   └── vigência
    │
    ├── Financeiro
    │   ├── regras de valores
    │   ├── adicionais
    │   ├── rateios
    │   ├── valores fixos
    │   ├── cálculo mensal
    │   ├── conferência
    │   ├── saldos
    │   ├── processos
    │   └── pagamentos
    │
    └── Governança
        ├── aprovações
        ├── ajustes
        ├── fechamento
        └── auditoria
```

## 43. Cadastro único com dois tipos de atuação

Não haverá dois cadastros pessoais independentes. Haverá um cadastro único de preceptor e dois tipos de vínculo:

```text
Preceptor
├── Vínculos ADM
└── Vínculos de Internato
```

Uma mesma pessoa poderá ter um ou mais vínculos ADM, um ou mais vínculos de Internato, ou ambos.

## 44. Fluxo da presença

A rota do preceptor permanecerá simples:

1. identificação do preceptor;
2. sistema consulta os vínculos e escalas ativos no dia;
3. se houver uma única possibilidade, atividade e local são selecionados automaticamente;
4. se houver mais de uma possibilidade, o sistema mostra somente as opções válidas;
5. preceptor seleciona Manhã, Tarde e/ou Noite;
6. presença é registrada com data, vínculo, local, turno e horário do envio;
7. qualquer correção de outro dia é tratada pelo administrador.

A presença deverá registrar o vínculo acadêmico correto, mas não exibirá valores ao preceptor.

## 45. Fluxo financeiro

```text
Presença ou evento financeiro
        ↓
Busca da regra vigente
        ↓
Geração das parcelas de cálculo
        ↓
Memória de cálculo
        ↓
Conferência administrativa
        ↓
Validação acadêmica/financeira
        ↓
Fechamento da competência
        ↓
Processo e movimento
        ↓
Pagamento e baixa
```

O valor calculado não ficará gravado apenas como um total. Cada componente deverá permanecer identificável.

## 46. Formas de cálculo necessárias

O motor financeiro deverá suportar, pelo menos:

- por turno confirmado;
- por hora;
- por grupo;
- mensal fixo;
- por setor;
- por local;
- por disciplina;
- por internato;
- rateio ou valor dividido;
- adicional de coordenação;
- complemento;
- ajuste positivo;
- desconto ou estorno;
- exceção autorizada.

Cada regra deverá possuir vigência. Alterar um valor hoje não poderá modificar automaticamente competências já fechadas.

## 47. Banco de dados conceitual consolidado

Entidades recomendadas:

```text
usuarios
perfis
permissoes
preceptores
preceptor_documentos
preceptor_contatos
favorecidos
preceptor_favorecidos
cursos
disciplinas
internatos
periodos
semestres
locais
setores
vinculos_pratica
vinculos_internato
vinculo_locais
escalas
presencas
ajustes_presenca
regras_financeiras
regra_condicoes
adicionais_financeiros
competencias
calculos
calculo_itens
saldos_autorizados
processos_pagamento
movimentos_pagamento
pagamentos
aprovacoes
auditoria
```

## 48. Princípios obrigatórios do sistema

- a planilha não será a base operacional;
- cadastros e valores serão mantidos no sistema;
- nomes não serão usados como identificador único;
- preceptor e empresa/favorecido serão entidades separadas;
- ADM e Internato serão vínculos distintos do mesmo cadastro pessoal;
- valores terão vigência;
- presença deverá apontar para vínculo, local e turno;
- cálculo produzirá memória detalhada;
- fechamento congelará os valores aplicados;
- alterações posteriores exigirão ajuste auditável;
- o preceptor não visualizará dados financeiros;
- o painel administrativo será desktop-first;
- toda operação crítica terá usuário, data e histórico.

## 49. Próximos passos recomendados

1. validar esta interpretação funcional com Edgar;
2. transformar a documentação em requisitos funcionais;
3. definir perfis e permissões;
4. desenhar os fluxos de cadastro ADM e Internato;
5. detalhar o cadastro de regras financeiras;
6. desenhar a memória de cálculo;
7. fechar o modelo relacional do Supabase;
8. definir estratégia de migração dos históricos;
9. somente depois criar as páginas administrativas definitivas;
10. gerar o projeto completo para VS Code com documentação incorporada.

## 50. Status do levantamento

O levantamento dos modelos distintos foi concluído. Arquivos futuros com as mesmas estruturas e outras datas serão considerados bases históricas para migração e validação, salvo quando apresentarem novas regras ou novos campos.
