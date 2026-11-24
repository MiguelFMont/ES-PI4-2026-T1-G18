# RespostaCalcularParcelamentos.java — Resposta do cálculo de parcelamentos

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaCalcularParcelamentos"`). Par: `PedidoCalcularParcelamentos`.
- `parcelamentos`: um item por parcelamento recebido, na mesma ordem, com os campos originais mais `valorParcela`, `totalPago`, `totalJuros`, `parcelasRestantes` e `saldoDevedor` (valores em reais, arredondados em 2 casas; cálculo pela Tabela Price).
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.investments;

import java.util.List;
import java.util.Map;

public class RespostaCalcularParcelamentos
{
    public static final String TIPO = "RespostaCalcularParcelamentos";

    private List<Map<String,Object>> parcelamentos;

    public RespostaCalcularParcelamentos (List<Map<String,Object>> parcelamentos)
    {
        this.parcelamentos = parcelamentos;
    }

    public List<Map<String,Object>> getParcelamentos ()
    {
        return this.parcelamentos;
    }
}
```
