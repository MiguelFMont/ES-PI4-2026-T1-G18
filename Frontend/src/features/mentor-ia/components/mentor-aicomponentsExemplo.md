# Componentes da feature Mentor-Ia

Esta pasta contém telas, formulários e elementos visuais. Componentes recebem dados e callbacks, delegando operações ao service da feature. Toda comunicação com o Backend fica em services/, usando exclusivamente o wrapper piFetch de src/core/http/api.js; componentes não fazem requisições HTTP diretamente.

Prefira 	extContent para conteúdo recebido do Backend, anuncie erros com ole="alert" e mantenha foco visível.
