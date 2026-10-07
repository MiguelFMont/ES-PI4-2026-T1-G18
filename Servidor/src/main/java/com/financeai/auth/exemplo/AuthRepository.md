# AuthRepository.java — Acesso aos dados de usuários

## O que deve ter neste arquivo
- Acesso à coleção `users`: buscar por e-mail, buscar por id, criar e gravar o segredo do MFA. É a **única** classe do grupo que fala com o MongoDB; o `AuthHandler` nunca usa o driver direto.
- Cria o índice **único** em `email` ao ser instanciado, para o banco também impedir e-mails duplicados (a checagem do handler sozinha não evita duas requisições simultâneas).
- Documentos de usuário: `nome`, `email`, `cpf`, `senhaHash`, `mfaEnabled`, `mfaSecret` (só depois de habilitar o MFA), `plano` (`free`/`pro`) e `createdAt`.
- Sem regra de negócio: só consulta e grava.

## Exemplo de implementação

```java
package com.financeai.auth;

import org.bson.Document;

import com.financeai.core.Banco;
import com.financeai.core.ErroDeNegocio;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import com.mongodb.client.model.Updates;

public class AuthRepository
{
    private final MongoCollection<Document> usuarios = Banco.colecao ("users");

    public AuthRepository ()
    {
        this.usuarios.createIndex (Indexes.ascending("email"), new IndexOptions().unique(true));
    }

    public Document buscarPorEmail (String email)
    {
        return this.usuarios.find(Filters.eq("email", email)).first();
    }

    public Document buscarPorId (String id) throws ErroDeNegocio
    {
        return this.usuarios.find(Filters.eq("_id", Banco.id(id))).first();
    }

    public Document criar (Document usuario)
    {
        this.usuarios.insertOne (usuario);   // preenche o _id
        return usuario;
    }

    public void salvarSegredoMfa (String id, String segredo) throws ErroDeNegocio
    {
        this.usuarios.updateOne (
            Filters.eq ("_id", Banco.id(id)),
            Updates.combine (Updates.set("mfaSecret", segredo), Updates.set("mfaEnabled", true)));
    }
}
```
