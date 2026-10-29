import { existsSync } from 'node:fs';
import { checkLicense } from './license.js';
import { contactKey, plan } from './outreach.js';
import { monthView, rangeView, searchView, templateList, yearView } from './store.js';

// The app's view of the Archive and the License together. While locked it holds no invoices, so every query
// and action finds nothing to act on. The clock rule lives here too: the last day seen counts as "now".
// readArchive(path) -> { invoices, vats }, or a promise of it; now() is the clock; dbPath() says which archive to read.
// publicKey is only for tests: the shipped one can't verify keys made with a test keypair.
export function createSession({ store, dbPath, readArchive, now = Date.now, publicKey }) {
  let invoices = [];
  let shop = { vats: [], latest: null }; // what the license is checked against

  const checkKey = (key) => checkLicense(key, { ...shop, now: now(), lastSeen: store.data.lastSeen }, publicKey);

  async function read() {
    const path = dbPath();
    let all = [];
    let error = null;
    try {
      const archive = await readArchive(path);
      all = archive.invoices;
      shop = { vats: archive.vats, latest: all[0]?.date ?? null };
    } catch (err) {
      shop = { vats: [], latest: null };
      error = existsSync(path) ? `Impossibile leggere ${path}: ${err.message}` : `Archivio fatture mancante: ${path}. Reinstalla FollowUp per selezionarlo`;
    }
    const license = checkKey(store.data.license);
    try {
      store.update((d) => { d.lastSeen = Math.max(d.lastSeen ?? 0, now()); });
    } catch {
      // A full or read-only disk must not blank the screen; the next refresh records it.
    }
    invoices = license.ok ? all : [];
    return {
      error,
      years: [...new Set(invoices.map((i) => Number(i.date.slice(0, 4))))],
      latest: invoices[0]?.date ?? null,
      license: { ...license, needsDb: !shop.vats.length },
      templates: templateList(store.data),
    };
  }

  // One read at a time, in order: no two archive reads at once, and an older one never lands last.
  let queue = Promise.resolve();
  const inTurn = (step) => (queue = queue.then(step, step));
  const refresh = () => inTurn(read);

  // A wrong key never replaces a working one. Checked in turn too: against the archive just picked, not the one
  // still showing while it's read.
  async function activate(key) {
    const k = String(key ?? '').trim();
    const { ok, reason } = await inTurn(() => checkKey(k));
    if (ok) store.update((d) => { d.license = k; });
    return { ...(await refresh()), rejected: ok ? null : reason };
  }

  // Every state change goes through here: a locked session, or a key that isn't a loaded invoice, changes nothing.
  const changeState = (key, change) => {
    if (invoices.some((i) => i.key === key)) store.update(({ states }) => change(states));
  };

  return {
    refresh,
    activate,
    useArchive(path) { store.update((d) => { d.dbPath = path; }); return refresh(); },

    month: (year, month) => monthView(invoices, store.data, year, month, now()),
    range: (from, to) => rangeView(invoices, store.data, from, to, now()),
    search: (query) => searchView(invoices, store.data, query, now()),
    year: (year) => yearView(invoices, store.data, year, now()),

    // A phone or email as typed, kept for the client. Typing back what Wincar has forgets it, so Wincar's later
    // fixes show again; an emptied box over a Wincar number is kept as '', or that number would come back.
    setContact(list, key, text) {
      const inv = invoices.find((i) => i.key === key);
      if (!inv) return;
      const t = String(text ?? '').trim();
      const fromWincar = { phones: inv.cell, landlines: inv.landline }[list] ?? '';
      store.update((data) => {
        if (t === fromWincar) delete data[list][contactKey(inv)];
        else data[list][contactKey(inv)] = t;
      });
    },

    setStatus(key, status) {
      changeState(key, (states) => {
        if (status === 'dismissed') states[key] = { status, at: now() };
        else delete states[key];
      });
    },

    // Only a contacted invoice can be removed; it stays contacted, so it never comes back as to-do.
    remove(key) {
      changeState(key, (states) => { if (states[key]?.status === 'messaged') states[key].removed = true; });
    },

    // A removed invoice stays removed if a stale panel messages it again.
    markMessaged: (key) => changeState(key, (states) => {
      states[key] = { ...(states[key]?.removed && { removed: true }), status: 'messaged', at: now() };
    }),

    // What would open for this invoice, and whether it counts as contacted: see outreach.js.
    outreach: (key, message, mode) => plan({ invoice: invoices.find((i) => i.key === key), saved: store.data, message, mode }),
  };
}
