import test from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_MAX, mailUrl, normalizeEmail, normalizePhone, plan, waUrl } from '../outreach.js';

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

test('normalizeEmail keeps only a plain address', () => {
  const cases = {
    'info@rasottoflotte.it': 'info@rasottoflotte.it',
    ' Mario.Rossi+auto@mail.co.uk ': 'Mario.Rossi+auto@mail.co.uk',
    'info@x.it; amm@x.it': 'info@x.it',
    'a@b.it?bcc=spy@evil.com': 'a@b.it',
    'info@x': '',
    'non ce l\'ha': '',
    '': '',
  };
  for (const [input, email] of Object.entries(cases)) assert.equal(normalizeEmail(input), email, input);
  assert.equal(normalizeEmail(undefined), '');
});

test('mailUrl encodes subject and body', () => {
  assert.equal(mailUrl('a@b.it', 'Fattura n. 1', "com'è & ok?\nCiao"),
    'mailto:a@b.it?subject=Fattura%20n.%201&body=com\'%C3%A8%20%26%20ok%3F%0ACiao');
});

const inv = { key: 'FI-2026-1-', clientCode: 7, number: '1', date: '2026-07-10', telefo: '333 1111111' };
const none = { phones: {}, emails: {} };

test('plan whatsapp: a wa.me url from the best phone, and it marks contacted', () => {
  const p = plan({ invoice: inv, saved: none, message: ' Ciao ', mode: 'whatsapp' });
  assert.deepEqual(p, { url: 'https://wa.me/393331111111?text=Ciao', marks: true });
  const saved = plan({ invoice: inv, saved: { phones: { 7: '340 9999999' }, emails: {} }, message: 'Ciao', mode: 'whatsapp' });
  assert.match(saved.url, /^https:\/\/wa\.me\/393409999999\?/); // saved phone wins over F_TELEFO
});

test('plan email: not marked until the owner confirms, and carries the text to paste', () => {
  const p = plan({ invoice: inv, saved: { phones: {}, emails: { 7: 'a@b.it' } }, message: 'Ciao', mode: 'email' });
  assert.equal(p.marks, false);
  assert.equal(p.url, mailUrl('a@b.it', 'Fattura n. 1 del 10/07/2026', 'Ciao'));
  assert.equal(p.copy, 'A: a@b.it\nOggetto: Fattura n. 1 del 10/07/2026\n\nCiao');
});

test('plan refuses what cannot be sent', () => {
  const ask = (over) => plan({ invoice: inv, saved: none, message: 'Ciao', mode: 'whatsapp', ...over });
  assert.ok(ask({ invoice: undefined }).refused);
  assert.ok(ask({ message: '   ' }).refused);
  assert.ok(ask({ invoice: { ...inv, telefo: '' } }).refused); // no phone
  assert.ok(ask({ mode: 'email' }).refused); // no email saved
});

test('plan cuts the message at the limit', () => {
  const p = plan({ invoice: inv, saved: none, message: 'a'.repeat(MESSAGE_MAX + 50), mode: 'whatsapp' });
  assert.equal(decodeURIComponent(p.url.split('text=')[1]).length, MESSAGE_MAX);
});
