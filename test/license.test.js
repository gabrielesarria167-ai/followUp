import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { checkLicense, keyId, signLicense } from '../license.js';

const DAY = 24 * 60 * 60 * 1000;
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const now = new Date('2026-10-26T12:00').getTime();
const key = signLicense({ p: '03256760236', n: 'Officina Rossi', e: '2027-10-26' }, privateKey);
const check = (k, opts = {}) => checkLicense(k, { vats: ['03256760236'], now, ...opts }, publicKey);

test('a valid key unlocks and counts the days left', () => {
  assert.deepEqual(check(key), { ok: true, name: 'Officina Rossi', expires: '2027-10-26', daysLeft: 365 });
  assert.equal(check(key, { vats: ['01234567890', '03256760236'] }).ok, true);
  assert.equal(check(key, { now: new Date('2027-10-26T23:00').getTime() }).daysLeft, 0);
});

test('bad keys are rejected with a reason', () => {
  assert.deepEqual(check(''), { ok: false, reason: '' });
  const [data, sig] = key.split('.');
  const forged = Buffer.from(JSON.stringify({ p: '03256760236', n: 'X', e: '2099-01-01' })).toString('base64url');
  const other = generateKeyPairSync('ed25519').privateKey;
  const cases = {
    garbage: [check('abc'), /non valida/],
    tampered: [check(`${forged}.${sig}`), /non valida/],
    'extra part': [check(`${data}.${sig}.x`), /non valida/],
    'signed by someone else': [check(signLicense({ p: '03256760236', e: '2099-01-01' }, other)), /non valida/],
    'other shop': [check(key, { vats: ['01234567890'] }), /altra azienda/],
    'no archive': [check(key, { vats: [] }), /archivio/],
    expired: [check(key, { now: new Date('2027-10-27T00:01').getTime() }), /scaduta il 26\/10\/2027/],
    'clock set back': [check(key, { lastSeen: now + 2 * DAY }), /data del PC/],
    'invoices past expiry': [check(key, { latest: '2027-11-02' }), /scaduta/],
    revoked: [check(key, { revoked: [keyId(key)] }), /revocata/],
  };
  for (const [name, [r, reason]] of Object.entries(cases)) {
    assert.equal(r.ok, false, name);
    assert.match(r.reason, reason, name);
  }
});

test('the shipped public key is not the test one', () => {
  assert.equal(checkLicense(key, { vats: ['03256760236'], now }).ok, false);
});
