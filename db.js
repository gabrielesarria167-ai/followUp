import { readFileSync } from 'node:fs';
import MDBReader from 'mdb-reader';

// Credit notes (NC) excluded until the client confirms otherwise.
const INCLUDED_DOC_TYPES = ['FI'];

const COLUMNS = ['F_NUMFAT', 'F_ALFFAT', 'F_TIPDOC', 'F_DATFAT', 'F_CODCLI', 'F_RAGSOC', 'F_CITTAC', 'F_CAPCLI',
  'F_DESPAG', 'F_TARGA', 'F_DESMAR', 'F_DESMOD', 'F_DESVER', 'F_TOTFAT', 'F_TELEFO'];

const s = (v) => (v ?? '').toString().trim();
const join = (...parts) => parts.map(s).filter(Boolean).join(' ');

// Read-only: the whole file is read into memory, Wincar's file is never opened for writing.
export function loadInvoices(path, { samplePhones = false } = {}) {
  const table = new MDBReader(readFileSync(path)).getTable('TESFAT');
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
        telefo: s(r.F_TELEFO),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key, undefined, { numeric: true }));
  if (samplePhones && !rows.some((r) => r.telefo)) for (const r of rows) r.telefo = placeholderPhone(r.clientCode);
  return rows;
}

// Preview only: the bundled sample has no F_TELEFO, so invent stable per-client numbers to show
// every phone state. Never on real data, where these could belong to strangers.
function placeholderPhone(code) {
  const n = Number(code) || 0;
  const digits = String(1000000 + (n * 7919) % 9000000);
  if (n % 10 === 0) return '';                                   // senza telefono
  if (n % 10 === 1) return `0444 ${digits.slice(1)}`;            // fisso
  if (n % 10 === 2) return `0444 ${digits.slice(1)} / 347 ${digits}`; // fisso + cellulare
  return `${['333', '338', '347', '349'][n % 4]} ${digits}`;
}
