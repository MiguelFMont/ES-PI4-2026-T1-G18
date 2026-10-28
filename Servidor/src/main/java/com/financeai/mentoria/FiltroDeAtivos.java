package com.financeai.mentoria;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

// Regra do Grupo 4: o Mentor nunca recomenda comprar/vender um ativo especifico.
// Analisa a resposta da IA frase a frase e remove so as frases que recomendam um ativo;
// uma recusa explicita ("nao posso recomendar PETR4") passa.
public class FiltroDeAtivos
{
    public static final String AVISO =
        "Não posso recomendar a compra ou a venda de ativos específicos. "
      + "Posso ajudar você a entender seus gastos, seu orçamento e os conceitos de investimento.";

    // Abaixo disso, o que sobrou depois de remover frases nao vale como resposta.
    private static final int MINIMO_CARACTERES = 40;

    // codigo de acao/FII/BDR da B3 (PETR4, MXRF11, PETR4F); procurado no texto original,
    // em maiusculas, para nao confundir com palavras comuns
    private static final Pattern TICKER = Pattern.compile ("\\b[A-Z]{4}\\d{1,2}F?\\b");

    // nomes procurados no texto sem acento e em minusculas. Ficam de fora nomes ambiguos
    // (ex.: "vale", de "vale a pena"). A lista pode crescer.
    private static final Pattern NOME_DE_ATIVO = Pattern.compile (
        "\\b(bitcoin|btc|ethereum|eth|solana|cardano|dogecoin|xrp|ripple|litecoin|tether|usdt|bnb"
      + "|petrobras|itau|bradesco|ambev|nubank|magazine luiza|weg|eletrobras"
      + "|apple|tesla|nvidia|microsoft|amazon)\\b");

    private static final Pattern RECOMENDACAO = Pattern.compile (
        "\\b(compr(e|ar|em|ando|aria)|vend(a|er|am|endo|eria)|aport(e|ar|em)|invist(a|am)|investir"
      + "|apliqu(e|em)|aplicar|adquir(a|ir)|recomend(o|amos|aria)|sugir(o)|sugerimos"
      + "|aconselh(o|amos)|indico|segur(e|ar)|mantenha|zere|realize)\\b");

    // "nao posso recomendar", "nao vou indicar", "nunca consigo sugerir"...
    private static final Pattern RECUSA = Pattern.compile (
        "\\b(nao|nunca)\\s+(posso|consigo|devo|vou|irei|podemos|fazemos|faco)\\b.*?"
      + "\\b(recomend|indic|suger|sugest|aconselh)\\w*");

    // uma recusa seguida de "mas compre X" nao salva a frase: cada trecho e avaliado
    private static final Pattern CONJUNCAO_ADVERSATIVA = Pattern.compile (
        "\\b(mas|porem|entretanto|contudo|no entanto|todavia)\\b", Pattern.CASE_INSENSITIVE);

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
        // cada trecho entre conjuncoes adversativas e julgado separado
        for (String trecho : CONJUNCAO_ADVERSATIVA.split (semAcento (frase)))
        {
            String minusculo = trecho.toLowerCase();

            boolean temAtivo = TICKER.matcher(trecho).find()   // TICKER precisa das maiusculas
                            || NOME_DE_ATIVO.matcher(minusculo).find();

            if (temAtivo
             && RECOMENDACAO.matcher(minusculo).find()
             && !RECUSA.matcher(minusculo).find())
                return true;
        }
        return false;
    }

    // "Não" e "Nao" contam igual; maiusculas ficam (o TICKER depende delas)
    private static String semAcento (String texto)
    {
        return Normalizer.normalize (texto, Normalizer.Form.NFD).replaceAll ("\\p{M}", "");
    }
}
