import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolveContact } from './outreach.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// FollowUp's own state. Never stored in Wincar.
export function openStore(file) {
  let data = { phones: {}, emails: {}, states: {}, templates: {} };
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
        for (const k of Object.keys(data)) delete data[k]; // keys the change added must go too
        Object.assign(data, JSON.parse(before));
        throw err;
      }
    },
  };
}

// Removed: taken off the list by hand before the week is up.
export const isHidden = (state, now) => !!state && (!!state.removed || now - state.at > WEEK_MS);

// The ready messages. {…} is filled from the invoice (the panel does it); [between brackets] is for the owner
// to replace, in the message or for good with Modifica. A fifth of invoices have no plate: the text must read without it.
export const TEMPLATES = [
  {
    id: 'thanks', name: 'Ringraziamento per il lavoro svolto',
    text: `Buongiorno, la ringraziamo per averci affidato il suo veicolo {targa}. È stato un piacere occuparcene: per qualsiasi necessità siamo a sua disposizione. A presto!`,
  },
  {
    // Draft text from spec §7, the default. Waiting for client approval.
    id: 'feedback', name: 'Richiesta feedback',
    text: `Buongiorno, la contattiamo in merito al lavoro svolto sul suo veicolo {targa} (fattura n. {fattura} del {data}). Volevamo sapere com'è andato il lavoro e se è rimasto soddisfatto del risultato. Se ha osservazioni o suggerimenti, siamo a disposizione. Grazie.`,
  },
  {
    id: 'payment', name: 'Promemoria pagamento',
    text: `Buongiorno, le ricordiamo che la fattura n. {fattura} del {data}, di {totale}, risulta ancora da saldare. Può pagare con bonifico all'IBAN [IBAN] oppure direttamente in officina. Se ha già provveduto, non tenga conto di questo messaggio. Grazie.`,
  },
  {
    id: 'review', name: 'Richiesta recensione',
    text: `Buongiorno, speriamo che sia soddisfatto del lavoro sul suo veicolo {targa}. Se le va di lasciarci una recensione, per noi sarebbe di grande aiuto: [link alla recensione]. Grazie mille!`,
  },
  {
    id: 'offer', name: 'Offerta servizi aggiuntivi',
    text: `Buongiorno, grazie ancora per averci scelto. Per il suo veicolo {veicolo} le proponiamo anche [servizio offerto] a [prezzo o sconto]. Se le interessa, risponda a questo messaggio e fissiamo un appuntamento.`,
  },
];

// Each template in the owner's wording where they changed it; the original stays for Ripristina.
export const templateList = (data) => TEMPLATES.map((t) => ({ ...t, original: t.text, text: data.templates[t.id] ?? t.text }));

// Rows for one month, with the resolved contacts and follow-up state.
export const monthView = (invoices, data, year, month, now) =>
  periodView(invoices, data, (date) => date.startsWith(`${year}-${String(month).padStart(2, '0')}`), now);

// Inclusive ISO date range; either end may be empty.
export const rangeView = (invoices, data, from, to, now) =>
  periodView(invoices, data, (date) => (!from || date >= from) && (!to || date <= to), now);

function periodView(invoices, data, inPeriod, now) {
  return invoices
    .filter((inv) => inPeriod(inv.date) && !isHidden(data.states[inv.key], now))
    .map((inv) => {
      const state = data.states[inv.key];
      return {
        ...inv, ...resolveContact(inv, data),
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
