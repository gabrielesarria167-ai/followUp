---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["style.css","renderer.js"]
---

# Surface brief: FollowUp main screen

Scope: the one and only screen of FollowUp (index.html + style.css + renderer.js). Mode: Operate.
Audience: garage owner, one monthly sitting, works through ~22–27 invoices of the month that just closed.
Task: pick month, select invoice, check phone + message, Apri WhatsApp, Successiva. Dismiss with Elimina; undo with Annulla within 7 days.
Constraints: user's standing preference — simplicity and natural, familiar feel over visual design; dark theme; system font (Segoe UI on Windows).

## Direction contract

THESIS: A quiet dark work screen for one monthly session: months, list, detail. It refuses dashboard chrome (metric cards, banners, decoration); the only accent marks what is selected.
OWN-WORLD: graphite ground #17181A, surface #1C1D20, hairlines #26282B, text #E9EAE6, muted #A3A59F; one yellow accent #F2CF3A used only for the selected month pill and contacted-state dot; WhatsApp green #1A7A45 for the single primary action; warm orange #FF8A5C for "senza telefono". Segoe UI / system-ui, 14px base, 26px month title, 20px client name.
STORY: The owner sees which month still has work (counts in the month list), reads the list top-down, checks the message before sending, sends, and moves to the next with Successiva until the month count reaches zero.
FIRST VIEWPORT: Top bar: FollowUp left, "Fatture fino al …" + Aggiorna right. Below, three columns: month list (200px, year select on top, open count per month, selected month with yellow pill), invoice table (Data, Nº, Cliente+città, Veicolo short+targa, Totale, Stato dot+label), sticky detail panel (340px: fattura nº + date, client name, vehicle/payment/total, phone input, message preview, Apri WhatsApp full width, Elimina + Successiva). Under 1180px the months become a row above and the panel stays beside the list.
FORM: Sketch G "Quieto" — simplification of sketch D (A's layout + C's detail panel, dark), chosen by the user after three rounds of sketches on the Design canvas; seed key 24776ac5 (original roll).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
