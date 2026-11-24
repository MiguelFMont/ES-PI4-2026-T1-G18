/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// Valores devolvidos pela API (docs/contrato-api.md, seção 2.8) e os textos mostrados na tela.

/** Limite de contas conectadas por usuário (o Backend recusa a sexta com ACCOUNT_LIMIT_REACHED). */
export const MAX_CONTAS = 5;

/**
 * Status do item na Pluggy. `situacao` escolhe a cor da etiqueta; o texto sempre aparece, então a cor não é a única
 * pista. Status que não estão aqui mostram o próprio valor, com a situação "atencao".
 */
export const STATUS = {
  UPDATED: { rotulo: 'Atualizada', situacao: 'ok' },
  UPDATING: { rotulo: 'Sincronizando', situacao: 'andamento' },
  LOGIN_ERROR: { rotulo: 'Erro de acesso', situacao: 'erro' },
  OUTDATED: { rotulo: 'Desatualizada', situacao: 'atencao' },
  WAITING_USER_INPUT: { rotulo: 'Aguardando você', situacao: 'atencao' },
  ERROR: { rotulo: 'Com erro', situacao: 'erro' },
};

export const TIPOS_DE_CONTA = {
  BANK: 'Conta corrente',
  CREDIT: 'Cartão de crédito',
};

/** Mensagens para os `code` de erro que o usuário pode resolver. Os demais mostram a mensagem da própria API. */
export const MENSAGENS_DE_ERRO = {
  ACCOUNT_LIMIT_REACHED: `Limite de ${MAX_CONTAS} contas conectadas atingido.`,
  ACCOUNT_ALREADY_CONNECTED: 'Essa conta já está conectada.',
  PLUGGY_SYNC_IN_PROGRESS: 'A instituição ainda está sincronizando. Tente de novo em instantes.',
  PLUGGY_ITEM_ERROR: 'Refaça a conexão: desconecte e conecte de novo.',
  PLUGGY_NOT_CONFIGURED: 'A integração com a Pluggy não está configurada neste ambiente.',
  PLUGGY_UNAVAILABLE: 'A Pluggy está fora do ar ou demorou demais. Tente de novo em instantes.',
  PLUGGY_AUTH_FAILED: 'As credenciais da integração com a Pluggy foram recusadas.',
  PLUGGY_ERROR: 'A Pluggy devolveu um erro. Tente de novo em instantes.',
  ACCOUNT_NAME_IN_USE: 'Você já tem uma conta com este nome.',
  ACCOUNT_IS_OPEN_FINANCE: 'Desconecte a conta do Open Finance para excluí-la.',
  UNDO_NOT_FOUND: 'O prazo para desfazer acabou.',
  UNDO_CONFLICT: 'Já existe algo com esse nome.',
  ACCOUNT_READ_ONLY: 'Uma conta Open Finance não pode ser editada: ela vem do banco.',
  MANUAL_ENTRY_NOT_ALLOWED: 'Open Finance não aceita lançamento manual.',
  PLAN_REQUIRED: 'Contas Open Finance fazem parte do plano Pro.',
  JAVA_SERVER_UNAVAILABLE: 'O servidor de cálculos está fora do ar. Tente de novo em instantes.',
};
