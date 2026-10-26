import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// FollowUp's own state. Never stored in Wincar.
export function openStore(file) {
  let data = { phones: {}, states: {} };
  if (existsSync(file)) {
    try {
      data = { ...data, ...JSON.parse(readFileSync(file, 'utf8')) };
    } catch {
      // Keep the unreadable file instead of overwriting the saved phones.
      renameSync(file, `${file}.corrupt-${Date.now()}`);
    }
  }
  const save = () => {
    writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
    renameSync(file + '.tmp', file);
  };
  return {
    data,
    // Changes data and saves; if the save fails the change is undone, so the screen never shows unsaved state.
    update(change) {
      const before = JSON.stringify(data);
      change(data);
      try {
        save();
      } catch (err) {
        Object.assign(data, JSON.parse(before));
        throw err;
      }
    },
  };
}

// Removed: taken off the list by hand before the week is up.
export const isHidden = (state, now) => !!state && (!!state.removed || now - state.at > WEEK_MS);

// Turns free text like "0444 123456 / 333 1234567" into wa.me digits, preferring a mobile.
// shortcut: numbers without a prefix are assumed Italian (+39); revisit if the client has foreign clients.
export function normalizePhone(text) {
  const candidates = (text ?? '').match(/\+?\d[\d\s.\-()]*\d/g) ?? [];
  const numbers = candidates.map((c) => {
    let d = c.replace(/\D/g, '');
    if (c.startsWith('+')) return d;
    if (d.startsWith('00')) return d.slice(2);
    return d.startsWith('0') || d.length <= 10 ? '39' + d : d;
  }).filter((d) => d.length >= 10 && d.length <= 15);
  const isMobile = (d) => !d.startsWith('39') || d[2] === '3';
  const phone = numbers.find(isMobile) ?? numbers[0] ?? '';
  return { phone, mobile: phone ? isMobile(phone) : false };
}

export const waUrl = (phone, text) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

// Draft text from spec §7. Waiting for client approval.
export function buildMessage(inv) {
  const [y, m, d] = inv.date.split('-');
  const vehicle = inv.plate ? ` sul veicolo targato ${inv.plate}` : '';
  return `Buongiorno, la contattiamo in merito al lavoro svolto${vehicle} (fattura n. ${inv.number} del ${d}/${m}/${y}). ` +
    `Volevamo sapere com'è andato il lavoro e se è rimasto soddisfatto del risultato. ` +
    `Se ha osservazioni o suggerimenti, siamo a disposizione. Grazie.`;
}

// Saved phones follow the client; code 0 is not a real client, so those stay on their own invoice.
export const phoneKey = (inv) => inv.clientCode || inv.key;

// Rows for one month, with the resolved phone and follow-up state. A phone saved in FollowUp wins over F_TELEFO.
export const monthView = (invoices, data, year, month, now) =>
  periodView(invoices, data, (date) => date.startsWith(`${year}-${String(month).padStart(2, '0')}`), now);

// Inclusive ISO date range; either end may be empty.
export const rangeView = (invoices, data, from, to, now) =>
  periodView(invoices, data, (date) => (!from || date >= from) && (!to || date <= to), now);

function periodView(invoices, data, inPeriod, now) {
  return invoices
    .filter((inv) => inPeriod(inv.date) && !isHidden(data.states[inv.key], now))
    .map((inv) => {
      const phoneText = data.phones[phoneKey(inv)] ?? inv.telefo;
      const state = data.states[inv.key];
      return {
        ...inv, phoneText, ...normalizePhone(phoneText), message: buildMessage(inv),
        status: state?.status ?? 'pending', at: state?.at ?? null,
      };
    });
}

// Every visible invoice, any period, whose client, vehicle or plate contains each word of the query.
export function searchView(invoices, data, query, now) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  // Matched first, so the per-row work runs only on the hits, not the whole archive.
  const hits = invoices.filter((inv) => words.every((w) => [inv.client, inv.vehicle, inv.plate].join(' ').toLowerCase().includes(w)));
  return rangeView(hits, data, '', '', now);
}

// Per-month totals for the month list: all invoices, and those still to contact.
export const yearView = (invoices, data, year, now) => Array.from({ length: 12 }, (_, i) => ({
  total: invoices.filter((inv) => inv.date.startsWith(`${year}-${String(i + 1).padStart(2, '0')}`)).length,
  open: monthView(invoices, data, year, i + 1, now).filter((r) => r.status === 'pending').length,
}));
