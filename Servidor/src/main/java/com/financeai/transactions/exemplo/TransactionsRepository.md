# TransactionsRepository.java — Acesso aos dados de transações

## O que deve ter neste arquivo
- Acesso à coleção `transactions`. Toda consulta é **restrita ao dono** (`userId`): buscar, atualizar e remover sempre combinam o `_id` com o `userId`, para um usuário nunca alcançar a transação de outro, mesmo conhecendo o id.
- Cria o índice composto `(userId, data)` ao ser instanciado, que acelera a listagem e o painel.
- Documento de transação: `userId`, `tipo` (`receita`/`despesa`), `valor`, `categoria`, `data` (`Date`), `descricao`, `origem` (`manual`/`pluggy`) e `createdAt`.
- Os módulos do painel (`dashboard`) e do mentor (`mentoria`) leem esta mesma coleção, cada um pelo seu repositório; só o `TransactionsRepository` **grava** nela.
- Sem regra de negócio: a categorização e as validações ficam no `TransactionsHandler`.

## Exemplo de implementação

```java
package com.financeai.transactions;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import org.bson.Document;
import org.bson.conversions.Bson;

import com.financeai.core.Banco;
import com.financeai.core.ErroDeNegocio;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import com.mongodb.client.model.Indexes;
import com.mongodb.client.model.ReturnDocument;
import com.mongodb.client.model.Sorts;
import com.mongodb.client.model.Updates;

public class TransactionsRepository
{
    private final MongoCollection<Document> transacoes = Banco.colecao ("transactions");

    public TransactionsRepository ()
    {
        this.transacoes.createIndex (Indexes.compoundIndex (
            Indexes.ascending ("userId"), Indexes.descending ("data")));
    }

    public List<Document> listar (String userId, String categoria, String origem, Date inicio, Date fim)
    {
        List<Bson> filtros = new ArrayList<>();
        filtros.add (Filters.eq ("userId", userId));

        if (categoria != null) filtros.add (Filters.eq  ("categoria", categoria));
        if (origem    != null) filtros.add (Filters.eq  ("origem",    origem));
        if (inicio    != null) filtros.add (Filters.gte ("data",      inicio));
        if (fim       != null) filtros.add (Filters.lte ("data",      fim));

        return this.transacoes.find(Filters.and(filtros))
                              .sort(Sorts.descending("data"))
                              .into(new ArrayList<>());
    }

    public Document buscar (String userId, String id) throws ErroDeNegocio
    {
        return this.transacoes.find(doDono(userId, id)).first();
    }

    public Document criar (Document transacao)
    {
        this.transacoes.insertOne (transacao);
        return transacao;
    }

    public void criarVarias (List<Document> lote)
    {
        if (!lote.isEmpty())
            this.transacoes.insertMany (lote);
    }

    public Document atualizar (String userId, String id, List<Bson> alteracoes) throws ErroDeNegocio
    {
        return this.transacoes.findOneAndUpdate (
            doDono (userId, id),
            Updates.combine (alteracoes),
            new FindOneAndUpdateOptions().returnDocument (ReturnDocument.AFTER));
    }

    public boolean remover (String userId, String id) throws ErroDeNegocio
    {
        return this.transacoes.deleteOne(doDono(userId, id)).getDeletedCount() > 0;
    }

    private Bson doDono (String userId, String id) throws ErroDeNegocio
    {
        return Filters.and (Filters.eq ("_id", Banco.id(id)), Filters.eq ("userId", userId));
    }
}
```
