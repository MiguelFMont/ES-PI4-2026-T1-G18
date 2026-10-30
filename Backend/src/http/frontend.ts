// src/http/frontend.ts
// Entrega o Frontend (pasta ../Frontend na raiz do repositório) pelo próprio Backend:
// arquivos estáticos (HTML, CSS, JS) e endereços amigáveis para as páginas.
// A API continua em /v1; este router é registrado depois dela no app.ts.
import path from "node:path";
import express, { Router } from "express";

// src/http -> Backend -> raiz do repositório -> Frontend (o mesmo caminho vale em dist/http)
const PASTA_FRONTEND = path.resolve(__dirname, "../../../Frontend");

// Endereço amigável -> arquivo da página. O Frontend é um SPA: só o index.html é uma página.
const PAGINAS: Record<string, string> = {
  "/": "index.html",
};

// Atalhos: as telas do SPA são rotas internas do index.html (roteador por #); o login é uma página independente.
const ATALHOS_DO_INDEX: Record<string, string> = {
  "/login": "/src/features/auth/components/inicio.html",
  "/dashboard": "/#dashboard",
  "/transactions": "/#transactions",
};

export const frontendRouter = Router();

for (const [endereco, arquivo] of Object.entries(PAGINAS)) {
  frontendRouter.get(endereco, (_req, res) => res.sendFile(path.join(PASTA_FRONTEND, arquivo)));
}

for (const [endereco, destino] of Object.entries(ATALHOS_DO_INDEX)) {
  frontendRouter.get(endereco, (_req, res) => res.redirect(destino));
}

// Demais arquivos (CSS, JS, componentes HTML, imagens). Arquivos que começam com "." não são entregues.
frontendRouter.use(express.static(PASTA_FRONTEND, { dotfiles: "ignore" }));
