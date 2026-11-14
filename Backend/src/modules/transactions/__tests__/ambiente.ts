// src/modules/transactions/__tests__/ambiente.ts
// Variáveis de ambiente dos testes de transações: as de contas conectadas (variáveis falsas, sem Atlas nem Pluggy) mais um
// Servidor Java que NUNCA é o de verdade. O endereço aponta para uma porta fechada e o tempo de espera é curto, então um
// teste que esquecer de simular o Servidor (simularCategorizacao) falha na hora, em vez de ficar esperando 5 segundos por
// chamada, ou, pior, de falar com o Servidor Java que o desenvolvedor deixou rodando na porta 3000.
// Como o dotenv não sobrescreve o que já está definido, o Backend/.env local não muda nada disto.
import "../../connected-accounts/__tests__/ambiente";

process.env.JAVA_SERVER_HOST = "127.0.0.1";
process.env.JAVA_SERVER_PORT = "1";
process.env.JAVA_SERVER_TIMEOUT_MS = "300";
process.env.JAVA_SERVER_POOL_SIZE = "1";
