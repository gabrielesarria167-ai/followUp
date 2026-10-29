import { existsSync, readFileSync } from 'node:fs';
import { dirname, join as joinPath } from 'node:path';
import MDBReader from 'mdb-reader';

// Credit notes (NC) excluded until the client confirms otherwise.
const INCLUDED_DOC_TYPES = ['FI'];

const COLUMNS = ['F_NUMFAT', 'F_ALFFAT', 'F_TIPDOC', 'F_DATFAT', 'F_CODCLI', 'F_RAGSOC', 'F_CITTAC', 'F_CAPCLI',
  'F_DESPAG', 'F_TARGA', 'F_DESMAR', 'F_DESMOD', 'F_DESVER', 'F_TOTFAT'];

const s = (v) => (v ?? '').toString().trim();
const join = (...parts) => parts.map(s).filter(Boolean).join(' ');

// Read-only: the whole file is read into memory once, Wincar's file is never opened for writing.
export const openArchive = (path) => new MDBReader(readFileSync(path));

// Wincar keeps phones in the customer registry (wcTabelle.mdb, table CLIENT); TESFAT.F_TELEFO is always empty.
// F_CELLUL is the most filled and nearly all mobiles; F_TELEFO is mostly landlines.
export const loadPhones = (registry) => new Map(registry.getTable('CLIENT')
  .getData({ columns: ['F_CODCLI', 'F_CELLUL', 'F_TELEFO'] })
  .map((r) => [r.F_CODCLI, { cell: s(r.F_CELLUL), landline: s(r.F_TELEFO) }]));

// phones: from loadPhones, or none when the registry isn't there.
export function loadInvoices(archive, phones = new Map()) {
  const table = archive.getTable('TESFAT');
  const rows = table.getData({ columns: COLUMNS })
    .filter((r) => r.F_DATFAT && INCLUDED_DOC_TYPES.includes(s(r.F_TIPDOC)))
    .map((r) => {
      // Jet stores naive dates; mdb-reader returns them as UTC midnight.
      const date = r.F_DATFAT.toISOString().slice(0, 10);
      const number = s(r.F_NUMFAT) + (s(r.F_ALFFAT) ? '/' + s(r.F_ALFFAT) : '');
      return {
        key: [s(r.F_TIPDOC), date.slice(0, 4), s(r.F_NUMFAT), s(r.F_ALFFAT)].join('-'),
        date,
        number,
        clientCode: r.F_CODCLI,
        client: s(r.F_RAGSOC),
        place: join(r.F_CITTAC, r.F_CAPCLI),
        payment: s(r.F_DESPAG),
        vehicle: join(r.F_DESMAR, r.F_DESMOD, r.F_DESVER),
        // Short form for the list: "Kodiaq dal 07/2021 fino al 2025" -> "Kodiaq".
        car: join(r.F_DESMAR, s(r.F_DESMOD).replace(/\s+dal\b.*$/i, '')),
        plate: s(r.F_TARGA),
        total: r.F_TOTFAT ?? 0,
        // Code 0 is not a real client.
        ...((r.F_CODCLI && phones.get(r.F_CODCLI)) || { cell: '', landline: '' }),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key, undefined, { numeric: true }));
  return rows;
}

// The shop's own P.IVA: Wincar records it as the sender of every e-invoice. The license is bound to it.
export function shopVats(archive) {
  if (!archive.getTableNames().includes('ProgressiviFE')) return [];
  return [...new Set(archive.getTable('ProgressiviFE').getData({ columns: ['F_PFE_PARIVA'] }).map((r) => s(r.F_PFE_PARIVA)).filter(Boolean))];
}

// Everything FollowUp takes from Wincar. The customer registry sits next to wcFatture.mdb in Wincar's folder;
// without it, phones are typed by hand. Runs in reader.js's own process (see main.js).
export function readArchive(path) {
  const archive = openArchive(path);
  const registry = joinPath(dirname(path), 'wcTabelle.mdb');
  const phones = existsSync(registry) ? loadPhones(openArchive(registry)) : undefined;
  return { invoices: loadInvoices(archive, phones), vats: shopVats(archive) };
}
