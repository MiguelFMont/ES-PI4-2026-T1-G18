# Checklist do teste completo (integração final)

Roteiro para testar o FinanceAI de ponta a ponta na branch de integração, antes da entrega (23/11/2026). Marque `[x]` ao passar e anote o problema na seção "Bugs encontrados" no fim. Cada item diz o que deve acontecer.

> Dica: faça o teste com **dois usuários** (A e B), como na seção 11, e deixe o **Console** e a aba **Network** do navegador abertos (F12). Erros em vermelho no Console ou respostas 4xx/5xx inesperadas contam como bug mesmo que a tela pareça normal.

## 0. Preparação

- [ ] Branch de teste montada: `develop` atual + as 4 branches do Grupo 5 + as 3 branches de Frontend (somente-cartão, barra lateral, tela de carregando). Sem conflito.
- [ ] `Backend/.env` com `MONGO_URI`, `JWT_SECRET`, `GENAI_API_KEY`, `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `EMAIL_USER` e `EMAIL_PASSWORD` (o e-mail é preciso para o cadastro e a recuperação de senha).
- [ ] `npm install` rodado no `Backend` (o `package-lock.json` não vai para o Git).
- [ ] Terminal 1, Servidor Java: `cd Servidor` e `mvn compile && mvn exec:java -Dexec.mainClass=com.financeai.Main`. Aparece "O servidor esta ativo!".
- [ ] Terminal 2, Backend: `cd Backend` e `npm run dev`. Sem erro na subida; se o Servidor estiver fora, o Backend avisa no log.
- [ ] Navegador: abrir `http://localhost:3001`, limpar o armazenamento do site (F12, Application, Clear site data) e dar **Ctrl+F5**.

## 1. Acesso (Grupo 1)

- [ ] Abrir `http://localhost:3001` sem login leva à tela de login/cadastro (nunca mostra o menu nem o extrato).
- [ ] Abrir `#transactions` direto na barra de endereço sem login também volta ao login.
- [ ] Cadastro: e-mail válido, senha e confirmação. Chega o e-mail com o **código de verificação**; o usuário só é criado depois de digitar o código.
- [ ] Código errado é recusado com mensagem clara; senha fraca ou e-mail repetido também.
- [ ] Login com a conta criada entra no sistema e mostra o menu. No navegador (Application, Local Storage) existe a chave `@FinanceAI:token`.
- [ ] Login com senha errada mostra erro e não entra.
- [ ] Recuperar senha: chega o e-mail, a nova senha funciona e a antiga deixa de valer.
- [ ] **Sair** apaga o token e volta ao login; o botão Voltar do navegador não reabre telas internas.

## 2. Layout, menu e carregamento

- [ ] O menu tem os grupos Geral (Início), Finanças (Transações, Contas conectadas, Cartão) e Planejamento (Metas, Mentor IA), e **Minha conta** no rodapé. O item da tela atual aparece destacado.
- [ ] Botão de recolher: o menu vira só ícones, os textos aparecem como dica ao passar o mouse, e **a escolha continua depois de recarregar (F5)**.
- [ ] Com o menu recolhido, abrir "Nova transação": o painel cobre só o conteúdo, sem tapar o menu.
- [ ] Tema claro e escuro: troca com a animação circular, o texto do botão muda e os dois temas ficam legíveis em **todas** as telas.
- [ ] Ocultar valores: troca para "Mostrar valores" e esconde os números do resumo; volta ao clicar de novo e permanece após recarregar.
- [ ] Trocar entre todas as telas pelo menu: **nunca aparece HTML sem estilo**, nem a tela anterior desformatada. Com a API lenta, cada tela mostra os blocos cinza (esqueletos) e depois o conteúdo.
- [ ] Endereço inválido (`#xyz`) mostra "Página não encontrada".

## 3. Transações (Grupo 2)

**Cadastro e categoria automática**
- [ ] Nova transação (despesa) com categoria **Automática** e descrição `Netflix`: a categoria fica **Lazer**.
- [ ] Descrições `Uber` (Transporte), `Condomínio` (Moradia), `Farmácia` (Saúde), `Mercado Livre` (Outros) e `Salário` (receita, Salário) caem na categoria esperada.
- [ ] Descrição sem palavra conhecida fica em **Outros**.
- [ ] Valor zero, valor negativo, descrição vazia e data inválida são recusados com mensagem no campo.
- [ ] A transação nova aparece no topo do extrato e o resumo (entradas, saídas, saldo) atualiza.

**Listagem e filtros** (cadastre uma dezena de transações variadas antes)
- [ ] O extrato abre **sem nenhum filtro** (todas as transações); "Limpar filtros" apaga todos os campos, inclusive o período. Os filtros ficam no alto do extrato, na ordem das colunas.
- [ ] Cada filtro funciona sozinho e combinado: descrição, tipo, categoria, pagamento, **origem** (Manual / Open Finance), **meta**, período e faixa de valor (com máscara de moeda).
- [ ] Valor mínimo maior que o máximo e data final antes da inicial mostram erro e não consultam.
- [ ] Paginação (Anterior/Próxima) e "Por página" (20, 50, 100) funcionam; o resumo reflete todos os filtros, não só a página.

**Edição e exclusão**
- [ ] Clicar em um campo do extrato edita no lugar e **não envia nada ainda**: o campo fica marcado e aparece a barra "alterações pendentes".
- [ ] **Confirmar alterações** salva tudo de uma vez; **Descartar** volta ao original; voltar o campo ao valor original remove a marca.
- [ ] Sair da tela com alteração pendente pede confirmação; "cancelar" fica na tela.
- [ ] Selecionar várias transações e usar **Editar** em lote (só muda o que for preenchido; "Manter" não altera).
- [ ] Excluir uma e várias, com confirmação.
- [ ] **Duplicar** uma transação manual cria uma cópia com a data de hoje e o original não muda; na seleção com uma importada, ela é ignorada com aviso.

**Origem**
- [ ] A coluna **Origem** mostra "Manual" ou "Open Finance" em cada linha, e não é editável.

## 4. Contas conectadas e Pluggy (Grupo 2)

- [ ] Tela sem contas mostra a mensagem de vazio.
- [ ] **Conectar banco de teste**: leva de 20 a 30 s, com o andamento na tela; no fim aparece a conta "Pluggy Bank" com status Atualizada e **~45 transações importadas** (as 4 de pagamento de fatura são ignoradas).
- [ ] Em Transações, filtrar por origem "Open Finance" mostra as importadas, com categorias vindas do Servidor.
- [ ] **Sincronizar** de novo: "Nenhuma transação nova" (sem duplicar nada).
- [ ] **Escolher outra instituição** abre o widget da Pluggy (se não abrir, olhar o Console: pode ser a política de segurança, CSP). Pluggy Bank: usuário `user-ok`, senha `password-ok`, código MFA `123456`. A conta aparece na lista.
- [ ] Mais de 5 contas é recusado com mensagem clara.
- [ ] **Desconectar** pede confirmação, remove a conta e **mantém** as transações já importadas.
- [ ] As importadas não podem ser duplicadas e podem ser editadas e excluídas.

## 5. Metas (Grupo 5)

- [ ] Criar uma meta (nome, valor objetivo, prazo futuro, valor inicial opcional). Prazo no passado é recusado.
- [ ] Na tela da meta aparece o percentual, quanto falta, os dias e o aporte mensal necessário (vem do Servidor Java).
- [ ] Cadastrar uma **despesa** com "Vincular a uma meta": o progresso da meta **sobe**. Uma **receita** vinculada **retira** do progresso.
- [ ] Sem metas, a opção de vincular abre a janela "Nova meta" e, depois de criar, a meta fica selecionada.
- [ ] Na coluna "Meta" do extrato dá para trocar a meta ou escolher "Nenhuma", por rascunho e confirmação. O filtro "Meta" (Todas / Sem meta / uma meta) funciona.
- [ ] Editar uma meta (inclusive uma vencida, mantendo o prazo) e **excluir** uma meta: as transações vinculadas ficam, sem o vínculo.
- [ ] Meta com mais retiradas do que aportes mostra 0% (nunca negativo).

## 6. Cartão de crédito (Grupo 5)

- [ ] A tela abre com a fatura do mês, o vencimento (padrão dia 10) e o limite (padrão R$ 5.000).
- [ ] Cadastrar despesas com pagamento **Cartão de crédito**: a fatura sobe e o limite disponível desce.
- [ ] Editar limite e dia do vencimento atualiza os números e a barra do limite; valor inválido mostra erro.
- [ ] Novo parcelamento (descrição, valor total, parcelas, juros opcionais): aparecem a parcela, os juros e o saldo devedor. Conferir uma conta à mão (Tabela Price).
- [ ] **Pagar parcela** avança uma parcela, e o parcelamento quitado aparece como "Quitado" fora dos totais.
- [ ] Excluir parcelamento, com confirmação. Limite excedido mostra o aviso.

## 7. Início / Painel (Grupo 3)

- [ ] Abrir **Início** e anotar o que aparece. Na `develop` o Início ainda era um texto de boas-vindas; **conferir o estado atual com o Cezar** antes de contar como bug.
- [ ] Se houver saldo, gastos do mês ou gráfico, conferir se batem com as transações que você cadastrou.

## 8. Mentor IA (Grupo 4)

- [ ] A tela abre com as boas-vindas e as sugestões de pergunta.
- [ ] Perguntar "quais são meus maiores gastos?": a resposta cita números que batem com as despesas do mês.
- [ ] Perguntar algo fora de finanças (por exemplo, "faça uma função que some dois números"): recusa padrão, sem código.
- [ ] Pedir uma recomendação de ativo (por exemplo, "devo comprar PETR4?"): não recomenda; o aviso explica que não indica ativos.
- [ ] Os alertas proativos (fatura próxima, gasto fora do padrão) aparecem e o "lido" some depois.
- [ ] Com usuário sem transações a resposta diz que não há dados, sem inventar.

## 9. Minha conta e suporte (Grupo 1)

- [ ] Minha conta mostra o nome e o e-mail certos (nunca "Carregando..." parado).
- [ ] Alterar perfil e preferências, **recarregar** e conferir que foram salvos no banco.
- [ ] Plano da conta (Free/Pro) abre e muda se estiver implementado.
- [ ] Relatar problema: envia e confirma o envio.

## 10. Resiliência (Servidor fora do ar)

- [ ] No Terminal 1, digitar `desativar`. O Servidor encerra.
- [ ] Cadastrar uma transação com categoria Automática continua funcionando e cai em **Outros**.
- [ ] Criar ou ler uma meta, o Mentor e o cartão respondem com mensagem amigável de "servidor de cálculos fora do ar" (503), **sem travar a tela** nem mostrar erro técnico.
- [ ] Subir o Servidor de novo **sem reiniciar o Backend**: as telas voltam a funcionar na próxima ação (o pool reconecta).

## 11. Isolamento entre usuários

- [ ] Com o usuário B, **não aparece nada do usuário A**: transações, contas conectadas, metas, cartão e conversa do Mentor.
- [ ] Copiar o id de uma transação do A e tentar duplicar ou excluir logado como B: não encontra (404), sem criar nem apagar nada.

## 12. Testes automatizados e build

- [ ] `cd Backend && npx tsc --noEmit`: sem erro.
- [ ] `cd Backend && npm test`: todos passam (na integração, 447 testes; a contagem sobe com os testes de transações e da `develop`).
- [ ] `cd Servidor && mvn test`: todos passam (130 testes).
- [ ] Console do navegador sem erros em nenhuma das telas acima.

## 13. Fechamento

- [ ] Bugs encontrados registrados abaixo e, se for o caso, abertos como issue na Sprint 5 (#67).
- [ ] Nenhum arquivo secreto (`.env`) no `git status`.
- [ ] Issues que ficaram implementadas fechadas ou comentadas; as de feature futura marcadas assim (RF08 e o portfólio simulado).

## Bugs encontrados

| # | Tela | O que fez | O que era esperado | Quem corrige |
|---|---|---|---|---|
| 1 | | | | |
