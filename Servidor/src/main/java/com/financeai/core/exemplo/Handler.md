# Handler.java — Contrato de um tratador de pedido

## O que deve ter neste arquivo
- Uma interface com um único método: recebe o `Comunicado` do pedido e devolve o `Comunicado` da resposta. Lançar exceção significa "falhou": a `Supervisora` converte em uma resposta `Erro`.
- Por ser uma interface funcional, cada grupo registra seus tratadores com referência de método (`this::hashSenha`), sem criar uma classe por pedido.
- Handlers não conhecem sockets nem threads: são só "pedido entra, resposta sai". Isso os torna fáceis de testar.

## Exemplo de implementação

```java
package com.financeai.core;

@FunctionalInterface
public interface Handler
{
    Comunicado tratar (Comunicado pedido) throws Exception;
}
```
