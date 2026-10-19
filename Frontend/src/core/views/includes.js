/**
 * Junta os componentes HTML de uma página. Onde houver um elemento com
 *   <div data-incluir="../components/Algo.html"></div>
 * o conteúdo desse arquivo entra no lugar (o endereço é relativo à própria página).
 * Chame antes de ligar a lógica da página, pois os elementos só existem depois da inclusão.
 * Use só com arquivos do projeto: o texto é inserido como HTML (dados da API entram por textContent).
 */
export async function incluirFragmentos(raiz = document) {
  const lugares = [...raiz.querySelectorAll('[data-incluir]')];

  await Promise.all(
    lugares.map(async (lugar) => {
      const endereco = new URL(lugar.dataset.incluir, document.baseURI);
      const resposta = await fetch(endereco);
      if (!resposta.ok) throw new Error(`Não foi possível carregar ${lugar.dataset.incluir} (${resposta.status}).`);
      lugar.outerHTML = await resposta.text();
    })
  );
}
