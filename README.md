# PCMYM

Plataforma SaaS **multi-tenant** de gestión para negocios de venta y servicio técnico de
computadoras. La entidad corazón es la **Orden de Servicio (OS)**. Diseñada para ser replicable
y vendible a otros talleres desde el día uno.

## Stack
Angular 22 (signal-first, zoneless, Signal Forms) · Tailwind CSS + PrimeNG · Supabase
(Postgres + Auth + Storage + Realtime + Edge Functions) · Vercel · GitHub · n8n (fases posteriores).

## Estructura del workspace
- `apps/crm/` — aplicación Angular 22 (el MVP).
- `supabase/` — migraciones y seed de la base de datos.
- `automation/n8n/` — automatizaciones (fases posteriores, placeholder).
- `docs/` — base de conocimiento (visión, arquitectura, modelo de datos, roadmap, convenciones, ADRs).
- `AGENTS.md` — fuente única de verdad para agentes y humanos. **Empieza por aquí.**

## Arranque rápido (desarrollo)
```bash
# 1. Variables de entorno
cp .env.example .env        # rellena con tus claves de Supabase

# 2. App Angular
cd apps/crm
npm install
npm start                   # http://localhost:4200

# 3. Base de datos local (requiere Docker)
npx supabase start
npx supabase db reset       # aplica migraciones + seed
```

## Documentación clave
- Estado actual del proyecto y siguiente paso: [`docs/ESTADO.md`](docs/ESTADO.md)
- Roadmap por fases: [`docs/03-ROADMAP-FASES.md`](docs/03-ROADMAP-FASES.md)
- Convenciones, MCP y skills: [`docs/04-CONVENCIONES.md`](docs/04-CONVENCIONES.md)

## Licencia
Privado. Todos los derechos reservados.
