# PedidoCalcularParcelamentos.java — Pedido de cálculo de parcelamentos

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoCalcularParcelamentos"`). Par: `RespostaCalcularParcelamentos`.
- `parcelamentos`: lista de mapas com `valorTotal` (valor financiado), `parcelas` (quantidade total), `parcelasPagas` (quantas já foram pagas; `0` numa simulação) e `taxaJurosMensal` (em %; `0` se não há juros). Qualquer outro campo (por exemplo `id` e `descricao`) volta igual na resposta, para o Backend associar cada resultado ao seu parcelamento.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido.

## Exemplo de implementação

```java
package com.financeai.investments;

import java.util.List;
import java.util.Map;

public class PedidoCalcularParcelamentos
{
    public static final String TIPO = "PedidoCalcularParcelamentos";

    private List<Map<String,Object>> parcelamentos;

    public List<Map<String,Object>> getParcelamentos ()
    {
        return this.parcelamentos;
    }
}
```
