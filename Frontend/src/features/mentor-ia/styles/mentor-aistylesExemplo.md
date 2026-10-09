# Estilos de Mentor financeiro

Mantenha neste diretório o CSS específico do módulo. Use classes prefixadas por `mentor-ai-`; cores e tipografia globais devem ficar no tema compartilhado quando ele existir.

```css
.mentor-ai-page {
  --mentor-ai-accent: #2563eb;
  display: grid;
  gap: 1.25rem;
  max-width: 72rem;
  margin-inline: auto;
  padding: clamp(1rem, 3vw, 2rem);
}
.mentor-ai-page button { min-height: 2.75rem; padding-inline: 1rem; border: 0; border-radius: .5rem; color: #fff; background: var(--mentor-ai-accent); }
.mentor-ai-page :focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }
.mentor-ai-page [role="alert"] { color: #b42318; }
@media (max-width: 640px) { .mentor-ai-page { padding: 1rem; } }
@media (prefers-reduced-motion: reduce) { .mentor-ai-page *, .mentor-ai-page *::before, .mentor-ai-page *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
```

Garanta contraste, foco visível e responsividade. Não comunique sucesso ou erro apenas pela cor; mantenha textos e rótulos legíveis em telas estreitas.
