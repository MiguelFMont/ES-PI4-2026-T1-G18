package com.financeai.core;

@FunctionalInterface
public interface Handler
{
    Comunicado tratar (Comunicado pedido) throws Exception;
}
