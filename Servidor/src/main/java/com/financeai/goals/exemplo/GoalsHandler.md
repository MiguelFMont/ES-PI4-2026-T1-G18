# GoalsHandler.java — Handlers do Grupo 5 (Metas Financeiras)

## O que deve ter neste arquivo
- Registra `PedidoListarMetas`, `PedidoCriarMeta`, `PedidoAtualizarMeta`, `PedidoRemoverMeta` e `PedidoProgressoMeta`.
- É o **dono das metas**: valida e grava via `GoalsRepository`. `valorAtual` nunca vem do cliente: a meta nasce com `0`, e o acúmulo é atualizado por outra regra do grupo (fora deste exemplo).
- `PedidoProgressoMeta`: lê a meta do próprio banco e calcula o percentual concluído (acumulado ÷ objetivo, limitado a 100) e se está dentro do prazo (já concluída ou prazo ainda no futuro).
- Falhas de regra: `400 VALIDATION` (título vazio, valor objetivo não positivo, prazo inválido) e `404 GOAL_NOT_FOUND`.

## Exemplo de implementação

```java
package com.financeai.goals;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

import org.bson.Document;
import org.bson.conversions.Bson;

import com.financeai.core.Banco;
import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;
import com.mongodb.client.model.Updates;

public class GoalsHandler
{
    private final GoalsRepository repositorio = new GoalsRepository();

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoListarMetas.TIPO,    this::listar);
        registry.registrar (PedidoCriarMeta.TIPO,      this::criar);
        registry.registrar (PedidoAtualizarMeta.TIPO,  this::atualizar);
        registry.registrar (PedidoRemoverMeta.TIPO,    this::remover);
        registry.registrar (PedidoProgressoMeta.TIPO,  this::progresso);
    }

    private Comunicado listar (Comunicado pedido) throws Exception
    {
        PedidoListarMetas p = pedido.dadosComo (PedidoListarMetas.class);

        List<Map<String, Object>> metas = new ArrayList<>();
        for (Document d : this.repositorio.listar (p.getUserId()))
            metas.add (Banco.paraMapa (d));

        return Comunicado.de (RespostaListarMetas.TIPO, new RespostaListarMetas (metas));
    }

    private Comunicado criar (Comunicado pedido) throws Exception
    {
        PedidoCriarMeta p = pedido.dadosComo (PedidoCriarMeta.class);

        if (p.getTitulo() == null || p.getTitulo().isBlank() || p.getValorObjetivo() <= 0)
            throw new ErroDeNegocio ("VALIDATION", "Titulo e valor objetivo positivo sao obrigatorios");

        Document meta = new Document ("userId", p.getUserId())
            .append ("titulo",        p.getTitulo())
            .append ("valorObjetivo", p.getValorObjetivo())
            .append ("valorAtual",    0.0)
            .append ("prazo",         data (p.getPrazo()))
            .append ("createdAt",     new Date());
        this.repositorio.criar (meta);

        return Comunicado.de (RespostaCriarMeta.TIPO, new RespostaCriarMeta (Banco.paraMapa(meta)));
    }

    private Comunicado atualizar (Comunicado pedido) throws Exception
    {
        PedidoAtualizarMeta p = pedido.dadosComo (PedidoAtualizarMeta.class);

        List<Bson> alteracoes = new ArrayList<>();
        if (p.getTitulo()        != null) alteracoes.add (Updates.set ("titulo",        p.getTitulo()));
        if (p.getValorObjetivo() != null) alteracoes.add (Updates.set ("valorObjetivo", p.getValorObjetivo()));
        if (p.getPrazo()         != null) alteracoes.add (Updates.set ("prazo",         data (p.getPrazo())));

        Document meta = alteracoes.isEmpty()
            ? this.repositorio.buscar (p.getUserId(), p.getId())
            : this.repositorio.atualizar (p.getUserId(), p.getId(), alteracoes);

        if (meta == null)
            throw new ErroDeNegocio ("GOAL_NOT_FOUND", "Meta nao encontrada");

        return Comunicado.de (RespostaAtualizarMeta.TIPO, new RespostaAtualizarMeta (Banco.paraMapa(meta)));
    }

    private Comunicado remover (Comunicado pedido) throws Exception
    {
        PedidoRemoverMeta p = pedido.dadosComo (PedidoRemoverMeta.class);

        if (!this.repositorio.remover (p.getUserId(), p.getId()))
            throw new ErroDeNegocio ("GOAL_NOT_FOUND", "Meta nao encontrada");

        return Comunicado.de (RespostaRemoverMeta.TIPO, new RespostaRemoverMeta (true));
    }

    private Comunicado progresso (Comunicado pedido) throws Exception
    {
        PedidoProgressoMeta p = pedido.dadosComo (PedidoProgressoMeta.class);

        Document meta = this.repositorio.buscar (p.getUserId(), p.getId());
        if (meta == null)
            throw new ErroDeNegocio ("GOAL_NOT_FOUND", "Meta nao encontrada");

        double objetivo   = ((Number) meta.get ("valorObjetivo")).doubleValue();
        double atual      = ((Number) meta.get ("valorAtual")).doubleValue();
        double percentual = Math.min (100.0, (atual / objetivo) * 100);
        boolean noPrazo   = percentual >= 100 || meta.getDate ("prazo").after (new Date());

        return Comunicado.de (RespostaProgressoMeta.TIPO, new RespostaProgressoMeta (percentual, noPrazo));
    }

    private static Date data (String texto) throws ErroDeNegocio
    {
        try
        {
            return Date.from (Instant.parse (texto));
        }
        catch (Exception erro)
        {
            throw new ErroDeNegocio ("VALIDATION", "Prazo invalido: " + texto);
        }
    }
}
```
