package com.financeai.transactions;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;

// Sugere a categoria de uma transacao pela descricao (PedidoCategorizarTransacao).
// Operacao pura: so usa os dados do pedido (o Servidor nao acessa o banco).
public class TransactionsHandler
{
    private static final String CATEGORIA_PADRAO = "Outros";

    // Palavras que nao ajudam a descobrir o que foi comprado. Saem da descricao ANTES da comparacao, e as palavras-chave
    // abaixo ja estao escritas sem elas (ex.: "posto saude", nao "posto de saude"). Se esta lista mudar, as
    // palavras-chave precisam ser refeitas com a mesma lista (ver plano-migracao/palavras-chave-categorias.md).
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
          "casas bahia", "americanas", "amazon compras" },
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
          "leroy merlin", "telhanorte", "tok stok", "diarista", "faxina", "dedetizacao", "seguro residencial" },
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
    }

    private Comunicado categorizar (Comunicado pedido) throws Exception
    {
        PedidoCategorizarTransacao p = pedido.dadosComo (PedidoCategorizarTransacao.class);

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
