# Palavras-chave de categorização (sugestão inicial)

Lista usada pelo `TransactionsHandler` do Servidor Java (`Servidor/src/main/java/com/financeai/transactions/`) para o `PedidoCategorizarTransacao` (Sprint 2, issue #34). Foi gerada por IA e o handler tem uma cópia dela (o array `REGRAS`): **ao mudar uma, mude a outra**. É um **ponto de partida**: foi validada só com descrições inventadas, e deve ser revisada com as descrições reais que vierem do sandbox da Pluggy.

Categorias válidas (contrato, seção 2.3): `Alimentacao`, `Transporte`, `Moradia`, `Saude`, `Lazer`, `Educacao`, `Salario`, `Outros`. Sem nenhuma palavra encontrada, a categoria é `Outros`.

## Como usar

1. **Normalize a descrição antes de comparar:** minúsculas, sem acentos, sem números e símbolos, e sem as palavras que não ajudam a identificar o que foi comprado (a lista completa está no item 4).
2. **Compare por palavra ou frase inteira**, não por pedaço de texto (`gas` não pode casar dentro de `gasolina`): coloque espaços nas pontas do texto e da palavra.
3. **A ordem decide:** percorra os grupos na ordem deste documento e fique com a primeira categoria que casar. As exceções vêm antes das categorias comuns.
4. As palavras **já passaram pela mesma limpeza da descrição**: sem acento, sem números e sem as palavras descartadas (`de`, `do`, `da`, `no`, `na`, `compra`, `debito`, `credito`, `pix`, `enviado`, `recebido`, `transf`, `ted`, `doc`, `br`, `com`, `pedido`, `ltda`, `av`, `sao`, `paulo`, `help`). Por isso "posto de saude" aparece como `posto saude`. **Se você mudar a lista de palavras descartadas, regenere as palavras-chave com a mesma lista**, senão frases como essa deixam de casar. Não há palavra com dígito (`99`), porque os números são retirados.
5. As **regras do usuário** (feature futura) devem ser testadas **antes** destas.

## Exceções (vêm primeiro: palavras que enganam)

Mesma palavra, categoria diferente. Se estas não vierem antes, 'uber' vira transporte e 'mercado livre' vira supermercado.

**Alimentacao** (4): `uber eats`, `ifood`, `rappi`, `aiqfome`

**Saude** (3): `posto saude`, `mensalidade academia`, `plano saude`

**Outros** (12): `mercado livre`, `mercado pago`, `mercadopago`, `shopee`, `shein`, `aliexpress`, `magazine luiza`, `casas bahia`, `americanas`, `amazon compras`, `fatura cartao`, `pagamento fatura`

**Lazer** (6): `amazon prime`, `prime video`, `disney plus`, `hbo max`, `youtube premium`, `apple tv`

## Categorias

Depois das exceções, vale a primeira categoria que tiver uma das palavras.

**Salario** (11): `salario`, `pagamento salario`, `folha pagamento`, `folha pgto`, `adiantamento salarial`, `decimo terceiro`, `ferias`, `rescisao`, `pro labore`, `comissao`, `bonus`

**Alimentacao** (38): `supermercado`, `hipermercado`, `mercado`, `atacadao`, `assai`, `carrefour`, `makro`, `atacarejo`, `hortifruti`, `sacolao`, `acougue`, `padaria`, `panificadora`, `confeitaria`, `cafeteria`, `starbucks`, `restaurante`, `lanchonete`, `pizzaria`, `hamburgueria`, `churrascaria`, `sorveteria`, `doceria`, `marmita`, `lanche`, `mcdonalds`, `burger king`, `bobs`, `subway`, `habibs`, `giraffas`, `outback`, `spoleto`, `madero`, `kfc`, `popeyes`, `dominos`, `pizza hut`

**Transporte** (39): `uber`, `cabify`, `indriver`, `taxi`, `onibus`, `metro`, `cptm`, `sptrans`, `bilhete unico`, `rodoviaria`, `passagem`, `posto`, `combustivel`, `gasolina`, `etanol`, `diesel`, `ipiranga`, `shell`, `petrobras`, `estacionamento`, `zona azul`, `estapar`, `pedagio`, `sem parar`, `conectcar`, `veloe`, `localiza`, `movida`, `unidas`, `oficina`, `mecanica`, `borracharia`, `lava jato`, `detran`, `ipva`, `licenciamento`, `latam`, `gol linhas`, `azul linhas`

**Moradia** (38): `aluguel`, `condominio`, `iptu`, `agua`, `sabesp`, `copasa`, `sanepar`, `cedae`, `energia`, `luz`, `enel`, `cpfl`, `cemig`, `equatorial`, `neoenergia`, `celesc`, `copel`, `gas`, `comgas`, `naturgy`, `ultragaz`, `liquigas`, `internet`, `fibra`, `vivo fibra`, `claro net`, `oi fibra`, `tim live`, `leroy merlin`, `telhanorte`, `tok stok`, `diarista`, `faxina`, `dedetizacao`, `seguro residencial`, `eletrobras`, `light sa`, `vivo`

**Saude** (43): `farmacia`, `drogaria`, `drogasil`, `droga raia`, `raia`, `pacheco`, `pague menos`, `panvel`, `ultrafarma`, `nissei`, `venancio`, `onofre`, `hospital`, `clinica`, `consulta`, `medico`, `dentista`, `odontologia`, `laboratorio`, `exame`, `fleury`, `dasa`, `delboni`, `sabin`, `unimed`, `amil`, `bradesco saude`, `sulamerica`, `hapvida`, `notredame`, `intermedica`, `prevent senior`, `psicologo`, `terapia`, `fisioterapia`, `academia`, `smart fit`, `bluefit`, `bodytech`, `selfit`, `pilates`, `otica`, `oculos`

**Lazer** (36): `netflix`, `spotify`, `disney`, `globoplay`, `paramount`, `deezer`, `tidal`, `steam`, `playstation`, `psn`, `xbox`, `nintendo`, `epic games`, `riot games`, `cinema`, `cinemark`, `kinoplex`, `ingresso`, `sympla`, `eventim`, `teatro`, `show`, `parque`, `hopi hari`, `beto carrero`, `hotel`, `airbnb`, `booking`, `decolar`, `cvc`, `pousada`, `hostel`, `balada`, `clube`, `boliche`, `streaming`

**Educacao** (31): `escola`, `colegio`, `faculdade`, `universidade`, `mensalidade`, `matricula`, `curso`, `cursinho`, `idiomas`, `wizard`, `fisk`, `ccaa`, `cultura inglesa`, `yazigi`, `udemy`, `coursera`, `alura`, `rocketseat`, `duolingo`, `hotmart`, `kumon`, `livro`, `saraiva`, `material escolar`, `anhanguera`, `estacio`, `unip`, `uninove`, `ead`, `vestibular`, `enem`

## Pontos de atenção (palavras que podem enganar)

| Palavra | Risco | O que fazer |
|---|---|---|
| `mercado` | Casa com "mercado livre" e "mercado pago" | As exceções vêm antes (já estão no primeiro grupo) |
| `uber` | "uber eats" é comida | Exceção antes de `uber` |
| `posto` | "posto de saude" não é combustível | Exceção antes |
| `mensalidade` | Pode ser academia, escola ou plano | "mensalidade academia" é exceção; sem contexto vira Educacao |
| `luz`, `gas`, `agua`, `show`, `clube` | Palavras comuns, podem aparecer em nomes de lojas | Aceitável; revise com dados reais |
| `ferias`, `bonus` | Podem ser outras coisas | Só vale como receita (`type: CREDIT`); considere checar o tipo |
| `academia` | Saúde ou lazer | Escolhi Saude |
| `fatura cartao`, `pagamento fatura` | Pagar a fatura do cartão aparece na conta corrente e as compras já estão no cartão: contar os dois dobra o gasto | Forçadas para Outros; a importação da Pluggy também deve tratar isso como transferência |
| Compras online (Amazon, Shopee, Shein...) | Não dá para saber o que foi comprado | Forçadas para Outros |
| Companhias aéreas | Podem ser viagem de lazer | Coloquei em Transporte |

## O que está de fora de propósito
- **Transferências e Pix entre pessoas** (`transf enviada joao`): ficam em Outros, porque a descrição não diz o motivo.
- **Rendimentos, reembolsos e empréstimos:** ficam em Outros.
- **Pets, vestuário, presentes, assinaturas de telefone:** o contrato não tem categoria para isso. Se o grupo criar mais categorias, estas listas crescem.

## Versão em Java (para o handler)

Cada linha é um grupo `(categoria, palavras)`, na ordem de aplicação. Use `LinkedHashMap`/lista ordenada, nunca `HashMap`, porque a ordem importa. É só um esqueleto, adapte ao seu estilo.

```java
private static final String[][] REGRAS = {
    { "Alimentacao", "uber eats", "ifood", "rappi", "aiqfome" },
    { "Saude", "posto saude", "mensalidade academia", "plano saude" },
    { "Outros", "mercado livre", "mercado pago", "mercadopago", "shopee", "shein", "aliexpress", "magazine luiza", "casas bahia", "americanas", "amazon compras", "fatura cartao", "pagamento fatura" },
    { "Lazer", "amazon prime", "prime video", "disney plus", "hbo max", "youtube premium", "apple tv" },
    { "Salario", "salario", "pagamento salario", "folha pagamento", "folha pgto", "adiantamento salarial", "decimo terceiro", "ferias", "rescisao", "pro labore", "comissao", "bonus" },
    { "Alimentacao", "supermercado", "hipermercado", "mercado", "atacadao", "assai", "carrefour", "makro", "atacarejo", "hortifruti", "sacolao", "acougue", "padaria", "panificadora", "confeitaria", "cafeteria", "starbucks", "restaurante", "lanchonete", "pizzaria", "hamburgueria", "churrascaria", "sorveteria", "doceria", "marmita", "lanche", "mcdonalds", "burger king", "bobs", "subway", "habibs", "giraffas", "outback", "spoleto", "madero", "kfc", "popeyes", "dominos", "pizza hut" },
    { "Transporte", "uber", "cabify", "indriver", "taxi", "onibus", "metro", "cptm", "sptrans", "bilhete unico", "rodoviaria", "passagem", "posto", "combustivel", "gasolina", "etanol", "diesel", "ipiranga", "shell", "petrobras", "estacionamento", "zona azul", "estapar", "pedagio", "sem parar", "conectcar", "veloe", "localiza", "movida", "unidas", "oficina", "mecanica", "borracharia", "lava jato", "detran", "ipva", "licenciamento", "latam", "gol linhas", "azul linhas" },
    { "Moradia", "aluguel", "condominio", "iptu", "agua", "sabesp", "copasa", "sanepar", "cedae", "energia", "luz", "enel", "cpfl", "cemig", "equatorial", "neoenergia", "celesc", "copel", "gas", "comgas", "naturgy", "ultragaz", "liquigas", "internet", "fibra", "vivo fibra", "claro net", "oi fibra", "tim live", "leroy merlin", "telhanorte", "tok stok", "diarista", "faxina", "dedetizacao", "seguro residencial", "eletrobras", "light sa", "vivo" },
    { "Saude", "farmacia", "drogaria", "drogasil", "droga raia", "raia", "pacheco", "pague menos", "panvel", "ultrafarma", "nissei", "venancio", "onofre", "hospital", "clinica", "consulta", "medico", "dentista", "odontologia", "laboratorio", "exame", "fleury", "dasa", "delboni", "sabin", "unimed", "amil", "bradesco saude", "sulamerica", "hapvida", "notredame", "intermedica", "prevent senior", "psicologo", "terapia", "fisioterapia", "academia", "smart fit", "bluefit", "bodytech", "selfit", "pilates", "otica", "oculos" },
    { "Lazer", "netflix", "spotify", "disney", "globoplay", "paramount", "deezer", "tidal", "steam", "playstation", "psn", "xbox", "nintendo", "epic games", "riot games", "cinema", "cinemark", "kinoplex", "ingresso", "sympla", "eventim", "teatro", "show", "parque", "hopi hari", "beto carrero", "hotel", "airbnb", "booking", "decolar", "cvc", "pousada", "hostel", "balada", "clube", "boliche", "streaming" },
    { "Educacao", "escola", "colegio", "faculdade", "universidade", "mensalidade", "matricula", "curso", "cursinho", "idiomas", "wizard", "fisk", "ccaa", "cultura inglesa", "yazigi", "udemy", "coursera", "alura", "rocketseat", "duolingo", "hotmart", "kumon", "livro", "saraiva", "material escolar", "anhanguera", "estacio", "unip", "uninove", "ead", "vestibular", "enem" },
};
```
