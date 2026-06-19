---
name: commit
description: Crea commits del proyecto PCMYM con formato Conventional Commits (en inglés). Úsalo al preparar cualquier commit en este repo.
---

# Skill: commit (Conventional Commits PCMYM)

Mensajes de commit **en inglés**, formato Conventional Commits.

## Formato
```
<type>(<scope opcional>): <descripción imperativa, minúscula, sin punto final>
```

## Tipos permitidos
`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.

## Scopes habituales
`crm`, `clientes`, `ordenes`, `finanzas`, `auth`, `db` (migraciones), `docs`, `ci`.

## Reglas
- Inglés, modo imperativo: "add", no "added"/"adds".
- Una intención por commit. Si tocas varias cosas no relacionadas, divide.
- Cuerpo opcional explicando el porqué (no el qué). Footer para breaking changes: `BREAKING CHANGE: ...`.
- **Antes de `git add`**: verifica que no entran secretos ni datos reales (`.env`, dumps, `*-real.*`).
- Cierra los commits creados por agentes con la línea de co-autoría que indique el entorno.

## Ejemplos
- `feat(ordenes): add service order state machine`
- `fix(auth): handle expired supabase session`
- `chore(db): add RLS policy for clientes`
- `docs: update ESTADO with phase 1 progress`
