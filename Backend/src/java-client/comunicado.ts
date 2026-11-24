// src/java-client/comunicado.ts

// Equivalente ao "Comunicado implements Serializable, Cloneable" do professor:
// aqui é só o formato do envelope, não uma classe para estender.
export interface Comunicado<TDados = unknown> {
  tipo: string;
  dados: TDados;
}

// Equivalente ao PedidoParaSair.java: o cliente avisa que vai encerrar.
export const TIPO_PEDIDO_PARA_SAIR = "PedidoParaSair";

// Equivalente ao ComunicadoDeDesligamento.java: aviso não solicitado do servidor.
export const TIPO_COMUNICADO_DESLIGAMENTO = "ComunicadoDeDesligamento";

// Resposta do servidor quando um handler falha ou o tipo do pedido é desconhecido.
export const TIPO_ERRO = "Erro";

export function ehComunicadoDeDesligamento(comunicado: Comunicado): boolean {
  return comunicado.tipo === TIPO_COMUNICADO_DESLIGAMENTO;
}
