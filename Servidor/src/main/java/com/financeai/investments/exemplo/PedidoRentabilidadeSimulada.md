# PedidoRentabilidadeSimulada.java — Pedido de rentabilidade simulada

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoRentabilidadeSimulada"`). Par: `RespostaRentabilidadeSimulada`.
- `ativos`: lista de mapas com o `nome` e o `valor` investido de cada ativo simulado (e, opcionalmente, `taxaMensal` em %). `meses` (opcional, padrão `1`): quantos meses projetar, com juros compostos.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido; `meses` é `Integer` para distinguir "não enviado" (`null`) de zero.

## Exemplo de implementação

```java
package com.financeai.investments;

import java.util.List;
import java.util.Map;

public class PedidoRentabilidadeSimulada
{
    public static final String TIPO = "PedidoRentabilidadeSimulada";

    private List<Map<String,Object>> ativos;
    private Integer meses;

    public List<Map<String,Object>> getAtivos ()
    {
        return this.ativos;
    }

    public Integer getMeses ()
    {
        return this.meses;
    }
}
```
