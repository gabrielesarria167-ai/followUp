# Glossary

- **Archive**: the shop's Wincar `wcFatture.mdb`, read-only. FollowUp never writes to it.
- **Invoice**: a `FI` row of the Archive. Credit notes are excluded.
- **License**: the per-shop key, bound to the shop's P.IVA, checked offline.
- **Session**: the running app's view of the Archive and License together. It decides whether the app is locked and, only when unlocked, hands out Invoices and their views. Owns the clock rule (`lastSeen`).
- **Outreach**: contacting a client about an Invoice by WhatsApp or email. Resolves which phone or email applies (saved in FollowUp beats Wincar's customer registry, `wcTabelle.mdb` table `CLIENT`), builds the link, and says what follow-up state results. Knows nothing about the License.
- **Follow-up state**: per Invoice, pending, contacted, or dismissed. FollowUp's own data, never stored in Wincar.
