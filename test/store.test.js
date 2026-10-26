import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isHidden, normalizePhone, waUrl, buildMessage, monthView, rangeView, searchView, yearView, openStore, phoneKey } from '../store.js';

const DAY = 24 * 60 * 60 * 1000;

test('7-day hide rule', () => {
  const now = Date.now();
  assert.equal(isHidden(undefined, now), false);
  assert.equal(isHidden({ status: 'messaged', at: now - 7 * DAY + 3600e3 }, now), false);
  assert.equal(isHidden({ status: 'messaged', at: now - 7 * DAY - 1000 }, now), true);
  assert.equal(isHidden({ status: 'dismissed', at: now - 8 * DAY }, now), true);
  assert.equal(isHidden({ status: 'messaged', at: now, removed: true }, now), true);
});

test('normalizePhone', () => {
  const cases = {
    '333 1234567': ['393331234567', true],
    '+39 333 123 4567': ['393331234567', true],
    '0039 333.1234567': ['393331234567', true],
    '333-1234567': ['393331234567', true],
    '0444 123456': ['390444123456', false],
    '0444 123456 / 333 1234567': ['393331234567', true],
    'Tel. 0444-123456, cell. 340 9876543': ['393409876543', true],
    '+44 7700 900123': ['447700900123', true],
    '': ['', false],
    '12345': ['', false],
  };
  for (const [input, [phone, mobile]] of Object.entries(cases)) {
    assert.deepEqual(normalizePhone(input), { phone, mobile }, input);
  }
  assert.deepEqual(normalizePhone(undefined), { phone: '', mobile: false });
});

test('waUrl encodes the text', () => {
  assert.equal(waUrl('393331234567', "com'è & ok?"), 'https://wa.me/393331234567?text=com\'%C3%A8%20%26%20ok%3F');
});

test('buildMessage mentions invoice and plate only when present', () => {
  const m = buildMessage({ date: '2026-07-31', number: '167', plate: 'GM412XG' });
  assert.match(m, /fattura n\. 167 del 31\/07\/2026/);
  assert.match(m, /targato GM412XG/);
  assert.doesNotMatch(buildMessage({ date: '2026-07-31', number: '1', plate: '' }), /targato/);
});

test('monthView: phone precedence, state, hiding', () => {
  const now = Date.now();
  const inv = (key, date, clientCode, telefo) => ({ key, date, number: key, clientCode, telefo, plate: '' });
  const invoices = [
    inv('a', '2026-07-10', 1, '333 1111111'),
    inv('b', '2026-07-09', 2, '333 2222222'),
    inv('c', '2026-07-08', 3, ''),
    inv('d', '2026-07-07', 4, ''),
    inv('e', '2026-06-30', 1, ''),
  ];
  const data = {
    phones: { 2: '340 9999999' },
    states: { c: { status: 'messaged', at: now - DAY }, d: { status: 'dismissed', at: now - 8 * DAY } },
  };
  const rows = monthView(invoices, data, 2026, 7, now);
  assert.deepEqual(rows.map((r) => r.key), ['a', 'b', 'c']);
  assert.equal(rows[0].phone, '393331111111'); // from F_TELEFO
  assert.equal(rows[1].phone, '393409999999'); // saved phone wins
  assert.equal(rows[2].phone, '');
  assert.equal(rows[2].status, 'messaged');
  assert.equal(rows[0].status, 'pending');
  assert.match(rows[0].message, /fattura n\. a del 10\/07\/2026/);

  // Date ranges span months, include both ends, may be open, and still drop hidden invoices.
  const keys = (from, to) => rangeView(invoices, data, from, to, now).map((r) => r.key);
  assert.deepEqual(keys('2026-06-30', '2026-07-09'), ['b', 'c', 'e']);
  assert.deepEqual(keys('2026-07-09', ''), ['a', 'b']);
  assert.deepEqual(keys('', '2026-07-01'), ['e']);

  const year = yearView(invoices, data, 2026, now);
  assert.equal(year.length, 12);
  assert.deepEqual(year[6], { total: 4, open: 2 }); // d is hidden but still counts toward the total
  assert.deepEqual(year[5], { total: 1, open: 1 });
  assert.deepEqual(year[0], { total: 0, open: 0 });
});

test('search matches every word in client, vehicle or plate, across periods', () => {
  const now = Date.now();
  const inv = (key, date, client, vehicle, plate) => ({ key, date, number: key, clientCode: key, telefo: '', client, vehicle, plate });
  const invoices = [
    inv('a', '2026-08-10', 'AUTOTORINO SPA', 'TOYOTA Yaris Cross', 'GZ471TS'),
    inv('b', '2025-03-02', 'ROSSI MARIO', 'FIAT Panda', 'AB123CD'),
    inv('c', '2026-01-05', 'AUTOTORINO SPA', 'FIAT Punto', 'EF456GH'),
  ];
  const data = { phones: {}, states: { c: { status: 'messaged', at: now - 8 * DAY } } };
  const keys = (q) => searchView(invoices, data, q, now).map((r) => r.key);
  assert.deepEqual(keys('autotorino'), ['a']); // c matches but is hidden
  assert.deepEqual(keys('fiat'), ['b']);
  assert.deepEqual(keys('yaris autotorino'), ['a']);
  assert.deepEqual(keys('gz 471'), ['a']);
  assert.deepEqual(keys('panda autotorino'), []);
});

test('client code 0 keeps a saved phone on its own invoice', () => {
  const invoices = [
    { key: 'f', date: '2026-07-06', number: 'f', clientCode: 0, telefo: '', plate: '' },
    { key: 'g', date: '2026-07-05', number: 'g', clientCode: 0, telefo: '', plate: '' },
  ];
  const rows = monthView(invoices, { phones: { [phoneKey(invoices[0])]: '333 5555555' }, states: {} }, 2026, 7, Date.now());
  assert.deepEqual(rows.map((r) => r.phone), ['393335555555', '']);
});

test('openStore saves atomically and keeps a corrupt file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'followup-'));
  const file = join(dir, 'followup.json');
  const s = openStore(file);
  s.update(({ phones }) => { phones[7] = '333 1234567'; });
  assert.equal(openStore(file).data.phones[7], '333 1234567');
  writeFileSync(file, '{broken');
  assert.deepEqual(openStore(file).data.phones, {});
  assert.ok(readdirSync(dir).some((f) => f.includes('.corrupt-')));
});

test('update undoes the change when the save fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'followup-'));
  const s = openStore(join(dir, 'missing-folder', 'followup.json'));
  assert.throws(() => s.update(({ states }) => { states.a = { status: 'dismissed', at: 1 }; }));
  assert.deepEqual(s.data.states, {});
});
