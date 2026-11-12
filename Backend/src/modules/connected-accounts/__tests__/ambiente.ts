// src/modules/connected-accounts/__tests__/ambiente.ts
// Variáveis de ambiente dos testes de contas conectadas. Cada arquivo de teste importa este ANTES de tudo, porque o
// config/env valida o process.env no import. Como o dotenv não sobrescreve o que já está definido, os testes não dependem
// do .env local: nunca chamam a Pluggy de verdade (o host abaixo não existe e o fetch é simulado).
process.env.JWT_SECRET = "segredo-de-teste";
process.env.MONGO_URI = "";
process.env.EMAIL_USER = "teste@teste.com";
process.env.EMAIL_PASSWORD = "senha-de-teste";
process.env.PLUGGY_CLIENT_ID = "id-de-teste";
process.env.PLUGGY_CLIENT_SECRET = "segredo-pluggy-de-teste";
process.env.PLUGGY_BASE_URL = "http://pluggy.teste";
process.env.PLUGGY_TIMEOUT_MS = "2000";
process.env.PLUGGY_ESPERA_ITEM_MS = "300"; // esperar a sincronização do item: curto nos testes
process.env.PLUGGY_INTERVALO_MS = "5";
