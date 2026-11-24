const PROFUNDIDADE_MAXIMA = 5; // um componente pode incluir outro (ex.: o calendário dentro do filtro); o limite evita laço infinito

/**
 * Junta os componentes HTML de uma página. Onde houver um elemento com
 *   <div data-incluir="../components/Algo.html"></div>
 * o conteúdo desse arquivo entra no lugar (o endereço é relativo à própria página). Se o arquivo incluído também tiver
 * `data-incluir`, esses entram em seguida.
 * Chame antes de ligar a lógica da página, pois os elementos só existem depois da inclusão.
 * Use só com arquivos do projeto: o texto é inserido como HTML (dados da API entram por textContent).
 */
export async function incluirFragmentos(raiz = document) {
  for (let nivel = 0; nivel < PROFUNDIDADE_MAXIMA; nivel += 1) {
    const lugares = [...raiz.querySelectorAll('[data-incluir]')];
    if (lugares.length === 0) return;

    await Promise.all(
      lugares.map(async (lugar) => {
        const endereco = new URL(lugar.dataset.incluir, document.baseURI);
        const resposta = await fetch(endereco);
        if (!resposta.ok) throw new Error(`Não foi possível carregar ${lugar.dataset.incluir} (${resposta.status}).`);
        lugar.outerHTML = await resposta.text();
      })
    );
  }
}
