import { sign, verify } from 'node:crypto';
import { REVOKED } from './revoked.js';

// Only the public half ships: it can check keys but not make them. The private key stays with the seller.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAwUuI94qZ762hX6R6znR4mI+HwdVucw5XTHgONcV8Mg4=
-----END PUBLIC KEY-----`;

const DAY_MS = 24 * 60 * 60 * 1000;
const TYPO_MS = 60 * DAY_MS;
const fmt = (iso) => iso.split('-').reverse().join('/');

// Key = base64url(JSON {p: P.IVA, n: name, e: last valid day}) + "." + Ed25519 signature of that text.
export function signLicense(payload, privateKey) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(null, Buffer.from(data), privateKey).toString('base64url')}`;
}

export function readKey(key, publicKey = PUBLIC_KEY) {
  const [data, sig, extra] = String(key ?? '').trim().split('.');
  if (!data || !sig || extra !== undefined) return null;
  try {
    if (!verify(null, Buffer.from(data), publicKey, Buffer.from(sig, 'base64url'))) return null;
    const p = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    return typeof p.p === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.e) ? p : null;
  } catch {
    return null;
  }
}

// Names a key in the revocation list without spelling out the client.
export const keyId = (key) => String(key ?? '').trim().split('.')[1]?.slice(0, 16) ?? '';

// The key is bound to the shop's own P.IVA in its Wincar archive, so it works on every PC of that shop and no other.
// The clock can't simply be set back: the last time the app ran and the newest invoice also count as "now".
export function checkLicense(key, { vats, now, lastSeen = 0, latest = null, revoked = REVOKED }, publicKey = PUBLIC_KEY) {
  if (!String(key ?? '').trim()) return { ok: false, reason: '' }; // first run: the screen itself asks for the key
  const p = readKey(key, publicKey);
  if (!p) return { ok: false, reason: 'Chiave non valida. Copiala di nuovo per intero.' };
  const info = { name: p.n ?? '', expires: p.e };
  if (revoked.includes(keyId(key))) return { ok: false, ...info, reason: 'Questa licenza è stata revocata.' };
  if (!vats.length) return { ok: false, ...info, reason: 'Nessuna partita IVA nell\'archivio fatture: scegli l\'archivio Wincar dell\'azienda.' };
  if (!vats.includes(p.p)) return { ok: false, ...info, reason: 'Questa chiave è intestata a un\'altra azienda.' };
  if (now < lastSeen - DAY_MS) return { ok: false, ...info, reason: `La data del PC è indietro: FollowUp ha già visto il ${new Date(lastSeen).toLocaleDateString('it-IT')}. Correggila e riapri FollowUp.` };
  const end = new Date(`${p.e}T00:00`).getTime() + DAY_MS; // local midnight after the last valid day
  // An invoice dated far ahead of the clock is a typo in Wincar, not proof the clock is wrong.
  const newest = latest ? Date.parse(latest) : 0;
  const effective = Math.max(now, lastSeen, newest <= now + TYPO_MS ? newest : 0);
  if (effective >= end) return { ok: false, ...info, reason: `Licenza scaduta il ${fmt(p.e)}.` };
  return { ok: true, ...info, daysLeft: Math.floor((end - effective) / DAY_MS) };
}
