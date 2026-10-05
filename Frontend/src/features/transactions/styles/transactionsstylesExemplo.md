# Estilos de Transações

Mantenha neste diretório o CSS específico do módulo. Use classes prefixadas por `transactions-`; cores e tipografia globais devem ficar no tema compartilhado quando ele existir.

```css
.transactions-page {
  --transactions-accent: #2563eb;
  display: grid;
  gap: 1.25rem;
  max-width: 72rem;
  margin-inline: auto;
  padding: clamp(1rem, 3vw, 2rem);
}
.transactions-page button { min-height: 2.75rem; padding-inline: 1rem; border: 0; border-radius: .5rem; color: #fff; background: var(--transactions-accent); }
.transactions-page :focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }
.transactions-page [role="alert"] { color: #b42318; }
@media (max-width: 640px) { .transactions-page { padding: 1rem; } }
@media (prefers-reduced-motion: reduce) { .transactions-page *, .transactions-page *::before, .transactions-page *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
```

Garanta contraste, foco visível e responsividade. Não comunique sucesso ou erro apenas pela cor; mantenha textos e rótulos legíveis em telas estreitas.
