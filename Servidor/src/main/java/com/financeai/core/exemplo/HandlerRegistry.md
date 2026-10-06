# HandlerRegistry.java — Registro tipo-de-mensagem -> handler

## O que deve ter neste arquivo
- Um mapa de `tipo` (String) para `Handler`. É o que substitui o `if/else instanceof` da `SupervisoraDeConexao` do professor.
- `registrar(tipo, handler)` recusa tipos duplicados (`IllegalStateException`), para dois grupos não registrarem o mesmo nome sem perceber.
- `criarPadrao()` monta o registro com os handlers de todos os grupos. **Esse é o único ponto compartilhado**: cada grupo adiciona uma linha aqui (`new XxxHandler().registrarEm(registry)`) e mexe só na própria pasta.
- O registro é preenchido uma vez, antes de qualquer conexão ser aceita; depois só é lido pelas threads, então não precisa de sincronização.

## Exemplo de implementação

```java
package com.financeai.core;

import java.util.HashMap;
import java.util.Map;

import com.financeai.auth.AuthHandler;
import com.financeai.dashboard.DashboardHandler;
import com.financeai.goals.GoalsHandler;
import com.financeai.investments.InvestmentsHandler;
import com.financeai.mentoria.MentorHandler;
import com.financeai.transactions.TransactionsHandler;

public class HandlerRegistry
{
    private final Map<String, Handler> handlers = new HashMap<>();

    public void registrar (String tipo, Handler handler)
    {
        if (this.handlers.containsKey(tipo))
            throw new IllegalStateException ("Ja existe handler para o tipo " + tipo);
        this.handlers.put (tipo, handler);
    }

    public Handler obter (String tipo)
    {
        return this.handlers.get (tipo);
    }

    public static HandlerRegistry criarPadrao ()
    {
        HandlerRegistry registry = new HandlerRegistry();

        new AuthHandler()         .registrarEm (registry);   // Grupo 1
        new TransactionsHandler() .registrarEm (registry);   // Grupo 2
        new DashboardHandler()    .registrarEm (registry);   // Grupo 3
        new MentorHandler()       .registrarEm (registry);   // Grupo 4
        new GoalsHandler()        .registrarEm (registry);   // Grupo 5
        new InvestmentsHandler()  .registrarEm (registry);   // Grupo 5

        return registry;
    }
}
```
