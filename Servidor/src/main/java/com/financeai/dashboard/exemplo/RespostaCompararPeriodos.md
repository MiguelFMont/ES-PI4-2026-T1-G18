# RespostaCompararPeriodos.java — Resposta da comparação entre períodos

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaCompararPeriodos"`). Par: `PedidoCompararPeriodos`.
- `periodos`: um item por período recebido, na mesma ordem, com `rotulo`, `receitas`, `despesas`, `saldo` e as variações percentuais `variacaoReceitas`, `variacaoDespesas` e `variacaoSaldo` em relação ao período anterior (o primeiro período devolve `0`). `tendenciaDespesas`: `"alta"`, `"queda"` ou `"estavel"`, conforme a variação das despesas do último período.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.dashboard;

import java.util.List;
import java.util.Map;

public class RespostaCompararPeriodos
{
    public static final String TIPO = "RespostaCompararPeriodos";

    private List<Map<String,Object>> periodos;
    private String tendenciaDespesas;

    public RespostaCompararPeriodos (List<Map<String,Object>> periodos, String tendenciaDespesas)
    {
        this.periodos = periodos;
        this.tendenciaDespesas = tendenciaDespesas;
    }

    public List<Map<String,Object>> getPeriodos ()
    {
        return this.periodos;
    }

    public String getTendenciaDespesas ()
    {
        return this.tendenciaDespesas;
    }
}
```
