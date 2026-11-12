package com.financeai.mentoria;

import java.util.regex.Pattern;

// Regra do Grupo 4: o Mentor so fala de financas pessoais. O prompt pede a IA que responda
// so o MARCADOR quando o pedido foge do assunto (ex.: "faca uma funcao que soma dois inteiros"),
// mas o modelo pode desobedecer: por isso, alem do marcador, qualquer codigo de programacao na
// resposta tambem a troca inteira pela recusa padrao (uma resposta de financas nunca tem codigo).
public class FiltroDeEscopo
{
    // combinado com o Backend (genai.client.ts, MARCADOR_FORA_DO_ESCOPO)
    public static final String MARCADOR = "FORA_DO_ESCOPO";

    public static final String AVISO =
        "Sou o Mentor Financeiro do FinanceAI e só posso ajudar com finanças pessoais: "
      + "seus gastos e receitas, orçamento, dívidas, cartão de crédito, reserva de emergência "
      + "e conceitos de investimento. Quer conversar sobre algum desses temas?";

    // bloco de codigo do markdown
    private static final Pattern BLOCO_DE_CODIGO = Pattern.compile ("```|~~~");

    // Linhas com cara de codigo. As palavras-chave sao em ingles e precisam vir no inicio da linha
    // seguidas de sintaxe de codigo, para nao confundir com texto em portugues.
    private static final Pattern LINHA_DE_CODIGO = Pattern.compile (
        "(?m)^\\s*(?:"
      + "(?:def|function|func|fn|class|interface|struct|public|private|protected|static|void"
      + "|const|let|var|int|long|double|float|bool|boolean|String)\\s+\\w+.*[({=:;]"
      + "|(?:import|package|using)\\s+[\\w.{}*, ]+;?\\s*$"
      + "|from\\s+[\\w.]+\\s+import\\s"
      + "|#include\\s*<"
      + "|return\\s+[^\\s].*"
      + ")");

    // chamadas e operadores tipicos de codigo em qualquer lugar do texto
    private static final Pattern TRECHO_DE_CODIGO = Pattern.compile (
        "console\\.log\\s*\\(|System\\.out\\.|\\bprintf?\\(|\\bprintln\\(|\\)\\s*=>|\\)\\s*\\{\\s*$",
        Pattern.MULTILINE);

    public static String filtrar (String resposta)
    {
        if (resposta == null || resposta.isBlank())
            return resposta;

        return foraDoEscopo (resposta) ? AVISO : resposta;
    }

    static boolean foraDoEscopo (String resposta)
    {
        return resposta.contains (MARCADOR)
            || BLOCO_DE_CODIGO.matcher(resposta).find()
            || LINHA_DE_CODIGO.matcher(resposta).find()
            || TRECHO_DE_CODIGO.matcher(resposta).find();
    }
}
