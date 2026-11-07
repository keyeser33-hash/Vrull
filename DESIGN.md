# DESIGN.md

Omal UI v2, the brand guide for AI coding agents working on the Omal B2B portal ("Omal Tour Operator by Global Travel"). Copy this file next to `globals.css`, in the repo root or in `.agents/`, and read it with the theme tokens before writing any UI. Prodhuar nga Claude (AI); rishikohet nga Andi. Source of the values: `tokens.json` of Omal UI v2 (25.10.2026).

## Purpose

A B2B booking tool for 300–500 travel agencies selling Turkey charter packages (Tirana → Antalya, Bodrum). Agents compare hotels, copy offers to clients on WhatsApp and book seats on charter flights, mostly from a phone. The UI must feel calm, exact and fast: grey surfaces, ink for ordinary actions, and one amber, the brand, for the actions that spend money or hold seats. Nothing decorative competes with the price, the dates and the status.

## Colors

shadcn variables in `x` / `x-foreground` pairs, extended in the same shape. Three themes: `light` (`:root`), `dark` (`.dark`), `oled` (`.oled`, with `.dark` kept on `<html>`). Hex is the source of truth.

| Variable | light | dark | oled | Role |
|---|---|---|---|---|
| `--background` | `#FAFAFA` | `#0F0F0F` | `#000000` | Page ground |
| `--foreground` | `#171717` | `#FAFAFA` | `#F5F5F5` | Body text, selection stripe |
| `--card` | `#FFFFFF` | `#171717` | `#0B0B0B` | Cards, dialogs, sheets, every field |
| `--card-foreground` | `#171717` | `#FAFAFA` | `#F5F5F5` | Text on card (= foreground) |
| `--popover` | `#FFFFFF` | `#171717` | `#0B0B0B` | Menus, popovers (= card) |
| `--popover-foreground` | `#171717` | `#FAFAFA` | `#F5F5F5` | Text on popover |
| `--muted` | `#F5F5F5` | `#141414` | `#050505` | Wells, tab track, placeholders |
| `--muted-foreground` | `#666666` | `#A3A3A3` | `#A3A3A3` | Secondary text, placeholders (≥ 5.0:1) |
| `--secondary` | `#F0F0F0` | `#222222` | `#1A1A1A` | Secondary button, neutral badge |
| `--secondary-foreground` | `#171717` | `#FAFAFA` | `#F5F5F5` | Text on secondary |
| `--primary` | `#171717` | `#FAFAFA` | `#FAFAFA` | Ink: the ordinary main action |
| `--primary-hover` | `#333333` | `#E5E5E5` | `#E5E5E5` | Hover of primary |
| `--primary-foreground` | `#FFFFFF` | `#171717` | `#171717` | Text on primary |
| `--accent` | `#F5F5F5` | `#222222` | `#0F0F0F` | Hover / highlight ground (shadcn), never brand |
| `--accent-foreground` | `#171717` | `#FAFAFA` | `#F5F5F5` | Text on accent |
| `--brand` | `#F1A335` | `#F1A335` | `#F1A335` | Amber: money and seat actions, marks |
| `--brand-hover` | `#E8952A` | `#E8952A` | `#E8952A` | Hover of brand |
| `--brand-foreground` | `#2A2520` | `#2A2520` | `#2A2520` | Text on brand (7.2:1) |
| `--brand-soft` | `#FEF3E2` | `#2B2112` | `#1C150A` | Amber tint |
| `--selected` | `#FEF3E2` | `#2B2112` | `#1C150A` | Selected row / card (= brand-soft) |
| `--inverse-foreground` | `#FAFAFA` | `#0F0F0F` | `#000000` | Text on a foreground ground |
| `--inverse-muted-foreground` | `#A3A3A3` | `#6B6B6B` | `#555555` | Secondary text on a foreground ground |
| `--border` | `#E5E5E5` | `#2A2A2A` | `#262626` | Card hairline |
| `--border-subtle` | `#ECECEC` | `#222222` | `#1C1C1C` | Row hairline |
| `--border-decorative` | `#B5B5B5` | `#444444` | `#3D3D3D` | Dashed placeholders, flight track |
| `--input` | `#8F8F8F` | `#6B6B6B` | `#666666` | Control border (≥ 3:1 on card) |
| `--ring` | `#171717` | `#FAFAFA` | `#F5F5F5` | Focus ring |
| `--skeleton` | `#F5F5F5` | `#141414` | `#1E1E1E` | Loading blocks |
| `--link` | `#171717` | `#FAFAFA` | `#F5F5F5` | Links (= foreground, underlined) |
| `--star` | `#171717` | `#FAFAFA` | `#F5F5F5` | Hotel stars (= foreground) |
| `--exclusive` | `#FFFFFF` | `#171717` | `#171717` | Text of the solid Exclusive badge |
| `--exclusive-soft` | `#171717` | `#FAFAFA` | `#FAFAFA` | Ground of the solid Exclusive badge |
| `--exclusive-border` | `#171717` | `#FAFAFA` | `#FAFAFA` | Ring of the outline Exclusive badge |
| `--success` | `#1E6B34` | `#8FD1A6` | `#8FD1A6` | Konfirmuar |
| `--success-soft` | `#E6F4EA` | `#14301F` | `#0B2415` | Ground of success |
| `--warning` | `#7A4A06` | `#F2C58A` | `#F2C58A` | Në pritje, Me kërkesë |
| `--warning-soft` | `#FEF3E2` | `#2B2112` | `#1F1608` | Ground of warning |
| `--destructive` | `#B83A3A` | `#F4978E` | `#F4978E` | Error, Anuluar, overdue |
| `--destructive-foreground` | `#FFFFFF` | `#171717` | `#171717` | Text on solid destructive |
| `--destructive-soft` | `#FBEDED` | `#3A1A17` | `#2A0F0C` | Ground of error |
| `--chart-1` | `#F1A335` | `#F1A335` | `#F1A335` | Histogram, slider fill (= brand) |
| `--chart-track` | `#E5E5E5` | `#2A2A2A` | `#262626` | Slider track (= border) |
| `--panel` | `#171717` | `#171717` | `#0B0B0B` | The surface that stays dark in every theme |
| `--panel-foreground` | `#FAFAFA` | `#FAFAFA` | `#F5F5F5` | Text on panel |
| `--panel-muted-foreground` | `#A3A3A3` | `#A3A3A3` | `#A3A3A3` | Secondary text on panel |
| `--panel-border` | `#2A2A2A` | `#2A2A2A` | `#333333` | Hairline on panel |
| `--panel-button` | `#6B6B6B` | `#6B6B6B` | `#666666` | Secondary button on panel |
| `--overlay` | `rgba(23,23,23,0.45)` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.7)` | Scrim behind dialogs and sheets |

Shadows and halo: `--shadow-sm` `0 1px 2px 0 rgba(0,0,0,0.06)` light / `…0.5` dark, oled; `--shadow-md` `0 6px 16px -4px rgba(0,0,0,0.10)` / `…0.6`; `--shadow` = `--shadow-pop` `0 12px 32px -8px rgba(0,0,0,0.18)` / `…0.7`; `--ring-halo` `0 0 0 4px rgba(241,163,53,0.45)` (0.55 in oled).

The brand family: `brand` is the one hue. It is a ground (the brand button, the offer count) or a mark (dots, check discs, the 2px active underline, the current step bar, chart fills, icon accent points, the logo). It is never text and never a glyph on a light ground: 2.0:1 on `background`. On amber, text is always `brand-foreground`, never white.

Measured contrast (WCAG 2): `brand-foreground` on `brand` 7.25:1 in all themes; `foreground` on `brand-soft` 16.3 / 15.1 / 16.6:1; `muted-foreground` on `background` 5.5 / 7.6 / 8.3:1 (light / dark / oled).

## Typography

- One family: **Inter** from Google Fonts (`opsz` 14..32, `wght` 400..700), stack `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`. No second face, no mono: numbers use `font-variant-numeric: tabular-nums`.
- Scale: `caption` 12/16 400 (the floor), `small` 14/20 400, `label` 14/20 500, `body` 16/24 400, `body-strong` 16/24 600, `h4` 18/28 600 −0.01em, `h3` 20/28 600 −0.015em, `h2` 24/32 600 −0.02em, `h1` 30/36 600 −0.025em (one per page).
- Field values are 16px on every screen (iOS zoom). Buttons are 14/20 600. Uppercase only for the `Exclusive` and `Anuluar` badges.

## Layout & spacing

- Spacing: 4px base: `space-1` 4, `space-2` 8, `space-3` 12, `space-4` 16, `space-5` 20, `space-6` 24, `space-8` 32, `space-10` 40, `space-12` 48.
- Gutters: desktop 40 (`space-10`), phone 16 (`space-4`). Cards pad 24 on desktop, 16 on a phone, with 24 between cards. Label 6px above its field; fields stack 16.
- Radius: `radius-sm` 8 (menu rows, thumbnails, tooltip), `radius-md` 12 (fields, photos, calendar days), `radius-lg` 16 (popovers, menus, alerts), `radius-xl` 24 (cards, dialogs, sheets, panel), `radius-pill` 9999 (every button, badge, chip, tab, toast, switch). Checkbox 4px, radio round.
- Control sizes, one measure for desktop and phone: `control-lg` **44px** (every field, main action, menu row, nav link, stepper, anything tapped), `control-md` 40 (dialog footers, page pills), `control-sm` 32 (toolbars, the row Rezervo, chips with a 44px hit area), `row` 56 (table rows).
- Phone frame: 390 × 844. Tables become card lists; dialogs become bottom sheets; the main action is full width at the bottom; navigation is a five-place bottom bar; nothing scrolls the page sideways.

## Components & button hierarchy

| Variant | Class / cva | Ground / text | Use |
|---|---|---|---|
| Brand | `btn-brand` / `brand` | `brand` / `brand-foreground` | **Rezervo, Konfirmo rezervimin, Paguaj, Konfirmo pagesën.** Nothing else. |
| Primary | `btn-primary` / `default` | `primary` / `primary-foreground` | The one ordinary main action: Apliko, Kopjo ofertën, Ruaj, Dërgo kërkesën te GTA |
| Outline | `btn-outline` / `outline` | `card`, 1px `input` / `foreground` | Secondary actions: Edito, Ndrysho fluturimin, Shiko detajet |
| Secondary | `btn-secondary` / `secondary` | `secondary` / `secondary-foreground` | Quiet secondary actions |
| Ghost | `btn-ghost` / `ghost` | transparent / `muted-foreground` | Toolbar and tertiary actions |
| Destructive | `btn-destructive` / `destructive` | `destructive` / `destructive-foreground` | Irreversible actions, after a dialog that names them |

The Rezervo rule:

1. **One `btn-brand` per view**, and only for an action that moves money or holds seats.
2. **Exception: a results list.** Each result row may carry its own 32px `btn-brand` "Rezervo" (the industry norm in RateHawk and Expedia TAAP). The row's other actions stay outline or ghost.
3. **One `btn-primary` per view** for the ordinary main action ("Kopjo ofertën" in the offer bar). A view may hold one of each; they never label the same task.
4. All buttons are `radius-pill`. Sizes: 44 default, 40 `md`, 32 `sm`. Hover: `brand-hover`, `primary-hover`, `accent` for outline and ghost.
5. On `panel` (dark in every theme) the main action is `btn-on-panel` (`panel-foreground` ground, `panel` text); the secondary one is `btn-panel` (`panel-button` / `panel-foreground`). Never `btn-primary` on panel (ink on ink in light); `btn-brand` there only when the action moves money.

Other components read the same tokens: selected rows and cards use `selected` plus a 3px `foreground` stripe or 2px border; badges are 24px pills with a word; hotel stars use `star`; the active tab, nav link and bottom-nav place carry a 2px `brand` underline with `foreground` text; the offer bar is a floating pill with a `brand` count and the page's one `btn-primary`; toasts and tooltips are `primary` pills.

## Content rules

- Albanian UI copy; technical terms stay English (`Exclusive`, `All Inclusive`, `Check-in`, `Stop sale`). Sentence case; title case only for hotel and person names. No exclamation marks, no emoji, no em dashes.
- Buttons: verb + object ("Kopjo ofertën", "Dërgo kërkesën te GTA").
- Dates: `04.10.2026` in fields, `e diel 04.10` in rows; ranges `04.10 → 10.10 · 6 netë`; times 24h `02:25`.
- Money: `€1.776` in rows, `1.284,00 €` in documents; European separators; `tabular-nums`. Prices come from TourVisio only: never round, average or invent; `[VLERA]` where there is no source.
- Pax: `2 të rritur + 1 fëmijë (7)`.
- Status words (fixed): `Konfirmuar` (success), `Në pritje` and `Me kërkesë` (warning), `Anuluar` (destructive, solid, uppercase), `Exclusive` (exclusive, uppercase), `Stop sale` (destructive). Always the word, never colour alone.

## Taste rules / things to avoid

- Grey first, ink second, amber last. If a screen has more amber than one button and a few marks, it is wrong.
- Never amber text, never an amber glyph on a light ground, never amber stars, never white on amber.
- Never use `accent` for the brand; `accent` is hover.
- Never more than one `btn-brand` per view outside a results list; never `btn-brand` for Apliko, Ruaj or Kopjo ofertën.
- No hex, `rgb()` or named colours in components; no gradients; no emoji; no second accent; navy only inside the supplied logo; no JetBrains Mono or any second font.
- No text under 12px; no control under 44px where it is tapped; no cards inside cards; no coloured left-border cards; no state shown by colour alone.
- Do not flatten the themes: check every new pair in light, dark and oled.

## How an agent applies this theme

1. Read `globals.css` and this file first. Use the Tailwind token classes (`bg-brand`, `text-brand-foreground`, `bg-accent`, `border-input`, `bg-selected`, `bg-panel`) or `var(--…)`. **Never hardcode a hex value.**
2. Need a new colour? Extend the tokens in the same shape: add `--x` and `--x-foreground` (and `--x-soft` if it needs a tint) to `:root`, `.dark` and `.oled` in `globals.css`, map `--color-x` in `@theme inline`, add it to `tokens.json` with a usage note naming the grounds it reads on, and check 4.5:1 (text) or 3:1 (borders, icons) in all three themes.
3. Buttons: use the six variants above. Before adding `variant="brand"`, ask: does this click move money or hold seats? If not, it is `default` or quieter. Count the brand buttons in the view: one (results rows excepted).
4. Make every tappable element 44px (`h-11`) on desktop and phone; inputs 16px text; check the 390px phone layout for every page.
5. Focus: keep `outline: 2px solid var(--ring); outline-offset: 2px` on every focusable element. Never remove it.
6. Themes: test `light`, `.dark` and `.dark.oled` before merging.
7. Guard it in CI. Suggested stylelint config for component CSS:

   ```json
   {
     "rules": {
       "color-no-hex": true,
       "color-named": "never",
       "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "linear-gradient", "radial-gradient"]
     },
     "overrides": [{ "files": ["app/globals.css"], "rules": { "color-no-hex": null, "function-disallowed-list": null } }]
   }
   ```

   Plus a grep in CI that fails on `#[0-9A-Fa-f]{3,8}\b`, `text-brand\b` and `text-\[#` in `*.tsx`.
8. After every AI change, re-check focus rings, `aria-*`, 44px targets, the one-brand-per-view rule and form validation.
