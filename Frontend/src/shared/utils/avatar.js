// O "avatar" de uma opção das listas que sobem do rodapé das janelas (shared/components/seletor.js): um círculo (conta) ou um quadrado
// arredondado (cartão) na cor do banco, com as iniciais. Não há imagens de bancos no projeto, então a cor e a sigla fazem o papel do logo.

export const CORES_DOS_BANCOS = {
  nubank: { fundo: '#8a05be', texto: '#ffffff' },
  itau: { fundo: '#ec7000', texto: '#ffffff' },
  inter: { fundo: '#ff7a00', texto: '#ffffff' },
  bradesco: { fundo: '#cc092f', texto: '#ffffff' },
  santander: { fundo: '#ec0000', texto: '#ffffff' },
  bb: { fundo: '#fcdc00', texto: '#1b1b1b' },
  caixa: { fundo: '#005ca9', texto: '#ffffff' },
  c6: { fundo: '#242424', texto: '#ffffff' },
  btg: { fundo: '#001e62', texto: '#ffffff' },
};
export const COR_PADRAO_DO_BANCO = { fundo: '#4b4d4b', texto: '#ffffff' };

// Os bancos que têm o logo em Frontend/assets/bancos/<codigo>.svg (o do Santander ainda falta: entra na lista quando o arquivo for salvo; as marcas são dos bancos; os arquivos vêm do Wikimedia Commons e do Simple Icons,
// ver Frontend/assets/bancos/LEIAME.md). Se um arquivo não carregar, o avatar volta às iniciais na cor do banco.
const BANCOS_COM_LOGO = new Set(['bb', 'bradesco', 'itau', 'caixa', 'inter', 'c6', 'nubank', 'btg', 'santander']);

/** O endereço do logo de um banco (pelo código), ou null se o banco não tem logo (por exemplo "Outro"). */
export const logoDoBanco = (codigo) => (BANCOS_COM_LOGO.has(codigo) ? `/assets/bancos/${codigo}.svg` : null);

/**
 * Põe o logo de um banco dentro de um elemento (uma <img> que se encaixa sem cortar). Se a imagem não carregar, o elemento mostra `reserva`
 * (as iniciais). Devolve true se havia logo para o banco.
 */
export function mostrarLogoDoBanco(elemento, codigo, reserva) {
  const endereco = logoDoBanco(codigo);
  if (!endereco) return false;
  const imagem = document.createElement('img');
  imagem.src = endereco;
  imagem.alt = '';
  imagem.className = 'logo-banco';
  imagem.addEventListener('error', () => {
    elemento.classList.remove('com-logo');
    elemento.textContent = reserva;
  }, { once: true });
  elemento.classList.add('com-logo');
  elemento.replaceChildren(imagem);
  return true;
}

/** A cor do banco (pelo código da lista de bancos); um banco que não está na lista ganha um cinza neutro. */
export const corDoBanco = (codigo) => CORES_DOS_BANCOS[codigo] ?? COR_PADRAO_DO_BANCO;

/** "Nubank Ultravioleta" -> "NU"; "Cartão" -> "CA" (as duas primeiras letras do nome, ou as iniciais das duas primeiras palavras). */
export function iniciais(nome) {
  const palavras = String(nome).trim().split(/\s+/).filter(Boolean);
  const letras = palavras.length > 1 ? palavras[0][0] + palavras[1][0] : (palavras[0] ?? '?').slice(0, 2);
  return letras.toUpperCase();
}

/**
 * Marca uma <option> com o avatar e os textos da lista em folha. `forma`: "redondo" (conta, o padrão) ou "quadrado" (cartão). `icone` e `cor`
 * (opcionais) são a aparência escolhida pelo usuário para a conta ou o cartão.
 * `titulo` e `subtitulo` são os dois textos da linha na lista (o texto da própria opção continua sendo o que o campo mostra).
 */
export function definirAvatar(opcao, { banco, sigla, forma = 'redondo', titulo, subtitulo, icone, cor: matiz }) {
  const cor = corDoBanco(banco);
  opcao.dataset.avatarSigla = sigla;
  // com ícone escolhido (conta, cartão), o avatar mostra o desenho na cor escolhida (ou na cor do banco, se só o ícone foi escolhido)
  if (icone) opcao.dataset.avatarIcone = icone;
  // sem ícone nem cor escolhidos, o avatar mostra o logo do banco (quando ele tem)
  if (!icone && !matiz && logoDoBanco(banco)) opcao.dataset.avatarLogo = banco;
  opcao.dataset.avatarFundo = matiz ? `var(--matiz-${matiz})` : cor.fundo;
  opcao.dataset.avatarTexto = matiz ? '#ffffff' : cor.texto;
  opcao.dataset.avatarForma = forma;
  if (titulo) opcao.dataset.titulo = titulo;
  if (subtitulo) opcao.dataset.subtitulo = subtitulo;
  return opcao;
}
