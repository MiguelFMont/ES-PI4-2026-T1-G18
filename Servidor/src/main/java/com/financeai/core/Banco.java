package com.financeai.core;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.bson.Document;
import org.bson.types.ObjectId;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;

// Unico ponto de acesso ao MongoDB: guarda o MongoClient (um so, compartilhado por
// todas as Supervisoras; o cliente do driver e thread-safe e tem pool proprio) e
// entrega as colecoes aos repositorios. Sem regra de negocio.
public class Banco
{
    private static final Set<String> CAMPOS_INTERNOS = Set.of ("userId", "senhaHash", "mfaSecret");

    private static MongoClient   cliente;
    private static MongoDatabase banco;

    // Retorna false se MONGO_URI nao esta definida (servidor segue sem banco, so para
    // testar sockets/Backend). Se esta definida e a conexao falha, lanca excecao:
    // melhor nao subir do que subir com a URI errada.
    public static boolean iniciar () throws Exception
    {
        String uri = System.getenv ("MONGO_URI");
        if (uri == null || uri.isBlank())
            return false;

        String nome = System.getenv().getOrDefault ("MONGO_DB", "financeai");

        try
        {
            MongoClientSettings configuracao = MongoClientSettings.builder()
                .applyConnectionString (new ConnectionString (uri))
                .applyToClusterSettings (c -> c.serverSelectionTimeout (8, TimeUnit.SECONDS))
                .build();

            cliente = MongoClients.create (configuracao);
            banco   = cliente.getDatabase (nome);
            banco.runCommand (new Document ("ping", 1));   // falha rapido se nao conectar
        }
        catch (Exception erro)
        {
            encerrar();
            // a mensagem do driver pode repetir a URI; nao a repassamos para nao vazar a senha
            throw new Exception ("falha ao conectar (confira MONGO_URI, usuario/senha e o IP liberado no Atlas): "
                                 + erro.getClass().getSimpleName());
        }

        return true;
    }

    public static MongoCollection<Document> colecao (String nome)
    {
        if (banco == null)
            throw new IllegalStateException ("Banco nao iniciado: defina MONGO_URI");

        return banco.getCollection (nome);
    }

    public static ObjectId id (String texto) throws ErroDeNegocio
    {
        if (texto == null || !ObjectId.isValid(texto))
            throw new ErroDeNegocio ("INVALID_ID", "Identificador invalido");

        return new ObjectId (texto);
    }

    // Document -> Map pronto para o Gson: _id vira id (texto), datas viram ISO-8601
    // e campos internos nunca saem do Servidor.
    public static Map<String, Object> paraMapa (Document documento)
    {
        Map<String, Object> mapa = new LinkedHashMap<>();

        for (Map.Entry<String, Object> campo : documento.entrySet())
        {
            String chave = campo.getKey();
            Object valor = campo.getValue();

            if (CAMPOS_INTERNOS.contains (chave))
                continue;

            if (chave.equals ("_id"))
                mapa.put ("id", valor.toString());
            else if (valor instanceof Date)
                mapa.put (chave, ((Date) valor).toInstant().toString());
            else if (valor instanceof ObjectId)
                mapa.put (chave, valor.toString());
            else
                mapa.put (chave, valor);
        }

        return mapa;
    }

    public static void encerrar ()
    {
        if (cliente != null)
        {
            cliente.close();
            cliente = null;
            banco   = null;
        }
    }
}
