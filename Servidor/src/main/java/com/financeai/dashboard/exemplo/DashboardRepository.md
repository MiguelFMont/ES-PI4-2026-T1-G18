# DashboardRepository.java — Agregações para o painel

## O que deve ter neste arquivo
- Consultas de **agregação** (`aggregate`) sobre a coleção `transactions`, sempre filtradas por `userId`: totais de receitas e despesas desde uma data, total de despesas por categoria e total por mês.
- O painel **não tem coleção própria nem grava nada**: só lê a coleção que pertence ao grupo de Transações. Por isso este repositório obtém a coleção por `Banco.colecao("transactions")`, sem usar o `TransactionsRepository` (que é o único que escreve nela).
- As agregações acontecem no banco, e o Servidor recebe só os totais.

## Exemplo de implementação

```java
package com.financeai.dashboard;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;

import org.bson.Document;

import com.financeai.core.Banco;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Accumulators;
import com.mongodb.client.model.Aggregates;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;

public class DashboardRepository
{
    private final MongoCollection<Document> transacoes = Banco.colecao ("transactions");

    // total de cada tipo ("receita" / "despesa") desde a data informada
    public List<Document> totaisPorTipo (String userId, Date desde)
    {
        return this.transacoes.aggregate (Arrays.asList (
            Aggregates.match (Filters.and (Filters.eq ("userId", userId), Filters.gte ("data", desde))),
            Aggregates.group ("$tipo", Accumulators.sum ("total", "$valor"))
        )).into (new ArrayList<>());
    }

    // gastos (despesas) somados por categoria, do maior para o menor
    public List<Document> gastosPorCategoria (String userId)
    {
        return this.transacoes.aggregate (Arrays.asList (
            Aggregates.match (Filters.and (Filters.eq ("userId", userId), Filters.eq ("tipo", "despesa"))),
            Aggregates.group ("$categoria", Accumulators.sum ("total", "$valor")),
            Aggregates.sort (Sorts.descending ("total"))
        )).into (new ArrayList<>());
    }

    // total (receitas e despesas somados) por ano e mes, desde a data informada
    public List<Document> totaisPorMes (String userId, Date desde)
    {
        Document ano = new Document ("$year",  "$data");
        Document mes = new Document ("$month", "$data");

        return this.transacoes.aggregate (Arrays.asList (
            Aggregates.match (Filters.and (Filters.eq ("userId", userId), Filters.gte ("data", desde))),
            Aggregates.group (new Document ("ano", ano).append ("mes", mes), Accumulators.sum ("total", "$valor")),
            Aggregates.sort (Sorts.ascending ("_id.ano", "_id.mes"))
        )).into (new ArrayList<>());
    }
}
```
