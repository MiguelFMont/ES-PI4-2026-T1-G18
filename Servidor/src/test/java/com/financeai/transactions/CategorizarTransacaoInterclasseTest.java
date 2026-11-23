/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
package com.financeai.transactions;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;
import com.financeai.core.Parceiro;
import com.financeai.core.Supervisora;
import com.google.gson.JsonObject;

// Teste INTERCLASSE do servico principal do Grupo 2: "PedidoCategorizarTransacao". O teste faz o papel do Backend:
// abre uma conexao TCP de verdade com uma Supervisora (a thread do Servidor), manda uma linha de JSON e le a resposta.
// Classes participantes: Supervisora -> Parceiro -> Comunicado -> HandlerRegistry -> TransactionsHandler ->
// PedidoCategorizarTransacao / RespostaCategorizarTransacao (e ErroDeNegocio nos cenarios de erro).
class CategorizarTransacaoInterclasseTest
{
    private ServerSocket servidor;
    private Socket cliente;
    private PrintWriter enviar;
    private BufferedReader receber;

    @BeforeEach
    void iniciarServidorEConectar () throws Exception
    {
        HandlerRegistry registry = new HandlerRegistry();
        new TransactionsHandler().registrarEm (registry);

        this.servidor = new ServerSocket (0);
        this.cliente = new Socket ("127.0.0.1", this.servidor.getLocalPort());
        this.cliente.setSoTimeout (5000);
        Socket doServidor = this.servidor.accept();
        new Supervisora (doServidor, new ArrayList<Parceiro>(), registry).start();

        this.enviar = new PrintWriter (this.cliente.getOutputStream(), true, StandardCharsets.UTF_8);
        this.receber = new BufferedReader (new InputStreamReader (this.cliente.getInputStream(), StandardCharsets.UTF_8));
    }

    @AfterEach
    void fechar () throws Exception
    {
        this.enviar.println ("{\"tipo\":\"PedidoParaSair\",\"dados\":{}}");
        this.cliente.close();
        this.servidor.close();
    }

    private Comunicado pedir (String linha) throws Exception
    {
        this.enviar.println (linha);
        return Comunicado.lerJson (this.receber.readLine());
    }

    // Cenario NORMAL: a descricao casa com uma palavra-chave e o Servidor devolve a categoria.
    @Test
    void cenarioNormalDevolveACategoriaSugerida () throws Exception
    {
        Comunicado resposta = pedir ("{\"tipo\":\"PedidoCategorizarTransacao\",\"dados\":{\"descricao\":\"Compra no debito FARMACIA Pague Menos\",\"valor\":45.9}}");

        assertEquals (RespostaCategorizarTransacao.TIPO, resposta.getTipo());
        assertEquals ("Saude", resposta.dadosComo (RespostaCategorizarTransacao.class).getCategoria());
    }

    // Cenario de ERRO 1: descricao em branco -> ErroDeNegocio VALIDATION, convertido em mensagem "Erro" pela Supervisora.
    @Test
    void cenarioDeErroDescricaoEmBrancoDevolveValidation () throws Exception
    {
        Comunicado resposta = pedir ("{\"tipo\":\"PedidoCategorizarTransacao\",\"dados\":{\"descricao\":\"   \",\"valor\":10}}");

        assertEquals (Comunicado.TIPO_ERRO, resposta.getTipo());
        JsonObject dados = resposta.getDados().getAsJsonObject();
        assertEquals ("VALIDATION", dados.get ("code").getAsString());
        assertEquals ("descricao e obrigatoria", dados.get ("message").getAsString());
    }

    // Cenario de ERRO 2: tipo de pedido que nenhum handler registrou.
    @Test
    void cenarioDeErroTipoDesconhecidoDevolveUnknownType () throws Exception
    {
        Comunicado resposta = pedir ("{\"tipo\":\"PedidoQueNaoExiste\",\"dados\":{}}");

        assertEquals (Comunicado.TIPO_ERRO, resposta.getTipo());
        assertEquals ("UNKNOWN_TYPE", resposta.getDados().getAsJsonObject().get ("code").getAsString());
    }

    // Cenario de ERRO 3: "dados" no formato errado (texto, nao objeto). Esperado: erro de validacao, nao erro interno.
    @Test
    void cenarioDeErroDadosEmFormatoInvalido () throws Exception
    {
        Comunicado resposta = pedir ("{\"tipo\":\"PedidoCategorizarTransacao\",\"dados\":\"isto e um texto\"}");

        assertEquals (Comunicado.TIPO_ERRO, resposta.getTipo());
        assertEquals ("VALIDATION", resposta.getDados().getAsJsonObject().get ("code").getAsString(),
                      "dados fora do formato deveria ser VALIDATION, e nao INTERNAL_ERROR");
    }

    // O servidor continua atendendo depois de um erro (a conexao nao cai).
    @Test
    void conexaoContinuaAbertaDepoisDeUmErro () throws Exception
    {
        pedir ("{\"tipo\":\"PedidoCategorizarTransacao\",\"dados\":{}}");
        Comunicado resposta = pedir ("{\"tipo\":\"PedidoCategorizarTransacao\",\"dados\":{\"descricao\":\"aluguel\"}}");

        assertEquals ("Moradia", resposta.dadosComo (RespostaCategorizarTransacao.class).getCategoria());
    }
}
