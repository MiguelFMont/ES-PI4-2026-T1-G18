package com.financeai.mentoria;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Regra do Grupo 4: o Mentor nunca recomenda comprar/vender um ativo especifico.
// Analisa a resposta da IA frase a frase e remove so as frases que recomendam um ativo;
// uma recusa explicita ("nao posso recomendar PETR4", "nao recomendo comprar PETR4") passa.
//
// Limitacoes conhecidas (o filtro e uma rede de seguranca, nao um analisador de portugues):
// - ticker com espaco ou hifen ("PETR 4", "petr-4") nao e reconhecido; casaria "para 3",
//   "dias 15", "IPCA-15"...
// - a recusa cobre a oracao inteira depois dela: "nao recomendo vender e compre PETR4" passa.
// - recusa interrompida por virgula ("nao recomendo, por ser arriscado, comprar PETR4") e
//   removida a mais (lado seguro).
// - previsao sem verbo de recomendacao ("PETR4 vai subir") passa.
public class FiltroDeAtivos
{
    public static final String AVISO =
        "Não posso recomendar a compra ou a venda de ativos específicos. "
      + "Posso ajudar você a entender seus gastos, seu orçamento e os conceitos de investimento.";

    // Abaixo disso, o que sobrou depois de remover frases nao vale como resposta.
    private static final int MINIMO_CARACTERES = 40;

    // codigo de acao/FII/BDR da B3 (PETR4, MXRF11, PETR4F) em qualquer caixa ("petr4", "Petr4"),
    // procurado no texto em minusculas. Palavra comum nao tem digito, entao nao ha confusao.
    // Os \b exigem exatamente 4 letras e 1 ou 2 digitos: covid19, rtx4090, ano2026, mp3, a4 e
    // "abcd2026" ficam de fora. Falso positivo aceito: termos como "fase2" ou "html5" contam
    // como ticker, mas so pesam se a frase tambem recomendar (e ai o erro e remover a mais).
    private static final Pattern TICKER = Pattern.compile ("\\b[a-z]{4}\\d{1,2}f?\\b");

    // nomes procurados no texto sem acento e em minusculas. Ficam de fora nomes ambiguos
    // (ex.: "vale", de "vale a pena"). A lista pode crescer.
    private static final Pattern NOME_DE_ATIVO = Pattern.compile (
        "\\b(bitcoin|btc|ethereum|eth|solana|cardano|dogecoin|xrp|ripple|litecoin|tether|usdt|bnb"
      + "|petrobras|itau|bradesco|ambev|nubank|magazine luiza|weg|eletrobras"
      + "|apple|tesla|nvidia|microsoft|amazon)\\b");

    private static final Pattern RECOMENDACAO = Pattern.compile (
        "\\b(compr(e|ar|em|ando|aria)|vend(a|er|am|endo|eria)|aport(e|ar|em)|invist(a|am)|investir"
      + "|apliqu(e|em)|aplicar|adquir(a|ir)|recomend(o|amos|aria)|sugir(o)|sugerimos|sugeriria"
      + "|aconselh(o|amos|aria)|indic(o|amos)|segur(e|ar)|mantenha|zere|realize"
      + "|(boa|otima|excelente)\\s+(compra|oportunidade|aposta))\\b");

    // "nao posso recomendar", "nao vou indicar", "nunca consigo sugerir",
    // "nao recomendo", "jamais indicamos", "nao e recomendavel"...
    private static final Pattern RECUSA = Pattern.compile (
        "\\b(nao|nunca|jamais)\\s+("
      + "(posso|consigo|devo|vou|irei|podemos|fazemos|faco)\\b.*?\\b(recomend|indic|suger|sugest|aconselh)\\w*"
      + "|(recomendo|recomendamos|recomendaria|indico|indicamos|indicaria|sugiro|sugerimos|sugeriria"
      + "|aconselho|aconselhamos|aconselharia)\\b"
      + "|(e|seria)\\s+(recomendad|recomendavel|indicad|aconselhavel|aconselhad)\\w*)");

    // uma recusa seguida de "mas compre X" nao salva a frase: cada trecho e avaliado
    private static final Pattern CONJUNCAO_ADVERSATIVA = Pattern.compile (
        "\\b(mas|porem|entretanto|contudo|no entanto|todavia)\\b");

    // dentro do trecho, a recusa so cobre o que vem depois dela na mesma oracao:
    // "nao recomendo vender, compre PETR4" e "nao recomendo nada senao comprar PETR4" saem
    private static final Pattern SEPARADOR_DE_ORACAO = Pattern.compile (
        "[,;:]|\\b(senao|exceto|a nao ser|salvo)\\b");

    private static final Pattern FIM_DE_FRASE = Pattern.compile ("(?<=[.!?])\\s+");

    public static String filtrar (String resposta)
    {
        if (resposta == null || resposta.isBlank())
            return AVISO;

        boolean removeuAlguma = false;
        List<String> linhas = new ArrayList<String>();

        // por linha, para manter listas e paragrafos do markdown
        for (String linha : resposta.split ("\n", -1))
        {
            List<String> mantidas = new ArrayList<String>();
            for (String frase : FIM_DE_FRASE.split (linha))
            {
                if (recomendaAtivo (frase))
                    removeuAlguma = true;
                else
                    mantidas.add (frase);
            }

            // linha que era so frase removida some; linha em branco original fica
            if (mantidas.isEmpty() && !linha.isBlank())
                continue;
            linhas.add (String.join (" ", mantidas));
        }

        if (!removeuAlguma)
            return resposta;

        String restante = String.join ("\n", linhas).strip();
        if (restante.length() < MINIMO_CARACTERES)
            return AVISO;

        return restante + "\n\n" + AVISO;
    }

    static boolean recomendaAtivo (String frase)
    {
        String texto = semAcento (frase).toLowerCase();

        // cada trecho entre conjuncoes adversativas e julgado separado
        for (String trecho : CONJUNCAO_ADVERSATIVA.split (texto))
        {
            boolean temAtivo = TICKER.matcher(trecho).find()
                            || NOME_DE_ATIVO.matcher(trecho).find();

            if (temAtivo && temRecomendacaoForaDeRecusa (trecho))
                return true;
        }
        return false;
    }

    // o ativo pode estar em outra oracao do trecho ("compre agora, PETR4 vai subir"), mas a
    // recomendacao so e perdoada se vier depois de uma recusa na mesma oracao
    private static boolean temRecomendacaoForaDeRecusa (String trecho)
    {
        for (String oracao : SEPARADOR_DE_ORACAO.split (trecho))
        {
            Matcher recusa = RECUSA.matcher (oracao);
            int inicioDaRecusa = recusa.find() ? recusa.start() : Integer.MAX_VALUE;

            Matcher recomendacao = RECOMENDACAO.matcher (oracao);
            if (recomendacao.find() && recomendacao.start() < inicioDaRecusa)
                return true;
        }
        return false;
    }

    // "Não" e "Nao" contam igual
    private static String semAcento (String texto)
    {
        return Normalizer.normalize (texto, Normalizer.Form.NFD).replaceAll ("\\p{M}", "");
    }
}
