/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
package com.financeai.goals;

// Pedido de calculo do progresso de uma meta (Grupo 5). O Backend envia o valor acumulado, o objetivo e o prazo;
// o Servidor devolve o percentual, o que falta e quanto guardar por mes. Os nomes dos campos sao os do JSON trocado
// com o Backend: mudar um nome aqui e mudar o contrato.
public class PedidoProgressoMeta
{
    public static final String TIPO = "PedidoProgressoMeta";

    private double valorAtual;
    private double valorObjetivo;
    private String prazo;   // ISO-8601 (instante ou so a data, como "2026-12-31")
    private String hoje;    // opcional: o dia de referencia (so os testes usam); sem ele vale o relogio do Servidor

    public PedidoProgressoMeta ()
    {}

    public PedidoProgressoMeta (double valorAtual, double valorObjetivo, String prazo, String hoje)
    {
        this.valorAtual    = valorAtual;
        this.valorObjetivo = valorObjetivo;
        this.prazo         = prazo;
        this.hoje          = hoje;
    }

    public double getValorAtual ()
    {
        return this.valorAtual;
    }

    public double getValorObjetivo ()
    {
        return this.valorObjetivo;
    }

    public String getPrazo ()
    {
        return this.prazo;
    }

    public String getHoje ()
    {
        return this.hoje;
    }

    public String toString ()
    {
        return (PedidoProgressoMeta.TIPO + ": atual=" + this.valorAtual + ", objetivo=" + this.valorObjetivo + ", prazo=" + this.prazo);
    }
}
