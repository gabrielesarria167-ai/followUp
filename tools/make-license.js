// Seller-side only, never shipped. Usage:
//   node tools/make-license.js --init                       once: creates the signing key
//   node tools/make-license.js <P.IVA> "<Ragione sociale>" [days=365]
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { signLicense } from '../license.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Outside the repo: whoever has this file can make keys. Back it up; losing it means a new build for every client.
const file = join(homedir(), '.followup', 'license-private.pem');
const [arg, name, days = '365'] = process.argv.slice(2);

if (arg === '--init') {
  // Overwriting would invalidate every key already sold.
  if (existsSync(file)) throw new Error(`${file} esiste già`);
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  console.log(`Chiave privata: ${file}\nIncolla in license.js come PUBLIC_KEY:\n${publicKey.export({ type: 'spki', format: 'pem' })}`);
} else if (/^\d{11}$/.test(arg ?? '') && name && Number(days) > 0) {
  const e = new Date(Date.now() + Number(days) * DAY_MS).toISOString().slice(0, 10);
  console.log(signLicense({ p: arg, n: name, e }, readFileSync(file)));
} else {
  console.error('Uso: node tools/make-license.js <P.IVA 11 cifre> "<Ragione sociale>" [giorni=365]');
  process.exit(1);
}
