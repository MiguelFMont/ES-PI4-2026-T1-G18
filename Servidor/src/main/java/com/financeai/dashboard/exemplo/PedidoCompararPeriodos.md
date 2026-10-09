# PedidoCompararPeriodos.java — Pedido de comparação entre períodos

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoCompararPeriodos"`). Par: `RespostaCompararPeriodos`.
- Traz a lista `periodos`, **do mais antigo ao mais recente**, e cada item é um mapa com `rotulo` (texto, por exemplo `"2026-09"`), `receitas` e `despesas` (números). O Backend monta essa lista agregando as transações no MongoDB; para "este mês contra o anterior" bastam dois itens.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido.

## Exemplo de implementação

```java
package com.financeai.dashboard;

import java.util.List;
import java.util.Map;

public class PedidoCompararPeriodos
{
    public static final String TIPO = "PedidoCompararPeriodos";

    private List<Map<String,Object>> periodos;

    public List<Map<String,Object>> getPeriodos ()
    {
        return this.periodos;
    }
}
```
