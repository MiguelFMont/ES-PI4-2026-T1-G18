# RespostaHistoricoChat.java — Mensagens do chat

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaHistoricoChat"`). Par: `PedidoHistoricoChat`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.mentoria;

import java.util.List;
import java.util.Map;

public class RespostaHistoricoChat
{
    public static final String TIPO = "RespostaHistoricoChat";

    private List<Map<String,Object>> mensagens;

    public RespostaHistoricoChat (List<Map<String,Object>> mensagens)
    {
        this.mensagens = mensagens;
    }

    public List<Map<String,Object>> getMensagens ()
    {
        return this.mensagens;
    }
}
```
