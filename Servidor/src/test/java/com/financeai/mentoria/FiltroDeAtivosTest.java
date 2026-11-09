package com.financeai.mentoria;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

// Regra de seguranca do Grupo 4: o Mentor nunca recomenda um ativo especifico.
class FiltroDeAtivosTest
{
    private static final String AVISO = FiltroDeAtivos.AVISO;

    @Test
    void removeFraseQueRecomendaTickerEAcrescentaAviso ()
    {
        String resposta = "Você poupou 60% da renda neste mês, um ótimo resultado. "
                        + "Compre PETR4 agora. "
                        + "Continue registrando os seus gastos.";

        assertEquals ("Você poupou 60% da renda neste mês, um ótimo resultado. "
                    + "Continue registrando os seus gastos.\n\n" + AVISO,
                      FiltroDeAtivos.filtrar (resposta));
    }

    @Test
    void removeRecomendacaoDeCriptomoedaPeloNome ()
    {
        String resposta = "Sua reserva de emergência já cobre três meses de gastos. "
                        + "Agora invista em bitcoin para ganhar mais.";

        String filtrada = FiltroDeAtivos.filtrar (resposta);

        assertFalse (filtrada.toLowerCase().contains ("bitcoin"));
        assertEquals ("Sua reserva de emergência já cobre três meses de gastos.\n\n" + AVISO, filtrada);
    }

    @Test
    void respostaQueEraSoRecomendacaoViraSoOAviso ()
    {
        assertEquals (AVISO, FiltroDeAtivos.filtrar ("Compre PETR4 agora."));
        // o que sobra (menos de 40 caracteres) nao vale como resposta
        assertEquals (AVISO, FiltroDeAtivos.filtrar ("Ótimo. Compre PETR4 agora."));
    }

    @Test
    void mantemRecusaExplicita ()
    {
        String resposta = "Não posso recomendar PETR4. Posso explicar o que é uma ação e como funciona a bolsa.";
        assertSame (resposta, FiltroDeAtivos.filtrar (resposta));

        String comNunca = "Nunca vou sugerir que você compre bitcoin, mas posso explicar o que é volatilidade.";
        assertSame (comNunca, FiltroDeAtivos.filtrar (comNunca));
    }

    @Test
    void recusaSeguidaDeMasCompreNaoSalvaAFrase ()
    {
        String resposta = "Seu saldo do mês está positivo em R$ 2.700,00. "
                        + "Não posso recomendar, mas compre ITUB4 se sobrar dinheiro.";

        assertEquals ("Seu saldo do mês está positivo em R$ 2.700,00.\n\n" + AVISO,
                      FiltroDeAtivos.filtrar (resposta));
    }

    @Test
    void textoSemAtivoPassaSemMudanca ()
    {
        String resposta = "Sua maior despesa é **Moradia**, com R$ 1.400,00 (77,8% do total). "
                        + "Recomendo revisar os gastos com lazer e montar uma reserva de emergência.";

        assertSame (resposta, FiltroDeAtivos.filtrar (resposta));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource (strings = { "   ", "\n\n" })
    void respostaVaziaViraOAviso (String resposta)
    {
        assertEquals (AVISO, FiltroDeAtivos.filtrar (resposta));
    }

    @Test
    void preservaLinhasEListasDoMarkdown ()
    {
        String resposta = "**Resumo do mês**\n"
                        + "\n"
                        + "- Moradia: 77,8% das despesas\n"
                        + "- Compre PETR4 agora.\n"
                        + "- Lazer: 5,6% das despesas\n"
                        + "\n"
                        + "Continue registrando os seus gastos todos os dias.";

        assertEquals ("**Resumo do mês**\n"
                    + "\n"
                    + "- Moradia: 77,8% das despesas\n"
                    + "- Lazer: 5,6% das despesas\n"
                    + "\n"
                    + "Continue registrando os seus gastos todos os dias.\n\n" + AVISO,
                      FiltroDeAtivos.filtrar (resposta));
    }

    @Test
    void naMesmaLinhaSoAFraseComRecomendacaoSai ()
    {
        String resposta = "- Separe 10% da renda para a reserva. Aporte em MXRF11 todo mês. Revise as assinaturas.";

        assertEquals ("- Separe 10% da renda para a reserva. Revise as assinaturas.\n\n" + AVISO,
                      FiltroDeAtivos.filtrar (resposta));
    }

    // recomendaAtivo e package-private: o teste esta no mesmo pacote
    @ParameterizedTest
    @ValueSource (strings = {
        "Compre PETR4.",
        "Aporte em MXRF11 todo mês.",
        "Venda suas ações da Petrobras.",
        "Recomendo comprar ações do Itaú.",   // com acento
        "Invista em BTC.",
        "Aplique em ethereum.",
        "Mantenha PETR4F na carteira.",
        "Não posso recomendar, mas compre ITUB4.",
        "Nao posso recomendar, porem invista em bitcoin.",
    })
    void detectaRecomendacaoDeAtivo (String frase)
    {
        assertTrue (FiltroDeAtivos.recomendaAtivo (frase), frase);
    }

    @ParameterizedTest
    @ValueSource (strings = {
        "MXRF11 é um fundo imobiliário.",                    // ativo sem recomendacao
        "A Petrobras divulgou o resultado do trimestre.",
        "Compre menos por impulso no mercado.",              // recomendacao sem ativo
        "Vale a pena guardar 10% da renda.",
        "Não posso recomendar PETR4.",                       // recusa explicita
        "Não consigo indicar se você deve comprar bitcoin.",
        "Não posso recomendar PETR4, mas recomendo montar uma reserva.",
    })
    void naoConfundeComRecomendacao (String frase)
    {
        assertFalse (FiltroDeAtivos.recomendaAtivo (frase), frase);
    }
}
