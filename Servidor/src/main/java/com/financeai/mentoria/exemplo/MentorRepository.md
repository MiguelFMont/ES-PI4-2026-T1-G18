# MentorRepository.java — Acesso aos dados do mentor financeiro

## O que deve ter neste arquivo
- Acesso às coleções do grupo: `chat_messages` (histórico da conversa: `userId`, `autor` = `usuario`/`ia`, `texto`, `createdAt`) e `alerts` (avisos proativos: `userId`, `tipo`, `mensagem`, `lida`, `createdAt`).
- `ultimasTransacoes` **lê** a coleção `transactions` (do grupo de Transações) para montar o contexto da IA; é só leitura, e quem grava nela é o `TransactionsRepository`.
- A geração dos alertas (gasto fora do padrão, fatura próxima, dinheiro parado) não está neste arquivo: quem os cria (uma tarefa periódica ou o próprio fluxo do chat) usa `salvarAlerta`.
- Toda consulta é filtrada por `userId`.

## Exemplo de implementação

```java
package com.financeai.mentoria;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;

import org.bson.Document;

import com.financeai.core.Banco;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Indexes;
import com.mongodb.client.model.Sorts;

public class MentorRepository
{
    private final MongoCollection<Document> mensagens  = Banco.colecao ("chat_messages");
    private final MongoCollection<Document> alertas    = Banco.colecao ("alerts");
    private final MongoCollection<Document> transacoes = Banco.colecao ("transactions");

    public MentorRepository ()
    {
        this.mensagens.createIndex (Indexes.ascending ("userId", "createdAt"));
        this.alertas  .createIndex (Indexes.ascending ("userId", "createdAt"));
    }

    public void salvarTroca (String userId, String mensagemUsuario, String respostaIA)
    {
        Date agora = new Date();
        this.mensagens.insertMany (Arrays.asList (
            new Document ("userId", userId).append ("autor", "usuario").append ("texto", mensagemUsuario).append ("createdAt", agora),
            new Document ("userId", userId).append ("autor", "ia")     .append ("texto", respostaIA)      .append ("createdAt", new Date(agora.getTime() + 1))));
    }

    public List<Document> historico (String userId)
    {
        return this.mensagens.find(Filters.eq("userId", userId))
                             .sort(Sorts.ascending("createdAt"))
                             .into(new ArrayList<>());
    }

    public void salvarAlerta (String userId, String tipo, String mensagem)
    {
        this.alertas.insertOne (new Document ("userId", userId).append ("tipo", tipo)
                                .append ("mensagem", mensagem).append ("lida", false).append ("createdAt", new Date()));
    }

    public List<Document> alertas (String userId)
    {
        return this.alertas.find(Filters.eq("userId", userId))
                           .sort(Sorts.descending("createdAt"))
                           .into(new ArrayList<>());
    }

    public List<Document> ultimasTransacoes (String userId, int quantidade)
    {
        return this.transacoes.find(Filters.eq("userId", userId))
                              .sort(Sorts.descending("data"))
                              .limit(quantidade)
                              .into(new ArrayList<>());
    }
}
```
