// src/http/server.ts
import { app } from "./app";
import { env } from "../config/env";

app.listen(env.PORT, () => {
  console.log(`[server] Backend rodando em http://localhost:${env.PORT}/v1`);
});
