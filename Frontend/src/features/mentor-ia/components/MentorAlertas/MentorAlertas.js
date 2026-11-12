// Nome de cada tipo de alerta (docs/contrato-api.md, seção 3.5). Aparece escrito no cartão: a cor só reforça.
const NOMES_DOS_TIPOS = {
  gasto_fora_do_padrao: 'Gasto fora do padrão',
  fatura_proxima: 'Fatura próxima',
  dinheiro_parado: 'Dinheiro parado',
};

/**
 * Liga a lógica aos alertas (HTML em MentorAlertas.html): mostra os alertas não lidos e tira o que o usuário marcar
 * com "Entendi".
 *   entender(alerta) marca o alerta como lido no Backend e devolve uma Promise: true se deu certo (o cartão sai),
 *     false se falhou (o botão volta, para tentar de novo; quem chama avisa o usuário);
 *   aoEsvaziar() é chamado quando o último alerta sai pelo botão, para a tela levar o foco a outro lugar;
 *   signal: depois do abort() (tela desmontada), uma resposta que chegar atrasada não mexe mais na tela.
 */
export function iniciarAlertas(raiz, { entender, aoEsvaziar, signal }) {
  const regiao = raiz.querySelector('#mentor-alertas');
  const lista = raiz.querySelector('#mentor-alertas-lista');
  const modelo = raiz.querySelector('#modelo-alerta');

  function montarAlerta(alerta) {
    const item = modelo.content.firstElementChild.cloneNode(true);
    // O tipo vai num data-* (o CSS escolhe a cor por ele); um tipo desconhecido fica com o visual neutro.
    if (NOMES_DOS_TIPOS[alerta.tipo]) item.dataset.tipo = alerta.tipo;
    item.querySelector('.mentor-alerta__tipo').textContent = NOMES_DOS_TIPOS[alerta.tipo] ?? 'Alerta';
    item.querySelector('.mentor-alerta__titulo').textContent = alerta.titulo ?? '';
    item.querySelector('.mentor-alerta__mensagem').textContent = alerta.mensagem ?? '';

    // Vários cartões têm um "Entendi": o nome acessível diz de qual alerta é (e começa pelo texto visível).
    const botao = item.querySelector('.mentor-alerta__entendi');
    botao.setAttribute('aria-label', `Entendi, dispensar o alerta: ${alerta.titulo ?? 'alerta'}`);
    botao.addEventListener('click', async () => {
      if (botao.disabled) return;
      botao.disabled = true; // evita marcar duas vezes enquanto o PATCH está a caminho
      const deuCerto = await entender(alerta);
      if (signal?.aborted) return;
      if (deuCerto) remover(item);
      else botao.disabled = false;
    });
    return item;
  }

  // O foco passa para o "Entendi" do alerta vizinho (ou sai da faixa, se era o último), para não se perder.
  function remover(item) {
    const vizinho = item.nextElementSibling ?? item.previousElementSibling;
    item.remove();
    if (vizinho) {
      vizinho.querySelector('.mentor-alerta__entendi').focus();
    } else {
      regiao.hidden = true;
      aoEsvaziar?.();
    }
  }

  return {
    /** `alertas`: a lista de GET /mentor-ia/alerts. Sem alertas, a faixa inteira fica escondida. */
    mostrar(alertas) {
      lista.replaceChildren(...alertas.map(montarAlerta));
      regiao.hidden = lista.childElementCount === 0;
    },
  };
}
