# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(An Electron desktop window on the client's Windows PC. The design language is web, not native Windows.)

## Users
The owner of a small Italian car-repair shop (officina) that runs Wincar for invoicing. Once a month they sit down at the office PC, pick the month that just closed, and go through all of that month's invoices in one session (about 22–27 a month), sending each client a WhatsApp follow-up.

## Product Purpose
FollowUp turns the month's invoices into a follow-up list: who was invoiced, for which vehicle, and whether there's a phone to reach them. One click opens WhatsApp with a prefilled "how did the job go, are you satisfied?" message, which the owner sends by hand. Success means the month gets fully worked through in one sitting, with nobody forgotten and nobody messaged twice.

## Positioning
FollowUp isn't a CRM or a marketing tool. It's a single-purpose after-work checklist built on the shop's own Wincar invoices. It never changes the invoicing data and never sends anything on its own.

## Operating Context
- The data comes from Wincar's `TESFAT` table (`wcFatture.mdb`), shipped inside the FollowUp folder. Updating it means replacing that file.
- Many invoices go to the same fleet or dealer clients (in 2026, 15 distinct clients for about 25 invoices a month), so the same client can repeat several times in a month.
- Phones come from `F_TELEFO` in the real data. The owner can add or correct a phone, and it's remembered per client.
- WhatsApp opens through `wa.me` (WhatsApp Desktop or Web) and the owner sends manually.
- An invoice disappears from the list 7 days after it was messaged or dismissed.

## Capabilities and Constraints
- Month/year filter, an "Aggiorna" button at the top right, a summary (invoices, with phone, without phone, contacted), and one row per invoice.
- Per-invoice fields: date, number, client, city + CAP, payment method, vehicle (make, model, version) + plate, total, phone.
- Actions: WhatsApp (marks as contacted), Elimina (dismiss), Annulla (undo within the 7 days).
- Read-only on Wincar data. Italian UI.
- Open (waiting on the client): excluding credit notes, one row per invoice vs per client, final message text, the +39 default.

## Brand Commitments
The name is **FollowUp**. The logo is still to be decided, and there's no garage branding to carry yet.

The user's standing preference: **simplicity and a natural, familiar feel come before visual design.** Use a dark theme. Layout: month list on the left, invoices in the middle, a detail panel for the selected invoice on the right (message preview, Apri WhatsApp, Elimina, Successiva).

## Evidence on Hand
Burner sample data: `FollowUp_handoff/tesfat_sample.json`, `data/wcFatture.mdb` (3,302 invoices from 2007–2026, real-looking Italian client names, vehicles and plates). In the sample, `F_TELEFO` is empty. The client's real data has the same structure.

## Product Principles
- The month is the unit of work: finishing a month should feel like closing it.
- Contactable vs not contactable must be readable at a glance.
- Nothing is sent without the owner seeing it first.
- Never touch the source data. FollowUp's own state stays separate.
