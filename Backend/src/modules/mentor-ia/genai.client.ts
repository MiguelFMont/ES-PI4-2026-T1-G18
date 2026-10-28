// src/modules/mentor-ia/genai.client.ts
// Único arquivo que fala com a API de IA generativa. Usa o formato de chat da OpenAI
// (/chat/completions), que o Groq aceita: para trocar de provedor, basta mudar
// GENAI_BASE_URL e GENAI_MODEL no .env.
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";

export interface MensagemAnterior {
  autor: "usuario" | "ia";
  texto: string;
}

// A regra de nunca recomendar ativo também é garantida no Servidor Java (PedidoFiltrarResposta):
// o prompt sozinho não basta, porque o modelo pode desobedecer.
const INSTRUCOES = [
  "Você é o Mentor Financeiro do FinanceAI, um assistente educacional de finanças pessoais.",
  "Responda sempre em português do Brasil, de forma clara, curta (até 2 parágrafos) e sem jargão.",
  "Baseie-se no resumo financeiro do usuário abaixo.",
  "Use somente os números que estão no resumo e não faça contas novas; se precisar de um número que não está lá, diga que não tem essa informação.",
  "Nunca recomende comprar, vender ou aportar em um ativo específico (ações, fundos, criptomoedas, títulos).",
  "Se pedirem isso, comece a resposta com \"Não posso recomendar\" e ofereça ajuda com conceitos e com o orçamento.",
  "Você explica conceitos e hábitos; não substitui um consultor financeiro.",
].join(" ");

const indisponivel = () =>
  new AppError("Mentor IA indisponível no momento", 503, "GENAI_UNAVAILABLE");

export async function chamarApiDeIaGenerativa(
  contexto: string,
  texto: string,
  historico: MensagemAnterior[] = []
): Promise<string> {
  if (!env.GENAI_API_KEY) {
    throw new AppError("Mentor IA não configurado (GENAI_API_KEY)", 503, "GENAI_UNAVAILABLE");
  }

  const messages = [
    { role: "system", content: `${INSTRUCOES}\n\nResumo financeiro do usuário: ${contexto}` },
    ...historico.map((m) => ({ role: m.autor === "ia" ? "assistant" : "user", content: m.texto })),
    { role: "user", content: texto },
  ];

  let resposta: Response;
  try {
    resposta = await fetch(`${env.GENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: env.GENAI_MODEL, messages, max_completion_tokens: 1024 }),
      signal: AbortSignal.timeout(env.GENAI_TIMEOUT_MS),
    });
  } catch {
    // sem rede, DNS ou timeout
    throw indisponivel();
  }

  if (resposta.status === 429) {
    throw new AppError("Limite de uso do Mentor IA atingido, tente mais tarde", 429, "GENAI_RATE_LIMITED");
  }
  if (!resposta.ok) {
    // o corpo pode ter detalhes da conta: fica só no log
    console.error("[genai] status", resposta.status, await resposta.text().catch(() => ""));
    throw new AppError("Erro na API de IA", 502, "GENAI_ERROR");
  }

  const corpo = (await resposta.json()) as { choices?: { message?: { content?: string } }[] };
  const conteudo = corpo.choices?.[0]?.message?.content?.trim();
  if (!conteudo) {
    throw new AppError("A IA não devolveu resposta", 502, "GENAI_ERROR");
  }
  return conteudo;
}
