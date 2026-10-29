// Seller-side only, never shipped. Usage:
//   node tools/make-license.js --init                       once: creates the signing key
//   node tools/make-license.js <P.IVA> "<Ragione sociale>" [days=365]
//   node tools/make-license.js --list                       every key made, with its expiry and state
//   node tools/make-license.js --search <P.IVA>            prints that shop's key(s), newest last
//   node tools/make-license.js --rename <P.IVA> "<nuovo nome>"  new key, same expiry, new name (the old key keeps working)
//   node tools/make-license.js --add <key>                  records a key made before the list existed
//   node tools/make-license.js --revoke <P.IVA> ["<nome>"]  blocks that shop's keys (only the ones with that name, if given), from the next release on, and deletes them from the ledger
import { generateKeyPairSync } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { keyId, readKey, signLicense } from '../license.js';
import { REVOKED } from '../revoked.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Outside the repo: whoever has this file can make keys. Back it up; losing it means a new build for every client.
const file = join(homedir(), '.followup', 'license-private.pem');
// Every key made, one per line; the key itself holds the P.IVA, name and expiry. It stays here, off the public repo.
const ledger = join(homedir(), '.followup', 'licenses.txt');
const revokedFile = join(import.meta.dirname, '..', 'revoked.js');
const [arg, name, days = '365'] = process.argv.slice(2);

const keys = () => (existsSync(ledger) ? readFileSync(ledger, 'utf8').split('\n').filter(Boolean) : []);
// Keys signed by another keypair can't be read; they are left out of --list and --revoke, with a note.
const readable = () => {
  const all = keys();
  const ok = all.filter((k) => readKey(k));
  if (ok.length < all.length) console.error(`${all.length - ok.length} chiavi nel registro non sono leggibili con la PUBLIC_KEY attuale: ignorate.`);
  return ok;
};
const record = (key) => appendFileSync(ledger, `${key}\n`, { mode: 0o600 });
const fmt = (iso) => iso.split('-').reverse().join('/');
const fail = (msg) => { console.error(msg); process.exit(1); };

if (arg === '--init') {
  // Overwriting would invalidate every key already sold.
  if (existsSync(file)) throw new Error(`${file} esiste già`);
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  console.log(`Chiave privata: ${file}\nIncolla in license.js come PUBLIC_KEY:\n${publicKey.export({ type: 'spki', format: 'pem' })}`);
} else if (arg === '--list') {
  const rows = readable().map((k) => ({ id: keyId(k), ...readKey(k) })).sort((a, b) => a.e.localeCompare(b.e));
  if (!rows.length) fail(`Nessuna licenza registrata in ${ledger}.`);
  console.log(`${'P.IVA'.padEnd(13)}${'Scade'.padEnd(13)}${'Stato'.padEnd(22)}Ragione sociale`);
  for (const r of rows) {
    const left = Math.floor((new Date(`${r.e}T00:00`).getTime() + DAY_MS - Date.now()) / DAY_MS);
    const state = REVOKED.includes(r.id) ? 'revocata' : left < 0 ? 'scaduta' : `attiva, ${left} giorni`;
    console.log(`${r.p.padEnd(13)}${fmt(r.e).padEnd(13)}${state.padEnd(22)}${r.n ?? ''}`);
  }
} else if (arg === '--search') {
  const found = readable().filter((k) => readKey(k).p === name);
  if (!found.length) fail(`Nessuna licenza registrata per ${name}.`);
  found.forEach((k) => console.log(`${fmt(readKey(k).e)}${REVOKED.includes(keyId(k)) ? ' (revocata)' : ''}\n${k}`));
} else if (arg === '--rename') {
  if (!days || days === '365') fail('Uso: --rename <P.IVA> "<nuovo nome>"');
  // The name is inside the signed key, so renaming means signing again; the old key stays in the ledger so --revoke still covers it.
  const latest = readable().map((k) => readKey(k)).filter((k) => k.p === name).sort((a, b) => b.e.localeCompare(a.e))[0];
  if (!latest) fail(`Nessuna licenza registrata per ${name}.`);
  const key = signLicense({ p: name, n: days, e: latest.e }, readFileSync(file));
  if (!readKey(key)) fail('La chiave privata non corrisponde alla PUBLIC_KEY di license.js.');
  record(key);
  console.log(key);
} else if (arg === '--add') {
  const p = readKey(name);
  if (!p) fail('Chiave non valida per questa versione di FollowUp.');
  if (keys().includes(name.trim())) fail('Chiave già registrata.');
  if (REVOKED.includes(keyId(name))) fail('Chiave revocata.');
  record(name.trim());
  console.log(`Registrata: ${p.p} ${p.n ?? ''}, scade il ${fmt(p.e)}.`);
} else if (arg === '--revoke') {
  const match = readable().filter((k) => readKey(k).p === name && (days === '365' || readKey(k).n === days));
  if (!match.length) fail(`Nessuna chiave da revocare per ${name}: non registrata (aggiungila con --add).`);
  const ids = match.map(keyId).filter((id) => !REVOKED.includes(id));
  if (ids.length) writeFileSync(revokedFile, `// Written by tools/make-license.js --revoke. Key ids (the first 16 characters of the signature) that no longer unlock;
// a revocation reaches a shop with the first release it installs after this list changes.
export const REVOKED = [${[...REVOKED, ...ids].map((id) => `\n  '${id}',`).join('')}${REVOKED.length + ids.length ? '\n' : ''}];
`);
  // Gone from the ledger for good; its id in revoked.js is all the app needs to keep refusing it.
  writeFileSync(ledger, keys().filter((k) => !match.includes(k)).map((k) => `${k}\n`).join(''), { mode: 0o600 });
  console.log(`Revocate ed eliminate ${match.length} chiavi di ${name}.${ids.length ? " Pubblica una nuova versione: la revoca arriva al negozio con l'aggiornamento." : ''}`);
} else if (/^\d{11}$/.test(arg ?? '') && name && Number(days) > 0) {
  const e = new Date(Date.now() + Number(days) * DAY_MS).toISOString().slice(0, 10);
  const key = signLicense({ p: arg, n: name, e }, readFileSync(file));
  // A private key that doesn't match the shipped public one would make keys the app refuses.
  if (!readKey(key)) fail('La chiave privata non corrisponde alla PUBLIC_KEY di license.js.');
  record(key);
  console.log(key);
} else {
  fail('Uso: node tools/make-license.js <P.IVA 11 cifre> "<Ragione sociale>" [giorni=365] | --list | --search <P.IVA> | --rename <P.IVA> "<nuovo nome>" | --add <chiave> | --revoke <P.IVA> ["<nome>"]');
}
