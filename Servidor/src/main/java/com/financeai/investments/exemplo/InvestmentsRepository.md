# InvestmentsRepository.java — Acesso aos dados de investimentos e parcelamentos

## O que deve ter neste arquivo
- Acesso a duas coleções do grupo: `investments` (ativos **simulados** do usuário: `userId`, `nome`, `valor`) e `installments` (parcelamentos do cartão: `userId`, `descricao`, `parcelaAtual`, `totalParcelas`, `valorMensal`, `ativo`).
- Nesta fase o módulo é de leitura: os dados de teste entram pelo seed definido na Sprint 0.
- Toda consulta é filtrada por `userId`.

## Exemplo de implementação

```java
package com.financeai.investments;

import java.util.ArrayList;
import java.util.List;

import org.bson.Document;

import com.financeai.core.Banco;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Indexes;

public class InvestmentsRepository
{
    private final MongoCollection<Document> investimentos = Banco.colecao ("investments");
    private final MongoCollection<Document> parcelamentos = Banco.colecao ("installments");

    public InvestmentsRepository ()
    {
        this.investimentos.createIndex (Indexes.ascending ("userId"));
        this.parcelamentos.createIndex (Indexes.ascending ("userId"));
    }

    public List<Document> ativos (String userId)
    {
        return this.investimentos.find(Filters.eq("userId", userId)).into(new ArrayList<>());
    }

    public List<Document> parcelamentosAtivos (String userId)
    {
        return this.parcelamentos.find(Filters.and (
                   Filters.eq ("userId", userId), Filters.eq ("ativo", true))).into(new ArrayList<>());
    }
}
```
