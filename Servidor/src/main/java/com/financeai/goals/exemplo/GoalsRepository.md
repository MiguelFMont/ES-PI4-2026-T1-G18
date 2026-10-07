# GoalsRepository.java — Acesso aos dados de metas financeiras

## O que deve ter neste arquivo
- Acesso à coleção `goals`: `userId`, `titulo`, `valorObjetivo`, `valorAtual` (acumulado, começa em `0`), `prazo` (`Date`) e `createdAt`.
- Toda consulta, atualização e remoção combina o `_id` com o `userId`, para um usuário nunca alterar a meta de outro.
- Sem regra de negócio: o cálculo do progresso fica no `GoalsHandler`.

## Exemplo de implementação

```java
package com.financeai.goals;

import java.util.ArrayList;
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

public class GoalsRepository
{
    private final MongoCollection<Document> metas = Banco.colecao ("goals");

    public GoalsRepository ()
    {
        this.metas.createIndex (Indexes.ascending ("userId"));
    }

    public List<Document> listar (String userId)
    {
        return this.metas.find(Filters.eq("userId", userId))
                         .sort(Sorts.ascending("prazo"))
                         .into(new ArrayList<>());
    }

    public Document buscar (String userId, String id) throws ErroDeNegocio
    {
        return this.metas.find(doDono(userId, id)).first();
    }

    public Document criar (Document meta)
    {
        this.metas.insertOne (meta);
        return meta;
    }

    public Document atualizar (String userId, String id, List<Bson> alteracoes) throws ErroDeNegocio
    {
        return this.metas.findOneAndUpdate (
            doDono (userId, id),
            Updates.combine (alteracoes),
            new FindOneAndUpdateOptions().returnDocument (ReturnDocument.AFTER));
    }

    public boolean remover (String userId, String id) throws ErroDeNegocio
    {
        return this.metas.deleteOne(doDono(userId, id)).getDeletedCount() > 0;
    }

    private Bson doDono (String userId, String id) throws ErroDeNegocio
    {
        return Filters.and (Filters.eq ("_id", Banco.id(id)), Filters.eq ("userId", userId));
    }
}
```
