import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadInvoices, loadPhones, openArchive, readArchive, shopVats } from '../db.js';

const dir = new URL('../FollowUp_handoff/', import.meta.url);
const file = new URL('../data/wcFatture.mdb', import.meta.url);
// Both are git-ignored client data: absent on a fresh clone or in CI.
const skip = !existsSync(file) || !existsSync(dir);

test('loadInvoices matches the exported sample', { skip }, () => {
  const rows = loadInvoices(openArchive(file));
  const sample = JSON.parse(readFileSync(new URL('tesfat_sample.json', dir), 'utf8').replace(/^﻿/, ''))
    .filter((r) => r.F_TIPDOC === 'FI');
  assert.equal(rows.length, 3253);
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
  assert.equal(rows.filter((r) => r.date.startsWith('2026-07')).length, 22);

  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const s of sample) {
    const r = byKey.get(`FI-${s.F_DATFAT.slice(0, 4)}-${s.F_NUMFAT}-${s.F_ALFFAT}`);
    assert.ok(r, `missing ${s.F_NUMFAT}/${s.F_DATFAT}`);
    assert.equal(r.date, s.F_DATFAT);
    assert.equal(r.client, s.F_RAGSOC);
    assert.equal(r.clientCode, s.F_CODCLI);
    assert.equal(r.total, s.F_TOTFAT);
  }
  const first = rows[0];
  assert.equal(first.date, '2026-08-10');
  assert.equal(first.place, 'DUEVILLE 36031');
  assert.match(first.vehicle, /^RENAULT Clio dal 2025 1\.8/);
  assert.equal(first.car, 'RENAULT Clio');
  assert.equal(rows.find((r) => r.key === 'FI-2026-167-').car, 'SKODA Kodiaq');
});

test('shopVats reads the shop\'s own P.IVA', { skip }, () => {
  assert.deepEqual(shopVats(openArchive(file)), ['03256760236']);
});

// Stands in for an MDBReader: getTable(name).getData() returns that table's rows.
const fakeArchive = (tables) => ({ getTableNames: () => Object.keys(tables), getTable: (name) => ({ getData: () => tables[name] }) });

test('phones come from the customer registry, by client code', () => {
  const phones = loadPhones(fakeArchive({ CLIENT: [
    { F_CODCLI: 7, F_CELLUL: ' 333 1234567 ', F_TELEFO: '0444 123456' },
    { F_CODCLI: 0, F_CELLUL: '333 0000000', F_TELEFO: null },
  ] }));
  const invoice = (F_CODCLI, F_NUMFAT) => ({ F_CODCLI, F_NUMFAT, F_TIPDOC: 'FI', F_DATFAT: new Date('2026-07-10'), F_ALFFAT: '' });
  const rows = loadInvoices(fakeArchive({ TESFAT: [invoice(7, 3), invoice(9, 2), invoice(0, 1)] }), phones);
  assert.deepEqual(rows.map((r) => [r.clientCode, r.cell, r.landline]), [
    [7, '333 1234567', '0444 123456'],
    [9, '', ''], // not in the registry
    [0, '', ''], // code 0 is not a real client
  ]);
  assert.equal(loadInvoices(fakeArchive({ TESFAT: [invoice(7, 3)] }))[0].cell, ''); // no registry
});

test('the client code matches across files whatever its type or zero padding', () => {
  const phones = loadPhones(fakeArchive({ CLIENT: [
    { F_CODCLI: '007', F_CELLUL: '333 1234567', F_TELEFO: '' },
    { F_CODCLI: ' 12 ', F_CELLUL: '340 9876543', F_TELEFO: '' },
    { F_CODCLI: '000', F_CELLUL: '333 0000000', F_TELEFO: '' },
  ] }));
  const invoice = (F_CODCLI, F_NUMFAT) => ({ F_CODCLI, F_NUMFAT, F_TIPDOC: 'FI', F_DATFAT: new Date('2026-07-10'), F_ALFFAT: '' });
  const rows = loadInvoices(fakeArchive({ TESFAT: [invoice(7, 3), invoice(12, 2), invoice('0', 1)] }), phones);
  assert.deepEqual(rows.map((r) => r.cell), ['333 1234567', '340 9876543', '']);
});

test('a registry without a CLIENT table gives no phones', () => {
  assert.equal(loadPhones(fakeArchive({ ALTRO: [] })), undefined);
});

// A Wincar folder with the archive, and the registry unless openRegistry is null; it decides what reading it gives.
function wincarFolder(openRegistry) {
  const folder = mkdtempSync(join(tmpdir(), 'wincar-'));
  writeFileSync(join(folder, 'wcFatture.mdb'), '');
  if (openRegistry) writeFileSync(join(folder, 'wcTabelle.mdb'), '');
  const archive = fakeArchive({
    TESFAT: [{ F_CODCLI: 7, F_NUMFAT: 1, F_TIPDOC: 'FI', F_DATFAT: new Date('2026-07-10'), F_ALFFAT: '' }],
    ProgressiviFE: [{ F_PFE_PARIVA: '01234567890' }],
  });
  const open = (path) => (path.endsWith('wcFatture.mdb') ? archive : openRegistry());
  return readArchive(join(folder, 'wcFatture.mdb'), open);
}

test('readArchive joins the registry next to the archive', () => {
  const { invoices, vats, registry } = wincarFolder(() => fakeArchive({ CLIENT: [{ F_CODCLI: 7, F_CELLUL: '333 1234567', F_TELEFO: '' }] }));
  assert.equal(invoices[0].cell, '333 1234567');
  assert.deepEqual(vats, ['01234567890']);
  assert.equal(registry, 'ok');
});

test('no registry next to the archive: the invoices, no phones, and it says so', () => {
  const { invoices, registry } = wincarFolder(null);
  assert.equal(invoices[0].cell, '');
  assert.equal(registry, 'missing');
});

test('a registry that can\'t be read costs only the phones, not the invoices or the license', () => {
  for (const openRegistry of [
    () => { throw new Error('EBUSY: resource busy or locked'); }, // Wincar has it open
    () => fakeArchive({ ALTRO: [] }), // no CLIENT table
  ]) {
    const { invoices, vats, registry } = wincarFolder(openRegistry);
    assert.equal(invoices.length, 1);
    assert.equal(invoices[0].cell, '');
    assert.deepEqual(vats, ['01234567890']);
    assert.equal(registry, 'unreadable');
  }
});

// With the real registry next to the archive, the join must find phones: a type mismatch would find none, silently.
test('readArchive reads invoices and VAT numbers, and phones when the registry is there', { skip }, () => {
  const { invoices, vats } = readArchive(fileURLToPath(file));
  assert.equal(invoices.length, 3253);
  assert.deepEqual(vats, ['03256760236']);
  const withPhone = invoices.filter((i) => i.cell || i.landline).length;
  if (existsSync(new URL('../data/wcTabelle.mdb', import.meta.url))) assert.ok(withPhone > 0, 'no invoice got a phone from wcTabelle.mdb');
  else assert.equal(withPhone, 0);
});
