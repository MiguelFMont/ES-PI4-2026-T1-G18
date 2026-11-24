/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
package com.financeai.transactions;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;

// Teste INTRACLASSE de TransactionsHandler (categoriza uma transacao pela descricao).
// Particionamento 1: CATEGORIAS DE METODOS (registrarEm, categorizar via registry, categoriaDe, normalizacao).
// Particionamento 2: ATRIBUTOS (a descricao do pedido): classes de equivalencia da entrada.
class TransactionsHandlerTest
{
    private HandlerRegistry registry;

    @BeforeEach
    void registrar ()
    {
        this.registry = new HandlerRegistry();
        new TransactionsHandler().registrarEm (this.registry);
    }

    private String categoriaPeloRegistry (String dadosJson) throws Exception
    {
        Comunicado resposta = this.registry.obter (PedidoCategorizarTransacao.TIPO)
            .tratar (Comunicado.lerJson ("{\"tipo\":\"PedidoCategorizarTransacao\",\"dados\":" + dadosJson + "}"));
        assertEquals (RespostaCategorizarTransacao.TIPO, resposta.getTipo());
        return resposta.getDados().getAsJsonObject().get ("categoria").getAsString();
    }

    // ---------------- Particionamento 1: categorias de metodos ----------------

    @Test
    void registrarEmRegistraOTipoDoPedido ()
    {
        assertNotNull (this.registry.obter (PedidoCategorizarTransacao.TIPO));
    }

    @Test
    void registrarDuasVezesOMesmoHandlerFalha ()
    {
        assertThrows (IllegalStateException.class, () -> new TransactionsHandler().registrarEm (this.registry));
    }

    @Test
    void categorizarPeloRegistryDevolveCategoriaDaDescricao () throws Exception
    {
        assertEquals ("Transporte", categoriaPeloRegistry ("{\"descricao\":\"UBER *TRIP\",\"valor\":23.9}"));
    }

    @Test
    void categoriaDeIgnoraAcentoCaixaENumeros ()
    {
        assertEquals ("Alimentacao", TransactionsHandler.categoriaDe ("PADARIA São José 123"));
        assertEquals ("Educacao", TransactionsHandler.categoriaDe ("Mensalidade FACULDADE"));
    }

    @Test
    void categoriaDeIgnoraPalavrasDeRuido ()
    {
        // "compra no debito" sao ruido: sobra so "farmacia"
        assertEquals ("Saude", TransactionsHandler.categoriaDe ("Compra no debito FARMACIA"));
    }

    // ---------------- Particionamento 2: atributos (descricao) ----------------

    @Test
    void descricaoComPalavraChaveConhecidaUsaACategoriaDela ()
    {
        assertEquals ("Moradia", TransactionsHandler.categoriaDe ("aluguel"));
        assertEquals ("Lazer", TransactionsHandler.categoriaDe ("Netflix"));
        assertEquals ("Salario", TransactionsHandler.categoriaDe ("salario novembro"));
    }

    @Test
    void descricaoSemPalavraChaveVaiParaOutros ()
    {
        assertEquals ("Outros", TransactionsHandler.categoriaDe ("xyzzy qwerty"));
    }

    @Test
    void descricaoSoComNumerosOuSimbolosVaiParaOutros ()
    {
        assertEquals ("Outros", TransactionsHandler.categoriaDe ("12345 !!! ###"));
    }

    @Test
    void descricaoSoComRuidoVaiParaOutros ()
    {
        assertEquals ("Outros", TransactionsHandler.categoriaDe ("compra no debito"));
    }

    @Test
    void palavraChaveDentroDeOutraPalavraNaoCasa ()
    {
        // "uber" nao casa dentro de "uberaba"
        assertEquals ("Outros", TransactionsHandler.categoriaDe ("Uberaba"));
        assertEquals ("Transporte", TransactionsHandler.categoriaDe ("gasolina"));
    }

    @Test
    void variacaoNoPluralNaoCasaComAPalavraChave ()
    {
        // limitacao conhecida: a comparacao e por palavra inteira, entao "farmacias" nao casa com "farmacia"
        assertEquals ("Saude", TransactionsHandler.categoriaDe ("farmacia"));
        assertEquals ("Outros", TransactionsHandler.categoriaDe ("farmacias"));
    }

    @Test
    void excecaoVemAntesDaRegraGeral ()
    {
        // "uber eats" e comida, apesar de "uber" ser transporte; "mercado livre" nao e supermercado
        assertEquals ("Alimentacao", TransactionsHandler.categoriaDe ("UBER EATS"));
        assertEquals ("Outros", TransactionsHandler.categoriaDe ("Mercado Livre"));
    }

    @Test
    void descricaoAusenteOuEmBrancoELancaErroDeValidacao ()
    {
        for (String dados : new String[] { "{}", "{\"descricao\":null}", "{\"descricao\":\"\"}", "{\"descricao\":\"   \"}" })
        {
            ErroDeNegocio erro = assertThrows (ErroDeNegocio.class, () -> categoriaPeloRegistry (dados));
            assertEquals ("VALIDATION", erro.getCode());
        }
    }

    @Test
    void valorDoPedidoNaoInfluenciaACategoria () throws Exception
    {
        assertEquals (categoriaPeloRegistry ("{\"descricao\":\"Netflix\",\"valor\":1}"),
                      categoriaPeloRegistry ("{\"descricao\":\"Netflix\",\"valor\":99999}"));
    }
}
