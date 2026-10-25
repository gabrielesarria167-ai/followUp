---
name: FollowUp
description: A quiet dark work screen for one monthly follow-up session.
colors:
  graphite: "#17181a"
  surface: "#1c1d20"
  raised: "#232427"
  hairline: "#26282b"
  line-strong: "#3a3c40"
  text: "#e9eae6"
  muted: "#a3a59f"
  faint: "#8e908a"
  off: "#6e706b"
  accent: "#f2cf3a"
  selected: "#2a2b2f"
  hover: "#222326"
  whatsapp: "#1a7a45"
  whatsapp-hover: "#1f8a50"
  warn: "#ff8a5c"
typography:
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
  headline:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
  brand:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  caption:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
components:
  button:
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-whatsapp:
    backgroundColor: "{colors.whatsapp}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "44px"
  button-whatsapp-hover:
    backgroundColor: "{colors.whatsapp-hover}"
  link:
    textColor: "{colors.text}"
  input:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "40px"
  month-item:
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0 12px 0 16px"
    height: "38px"
  month-item-hover:
    backgroundColor: "{colors.hover}"
  table-box:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  table-row-selected:
    backgroundColor: "{colors.selected}"
  detail-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "20px"
    width: "340px"
  message-preview:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
---

# Design System: FollowUp

## Overview

**Creative North Star: "The Quiet Desk"**

One dark screen for one monthly sitting: months on the left, the month's invoices in the middle, the selected invoice beside them. Graphite ground, slightly lifted surfaces, hairline borders, the system font at a calm 14px. Nothing on screen is there to decorate; the eye goes to the selected month, the selected row and the one green action.

The product commitment drives the world: simplicity and a natural, familiar feel come before visual design. Controls look like the controls people already know on a Windows PC (outlined buttons, a native select, a plain text field, an underlined link). There are no metric cards, banners, badges or illustrations.

**Key Characteristics:**
- Dark, low-contrast tonal surfaces separated by 1px hairlines, never shadows.
- One yellow accent, reserved for what is selected or done.
- One filled button per screen: WhatsApp green.
- System type only, weight 600 as the only emphasis.
- Status read through a small dot plus a plain word.

## Colors

A near-neutral graphite palette with three signal colors, each owning one meaning.

### Primary
- **Selection Yellow** (accent): the selected month (its 3px left marker and open count) and the "Contattato" dot. Also the keyboard focus ring and text selection, as system affordances.

### Secondary
- **WhatsApp Green** (whatsapp, hover whatsapp-hover): fill of "Apri WhatsApp", the single primary action. Nowhere else.

### Tertiary
- **Warm Orange** (warn): "Senza telefono" state, phone-field warnings, the load-error status. Text and dot only, never a fill.

### Neutral
- **Graphite** (graphite): page ground; also the phone input's fill so it reads as recessed.
- **Surface** (surface): table box, detail panel, empty state, year select.
- **Raised** (raised): message preview; disabled WhatsApp button.
- **Hairline** (hairline): every container border and row divider.
- **Strong Line** (line-strong): outlines of buttons, input and select.
- **Text** (text): primary text and the Annulla link.
- **Muted** (muted): secondary lines (place, plate, panel subline), labels, column heads, counts, summary.
- **Faint** (faint): rows already contacted or dismissed; input placeholder.
- **Off** (off): disabled months and buttons; the "Eliminata" dot.
- **Hover** / **Selected** (hover, selected): row and month hover; selected table row.

### Named Rules
**The Yellow Is Earned Rule.** Yellow marks only the selected month and the contacted dot (plus focus and selection). It is never a button, a heading, a border or a highlight on data.

**The One Fill Rule.** Exactly one filled button exists: Apri WhatsApp. Every other control is outlined, ghost or a link.

## Typography

**Display Font:** none; the app has no display type.
**Body Font:** Segoe UI Variable Text (with Segoe UI, system-ui, sans-serif)

**Character:** The machine's own font, so the app feels native and familiar. Hierarchy comes from size and weight 600, never from a second family, uppercase or tracking.

### Hierarchy
- **Title** (600, 26px): the month heading ("Luglio 2026").
- **Headline** (600, 20px): client name at the top of the detail panel.
- **Brand** (600, 17px): "FollowUp" wordmark in the top bar.
- **Body** (400, 14px, 1.45): table cells, buttons, months. Client names in the table at 600. Phone input at 15px.
- **Label** (400, 13px): panel field labels, the definition list, top-bar status.
- **Caption** (400/600, 12px): column heads (600, muted), second lines in cells, hints, month counts.

### Named Rules
**The Title Case Rule.** Client names and places from Wincar arrive in capitals; they are shown in title case in the table and the panel. Vehicle and payment text are shown as stored.

**The Tabular Figures Rule.** Dates, invoice numbers, totals and phone numbers use tabular numerals; totals align right.

## Layout

A three-column grid: months (200px), list (fluid), detail (340px), 24px gaps, page padding 24px 32px 48px under a top bar (12px 32px, hairline below). The detail panel is sticky at 24px from the top. Spacing steps are 8 / 16 / 24 / 32 px, with 6px and 14px used inside dense parts (labels, cell padding 10px 14px).

The detail panel reads top-down: client name, then one muted line "{Place} · Fattura {nº} del {dd/mm/yyyy}", then Veicolo / Pagamento / Totale, phone field with hint, message preview, then actions (full-width Apri WhatsApp; Elimina and Successiva side by side). Once an invoice is handled, the actions become a "Contattato il …" note with an Annulla link, plus Successiva.

Under 1180px the months become a wrapping row above the content, the panel narrows to 320px and stays beside the list, cell padding tightens to 10px, and the Nº column is hidden (the number is still in the panel).

## Elevation & Depth

Flat. No shadows anywhere. Depth is tonal: graphite ground, surface for containers, raised for the message preview, each edged with a 1px hairline. State is shown with background tone (hover, selected), never lift.

## Shapes

Soft rectangles: 6px radius for controls (buttons, input, select, month items, message preview), 8px for containers (table box, detail panel, empty state). Status dots are 7px circles; the selected-month marker is a 3px by 16px bar with 2px corners.

## Components

### Buttons
- **Shape:** gently rounded (6px), min height 40px, padding 0 16px.
- **Default (outlined):** transparent with a strong-line border; hover darkens the fill slightly; disabled text goes to off. Used for Aggiorna, Elimina, Successiva.
- **WhatsApp (primary):** WhatsApp green fill, white 600 text, 44px tall, no border; hover to whatsapp-hover; disabled drops to raised.
- **Link:** text color, underlined (3px offset), no padding. Used for Annulla.
- **Focus:** 2px yellow outline, 2px offset, on every control.

### Inputs / Fields
- **Style:** graphite fill (recessed), strong-line border, 6px radius, 40px tall, 15px tabular text, faint placeholder.
- **Label and hint:** 13px muted label above; 12px muted hint below, turning warm orange when the number is missing, invalid or a landline.

### Navigation (month list)
- Ghost rows, 38px tall, month name left, open count right in 12px muted. Hover takes the hover tone. Selected month: darker fill, 600 weight, yellow 3px left marker and yellow count. Fully worked months go muted; months with no invoices are disabled in off. A native year select sits above.

### Invoice table
- Inside a surface box with hairline border and 8px radius. Column heads 12px 600 muted. Two-line cells: primary value, then a 12px muted line (place under client, plate under vehicle). Whole row is clickable; hover and selected tones. Handled rows drop to faint.

### Status
- A 7px dot plus a word. Da contattare: text-colored dot. Contattato: yellow dot, muted word. Eliminata: off dot, muted word. Senza telefono: dot and word in warm orange.

### Detail panel
- Surface, hairline, 8px radius, 20px padding, 18px gap between groups, sticky. Message preview on raised with 6px radius.

## Do's and Don'ts

### Do:
- **Do** keep yellow for the selected month and the contacted dot only (plus focus ring and text selection).
- **Do** keep Apri WhatsApp the only filled button on the screen.
- **Do** separate surfaces with 1px hairlines and tone, at 6px (controls) and 8px (containers) radius.
- **Do** show status as a 7px dot plus a plain Italian word.
- **Do** use the system font and weight 600 for every emphasis.
- **Do** show Wincar names and places in title case.

### Don't:
- **Don't** add metric cards, banners, badges, illustrations or other dashboard chrome.
- **Don't** add shadows; depth is tonal.
- **Don't** use yellow on buttons, headings, borders or data highlights.
- **Don't** fill warm orange; it is text and dot only.
- **Don't** add a second typeface, uppercase labels or letter-spacing.
