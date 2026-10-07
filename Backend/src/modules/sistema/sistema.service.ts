// src/modules/sistema/sistema.service.ts
// Verificação da base das 3 camadas. Sem regra de negócio; pode sair quando os grupos
// já tiverem rotas reais passando pelo Servidor Java.
import { javaServerClient } from "../../java-client/java-server.client";

export const sistemaService = {
  // Faz o caminho completo: Backend -> socket -> Servidor Java -> de volta (PedidoEco/RespostaEco).
  eco(dados: Record<string, unknown>) {
    return javaServerClient.enviarPedido<Record<string, unknown>, Record<string, unknown>>(
      "PedidoEco",
      "RespostaEco",
      dados
    );
  },
};
