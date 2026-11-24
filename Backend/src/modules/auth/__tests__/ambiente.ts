// Gabriel Henrique Pozeti de Faria / R.A 25022716
// src/modules/auth/__tests__/ambiente.ts
// Variáveis de ambiente dos testes de autenticação. Cada arquivo de teste importa este ANTES de tudo, porque o
// config/env valida o process.env no import. Como o dotenv não sobrescreve o que já está definido, os testes não
// dependem do .env local: o e-mail é simulado (nada é enviado) e o Servidor Java aponta para uma porta fechada, então
// um teste que esquecer de simulá-lo falha na hora em vez de falar com um Servidor de verdade.
process.env.JWT_SECRET = "segredo-de-teste";
process.env.MFA_JWT_SECRET = "segredo-mfa-de-teste-com-mais-de-32-caracteres";
process.env.MONGO_URI = "";
process.env.EMAIL_USER = "teste@teste.com";
process.env.EMAIL_PASSWORD = "senha-de-teste";
process.env.JAVA_SERVER_HOST = "127.0.0.1";
process.env.JAVA_SERVER_PORT = "1";
process.env.JAVA_SERVER_TIMEOUT_MS = "300";
process.env.JAVA_SERVER_POOL_SIZE = "1";
