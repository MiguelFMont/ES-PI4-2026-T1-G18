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
        "Indicamos MXRF11 para a sua carteira.",
        "Compre agora, PETR4 vai subir.",                    // verbo e ativo em oracoes diferentes
    })
    void detectaRecomendacaoDeAtivo (String frase)
    {
        assertTrue (FiltroDeAtivos.recomendaAtivo (frase), frase);
    }

    @ParameterizedTest
    @ValueSource (strings = {
        "Compre petr4 agora.",
        "Compre Petr4 agora.",
        "Aporte em mxrf11 todo mês.",
        "Mantenha petr4f na carteira.",
        "Venda itub4.",
    })
    void detectaTickerEmMinusculasOuMisturado (String frase)
    {
        assertTrue (FiltroDeAtivos.recomendaAtivo (frase), frase);
    }

    @Test
    void tickerEmMinusculasTambemESubstituidoPeloAviso ()
    {
        assertEquals (AVISO, FiltroDeAtivos.filtrar ("Compre petr4 agora."));
    }

    // termos com letras e digitos que nao tem a forma de ticker (4 letras + 1 ou 2 digitos)
    @ParameterizedTest
    @ValueSource (strings = {
        "Compre uma placa rtx4090 só se couber no orçamento.",
        "Durante a covid19, compre só o essencial.",
        "Invista no seu planejamento do ano2026.",
        "Compre um caderno a4 em vez de três.",
        "Compre músicas em mp3 em vez de assinar vários serviços.",
        "Compre o modelo 2026 só se couber no orçamento.",
        "Invista em você: separe abcd2026 da renda.",          // 4 letras + 4 digitos
    })
    void tickerEmMinusculasNaoConfundeOutrosTermos (String frase)
    {
        assertFalse (FiltroDeAtivos.recomendaAtivo (frase), frase);
    }

    // recusa direta ("nao recomendo X") passa sem ser removida
    @ParameterizedTest
    @ValueSource (strings = {
        "Não recomendo comprar PETR4.",
        "Nunca recomendo vender bitcoin.",
        "Não indico investir em ações da Petrobras.",
        "Não sugiro aportar em MXRF11.",
        "Não aconselho comprar ethereum.",
        "Jamais recomendamos comprar ITUB4.",
        "Não é recomendável comprar PETR4 com o dinheiro da reserva.",
        "Não consigo indicar se você deve comprar bitcoin, isso depende do seu perfil.",
    })
    void aceitaRecusaDireta (String frase)
    {
        assertFalse (FiltroDeAtivos.recomendaAtivo (frase), frase);
    }

    @Test
    void recusaDiretaPassaSemMudanca ()
    {
        String resposta = "Não recomendo comprar PETR4. Posso explicar como funciona a renda variável.";
        assertSame (resposta, FiltroDeAtivos.filtrar (resposta));
    }

    // a recusa so vale para o que vem depois dela na mesma oracao
    @ParameterizedTest
    @ValueSource (strings = {
        "Não recomendo vender, compre PETR4.",
        "Não recomendo vender PETR4; compre mais PETR4.",
        "Não recomendo outra coisa senão comprar PETR4.",
        "Não indico nada a não ser comprar bitcoin.",
        "Compre PETR4, não recomendo vender.",
        "Compre PETR4 que eu não recomendo vender.",
        "Não posso garantir nada, compre PETR4 que eu recomendo.",
        "Não vou mentir: invista em bitcoin.",
    })
    void recusaNaoCobreRecomendacaoEmOutraOracao (String frase)
    {
        assertTrue (FiltroDeAtivos.recomendaAtivo (frase), frase);
    }

    @ParameterizedTest
    @ValueSource (strings = {
        "BTC é uma boa compra.",
        "PETR4 é uma ótima oportunidade.",
        "Bitcoin é uma excelente aposta para este ano.",
    })
    void detectaElogioDeAtivoComoRecomendacao (String frase)
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
        "Bitcoin não é uma boa escolha para a reserva de emergência.",
        "Uma boa compra é aquela que cabe no orçamento.",    // elogio sem ativo
    })
    void naoConfundeComRecomendacao (String frase)
    {
        assertFalse (FiltroDeAtivos.recomendaAtivo (frase), frase);
    }
}
