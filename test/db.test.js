import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
const fakeArchive = (tables) => ({ getTable: (name) => ({ getData: () => tables[name] }) });

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

test('readArchive reads invoices and VAT numbers; no registry next to it, no phones', { skip }, () => {
  const { invoices, vats } = readArchive(fileURLToPath(file));
  assert.equal(invoices.length, 3253);
  assert.deepEqual(vats, ['03256760236']);
  assert.ok(invoices.every((i) => i.cell === '' && i.landline === ''));
});
