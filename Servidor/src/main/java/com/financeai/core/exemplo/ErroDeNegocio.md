# ErroDeNegocio.java — Falha de regra de negócio

## O que deve ter neste arquivo
- Uma exceção que os handlers lançam quando uma regra de negócio é violada: e-mail já cadastrado, credenciais inválidas, recurso não encontrado, dado inválido etc.
- Carrega um `code` estável e a mensagem, **sem status HTTP**. A `Supervisora` a converte em uma resposta `Erro` (`Comunicado.erro(code, message)`).
- Qualquer **outra** exceção (um bug, o banco fora do ar) não deve vazar detalhes: a `Supervisora` a registra no log do servidor e responde `500 INTERNAL_ERROR` genérico.
- Todo `code` novo precisa entrar na tabela `code → status` do Backend (`shared/errors/error-codes.ts`); sem isso o Backend responde `502`.

## Exemplo de implementação

```java
package com.financeai.core;

// Falha de regra de negocio: o handler lanca esta excecao e a Supervisora a
// converte em uma resposta "Erro" com code e message. O status HTTP nao e daqui:
// o Backend traduz o code em status (ex.: EMAIL_IN_USE -> 409, INVALID_CREDENTIALS -> 401).
// Todo code novo precisa entrar na tabela do Backend (shared/errors/error-codes.ts).
public class ErroDeNegocio extends Exception
{
    private static final long serialVersionUID = 1L;

    private final String code;

    public ErroDeNegocio (String code, String mensagem)
    {
        super (mensagem);
        this.code   = code;
    }

    public String getCode ()
    {
        return this.code;
    }
}
```

## Exemplo de uso em um handler

```java
if (usuarios.existeEmail(p.getEmail()))
    throw new ErroDeNegocio ("EMAIL_IN_USE", "E-mail ja cadastrado");
```
