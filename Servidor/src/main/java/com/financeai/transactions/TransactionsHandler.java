/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
package com.financeai.transactions;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;
import com.google.gson.JsonParseException;

// Sugere a categoria de uma transacao pela descricao (PedidoCategorizarTransacao).
// Operacao pura: so usa os dados do pedido (o Servidor nao acessa o banco).
public class TransactionsHandler
{
    private static final String CATEGORIA_PADRAO = "Outros";

    // Palavras que nao ajudam a descobrir o que foi comprado. Saem da descricao ANTES da comparacao, e as palavras-chave
    // abaixo ja estao escritas sem elas (ex.: "posto saude", nao "posto de saude"). Se esta lista mudar, as
    // palavras-chave precisam ser refeitas com a mesma lista (ver docs/palavras-chave-categorias.md).
    private static final Set<String> RUIDO = Set.of (
        "compra", "no", "na", "de", "do", "da", "debito", "credito", "pix", "enviado", "enviada", "recebido",
        "transf", "ted", "doc", "br", "com", "pedido", "ltda", "av", "sao", "paulo", "help");

    // Cada linha e { categoria, palavra-chave, palavra-chave... }. A ORDEM E A PRIORIDADE: vale o primeiro grupo que casar.
    // Por isso as excecoes vem primeiro ("uber eats" e comida, "mercado livre" nao e supermercado).
    // Palavras sem acento, em minusculas e sem numeros; a comparacao e por palavra inteira.
    private static final String[][] REGRAS =
    {
        { "Alimentacao", "uber eats", "ifood", "rappi", "aiqfome" },
        { "Saude", "posto saude", "mensalidade academia", "plano saude" },
        { "Outros", "mercado livre", "mercado pago", "mercadopago", "shopee", "shein", "aliexpress", "magazine luiza",
          "casas bahia", "americanas", "amazon compras", "fatura cartao", "pagamento fatura" },
        { "Lazer", "amazon prime", "prime video", "disney plus", "hbo max", "youtube premium", "apple tv" },
        { "Salario", "salario", "pagamento salario", "folha pagamento", "folha pgto", "adiantamento salarial",
          "decimo terceiro", "ferias", "rescisao", "pro labore", "comissao", "bonus" },
        { "Alimentacao", "supermercado", "hipermercado", "mercado", "atacadao", "assai", "carrefour", "makro",
          "atacarejo", "hortifruti", "sacolao", "acougue", "padaria", "panificadora", "confeitaria", "cafeteria",
          "starbucks", "restaurante", "lanchonete", "pizzaria", "hamburgueria", "churrascaria", "sorveteria",
          "doceria", "marmita", "lanche", "mcdonalds", "burger king", "bobs", "subway", "habibs", "giraffas",
          "outback", "spoleto", "madero", "kfc", "popeyes", "dominos", "pizza hut" },
        { "Transporte", "uber", "cabify", "indriver", "taxi", "onibus", "metro", "cptm", "sptrans", "bilhete unico",
          "rodoviaria", "passagem", "posto", "combustivel", "gasolina", "etanol", "diesel", "ipiranga", "shell",
          "petrobras", "estacionamento", "zona azul", "estapar", "pedagio", "sem parar", "conectcar", "veloe",
          "localiza", "movida", "unidas", "oficina", "mecanica", "borracharia", "lava jato", "detran", "ipva",
          "licenciamento", "latam", "gol linhas", "azul linhas" },
        { "Moradia", "aluguel", "condominio", "iptu", "agua", "sabesp", "copasa", "sanepar", "cedae", "energia",
          "luz", "enel", "cpfl", "cemig", "equatorial", "neoenergia", "celesc", "copel", "gas", "comgas", "naturgy",
          "ultragaz", "liquigas", "internet", "fibra", "vivo fibra", "claro net", "oi fibra", "tim live",
          "leroy merlin", "telhanorte", "tok stok", "diarista", "faxina", "dedetizacao", "seguro residencial", "eletrobras", "light sa", "vivo" },
        { "Saude", "farmacia", "drogaria", "drogasil", "droga raia", "raia", "pacheco", "pague menos", "panvel",
          "ultrafarma", "nissei", "venancio", "onofre", "hospital", "clinica", "consulta", "medico", "dentista",
          "odontologia", "laboratorio", "exame", "fleury", "dasa", "delboni", "sabin", "unimed", "amil",
          "bradesco saude", "sulamerica", "hapvida", "notredame", "intermedica", "prevent senior", "psicologo",
          "terapia", "fisioterapia", "academia", "smart fit", "bluefit", "bodytech", "selfit", "pilates", "otica",
          "oculos" },
        { "Lazer", "netflix", "spotify", "disney", "globoplay", "paramount", "deezer", "tidal", "steam",
          "playstation", "psn", "xbox", "nintendo", "epic games", "riot games", "cinema", "cinemark", "kinoplex",
          "ingresso", "sympla", "eventim", "teatro", "show", "parque", "hopi hari", "beto carrero", "hotel", "airbnb",
          "booking", "decolar", "cvc", "pousada", "hostel", "balada", "clube", "boliche", "streaming" },
        { "Educacao", "escola", "colegio", "faculdade", "universidade", "mensalidade", "matricula", "curso",
          "cursinho", "idiomas", "wizard", "fisk", "ccaa", "cultura inglesa", "yazigi", "udemy", "coursera", "alura",
          "rocketseat", "duolingo", "hotmart", "kumon", "livro", "saraiva", "material escolar", "anhanguera",
          "estacio", "unip", "uninove", "ead", "vestibular", "enem" },
    };

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoCategorizarTransacao.TIPO, this::categorizar);
        registry.registrar (PedidoCalcularSaldoContas.TIPO,  this::calcularSaldoContas);
    }

    // saldo atual = saldo inicial + receitas - despesas - transferencias enviadas + transferencias recebidas (RN2 e RN6).
    // Movimentos de contas que nao vieram no pedido (ex.: uma conta Open Finance) sao ignorados.
    private Comunicado calcularSaldoContas (Comunicado pedido) throws Exception
    {
        PedidoCalcularSaldoContas p;
        try
        {
            p = pedido.dadosComo (PedidoCalcularSaldoContas.class);
        }
        catch (JsonParseException erro)
        {
            throw new ErroDeNegocio ("VALIDATION", "dados invalidos");
        }

        if (p == null || p.getContas() == null)
            throw new ErroDeNegocio ("VALIDATION", "contas e obrigatorio");

        Map < String, Double > saldos = new LinkedHashMap <> ();
        for (PedidoCalcularSaldoContas.Conta conta : p.getContas())
        {
            if (conta == null || conta.getId() == null || conta.getId().isBlank())
                throw new ErroDeNegocio ("VALIDATION", "toda conta precisa de id");
            if (Double.isNaN (conta.getSaldoInicial()) || Double.isInfinite (conta.getSaldoInicial()))
                throw new ErroDeNegocio ("VALIDATION", "saldoInicial invalido");
            saldos.put (conta.getId(), conta.getSaldoInicial());
        }

        List < PedidoCalcularSaldoContas.Movimento > movimentos = p.getMovimentos() == null
            ? new ArrayList <> () : p.getMovimentos();

        for (PedidoCalcularSaldoContas.Movimento m : movimentos)
        {
            if (m == null || m.getTipo() == null)
                throw new ErroDeNegocio ("VALIDATION", "todo movimento precisa de tipo");
            if (Double.isNaN (m.getValor()) || Double.isInfinite (m.getValor()) || m.getValor() <= 0)
                throw new ErroDeNegocio ("VALIDATION", "valor do movimento deve ser maior que zero");

            switch (m.getTipo())
            {
                case "receita":
                    somar (saldos, m.getContaId(), m.getValor());
                    break;
                case "despesa":
                    somar (saldos, m.getContaId(), -m.getValor());
                    break;
                case "transferencia":
                    if (m.getContaId() == null || m.getContaDestinoId() == null)
                        throw new ErroDeNegocio ("VALIDATION", "transferencia precisa de contaId e contaDestinoId");
                    somar (saldos, m.getContaId(), -m.getValor());
                    somar (saldos, m.getContaDestinoId(), m.getValor());
                    break;
                default:
                    throw new ErroDeNegocio ("VALIDATION", "tipo de movimento invalido: " + m.getTipo());
            }
        }

        List < RespostaCalcularSaldoContas.Saldo > resposta = new ArrayList <> ();
        for (Map.Entry < String, Double > e : saldos.entrySet())
            resposta.add (new RespostaCalcularSaldoContas.Saldo (e.getKey(), emReais (e.getValue())));

        return Comunicado.de (RespostaCalcularSaldoContas.TIPO, new RespostaCalcularSaldoContas (resposta));
    }

    private static void somar (Map < String, Double > saldos, String contaId, double valor)
    {
        if (contaId != null && saldos.containsKey (contaId))
            saldos.put (contaId, saldos.get (contaId) + valor);
    }

    // arredonda em 2 casas: a soma de decimais nao pode devolver 0.30000000000000004
    private static double emReais (double valor)
    {
        return Math.round (valor * 100.0) / 100.0;
    }

    private Comunicado categorizar (Comunicado pedido) throws Exception
    {
        PedidoCategorizarTransacao p;
        try
        {
            p = pedido.dadosComo (PedidoCategorizarTransacao.class);
        }
        catch (JsonParseException erro)   // "dados" fora do formato (ex.: um texto no lugar de um objeto)
        {
            throw new ErroDeNegocio ("VALIDATION", "dados invalidos");
        }


        if (p == null || p.getDescricao() == null || p.getDescricao().isBlank())
            throw new ErroDeNegocio ("VALIDATION", "descricao e obrigatoria");

        return Comunicado.de (RespostaCategorizarTransacao.TIPO,
                              new RespostaCategorizarTransacao (categoriaDe (p.getDescricao())));
    }

    static String categoriaDe (String descricao)
    {
        // espacos nas pontas: assim " gas " nao casa dentro de "gasolina" e "uber" nao casa dentro de "uberaba"
        String texto = " " + normalizar (descricao) + " ";

        for (String[] regra : REGRAS)
            for (int i = 1; i < regra.length; i++)
                if (texto.contains (" " + regra[i] + " "))
                    return regra[0];

        return CATEGORIA_PADRAO;
    }

    // minusculas, sem acentos, so letras e sem as palavras de RUIDO
    private static String normalizar (String texto)
    {
        String semAcento = Normalizer.normalize (texto, Normalizer.Form.NFD).replaceAll ("\\p{M}", "");
        String[] palavras = semAcento.toLowerCase (Locale.ROOT).replaceAll ("[^a-z]+", " ").trim().split (" ");

        StringBuilder limpo = new StringBuilder();
        for (String palavra : palavras)
            if (!palavra.isEmpty() && !RUIDO.contains (palavra))
                limpo.append (limpo.length() == 0 ? "" : " ").append (palavra);

        return limpo.toString();
    }
}
