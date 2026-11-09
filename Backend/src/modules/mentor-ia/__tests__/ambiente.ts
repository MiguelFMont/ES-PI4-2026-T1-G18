// src/modules/mentor-ia/__tests__/ambiente.ts
// Variáveis de ambiente dos testes. Cada arquivo de teste importa este ANTES de tudo, porque o
// config/env valida o process.env no import. Como o dotenv não sobrescreve o que já está
// definido, os testes não dependem do .env local (nem da chave real da IA ou do Atlas).
process.env.JWT_SECRET = "segredo-de-teste";
process.env.MONGO_URI = "";
process.env.GENAI_API_KEY = "chave-de-teste";
process.env.GENAI_BASE_URL = "http://genai.teste/v1";
process.env.GENAI_MODEL = "modelo-de-teste";
process.env.GENAI_TIMEOUT_MS = "2000";
