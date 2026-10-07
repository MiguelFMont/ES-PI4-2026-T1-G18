# TransactionsHandler.java — Handlers do Grupo 2 (Transações)

## O que deve ter neste arquivo
- Registra os seis pedidos do grupo: `PedidoListarTransacoes`, `PedidoCriarTransacao`, `PedidoAtualizarTransacao`, `PedidoRemoverTransacao`, `PedidoDuplicarTransacao` e `PedidoImportarTransacoes`.
- É o **dono das transações**: valida, categoriza e grava via `TransactionsRepository`. O `userId` vem do pedido (o Backend o tira do JWT) e é usado em toda consulta.
- **Categorização automática:** se a transação chega sem `categoria`, o handler a sugere por palavras-chave da descrição (a regra pode crescer sem o Backend mudar, desde que o contrato continue igual). A edição manual é só um `PedidoAtualizarTransacao` com `categoria`.
- `PedidoImportarTransacoes`: o Backend consulta a Pluggy (que precisa de internet e chave) e manda a lista; o handler categoriza e grava em lote com `origem = "pluggy"`.
- As datas chegam como texto ISO-8601 e são gravadas como `Date`; `Banco.paraMapa` as devolve como texto ISO.
- Falhas de regra: `400 VALIDATION`, `404 TRANSACTION_NOT_FOUND`.

## Exemplo de implementação

```java
package com.financeai.transactions;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.bson.Document;
import org.bson.conversions.Bson;

import com.financeai.core.Banco;
import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;
import com.mongodb.client.model.Updates;

public class TransactionsHandler
{
    private static final Map<String, String> PALAVRAS_CHAVE = new LinkedHashMap<>();
    static
    {
        PALAVRAS_CHAVE.put ("mercado",     "Alimentacao");
        PALAVRAS_CHAVE.put ("restaurante", "Alimentacao");
        PALAVRAS_CHAVE.put ("uber",        "Transporte");
        PALAVRAS_CHAVE.put ("combustivel", "Transporte");
        PALAVRAS_CHAVE.put ("aluguel",     "Moradia");
        PALAVRAS_CHAVE.put ("farmacia",    "Saude");
    }

    private final TransactionsRepository repositorio = new TransactionsRepository();

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoListarTransacoes.TIPO,   this::listar);
        registry.registrar (PedidoCriarTransacao.TIPO,     this::criar);
        registry.registrar (PedidoAtualizarTransacao.TIPO, this::atualizar);
        registry.registrar (PedidoRemoverTransacao.TIPO,   this::remover);
        registry.registrar (PedidoDuplicarTransacao.TIPO,  this::duplicar);
        registry.registrar (PedidoImportarTransacoes.TIPO, this::importar);
    }

    private Comunicado listar (Comunicado pedido) throws Exception
    {
        PedidoListarTransacoes p = pedido.dadosComo (PedidoListarTransacoes.class);

        List<Map<String, Object>> transacoes = new ArrayList<>();
        for (Document d : this.repositorio.listar (p.getUserId(), p.getCategoria(), p.getOrigem(),
                                                   data(p.getDataInicio()), data(p.getDataFim())))
            transacoes.add (Banco.paraMapa (d));

        return Comunicado.de (RespostaListarTransacoes.TIPO, new RespostaListarTransacoes (transacoes));
    }

    private Comunicado criar (Comunicado pedido) throws Exception
    {
        PedidoCriarTransacao p = pedido.dadosComo (PedidoCriarTransacao.class);

        Document transacao = montar (p.getUserId(), p.getTipo(), p.getValor(), p.getCategoria(),
                                     data(p.getData()), p.getDescricao(),
                                     p.getOrigem() == null ? "manual" : p.getOrigem());
        this.repositorio.criar (transacao);

        return Comunicado.de (RespostaCriarTransacao.TIPO, new RespostaCriarTransacao (Banco.paraMapa(transacao)));
    }

    private Comunicado atualizar (Comunicado pedido) throws Exception
    {
        PedidoAtualizarTransacao p = pedido.dadosComo (PedidoAtualizarTransacao.class);

        List<Bson> alteracoes = new ArrayList<>();
        if (p.getTipo()      != null) alteracoes.add (Updates.set ("tipo",      validarTipo(p.getTipo())));
        if (p.getValor()     != null) alteracoes.add (Updates.set ("valor",     p.getValor()));
        if (p.getCategoria() != null) alteracoes.add (Updates.set ("categoria", p.getCategoria()));
        if (p.getData()      != null) alteracoes.add (Updates.set ("data",      data(p.getData())));
        if (p.getDescricao() != null) alteracoes.add (Updates.set ("descricao", p.getDescricao()));

        Document resultado = alteracoes.isEmpty()
            ? this.repositorio.buscar (p.getUserId(), p.getId())
            : this.repositorio.atualizar (p.getUserId(), p.getId(), alteracoes);

        if (resultado == null)
            throw new ErroDeNegocio ("TRANSACTION_NOT_FOUND", "Transacao nao encontrada");

        return Comunicado.de (RespostaAtualizarTransacao.TIPO, new RespostaAtualizarTransacao (Banco.paraMapa(resultado)));
    }

    private Comunicado remover (Comunicado pedido) throws Exception
    {
        PedidoRemoverTransacao p = pedido.dadosComo (PedidoRemoverTransacao.class);

        if (!this.repositorio.remover (p.getUserId(), p.getId()))
            throw new ErroDeNegocio ("TRANSACTION_NOT_FOUND", "Transacao nao encontrada");

        return Comunicado.de (RespostaRemoverTransacao.TIPO, new RespostaRemoverTransacao (true));
    }

    private Comunicado duplicar (Comunicado pedido) throws Exception
    {
        PedidoDuplicarTransacao p = pedido.dadosComo (PedidoDuplicarTransacao.class);

        Document original = this.repositorio.buscar (p.getUserId(), p.getId());
        if (original == null)
            throw new ErroDeNegocio ("TRANSACTION_NOT_FOUND", "Transacao nao encontrada");

        Document copia = new Document (original);
        copia.remove ("_id");
        copia.put ("createdAt", new Date());
        this.repositorio.criar (copia);

        return Comunicado.de (RespostaDuplicarTransacao.TIPO, new RespostaDuplicarTransacao (Banco.paraMapa(copia)));
    }

    private Comunicado importar (Comunicado pedido) throws Exception
    {
        PedidoImportarTransacoes p = pedido.dadosComo (PedidoImportarTransacoes.class);

        List<Document> lote = new ArrayList<>();
        for (Map<String, Object> item : p.getTransacoes())
        {
            double valor = ((Number) item.get ("valor")).doubleValue();
            String tipo  = item.get ("tipo") == null ? "despesa" : item.get ("tipo").toString();
            String data  = item.get ("data") == null ? null : item.get ("data").toString();

            lote.add (montar (p.getUserId(), tipo, valor, null, data(data),
                              String.valueOf (item.get ("descricao")), "pluggy"));
        }
        this.repositorio.criarVarias (lote);

        return Comunicado.de (RespostaImportarTransacoes.TIPO, new RespostaImportarTransacoes (lote.size()));
    }

    private Document montar (String userId, String tipo, double valor, String categoria,
                             Date data, String descricao, String origem) throws ErroDeNegocio
    {
        if (descricao == null || descricao.isBlank() || valor <= 0)
            throw new ErroDeNegocio ("VALIDATION", "Descricao e valor positivo sao obrigatorios");

        return new Document ("userId", userId)
            .append ("tipo",      validarTipo (tipo))
            .append ("valor",     valor)
            .append ("categoria", categoria != null ? categoria : categorizar (descricao))
            .append ("data",      data != null ? data : new Date())
            .append ("descricao", descricao)
            .append ("origem",    origem)
            .append ("createdAt", new Date());
    }

    private static String validarTipo (String tipo) throws ErroDeNegocio
    {
        if (!"receita".equals (tipo) && !"despesa".equals (tipo))
            throw new ErroDeNegocio ("VALIDATION", "Tipo deve ser receita ou despesa");
        return tipo;
    }

    private static String categorizar (String descricao)
    {
        String texto = descricao.toLowerCase();
        for (Map.Entry<String, String> par : PALAVRAS_CHAVE.entrySet())
            if (texto.contains (par.getKey()))
                return par.getValue();
        return "Outros";
    }

    private static Date data (String texto) throws ErroDeNegocio
    {
        if (texto == null || texto.isBlank())
            return null;
        try
        {
            return Date.from (Instant.parse (texto));
        }
        catch (Exception erro)
        {
            throw new ErroDeNegocio ("VALIDATION", "Data invalida: " + texto);
        }
    }
}
```
