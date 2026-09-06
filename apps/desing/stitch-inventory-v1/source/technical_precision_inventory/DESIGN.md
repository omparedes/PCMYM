---
name: Technical Precision Inventory
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#5c403c'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#916f6b'
  outline-variant: '#e6bdb8'
  surface-tint: '#bf0715'
  primary: '#b70011'
  on-primary: '#ffffff'
  primary-container: '#dc2626'
  on-primary-container: '#fff6f5'
  inverse-primary: '#ffb4ab'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006645'
  on-tertiary: '#ffffff'
  tertiary-container: '#008259'
  on-tertiary-container: '#e1ffec'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ab'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#93000b'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '800'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 26px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.375rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.25rem
  space-2xl: 1.5rem
  space-3xl: 2rem
  sidebar-width: 220px
  card-gutter: 1rem
---

## Brand & Style

This design system is engineered specifically for fast-paced technical workshop operations, repair stations, and computer/mobile device inventory management. The brand personality is disciplined, highly legible, professional, and reliable. 

The aesthetic is Modern Corporate with pragmatic high-density utility:
- **Tone:** Crisp, operational, authoritative, and direct.
- **Audience:** Hardware repair technicians, logistics managers, service coordinators, and workshop admins who require immediate situational awareness without visual friction.
- **Emotional Response:** Confidence, order, zero cognitive lag, and rapid visual triage of parts, stock levels, and linked repair tickets.
- **Visual Structure:** Pure white actionable surfaces floating over an ultra-clean slate canvas, accented by an energetic corporate red for active states, high-priority actions, and urgency signals.

## Colors

The palette leverages a crisp slate-and-white foundation balanced by vibrant functional semantic signals:

### Foundation
- **Canvas / Background (`#F8FAFC`):** Soft, anti-glare cold gray that creates clean contrast with active cards.
- **Surface / Cards (`#FFFFFF`):** High-purity white for cards, dropdown menus, table headers, and modal dialogs.
- **Borders & Dividers (`#E2E8F0`):** Subtle definition lines that segment dense data without visual clutter.
- **Muted Surface (`#F1F5F9`):** Inactive filter tabs, subtle pill containers, and read-only input backgrounds.

### Typography & Neutrals
- **Text Primary (`#0F172A`):** Deep slate-black for item titles, main codes, and critical numeric values.
- **Text Secondary (`#64748B`):** Cool slate-gray for labels, secondary timestamps, and non-critical hardware metadata.
- **Text Muted (`#94A3B8`):** Disabled values, placeholders, and subtle iconography.

### Accents & Semantics
- **Brand Primary (`#DC2626` / `#E11D48`):** Vivid operational red reserved for the active sidebar selection, primary CTAs ("+ Nuevo Repuesto / Ingreso"), critical status tags, and urgent overdue warnings.
- **Success / In Stock (`#10B981`):** Crisp emerald green for parts available, normal quantity margins, and completed audits.
- **Warning / Low Stock (`#F59E0B`):** Amber tone for stock thresholds requiring reorder or pending procurement.
- **Danger / Urgent Out-of-Stock (`#EF4444`):** Red badge for 0-quantity alerts and broken component diagnostics.
- **Info / Category Tags (`#3B82F6` / `#8B5CF6`):** Soft tints for hardware classification tags (e.g., Pantallas, Placas, Baterías, Formateo).

## Typography

The type system relies on **Inter** to ensure maximum glyph clarity across dense technical specifications, hardware serial numbers, and rapid-scanning stock dashboards.

- **Headlines:** Set in bold and extra-bold weights (`700` and `800`) with tight tracking (`-0.02em`) to establish unambiguous views such as module titles and main inventory counter headers.
- **Data & Numbers:** Tabular figures are enabled globally across all numeric indicators (stock counters, part counts, SKU IDs, prices).
- **Badges & Micro-Labels:** Styled in `label-md` and `label-sm` with uppercase transformation and slight positive letter-spacing (`0.04em` to `0.06em`) for fast visual decoding under shop floor lighting.

## Layout & Spacing

The layout is built around a persistent fixed-rail sidebar navigation (`220px`) and an expansive, fluid data workspace.

### Structural Mechanics
- **Sidebar Rail:** Fixed left at `220px` width, vertically spanning 100vh with a segmented white background, bottom pinned profile card, and top branded logo header.
- **Main Viewport Canvas:** Employs an edge-to-edge scrollable container with `space-2xl` (24px) inline padding on desktop and `space-lg` (16px) on mobile/tablet.
- **Inventory Grid Rhythm:** 
  - **Desktop (>= 1280px):** 4-column responsive grid with `space-lg` (16px) gutters.
  - **Tablet (768px - 1279px):** 2-column or 3-column auto-wrap layout.
  - **Mobile (< 768px):** 1-column card stack; the sidebar collapses into a floating bottom bar or left sheet drawer.

### Section Spacing Rhythm
- Headers and view toggles stack with `space-lg` (16px) gaps.
- Sub-filters, category chips, and tabbed status counters sit within a contained horizontal control strip using `space-md` (12px) vertical buffer from card sections.

## Elevation & Depth

This system intentionally rejects heavy, deep dropshadows in favor of lightweight, clean architectural borders and very subtle atmospheric ambient blurs:

- **Level 0 (Canvas):** Flat `#F8FAFC`, non-elevated.
- **Level 1 (Cards & Data Panels):** `#FFFFFF` surface enclosed in a 1px solid border (`#E2E8F0`) with an ambient lift: `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Level 2 (Interactive Hover / Segmented Controls):** Applied to card hover states and active pill bars: `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Primary Action Glow):** Corporate Red action buttons utilize a soft branded ambient shadow: `box-shadow: 0 4px 14px 0 rgba(220, 38, 38, 0.35)`.
- **Level 4 (Modals & Overlays):** `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.

## Shapes

The design uses a clean, friendly, modern rounded language (`roundedness: 2`):

- **Data Cards:** `rounded-xl` (12px - 14px) with continuous 1px borders for a polished hardware catalog appearance.
- **Primary Buttons & Navigation Badges:** `rounded-xl` (10px - 12px) for comfortable touch targets and ergonomic mouse interactions.
- **Pills, Status Badges & Filter Chips:** Full capsule rounding (`rounded-full` / 9999px) to differentiate statuses and categories from structural containers.
- **Input Fields & Search Bars:** `rounded-lg` (8px - 10px) with inward-focused focus rings.

## Components

### 1. Navigation Sidebar
- **Brand Block:** Houses the PCMYM logo mark in high-contrast dark `#0F172A` with the uppercase subtitle "SERVICIO TÉCNICO" in `#94A3B8`.
- **Nav Items:** 
  - *Active:* Solid corporate red background (`#DC2626`), white text, bold font, rounded-xl shape, with matching white iconography.
  - *Inactive:* Transparent background, `#64748B` text, shifting to `#0F172A` with `#F1F5F9` background on hover.
- **Footer Profile:** Pinned to bottom, includes circular initials avatar (`#0F172A` background, white bold text), user role designation, and a discreet logout icon.

### 2. Primary Buttons & Controls
- **Primary CTA ("+ Nueva orden", "+ Nuevo repuesto"):** Vivid red (`#DC2626`) fill, pure white text, bold weight, rounded-xl geometry, flanked with a soft red glow shadow.
- **Segmented View Toggles (Kanban, Pestañas, Lista):** Grouped neutral container in `#F1F5F9` with `#E2E8F0` internal borders; selected item features a white rounded capsule with subtle elevation.
- **Flagged Filter Button ("Solo atención"):** Outlined with `#FECACA` border, soft `#FEF2F2` background, and primary red icon and typography.

### 3. Category & Filter Chips
- **Active Filter:** Deep dark pill (`#0F172A`) with crisp white text.
- **Inactive Filter:** White background, light border (`#E2E8F0`), slate text (`#475569`), hover state transitions to `#F8FAFC`.
- **Service Classification Badges:** Delicate pastel fills with contrasting text:
  - *Reparación:* Pale cyan/sky background (`#E0F2FE`) with `#0284C7` text.
  - *Formateo:* Soft lavender background (`#F3E8FF`) with `#7E22CE` text.
  - *Sin clasificar:* Muted gray background (`#F1F5F9`) with `#64748B` text.

### 4. Inventory & Service Cards
- **Structure:** Solid white card with 1px border `#E2E8F0`, 14px rounded corners.
- **Header Line:** Item identifier code (e.g. `#42`) in `#94A3B8` on the left; operational badge on the right.
- **Operational Badges:**
  - *URGENTE / CRÍTICO:* Solid `#DC2626` pill, pure white bold text.
  - *NORMAL / DISPONIBLE:* Subdued `#F1F5F9` pill with dark gray/black `#334155` text.
- **Body:** Bold title in `#0F172A` (`15px`, bold), immediate secondary line indicating technician / client / brand model in `#64748B`.
- **Card Footer:** Distinct separated footer containing temporal indicators (e.g., "Recibida hace 1 día", "Stock: 4 unidades") and dynamic alert lines ("Vencida hace 16 días" or "Agotado") styled in bright bold red (`#DC2626`).

### 5. Status Tabs Counter
- Horizontal tab bar running below global filters with an active red underline indicator (`3px` height, `#DC2626`).
- Each tab item displays the phase name in `#64748B` (or `#DC2626` when selected) followed by an inline numeric counter pill styled with light padding and a muted background.