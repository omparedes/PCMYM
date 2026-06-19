# PCMYM

[English](#english) | [Español](#español)

---

## English

Multi-tenant SaaS management platform for computer sales and repair businesses. The core entity is the **Service Order (OS)**. Designed to be replicable and sellable to other repair shops from day one.

### Stack
Angular 22 (signal-first, zoneless, Signal Forms) · Tailwind CSS + PrimeNG · Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) · Vercel · GitHub · n8n (later phases).

### Workspace Structure
- `apps/crm/` — Angular 22 application (the MVP).
- `supabase/` — Database migrations and seed data.
- `automation/n8n/` — Automations (later phases, placeholder).
- `docs/` — Knowledge base (vision, architecture, data model, roadmap, conventions, ADRs).
- `AGENTS.md` — Single source of truth for agents and humans. **Start here.**

### Quick Start (Development)
```bash
# 1. Environment variables
cp .env.example .env        # fill with your Supabase keys

# 2. Angular App
cd apps/crm
npm install
npm start                   # http://localhost:4200

# 3. Local database (requires Docker)
npx supabase start
npx supabase db reset       # applies migrations + seed
```

### Key Documentation
- Current project state and next step: [`docs/ESTADO.md`](docs/ESTADO.md)
- Phased roadmap: [`docs/03-ROADMAP-FASES.md`](docs/03-ROADMAP-FASES.md)
- Conventions, MCP, and skills: [`docs/04-CONVENCIONES.md`](docs/04-CONVENCIONES.md)

### License
Private. All rights reserved.

---

## Español

Plataforma SaaS **multi-tenant** de gestión para negocios de venta y servicio técnico de computadoras. La entidad corazón es la **Orden de Servicio (OS)**. Diseñada para ser replicable y vendible a otros talleres desde el día uno.

### Stack
Angular 22 (signal-first, zoneless, Signal Forms) · Tailwind CSS + PrimeNG · Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) · Vercel · GitHub · n8n (fases posteriores).

### Estructura del workspace
- `apps/crm/` — aplicación Angular 22 (el MVP).
- `supabase/` — migraciones y seed de la base de datos.
- `automation/n8n/` — automatizaciones (fases posteriores, placeholder).
- `docs/` — base de conocimiento (visión, arquitectura, modelo de datos, roadmap, convenciones, ADRs).
- `AGENTS.md` — fuente única de verdad para agentes y humanos. **Empieza por aquí.**

### Arranque rápido (desarrollo)
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

### Documentación clave
- Estado actual del proyecto y siguiente paso: [`docs/ESTADO.md`](docs/ESTADO.md)
- Roadmap por fases: [`docs/03-ROADMAP-FASES.md`](docs/03-ROADMAP-FASES.md)
- Convenciones, MCP y skills: [`docs/04-CONVENCIONES.md`](docs/04-CONVENCIONES.md)

### Licencia
Privado. Todos los derechos reservados.
