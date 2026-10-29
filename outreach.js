// Contacting a client about an invoice. Pure: it decides what would open and what that means for the
// follow-up state; the OS call (shell, clipboard) stays in main.js. It knows nothing about the license.

export const MESSAGE_MAX = 1000; // the panel's limit too

// Saved phones and emails follow the client; code 0 is not a real client, so those stay on their own invoice.
export const contactKey = (inv) => inv.clientCode || inv.key;

// Turns free text like "0444 123456 / 333 1234567" into wa.me digits, preferring a mobile.
// shortcut: numbers without a prefix are assumed Italian (+39); revisit if the client has foreign clients.
export function normalizePhone(text) {
  const candidates = (text ?? '').match(/\+?\d[\d\s.\-()]*\d/g) ?? [];
  const numbers = candidates.map((c) => {
    let d = c.replace(/\D/g, '');
    if (c.startsWith('+')) return d;
    if (d.startsWith('00')) return d.slice(2);
    return d.startsWith('0') || d.length <= 10 ? '39' + d : d;
  }).filter((d) => d.length >= 10 && d.length <= 15);
  const isMobile = (d) => !d.startsWith('39') || d[2] === '3';
  const phone = numbers.find(isMobile) ?? numbers[0] ?? '';
  return { phone, mobile: phone ? isMobile(phone) : false };
}

export const waUrl = (phone, text) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

// The first address in free text like "info@x.it; amm@x.it". No ? & % or spaces, so it can't add mailto fields.
export const normalizeEmail = (text) => (text ?? '').match(/[\w.+-]+@[\w-]+(\.[\w-]+)*\.[a-z]{2,}/i)?.[0] ?? '';

// shortcut: some mail programs cut mailto links past ~2000 characters; a long accented message can get there.
export const mailUrl = (email, subject, text) =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

// The one answer to "which phones and email for this invoice": what's saved in FollowUp wins over Wincar's
// registry; emails are only typed in FollowUp. `saved` is { phones, landlines, emails }; phones are the mobiles.
export function resolveContact(inv, { phones, landlines = {}, emails }) {
  const phoneText = phones[contactKey(inv)] ?? inv.cell;
  const landline = landlines[contactKey(inv)] ?? inv.landline;
  const emailText = emails[contactKey(inv)] ?? '';
  return { phoneText, ...normalizePhone(phoneText), landline, emailText, email: normalizeEmail(emailText) };
}

const emailSubject = (inv) => `Fattura n. ${inv.number} del ${inv.date.split('-').reverse().join('/')}`;

// mode: 'whatsapp' or 'email'. Returns { url, marks } or { refused }.
// marks: the invoice counts as contacted right away. Not for email: Windows takes a mailto link even when the
// mail program behind it never opens (an old Outlook 2007 does just that), so the owner confirms it went out.
// An email plan also carries `copy`, the same email as text to paste into webmail.
export function plan({ invoice, saved, message, mode }) {
  const text = String(message ?? '').trim().slice(0, MESSAGE_MAX);
  if (!invoice || !text) return { refused: 'nothing to send' };
  const contact = resolveContact(invoice, saved);
  if (mode === 'whatsapp') {
    return contact.phone ? { url: waUrl(contact.phone, text), marks: true } : { refused: 'no valid phone' };
  }
  if (!contact.email) return { refused: 'no valid email' };
  const subject = emailSubject(invoice);
  return {
    url: mailUrl(contact.email, subject, text), marks: false,
    copy: `A: ${contact.email}\nOggetto: ${subject}\n\n${text}`,
  };
}
