# Componentes da feature transactions

Esta pasta contém telas, formulários e elementos visuais. Componentes recebem dados e callbacks e delegam operações ao service da feature. Toda comunicação com o Backend fica em services e usa exclusivamente o wrapper apiFetch de src/core/http/api.js; componentes não fazem requisições diretamente.

Use nós de texto para exibir dados do Backend, apresente erros de forma acessível e mantenha foco visível.

