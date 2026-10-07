# RespostaResumoPainel.java — Totais e indicadores do mês

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaResumoPainel"`). Par: `PedidoResumoPainel`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.dashboard;

public class RespostaResumoPainel
{
    public static final String TIPO = "RespostaResumoPainel";

    private double receitas;
    private double despesas;
    private double saldo;
    private double economia;
    private double fluxoDeCaixa;

    public RespostaResumoPainel (double receitas, double despesas, double saldo, double economia, double fluxoDeCaixa)
    {
        this.receitas = receitas;
        this.despesas = despesas;
        this.saldo = saldo;
        this.economia = economia;
        this.fluxoDeCaixa = fluxoDeCaixa;
    }

    public double getReceitas ()
    {
        return this.receitas;
    }

    public double getDespesas ()
    {
        return this.despesas;
    }

    public double getSaldo ()
    {
        return this.saldo;
    }

    public double getEconomia ()
    {
        return this.economia;
    }

    public double getFluxoDeCaixa ()
    {
        return this.fluxoDeCaixa;
    }
}
```
