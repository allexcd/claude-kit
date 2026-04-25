---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.html"
---

# Frontend Code Instructions

## Code Change Rules
- Root cause first — no band-aid fixes.
- Minimal diff — only touch what's necessary.
- Verify with tests, lint, and type-check where applicable.
- Follow existing component structure and patterns in the file.

## Component Standards
- One responsibility per component — split when a component does more than one thing.
- No inline styles unless the value is dynamic; use CSS modules, utility classes, or the project's existing styling pattern.
- Semantic HTML first — use the right element before reaching for ARIA.
- Every interactive element must be keyboard-accessible and have a visible focus state.

## CSS / Styling
- No hardcoded magic numbers or colors — use design tokens or CSS variables.
- Avoid `!important` — fix specificity at the source instead.
- Scope styles to the component; avoid global side-effects.

## Performance
- Don't memoize preemptively — only when a profiler identifies a real problem.
- Lazy-load heavy routes and components.
- Avoid triggering layout thrash in event handlers (no synchronous reads after writes).

## Quality Standards
- No dead JSX or unused props.
- If tests exist, they must pass before marking done.
