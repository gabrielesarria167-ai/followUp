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
  red-hover: "#f26464"
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

- **Green** (green): done or go. Contattato, "completato", the selected month (bar and filled badge), the selected row, the license chip, and the Invia su WhatsApp fill.
- **Yellow** (yellow): waiting. Da contattare, and the license chip when 30 days or fewer are left.
- **Red** (red): blocked or discarded. Senza cellulare, phone-field warnings, load errors, a rejected key, and the Elimina fill.
- **Blue** (blue): neutral info and primary action. The "N fatture" pill, the focus ring, text selection, and the Successiva, Conferma, Salva and update-button fills.
- **Slate** (muted): worth knowing, not blocking. The "senza telefono fisso" pill: a missing landline matters less than a missing mobile, so it stays out of the signal colors.
- **Neutrals**:
  - bg is the page ground and recessed inputs.
  - surface is cards, the table, and outlined buttons.
  - raised is the month badges, the detail icon tile, and disabled fills.
  - line and line-strong are hairlines and control borders.
  - text, muted, faint and off are the text levels, from primary down to disabled.

### Named Rules
**The Pill Rule.** Every state uses the same pill: a 10px dot in the state color, a 14% tint fill, a 45% tint border, and text in the normal text color. In CSS this is `.pill` / `.state` driven by `--c`.

**The Fills Rule.** Only the action buttons are filled: Invia su WhatsApp (green), Elimina (red), and Invia Email, Successiva, Conferma, Salva and the update button (blue). Every other button is outlined on surface.

## Typography

System font only (Segoe UI Variable Text). Hierarchy comes from size and weight 600/700, with no second family and no uppercase.

- **Title**: 32px / 700 (month heading)
- **Brand**: 26px / 700
- **Detail headline**: 22px / 700
- **Body**: 14px
- **Labels and pills**: 13px

Client names and places from Wincar are shown in title case. Dates, numbers, totals and phones use tabular figures, and totals align right.

## Layout

A grid of months (230px), list (fluid) and detail (400px), with 24px gaps and page padding of 24px 32px 72px. The header bar (brand, the licensed company with its logo tile, license chip, search, Aggiorna) sits on #0b1526 with a hairline below it; a matching bar fixed at the bottom holds the status line on the left (archive date, preview note, a note when Wincar's customer registry is missing or unreadable, load errors). The detail panel is sticky and never taller than the window: its body scrolls while the actions stay at the bottom.

The window opens at 1400×880, or smaller to fit the screen.

Under 1380px (laptops such as 1366×768):
- the side columns narrow to 200px and 344px
- gaps and page padding shrink to 20px / 24px
- the Nº column is hidden

When the window is 820px tall or less, the vertical rhythm tightens (header, month items, detail panel and controls) so that all twelve months and the whole panel, buttons included, fit in one screen.

Under 1180px:
- the search moves to a full-width row of its own under the header bar
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
  - the phone and email fields (email is typed in FollowUp: Wincar has none)
  - while still to contact: the five message templates (the one in use wears the selected-row look; each has its own Modifica button, which rewrites it for every client) and the Messaggio libero box (recessed bg, emoji button and character count), filled from the template and editable
  - full-width Invia su WhatsApp (green), then Invia Email (blue)
  - after Invia Email, a blue tinted note asks "L'hai inviata?": Sì, inviata (outlined) marks it contacted, and Non si è aperta copies the recipient, subject and text for webmail. Windows can take a mailto link without any mail program showing up, so only the owner can confirm it.
  - Elimina (red) and Successiva (blue) side by side
  - once handled, a green tinted note with the Annulla link
- **Logo tile** (header): the company logo on white, or the building icon. A click opens a small menu under it (Scegli immagine…, and Rimuovi logo once one is set): a surface card with a hairline, items tinted raised on hover.
- **License chip** (header): the days left and the expiry date, green, or yellow when the license is expiring.
- **Template editor**: a centered dialog card over the dimmed app, hairline and no shadow: the template name, its text, the placeholder hint, the Ripristina link, Annulla and a blue Salva.
- **License screen**: a centered dialog card on a blue glow, with a green shield badge, the key textarea, a full-width blue Conferma, and the reason and error shown as tinted notes.

## Don'ts
- Don't add features or chrome just because the mockup shows them. Add them one at a time when built.
- Don't give one meaning two colors, or one color two meanings.
- Don't fill buttons other than the ones above.
- Don't add a second typeface, uppercase labels or letter-spacing.
