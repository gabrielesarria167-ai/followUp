---
name: FollowUp
description: A lively navy work screen for one monthly follow-up session.
colors:
  bg: "#0a1322"
  surface: "#0f1b2e"
  raised: "#15243b"
  line: "#1c2b44"
  line-strong: "#2a3c5a"
  text: "#e8eef7"
  muted: "#8fa0b8"
  faint: "#7a8ba3"
  off: "#55657d"
  hover: "#13213a"
  green: "#22c55e"
  green-hover: "#2fd36c"
  blue: "#2f7cf6"
  blue-hover: "#4a8ff8"
  yellow: "#f5c518"
  red: "#ef4444"
  brand: "#3ddc84"
typography:
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
  brand:
    fontSize: "26px"
    fontWeight: 700
  headline:
    fontSize: "22px"
    fontWeight: 700
  body:
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontSize: "13px"
    fontWeight: 400
rounded:
  control: "8px"
  container: "12px"
  dialog: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
---

# Design System: FollowUp

## Overview

**Creative North Star: "The Bright Desk"**

The same three-column screen as before (months on the left, the month's invoices in the middle, the selected invoice on the right), now on a deep navy ground with a soft blue glow. Color carries meaning: every state has its own color, shown as a tinted pill.

Simplicity still comes first. The color makes state readable at a glance; it isn't decoration. New controls are only added when a feature needs them.

## Colors

Navy neutrals plus four signal colors. Each signal color has one meaning.

- **Green** (green): done or go. Contattato, "completato", the selected month (bar and filled badge), the selected row, the license chip, and the Apri WhatsApp fill.
- **Yellow** (yellow): waiting. Da contattare, and the license chip when 30 days or fewer are left.
- **Red** (red): blocked. Senza telefono, phone-field warnings, load errors, a rejected key.
- **Blue** (blue): neutral info and primary action. The "N fatture" pill, the focus ring, text selection, and the Conferma button on the license screen.
- **Neutrals**:
  - bg is the page ground and recessed inputs.
  - surface is cards, the table, and outlined buttons.
  - raised is the month badges, the detail icon tile, and disabled fills.
  - line and line-strong are hairlines and control borders.
  - text, muted, faint and off are the text levels, from primary down to disabled.

### Named Rules
**The Pill Rule.** Every state uses the same pill: a 10px dot in the state color, a 14% tint fill, a 45% tint border, and text in the normal text color. In CSS this is `.pill` / `.state` driven by `--c`.

**The Two Fills Rule.** Only two buttons are filled: Apri WhatsApp (green) and Conferma on the license screen (blue). Every other button is outlined on surface.

## Typography

System font only (Segoe UI Variable Text). Hierarchy comes from size and weight 600/700, with no second family and no uppercase.

- **Title**: 32px / 700 (month heading)
- **Brand**: 26px / 700
- **Detail headline**: 22px / 700
- **Body**: 14px
- **Labels and pills**: 13px

Client names and places from Wincar are shown in title case. Dates, numbers, totals and phones use tabular figures, and totals align right.

## Layout

A grid of months (230px), list (fluid) and detail (400px), with 24px gaps and page padding of 24px 32px 48px. The header bar sits on #0b1526 with a hairline below it. The detail panel is sticky.

Under 1180px:
- the months become a wrapping row with the selection bar underneath
- the panel narrows to 340px
- the Nº column is hidden

## Elevation & Depth

Depth comes from tone and hairlines. The only shadow is on the license dialog card. The selected table row is a single green-tinted overlay with a green 1px border and 8px radius (a `::after` on the row, so cell edges show no seams).

## Icons

Icons in `assets/` are copied from Lucide (lucide-static 0.460.0, ISC) and Simple Icons (WhatsApp glyph, simple-icons 13.21.0, CC0); add new ones from the same sets. They are shown through `.ico` + `.i-<name>` (a CSS mask), so they take the current text color, and the renderer never builds SVG markup.

## Components

- **Month item**: 46px tall, with a count badge (a raised pill). When selected: a darker fill, a 4px green left bar, and a filled green badge.
- **Table**: a 12px-radius card, with 13px 600 headings in text color and two-line cells.
- **Detail panel**:
  - an icon tile with the client name and place
  - Veicolo, Fattura, Pagamento and Totale rows, each with an icon
  - the phone field, the message box (recessed bg), and full-width Apri WhatsApp
  - Elimina and Successiva side by side
  - once handled, a green tinted note with the Annulla link
- **License chip** (header): the days left and the expiry date, green, or yellow when the license is expiring.
- **License screen**: a centered dialog card on a blue glow, with a green shield badge, the key textarea, a full-width blue Conferma, and the reason and error shown as tinted notes.

## Don'ts
- Don't add features or chrome just because the mockup shows them. Add them one at a time when built.
- Don't give one meaning two colors, or one color two meanings.
- Don't fill buttons other than the two above.
- Don't add a second typeface, uppercase labels or letter-spacing.
