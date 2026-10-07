# PedidoImportarTransacoes.java — Importação em lote (Pluggy)

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoImportarTransacoes"`). Par: `RespostaImportarTransacoes`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido; campo ausente chega como `null` (ou `0` nos tipos primitivos).

## Exemplo de implementação

```java
package com.financeai.transactions;

import java.util.List;
import java.util.Map;

public class PedidoImportarTransacoes
{
    public static final String TIPO = "PedidoImportarTransacoes";

    private String userId;
    private List<Map<String,Object>> transacoes;

    public String getUserId ()
    {
        return this.userId;
    }

    public List<Map<String,Object>> getTransacoes ()
    {
        return this.transacoes;
    }
}
```
