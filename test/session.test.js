import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { signLicense } from '../license.js';
import { openStore } from '../store.js';
import { createSession } from '../session.js';

const DAY = 24 * 60 * 60 * 1000;
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const key = signLicense({ p: '03256760236', n: 'Officina Rossi', e: '2027-10-26' }, privateKey);
const invoice = { key: 'FI-2026-1-', date: '2026-10-20', number: '1', clientCode: 1, client: 'ROSSI', cell: '333 1111111', plate: '', total: 10 };

// An in-memory archive, a real store in a temp folder and a clock the test moves.
function setup({ license, vats = ['03256760236'], store } = {}) {
  const clock = { now: new Date('2026-10-26T12:00').getTime() };
  store ??= openStore(join(mkdtempSync(join(tmpdir(), 'followup-')), 'followup.json'));
  if (license) store.data.license = license;
  const session = createSession({
    store, publicKey, dbPath: () => 'fake.mdb', now: () => clock.now,
    readArchive: () => ({ invoices: [invoice], vats }),
  });
  return { session, store, clock };
}

test('locked: no invoices to read or act on', async () => {
  const { session, store } = setup();
  const view = await session.refresh();
  assert.equal(view.license.ok, false);
  assert.deepEqual(view.years, []);
  assert.deepEqual(session.month(2026, 10), []);
  assert.deepEqual(session.search('rossi'), []);
  assert.ok(session.outreach(invoice.key, 'Ciao', 'whatsapp').refused);
  session.markMessaged(invoice.key);
  session.setStatus(invoice.key, 'dismissed');
  session.remove(invoice.key);
  assert.deepEqual(store.data.states, {});
});

test('state changes need a loaded invoice, and a removed one stays removed', async () => {
  const { session, store } = setup({ license: key });
  await session.refresh();
  session.setStatus('FI-2099-9-', 'dismissed');
  assert.deepEqual(store.data.states, {}); // not an invoice of this archive
  session.markMessaged(invoice.key);
  session.remove(invoice.key);
  session.markMessaged(invoice.key); // a stale panel messages it again
  assert.equal(store.data.states[invoice.key].removed, true);
  assert.deepEqual(session.month(2026, 10), []);
});

test('a valid key unlocks and the rows follow the contact and state rules', async () => {
  const { session } = setup({ license: key });
  const view = await session.refresh();
  assert.equal(view.license.ok, true);
  assert.deepEqual(view.years, [2026]);
  assert.equal(session.month(2026, 10)[0].phone, '393331111111');

  const { url, marks } = session.outreach(invoice.key, 'Ciao', 'whatsapp');
  assert.match(url, /^https:\/\/wa\.me\/393331111111/);
  if (marks) session.markMessaged(invoice.key);
  assert.equal(session.month(2026, 10)[0].status, 'messaged');
});

test('a wrong key never replaces a working one', async () => {
  const { session, store } = setup();
  await session.refresh();
  assert.equal((await session.activate(key)).rejected, null);
  assert.equal(store.data.license, key);
  assert.ok((await session.activate('garbage')).rejected);
  assert.equal(store.data.license, key);
});

test('a key for another shop is rejected', async () => {
  const { session } = setup({ vats: ['01234567890'] });
  await session.refresh(); // the page always refreshes first, so the shop is known
  assert.match((await session.activate(key)).rejected, /altra azienda/);
});

test('turning the PC clock back locks the app', async () => {
  const { session, clock } = setup({ license: key });
  assert.equal((await session.refresh()).license.ok, true); // records the day seen
  clock.now -= 3 * DAY;
  const view = await session.refresh();
  assert.equal(view.license.ok, false);
  assert.deepEqual(session.month(2026, 10), []);
});

test('a failed lastSeen save still shows the screen', async () => {
  const { store } = setup({ license: key });
  const failing = { data: store.data, update() { throw new Error('disk full'); } };
  const { session } = setup({ store: failing });
  assert.equal((await session.refresh()).license.ok, true);
  assert.equal(session.month(2026, 10).length, 1);
});

test('an unreadable archive reports the error and locks', async () => {
  const { store } = setup({ license: key });
  const session = createSession({ store, publicKey, dbPath: () => 'fake.mdb', readArchive: async () => { throw new Error('boom'); } });
  const view = await session.refresh();
  assert.match(view.error, /fake\.mdb/);
  assert.equal(view.license.ok, false);
  assert.equal(view.license.needsDb, true);
});

test('archive reads run one at a time, however often the page asks', async () => {
  const { store } = setup({ license: key });
  let running = 0;
  let most = 0;
  const session = createSession({
    store, publicKey, dbPath: () => 'fake.mdb',
    readArchive: async () => {
      most = Math.max(most, ++running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return { invoices: [invoice], vats: ['03256760236'] };
    },
  });
  const views = await Promise.all([session.refresh(), session.refresh(), session.activate(key)]);
  assert.equal(most, 1);
  assert.ok(views.every((v) => v.license.ok));
});
