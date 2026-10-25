import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadInvoices } from '../db.js';

const dir = new URL('../FollowUp_handoff/', import.meta.url);

test('loadInvoices matches the exported sample', () => {
  const rows = loadInvoices(new URL('../data/wcFatture.mdb', import.meta.url));
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

test('placeholder phones only when asked, stable per client, covering every state', () => {
  const file = new URL('../data/wcFatture.mdb', import.meta.url);
  assert.ok(loadInvoices(file).every((r) => r.telefo === ''));
  const rows = loadInvoices(file, { samplePhones: true });
  const phones = new Map();
  for (const r of rows) {
    if (phones.has(r.clientCode)) assert.equal(r.telefo, phones.get(r.clientCode));
    phones.set(r.clientCode, r.telefo);
  }
  const kinds = new Set([...phones.values()].map((p) => p === '' ? 'none' : p.includes('/') ? 'both' : p[0]));
  assert.deepEqual([...kinds].sort(), ['0', '3', 'both', 'none']);
});
