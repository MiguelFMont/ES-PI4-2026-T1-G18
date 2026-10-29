/**
 * Converte o markdown simples das respostas da IA (ver docs/contrato-api.md, seção 3.1) em elementos:
 * parágrafos (separados por linha em branco), listas com "- " ou "* ", listas numeradas ("1. ") e **negrito**.
 * Tudo é montado com createElement e textContent: nenhum texto da IA entra como HTML.
 */
const ITEM_DE_LISTA = /^\s*[-*]\s+(.*)$/;
const ITEM_NUMERADO = /^\s*\d+[.)]\s+(.*)$/;

/** "Gasto com **Moradia**" -> [ "Gasto com ", <strong>Moradia</strong> ] dentro de `destino` */
function preencherLinha(destino, linha) {
  const partes = linha.split(/\*\*(.+?)\*\*/g); // as posições ímpares são o que estava entre ** **
  partes.forEach((parte, indice) => {
    if (!parte) return;
    if (indice % 2 === 1) {
      const forte = document.createElement('strong');
      forte.textContent = parte;
      destino.append(forte);
    } else {
      destino.append(parte);
    }
  });
}

export function markdownParaElementos(texto) {
  const fragmento = document.createDocumentFragment();
  let paragrafo = null; // <p> aberto (linhas seguidas viram um parágrafo com <br>)
  let lista = null; // <ul> ou <ol> aberta

  const fecharBlocos = () => {
    paragrafo = null;
    lista = null;
  };

  for (const linha of String(texto).split(/\r?\n/)) {
    if (!linha.trim()) {
      fecharBlocos();
      continue;
    }

    const item = linha.match(ITEM_DE_LISTA);
    const numerado = !item && linha.match(ITEM_NUMERADO);
    if (item || numerado) {
      const tag = item ? 'UL' : 'OL';
      if (!lista || lista.tagName !== tag) {
        lista = document.createElement(tag.toLowerCase());
        fragmento.append(lista);
      }
      paragrafo = null;
      const li = document.createElement('li');
      preencherLinha(li, (item ?? numerado)[1]);
      lista.append(li);
      continue;
    }

    lista = null;
    if (paragrafo) {
      paragrafo.append(document.createElement('br'));
    } else {
      paragrafo = document.createElement('p');
      fragmento.append(paragrafo);
    }
    preencherLinha(paragrafo, linha.trim());
  }

  return fragmento;
}
