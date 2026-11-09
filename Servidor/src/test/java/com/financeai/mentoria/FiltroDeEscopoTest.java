package com.financeai.mentoria;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

// Regra do Grupo 4: o Mentor so fala de financas pessoais e nunca devolve codigo.
class FiltroDeEscopoTest
{
    private static final String AVISO = FiltroDeEscopo.AVISO;

    @ParameterizedTest
    @ValueSource (strings = {
        "FORA_DO_ESCOPO",
        "  FORA_DO_ESCOPO\n",
        "**FORA_DO_ESCOPO**",
        "[FORA_DO_ESCOPO]",
        "Desculpe. FORA_DO_ESCOPO",
    })
    void marcadorViraARecusaPadrao (String resposta)
    {
        assertEquals (AVISO, FiltroDeEscopo.filtrar (resposta));
    }

    @ParameterizedTest
    @ValueSource (strings = {
        // o caso que motivou o filtro: a IA aceitou escrever a funcao
        "Claro! Aqui está:\n```python\ndef soma(a, b):\n    return a + b\n```",
        "Segue a função:\n\ndef soma(a: int, b: int) -> int:\n    return a + b",
        "function soma(a, b) {\n  return a + b;\n}",
        "const soma = (a, b) => a + b;",
        "public static int soma (int a, int b)\n{\n    return a + b;\n}",
        "int soma(int a, int b) { return a + b; }",
        "Use isto: console.log(1 + 1)",
        "System.out.println(a + b);",
        "print(a + b)",
        "#include <stdio.h>",
        "import java.util.List;",
        "from math import sqrt",
        "~~~\nqualquer coisa\n~~~",
    })
    void respostaComCodigoViraARecusaPadrao (String resposta)
    {
        assertEquals (AVISO, FiltroDeEscopo.filtrar (resposta));
    }

    @ParameterizedTest
    @ValueSource (strings = {
        "Sua maior despesa foi **Moradia**, com R$ 1.400,00 (48,2% do total).",
        "Para montar um orçamento:\n- Moradia: até 30% da renda;\n- Alimentação: R$ 600,00;\n- Lazer: o que sobrar.",
        "Uma reserva de emergência (de 3 a 6 meses de gastos) protege você de imprevistos.",
        "A função da reserva é cobrir imprevistos; o retorno vem depois.",
        "Juros compostos: o rendimento de um mês passa a render no mês seguinte.",
        "Classe de ativos é um grupo de investimentos parecidos, como renda fixa e renda variável.",
        "Importante: a fatura vence dia 10 (R$ 434,70).",
        "Você pode tirar um print (captura da tela) do extrato para conferir.",
        "Não posso recomendar a compra de ativos específicos.",
    })
    void respostaDeFinancasPassaSemMudanca (String resposta)
    {
        assertEquals (resposta, FiltroDeEscopo.filtrar (resposta));
    }

    @Test
    void respostaNulaOuVaziaPassaParaOFiltroDeAtivos ()
    {
        assertNull (FiltroDeEscopo.filtrar (null));
        assertEquals ("", FiltroDeEscopo.filtrar (""));
    }
}
