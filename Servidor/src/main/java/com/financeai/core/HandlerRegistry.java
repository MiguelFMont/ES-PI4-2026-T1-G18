package com.financeai.core;

import java.util.HashMap;
import java.util.Map;
import com.financeai.auth.AuthHandler;
import com.financeai.mentoria.MentorHandler;

public class HandlerRegistry
{
    private final Map<String, Handler> handlers = new HashMap<>();

    public void registrar (String tipo, Handler handler)
    {
        if (this.handlers.containsKey(tipo))
            throw new IllegalStateException ("Ja existe handler para o tipo " + tipo);

        this.handlers.put (tipo, handler);
    }

    public Handler obter (String tipo)
    {
        return this.handlers.get (tipo);
    }

    // Cada grupo adiciona UMA linha aqui quando seu handler existir
    // (ex.: new AuthHandler().registrarEm (registry);)
    public static HandlerRegistry criarPadrao ()
    {
        HandlerRegistry registry = new HandlerRegistry();

        new EcoHandler().registrarEm (registry);
        new AuthHandler().registrarEm (registry);   // handler de teste da Sprint 0
        new MentorHandler().registrarEm (registry);

        return registry;
    }
}
