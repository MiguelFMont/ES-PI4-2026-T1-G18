# Documento de Visão — Projeto FinanceAI

**Orçamento Guiado com Educação Financeira Aplicada**

PUC-Campinas — Escola Politécnica — Engenharia de Software
Orientação: Prof.(a) Dra. Renata Arantes
Campinas — 2026

**Autores:** Cezar Fernandez Rull, Gabriel Henrique Pozeti de Faria, Guilherme De Lima E Sousa, Julia Da Silva Maia e Miguel Fernandes Monteiro.

| Versão | Data | O que mudou |
|---|---|---|
| 1.0 | 26/09/2026 | Versão inicial (anexada à issue #1) |
| 1.1 | 09/11/2026 | Revisão para refletir a arquitetura e o plano de sprints atuais (ver a seção 1.3) |

---

## 1. O que é este documento

Este documento apresenta o escopo, o contexto e os requisitos da proposta do projeto FinanceAI, uma plataforma de gestão financeira pessoal orientada por Inteligência Artificial generativa, desenvolvida a partir do processo de ideação e validação conduzido pela equipe no componente curricular Ideação e Validação em Engenharia de Software, com continuidade prevista para as disciplinas subsequentes do curso de Engenharia de Software.

### 1.1. Quem deve ler este documento de visão

Este documento destina-se aos integrantes da equipe responsáveis pelo desenvolvimento do FinanceAI, ao(à) professor(a) orientador(a) e à banca avaliadora do componente curricular, servindo como referência única sobre o escopo, os requisitos e as limitações do projeto.

### 1.2. Como sugerir correções

Erros, ambiguidades ou pontos que precisem de ajuste devem ser levados à equipe e, quando necessário, ao(à) professor(a) orientador(a), para validação e atualização deste documento. Cada alteração entra na tabela de versões acima.

### 1.3. O que mudou na versão 1.1

- **Arquitetura (seção 6):** as responsabilidades do Backend e do Servidor foram separadas (cálculos e categorização ficam no Servidor Java) e o Frontend passa a ser descrito como módulos ES nativos, sem bundler.
- **Categorias (seção 5.3):** a lista de categorias passa a ser a lista oficial adotada no contrato da API.
- **Edição e exclusão (RF10):** o antigo **RF11 foi removido**, porque restringia a edição e a exclusão às transações manuais. Transações importadas também podem ser editadas e excluídas, e isso passa a constar no RF10. O número RF11 não é reutilizado, para que as referências a outros requisitos continuem válidas.
- **Requisitos incluídos** por já constarem no plano de sprints: RF31 a RF36 (plano da conta, suporte, duplicar lançamento, contas conectadas, categorias agrupadas e parcelamentos).
- **Novas seções:** requisitos não funcionais (8), features futuras (9), rastreabilidade (10) e glossário (11).

---

## 2. Contextualização do problema

A gestão financeira pessoal e familiar é um desafio recorrente mesmo entre pessoas organizadas em outros aspectos da vida. Grande parte das soluções disponíveis no mercado exige registro manual extensivo de receitas e despesas e apresenta as informações por meio de gráficos e relatórios de difícil interpretação para usuários sem familiaridade com finanças, o que leva ao abandono do uso após pouco tempo.

Esse cenário é evidenciado pela persona definida na etapa de ideação do projeto: um usuário adulto, com rotina ocupada e responsabilidades familiares, que tenta acompanhar os gastos da casa, mas se frustra com a quantidade de lançamentos manuais necessários e com a complexidade das informações apresentadas. Como consequência, ele perde a noção de para onde o dinheiro está indo, o que gera insegurança quanto ao planejamento de curto e longo prazo (reserva de emergência, estudos dos filhos, aposentadoria).

A causa raiz identificada não é a falta de interesse do usuário em se organizar financeiramente, mas a ausência de uma ferramenta que automatize a captura e a categorização dos dados e que traduza esses dados em explicações compreensíveis, e não apenas em números e gráficos.

Diante disso, o FinanceAI propõe-se a atuar como um ambiente de gestão financeira que reduz o esforço manual do usuário e utiliza Inteligência Artificial generativa para transformar o histórico financeiro em orientações práticas, aproximando a experiência de uma mentoria financeira contínua.

---

## 3. Inteligência Artificial generativa aplicada a finanças pessoais

Modelos de linguagem de grande escala (LLMs) possibilitam, a partir de dados estruturados, a geração de texto em linguagem natural que explica, contextualiza e resume informações que, de outra forma, exigiriam interpretação manual do usuário. Aplicada a um histórico financeiro previamente categorizado, essa tecnologia permite identificar padrões de consumo, variações relevantes entre períodos e oportunidades de economia, comunicando esses achados de forma acessível.

É importante diferenciar dois papéis que a IA pode assumir em um produto financeiro:

- **Explicação e educação:** a IA descreve o comportamento financeiro do usuário ("seus gastos com alimentação subiram 18% em relação ao mês passado") e oferece orientações educacionais gerais, sem indicar produtos financeiros específicos.
- **Recomendação de investimento:** a IA sugere, de forma personalizada e vinculante, a compra ou venda de ativos financeiros determinados.

O escopo deste projeto contempla exclusivamente o primeiro papel. A IA do FinanceAI atua como um "Mentor Financeiro" que explica dados e promove educação financeira aplicada à realidade do usuário, sem emitir recomendações de compra ou venda de ativos, o que evitaria caracterizar a plataforma como uma consultoria de investimentos regulada.

### 3.1. Papel da IA no projeto

No contexto acadêmico deste projeto, a IA generativa é tratada como um componente de apoio à interpretação de dados já processados pelo sistema (categorização, agregações e cálculos), e não como uma fonte de decisão autônoma sobre o patrimônio do usuário. Toda transação financeira permanece sob controle do usuário; a IA participa apenas da camada de explicação, conversação e alerta.

---

## 4. O Projeto FinanceAI

O FinanceAI é uma plataforma de gestão financeira pessoal que centraliza contas bancárias, cartões de crédito e investimentos em um único painel, permitindo ao usuário:

- Visualizar, em um dashboard consolidado, o saldo em contas, os gastos do mês, a economia acumulada e o fluxo de caixa;
- Registrar manualmente receitas e despesas e importar transações de contas conectadas;
- Consultar, filtrar, editar e excluir seu histórico de transações;
- Analisar seus gastos por categoria, com comparação entre períodos;
- Definir e acompanhar metas financeiras;
- Conversar com um assistente de IA (Mentor Financeiro) sobre sua própria situação financeira;
- Acompanhar, em módulo complementar, seu portfólio de investimentos e a fatura do cartão de crédito.

A interface terá características de um painel financeiro pessoal (estilo dashboard), combinado com um assistente conversacional lateral, proporcionando um ambiente informativo, didático e de fácil leitura mesmo para usuários iniciantes.

O componente central do sistema é o motor de categorização e explicação: toda transação registrada (manual ou importada do sandbox de Open Finance) é classificada em categorias pré-definidas, automaticamente quando o usuário não escolhe uma, e serve de insumo para os cálculos do dashboard, para os gráficos de análise de gastos e para as explicações geradas pela IA.

Ressalta-se que, no contexto acadêmico deste projeto, a conexão com contas bancárias é feita por meio do ambiente de sandbox de um provedor de Open Finance (Pluggy), que expõe instituições fictícias com dados de teste, sem integração com instituições financeiras reais.

### 4.1. Escopo da entrega e features futuras

Por orientação do(a) professor(a), **não é necessário implementar 100% do projeto**. O núcleo da entrega é o conjunto de requisitos com situação "Entregue", "Em andamento" ou "Planejado" na seção 10. Os requisitos marcados como **feature futura** (seção 9) fazem parte da visão do produto e ficam documentados para as próximas disciplinas, sem compromisso de implementação nesta etapa. Requisitos planejados que não forem concluídos nas Sprints 3 e 4 passam à mesma categoria.

---

## 5. Requisitos do FinanceAI

### 5.1. Autenticação e cadastro

Para utilizar o FinanceAI, o usuário deverá criar uma conta individual por meio de endereço de e-mail válido. No cadastro, deverão ser informados obrigatoriamente:

- Nome completo
- E-mail
- CPF (validado pelos dígitos verificadores)
- Senha (mínimo de 8 caracteres, com letra maiúscula, minúscula, número e caractere especial)

O sistema deverá oferecer mecanismo de recuperação de senha ("Esqueci minha senha"), com envio de instruções para o e-mail cadastrado. Não haverá acesso anônimo à plataforma. O usuário poderá ainda consultar o plano da conta (Free ou Pro) e reportar um problema por um canal de suporte.

### 5.2. Contas, receitas e despesas

O usuário poderá cadastrar suas fontes de receita (salário, bolsas, outras rendas) e suas despesas, de forma manual ou por meio de importação via sandbox de Open Finance (Pluggy), que fornece dados de instituições fictícias sem necessidade de credenciais reais. Cada transação conterá descrição, valor, categoria, data e forma de pagamento, podendo incluir observações. As contas conectadas à Pluggy poderão ser listadas, conectadas e desconectadas. A marcação de recorrência (despesa fixa mensal) é uma feature futura (seção 9).

### 5.3. Categorização e listagem de transações

Toda transação (receita ou despesa) é classificada em uma categoria da lista oficial adotada no projeto: **Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Salário e Outros**. Quando o usuário não escolhe uma categoria, o sistema a sugere automaticamente a partir da descrição; sem nenhuma pista, a categoria é "Outros". O usuário poderá consultar o histórico completo de transações, com filtros por descrição, categoria, período, faixa de valor, forma de pagamento e origem (manual ou importada), e poderá **editar ou excluir qualquer transação, manual ou importada**, uma a uma, direto no extrato, ou várias de uma vez.

### 5.4. Dashboard financeiro

A tela inicial deverá apresentar uma visão consolidada da situação financeira do usuário, incluindo saldo em contas, gastos do mês (com variação percentual em relação ao mês anterior), economia acumulada frente a uma meta e fluxo de caixa do período, além de uma lista das transações mais recentes.

### 5.5. Análise de gastos

O sistema deverá apresentar a distribuição dos gastos por categoria (por exemplo, em gráfico de proporção), inclusive agregada por grupos de categorias, permitindo ao usuário expandir cada categoria para visualizar as transações que a compõem, comparar gastos entre meses diferentes e consultar um resumo do período (total gasto, categoria de maior peso, número de transações e média de gasto diário).

### 5.6. Mentor Financeiro (IA Generativa)

O sistema deverá disponibilizar um assistente conversacional, baseado em IA generativa, capaz de responder perguntas do usuário sobre sua própria situação financeira (ex.: "quais são meus maiores gastos?", "quanto posso economizar este mês?") e de gerar, proativamente, explicações sobre padrões identificados no histórico financeiro (aumento de gastos em determinada categoria, dinheiro parado sem rendimento, proximidade de vencimento de fatura). As respostas deverão ter caráter educacional e explicativo, sem recomendar a compra ou venda de ativos financeiros específicos.

### 5.7. Metas financeiras

O usuário poderá criar metas financeiras, definindo um nome, um valor desejado e um prazo. O sistema deverá exibir o progresso do usuário em relação a cada meta cadastrada, permitindo o acompanhamento ao longo do tempo.

### 5.8. Investimentos (módulo complementar)

Em caráter complementar, o sistema poderá apresentar um painel de investimentos simulados, consolidando patrimônio total, portfólio de ativos (valor investido, percentual da carteira e rentabilidade recente), fatura e limite disponível de cartão de crédito e os parcelamentos ativos do cartão (parcela, juros e saldo devedor). Este módulo terá caráter exclusivamente informativo e educacional, sem qualquer recomendação de compra ou venda de ativos.

### 5.9. Personalização e segurança de acesso

O sistema deverá oferecer alternância entre modo claro e modo escuro, opção de ocultar valores sensíveis na tela (útil em ambientes compartilhados) e, de forma opcional, autenticação multifator (MFA/2FA). Os dados financeiros do usuário deverão ser tratados com práticas responsáveis de segurança e privacidade, adequadas ao contexto acadêmico do projeto (ver a seção 8).

### 5.10. Não escopo do projeto

Os itens a seguir não fazem parte do escopo deste projeto, por extrapolarem os objetivos pedagógicos e o tempo disponível na disciplina, ou por exigirem conformidade regulatória própria de instituições financeiras:

- Integração real com instituições financeiras via Open Finance (a integração será simulada, com dados fictícios);
- Execução real de ordens de compra e venda de ativos financeiros;
- Emissão de recomendações de investimento personalizadas e vinculantes;
- Processos formais de verificação de identidade (KYC) ou de prevenção à lavagem de dinheiro;
- Implantação em ambiente de produção com uso por usuários reais e dados financeiros reais;
- Certificações e conformidades regulatórias exigidas de instituições financeiras licenciadas (ex.: Banco Central do Brasil, CVM).

---

## 6. Requisitos de ambiente

Os ambientes e tecnologias abaixo são considerados como base tecnológica do projeto, podendo ser ajustados conforme orientação da disciplina em cada etapa do curso. A arquitetura tem três camadas: o **Frontend** conversa só com o **Backend** (API REST em `/v1`, que também entrega os arquivos do Frontend), e o **Backend** é o único cliente do **Servidor** Java, ao qual pede as operações de cálculo e de regra de negócio.

**Backend**
- Linguagem TypeScript sobre Node.js, com Express
- API REST protegida por JWT; valida as requisições e é o **único** componente que acessa o banco de dados
- Faz o CRUD no MongoDB, orquestra as chamadas ao Servidor Java e integra serviços externos: a API de IA generativa e o sandbox da Pluggy
- Não executa os cálculos nem a categorização: pede ao Servidor

**Servidor**
- Linguagem Java, exigida pela disciplina de Programação Concorrente/Cliente-Servidor
- Processo separado do Backend: um sistema cliente-servidor por sockets, seguindo a arquitetura ensinada em aula (thread aceitadora de conexões, thread supervisora por conexão, mensagens trocadas entre as partes), adaptada ao domínio do FinanceAI
- O Backend atua como único cliente do Servidor, trocando mensagens estruturadas em JSON pelo socket
- **Não acessa o banco de dados**: cada operação é pura (recebe os dados no pedido e devolve o resultado)
- Responsável pelas operações de cálculo e regra de negócio de cada funcionalidade: hash e conferência de senha e validação de MFA, categorização automática de transações, cálculo dos indicadores do dashboard e da comparação entre períodos, montagem do contexto enviado à IA e filtro das respostas, cálculo de progresso de metas, rentabilidade simulada e parcelamentos

**Banco de Dados**
- MongoDB (modelo não relacional), para armazenamento de usuários, transações, contas conectadas, mensagens do chat, metas, investimentos e parcelamentos
- As categorias não são uma coleção: são a lista oficial adotada no projeto (seção 5.3)

**Frontend**
- HTML, CSS e JavaScript, sem TypeScript e sem bundler: módulos ES nativos carregados pelo navegador
- Aplicação de página única (SPA) com roteamento por `#`, em que cada tela é um fragmento HTML com os seus estilos e módulos
- Aplicação web responsiva, com possibilidade de evolução futura para aplicativo mobile

**Inteligência Artificial**
- Integração com API de IA generativa para geração de explicações contextualizadas e para o chat do Mentor Financeiro

**Open Finance (simulado)**
- Sandbox da Pluggy, chamado pelo Backend; as credenciais ficam só no Backend

**Controle de Versão**
- Git, com repositório remoto hospedado no GitHub e fluxo com a branch `develop` como padrão

---

## 7. Requisitos Funcionais

A coluna **Grupo** indica o grupo de features responsável (1 a 5, ou "todos"), **Issues** liga o requisito ao GitHub e **Situação** é calculada pelo estado das issues em 09/11/2026: *Entregue* (todas fechadas), *Em andamento* (algumas fechadas), *Planejado* (nenhuma fechada) ou *Feature futura* (sem issue, ver a seção 9). A numeração dos RF não muda entre versões: o RF11 foi removido na versão 1.1 e os RF31 a RF36 são novos.

### 7.1. Autenticação e conta

| RF | Requisito | Grupo | Issues | Situação |
|---|---|---|---|---|
| **RF01** | O sistema deve permitir que o usuário crie uma conta informando nome completo, e-mail, CPF e senha. | 1 | #13, #15, #17, #32, #80 | Em andamento |
| **RF02** | O sistema deve permitir login por e-mail e senha, restringindo o acesso a usuários autenticados. | 1 | #14, #16, #56 | Planejado |
| **RF03** | O sistema deve permitir a recuperação de senha via e-mail cadastrado. | 1 | #31 | Planejado |
| **RF04** | O sistema deve permitir, de forma opcional, a habilitação de autenticação multifator (MFA/2FA). | 1 | #33, #42 | Planejado |
| **RF05** | O sistema deve permitir a edição de dados de perfil e de preferências (modo claro/escuro e ocultar valores sensíveis). | 1 | #43, #86 | Planejado |
| **RF31** | O sistema deve permitir ao usuário consultar o plano da conta (Free ou Pro) e acessar uma tela de upgrade. | 1 | #44, #86 | Planejado |
| **RF32** | O sistema deve oferecer um canal de suporte para o usuário reportar um problema. | 1 | #45, #72, #73, #85 | Em andamento |

### 7.2. Contas, receitas e despesas

| RF | Requisito | Grupo | Issues | Situação |
|---|---|---|---|---|
| **RF06** | O sistema deve permitir o cadastro manual de receitas (descrição, valor, data e categoria). | 2 | #18, #20, #22 | Entregue |
| **RF07** | O sistema deve permitir o cadastro manual de despesas (descrição, valor, data, categoria, forma de pagamento e observações). | 2 | #18, #20, #22 | Entregue |
| **RF08** | O sistema deve permitir marcar uma despesa como recorrente (fixa mensal). | 2 | — | Feature futura |
| **RF09** | O sistema deve permitir a importação de transações a partir do sandbox de Open Finance da Pluggy (instituições fictícias). | 2 | #12, #46 | Planejado |
| **RF10** | O sistema deve categorizar automaticamente as transações importadas e as lançadas sem categoria, permitindo ao usuário corrigir a categoria e editar ou excluir qualquer transação, seja ela manual ou importada, individualmente ou em lote. | 2 | #34, #35, #91, #92 | Entregue |
| **RF12** | O sistema deve permitir a listagem e a filtragem de transações por descrição, categoria, período, faixa de valor, forma de pagamento e origem. | 2 | #19, #21, #48, #93, #94 | Em andamento |
| **RF33** | O sistema deve permitir duplicar um lançamento existente. | 2 | #49 | Backend pronto; falta a ação no Frontend |
| **RF34** | O sistema deve permitir ao usuário listar, conectar e desconectar contas bancárias do sandbox da Pluggy. | 2 | #47, #74, #87 | Planejado |

### 7.3. Painel financeiro e análise

| RF | Requisito | Grupo | Issues | Situação |
|---|---|---|---|---|
| **RF13** | O sistema deve exibir, na tela inicial, um dashboard com saldo em contas, gastos do mês, economia acumulada e fluxo de caixa. | 3 | #24, #25, #36, #37, #82 | Em andamento |
| **RF14** | O sistema deve exibir a lista das transações mais recentes na tela inicial. | 3 | #24, #58 | Planejado |
| **RF15** | O sistema deve exibir a distribuição dos gastos por categoria em um período selecionado. | 3 | #50 | Planejado |
| **RF16** | O sistema deve permitir a expansão de uma categoria para visualizar as transações que a compõem. | 3 | #50 | Planejado |
| **RF35** | O sistema deve permitir visualizar a distribuição dos gastos também agregada por grupos de categorias. | 3 | #50 | Planejado |
| **RF17** | O sistema deve permitir a comparação de receitas e despesas entre diferentes períodos (mensal, últimos 6 meses, YTD). | 3 | #51, #89 | Planejado |
| **RF18** | O sistema deve exibir um resumo do período analisado (total gasto, categoria de maior peso, número de transações e média diária de gasto). | 3 | #60 | Planejado |

### 7.4. Mentor Financeiro (IA)

| RF | Requisito | Grupo | Issues | Situação |
|---|---|---|---|---|
| **RF19** | O sistema deve disponibilizar um chat de IA generativa para o usuário tirar dúvidas sobre sua situação financeira. | 4 | #26, #27, #38, #70, #71, #83 | Em andamento |
| **RF20** | O sistema deve gerar, de forma proativa, explicações em linguagem natural sobre padrões identificados no histórico financeiro do usuário. | 4 | #52 | Planejado |
| **RF21** | O sistema deve emitir alertas sobre eventos relevantes (gastos fora do padrão, proximidade de vencimento de fatura, dinheiro parado sem rendimento). | 4 | #62, #88 | Planejado |
| **RF22** | O sistema não deve emitir recomendações de compra ou venda de ativos financeiros específicos nas respostas geradas pela IA. | 4 | #53 | Planejado |

### 7.5. Metas financeiras

| RF | Requisito | Grupo | Issues | Situação |
|---|---|---|---|---|
| **RF23** | O sistema deve permitir o cadastro de metas financeiras (nome, valor desejado e prazo). | 5 | #28, #29, #30, #84 | Em andamento |
| **RF24** | O sistema deve exibir o progresso do usuário em relação a cada meta cadastrada. | 5 | #40, #41, #65 | Planejado |

### 7.6. Investimentos (complementar)

| RF | Requisito | Grupo | Issues | Situação |
|---|---|---|---|---|
| **RF25** | O sistema deve exibir um painel com o patrimônio total simulado do usuário. | 5 | #54, #75, #76 | Planejado |
| **RF26** | O sistema deve listar os ativos do portfólio simulado do usuário, com valor investido, percentual da carteira e rentabilidade recente. | 5 | #54, #64, #75 | Planejado |
| **RF27** | O sistema deve exibir a fatura atual e o limite disponível de um cartão de crédito simulado. | 5 | #65, #77 | Planejado |
| **RF36** | O sistema deve exibir os parcelamentos ativos do cartão de crédito simulado (valor da parcela, juros e saldo devedor). | 5 | #55, #77, #90 | Planejado |

### 7.7. Personalização e segurança

| RF | Requisito | Grupo | Issues | Situação |
|---|---|---|---|---|
| **RF28** | O sistema deve permitir a alternância entre modo claro e modo escuro. | 1 | #43 | Parcial |
| **RF29** | O sistema deve permitir ocultar valores financeiros sensíveis na tela. | 1 | #43 | Planejado |
| **RF30** | O sistema deve armazenar dados financeiros do usuário de forma segura, restringindo o acesso ao próprio usuário autenticado. | todos | #17, #56, #57 | Planejado |

**Resumo em 09/11/2026 (35 requisitos):** 24 planejado, 6 em andamento, 3 entregue, 1 feature futura, 1 parcial.

---

## 8. Requisitos Não Funcionais

Os requisitos abaixo descrevem como o sistema deve se comportar. Os itens RNF01 a RNF05 e RNF09 refletem decisões já adotadas no código.

| RNF | Requisito |
|---|---|
| **RNF01** | As senhas devem ser armazenadas apenas como hash com sal (PBKDF2 com HMAC-SHA256, 120.000 iterações), calculado no Servidor Java. |
| **RNF02** | Toda rota privada da API deve exigir um token JWT válido, e cada usuário só pode ler ou alterar os próprios dados. |
| **RNF03** | Chaves de API, o segredo do JWT e a URI do banco devem ficar em variáveis de ambiente, fora do repositório. As credenciais da Pluggy ficam só no Backend, nunca no Frontend. |
| **RNF04** | O Servidor Java deve aceitar conexões só da própria máquina (loopback) e encerrar conexões ociosas após 5 minutos. |
| **RNF05** | A indisponibilidade do Servidor Java ou de um serviço externo não derruba o Backend: as rotas que dependem deles respondem com erro de serviço indisponível, e o cadastro de transação continua funcionando (a categoria fica "Outros"). |
| **RNF06** | Listagens devem ser paginadas (no máximo 100 itens por página) e as operações em lote aceitam no máximo 100 itens por chamada. |
| **RNF07** | A interface deve ser em português, oferecer tema claro e escuro, ter foco visível na navegação por teclado, respeitar a preferência do sistema por menos movimento e mostrar o erro de cada campo junto dele, além de uma notificação geral. |
| **RNF08** | A interface deve se adaptar a telas pequenas (responsividade). |
| **RNF09** | O contrato entre as camadas deve estar documentado (`docs/contrato-api.md` para a API e `Servidor/README.md` para as mensagens do Servidor), e cada grupo adiciona o seu handler ao Servidor sem alterar o código dos outros. |
| **RNF10** | O sistema só deve manipular dados fictícios (sandbox da Pluggy); não há dados bancários reais. |

---

## 9. Features futuras

Itens que fazem parte da visão do produto, mas que, por orientação do(a) professor(a), não precisam ser implementados nesta etapa:

| RF | Feature | Observação |
|---|---|---|
| **RF08** | Marcar uma despesa como recorrente (fixa mensal) | Implica um campo de recorrência na transação, a geração automática das ocorrências mensais e a tela correspondente. Não há issue aberta. |

---

## 10. Rastreabilidade

A ligação entre requisitos e issues está na coluna **Issues** das tabelas da seção 7. As issues de cada sprint seguem o padrão `[Sprint N][Camada][Grupo G] Título`, e a **Situação** de cada requisito é recalculada a cada revisão deste documento.

---

## 11. Glossário

- **Open Finance:** compartilhamento padronizado de dados financeiros entre instituições, com o consentimento do cliente.
- **Pluggy:** provedor de Open Finance usado no projeto, em ambiente de **sandbox** (instituições e dados fictícios).
- **Sandbox:** ambiente de teste, sem dados nem instituições reais.
- **MFA/2FA:** autenticação em mais de uma etapa (além da senha).
- **JWT:** token assinado que identifica o usuário nas chamadas à API.
- **Handler:** código do Servidor Java que trata um tipo de pedido (por exemplo, categorizar uma transação).
- **YTD:** acumulado do ano até a data atual (year to date).
- **SPA:** aplicação de página única, em que a navegação troca o conteúdo sem recarregar a página.
