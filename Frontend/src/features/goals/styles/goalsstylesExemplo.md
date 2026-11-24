# Estilos de Metas financeiras

Mantenha neste diretório o CSS específico do módulo. Use classes prefixadas por `goals-`; cores e tipografia globais devem ficar no tema compartilhado quando ele existir.

```css
.goals-page {
  --goals-accent: #2563eb;
  display: grid;
  gap: 1.25rem;
  max-width: 72rem;
  margin-inline: auto;
  padding: clamp(1rem, 3vw, 2rem);
}
.goals-page button { min-height: 2.75rem; padding-inline: 1rem; border: 0; border-radius: .5rem; color: #fff; background: var(--goals-accent); }
.goals-page :focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }
.goals-page [role="alert"] { color: #b42318; }
@media (max-width: 640px) { .goals-page { padding: 1rem; } }
@media (prefers-reduced-motion: reduce) { .goals-page *, .goals-page *::before, .goals-page *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
```

Garanta contraste, foco visível e responsividade. Não comunique sucesso ou erro apenas pela cor; mantenha textos e rótulos legíveis em telas estreitas.
