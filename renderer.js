const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const $ = (id) => document.getElementById(id);
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const fmtDate = (iso) => iso.split('-').reverse().join('/');
const fmtShort = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fmtTs = (ts) => new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
const isPending = (r) => r.status === 'pending';
// A template with this invoice's details; a missing one (a fifth have no plate) leaves no stray space.
const fill = (text, r) => {
  const vals = { cliente: titleCase(r.client), veicolo: r.car, targa: r.plate, fattura: r.number, data: fmtDate(r.date), totale: euro.format(r.total) };
  return text.replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(vals, k) ? vals[k] ?? '' : m)).replace(/ +(?=[ ,.;:!?)])/g, '');
};

let year = null;
let month = null;
let rows = []; // in display order
let selectedKey = null;
let failed = false; // the last save failed; the panel says so once
let sort = { col: 'date', dir: -1 }; // newest first
let pinned = null; // the summary pill pressed: its rows go first, the rest after
let templates = []; // the five ready messages, in the owner's wording
let tplId = 'feedback'; // the template in use: it stays chosen from one invoice to the next
let draft = null; // { key, text }: the message as typed over for one invoice
let editing = null; // the template open in Modifica
const PINS = {
  pending: isPending,
  messaged: (r) => r.status === 'messaged',
  nophone: (r) => isPending(r) && !r.phone,
};
const STATUS_ORDER = ['pending', 'nophone', 'messaged', 'dismissed'];
const SORTS = {
  date: (a, b) => a.date.localeCompare(b.date) || SORTS.number(a, b),
  number: (a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }),
  client: (a, b) => a.client.localeCompare(b.client, 'it'),
  total: (a, b) => a.total - b.total,
  status: (a, b) => STATUS_ORDER.indexOf(stateOf(a)[0]) - STATUS_ORDER.indexOf(stateOf(b)[0]),
};

// Builds DOM with textContent only: DB strings are never parsed as HTML.
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}

// meta: what activate/pickDb already returned, else a fresh read.
async function refresh(meta) {
  meta ??= await window.api.refresh();
  const { license } = meta;
  const expiring = license.ok && license.daysLeft <= 30;
  renderLock(meta, expiring);
  $('license').hidden = !license.ok;
  $('license').classList.toggle('expiring', expiring);
  if (license.ok) {
    $('license-days').textContent = `${license.daysLeft} ${license.daysLeft === 1 ? 'giorno disponibile' : 'giorni disponibili'}`;
    $('license-until').textContent = `Valida fino al ${fmtDate(license.expires)}`;
  }
  $('company').hidden = !license.ok || !license.name;
  $('company-name').textContent = license.name ?? '';
  showLogo(meta.logo);
  templates = meta.templates;
  $('status').textContent = meta.error ?? [
    meta.latest ? `Fatture fino al ${fmtDate(meta.latest)}` : 'Nessuna fattura',
    meta.sample && 'Anteprima: numeri di telefono di esempio',
  ].filter(Boolean).join(' · ');
  $('status').classList.toggle('error', !!meta.error);
  // Locked: no invoices to show; forget the month so unlocking opens the newest one.
  if (!license.ok) { year = null; return; }

  const years = meta.years.length ? meta.years : [new Date().getFullYear()];
  $('year').replaceChildren(...years.map((y) => el('option', { value: y, textContent: y })));
  if (!years.includes(year)) {
    year = meta.latest ? Number(meta.latest.slice(0, 4)) : years[0];
    month = meta.latest ? Number(meta.latest.slice(5, 7)) : new Date().getMonth() + 1;
    clearRange();
  }
  $('year').value = year;
  await render();
}

// The licensed company's logo replaces the building icon once one is chosen.
function showLogo(logo) {
  $('logo').classList.toggle('has-logo', !!logo);
  $('logo').replaceChildren(logo ? el('img', { src: logo, alt: '' }) : icon('building'));
  $('logo-remove').hidden = !logo;
}

// Shown only while locked; during the last 30 days "Rinnova" opens it. A valid key closes it.
function renderLock({ license, rejected, error }, expiring) {
  showLock(!license.ok || !!rejected);
  $('renew').hidden = !expiring;
  $('lock-close').hidden = !license.ok;
  $('pick-db').hidden = !license.needsDb;
  const reason = license.ok ? `La licenza scade il ${fmtDate(license.expires)}.` : license.reason || error;
  $('lock-reason').hidden = !reason;
  $('lock-reason').textContent = reason ?? '';
  $('lock-error').hidden = !rejected;
  $('lock-error').textContent = rejected ?? '';
}

// The screen covers the app; what is behind it can't be reached by keyboard either.
function showLock(open) {
  $('lock').hidden = !open;
  $('layout').inert = document.querySelector('.bar').inert = open;
  if (open) $('key').focus();
}

// Two letters or more search every period; the month and day filters wait until the box is cleared.
const query = () => $('search').value.trim();
const searching = () => query().length >= 2;

// Dal/al pick a span of days inside the selected month; untouched, they cover the whole month.
const daysIn = () => new Date(year, month, 0).getDate();
const iso = (day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const span = () => [Number($('from').value), Number($('to').value)];
const ranged = () => { const [from, to] = span(); return from > 1 || to < daysIn(); };

function periodTitle() {
  if (searching()) return `Risultati per «${query()}»`;
  const name = `${MONTHS[month - 1]} ${year}`;
  if (!ranged()) return name;
  const [from, to] = span();
  return from === to ? `${from} ${name.toLowerCase()}` : `Dal ${from} al ${to} ${name.toLowerCase()}`;
}

// Rebuilds the day lists for the current month and selects all of it.
function clearRange() {
  const days = Array.from({ length: daysIn() }, (_, i) => i + 1);
  for (const id of ['from', 'to']) $(id).replaceChildren(...days.map((d) => el('option', { value: d, textContent: d })));
  $('from').value = 1;
  $('to').value = days.length;
}

async function render() {
  const q = searching() ? query() : null;
  const [months, list] = await Promise.all([
    window.api.year(year),
    q ? window.api.search(q) : ranged() ? window.api.range(...span().map(iso)) : window.api.month(year, month),
  ]);
  if (q !== (searching() ? query() : null)) return; // typed on while waiting: a newer render owns the screen
  rows = list;
  if (pinned && !rows.some(PINS[pinned])) pinned = null; // e.g. another month: nothing left to pin
  sortRows();
  if (!rows.some((r) => r.key === selectedKey)) selectedKey = (rows.find(isPending) ?? rows[0])?.key ?? null;
  renderMonths(months);
  renderList();
  renderDetail();
}

// Ties stay newest first, like the archive order.
function sortRows() {
  const by = SORTS[sort.col];
  rows.sort((a, b) => (pinned ? PINS[pinned](b) - PINS[pinned](a) : 0) || sort.dir * by(a, b) || b.date.localeCompare(a.date) || b.key.localeCompare(a.key, undefined, { numeric: true }));
}

function select(key) {
  selectedKey = key;
  renderList();
  renderDetail();
}

function renderMonths(months) {
  $('months').replaceChildren(...months.map((m, i) => {
    const b = el('button', {
      className: `month${m.total && !m.open ? ' closed' : ''}`,
      disabled: !m.total,
    }, el('span', { textContent: MONTHS[i] }), el('small', { textContent: m.open }));
    b.setAttribute('aria-current', String(!searching() && i + 1 === month));
    b.addEventListener('click', () => { month = i + 1; selectedKey = null; $('search').value = ''; clearRange(); render(); });
    return b;
  }));
}

function renderList() {
  const pending = rows.filter(isPending);
  const noPhone = pending.filter((r) => !r.phone).length;
  const messaged = rows.filter((r) => r.status === 'messaged').length;
  $('title').textContent = periodTitle();
  $('range-clear').hidden = !ranged();
  document.querySelector('.range').hidden = searching();
  // A pill with a pin is a toggle button: pressing it again restores the plain sort.
  const pill = (color, text, pin) => {
    if (!pin) return el('span', { className: `pill ${color}`, textContent: text });
    const b = el('button', { className: `pill ${color}`, textContent: text });
    b.setAttribute('aria-pressed', String(pinned === pin));
    b.addEventListener('click', () => { pinned = pinned === pin ? null : pin; sortRows(); select(selectedKey); });
    return b;
  };
  $('summary').replaceChildren(...(rows.length && !pending.length
    ? [pill('green', searching() ? 'Nessuna da contattare' : ranged() ? 'Periodo completato' : `${MONTHS[month - 1]} completato`), messaged && pill('green', `${messaged} contattate`, 'messaged')]
    : [
      pill('blue', `${rows.length} fatture`), pill('yellow', `${pending.length} da contattare`, 'pending'),
      messaged && pill('green', `${messaged} contattate`, 'messaged'), noPhone && pill('red', `${noPhone} senza telefono`, 'nophone'),
    ]).filter(Boolean));
  for (const th of document.querySelectorAll('th[data-sort]')) {
    th.setAttribute('aria-sort', th.dataset.sort !== sort.col ? 'none' : sort.dir > 0 ? 'ascending' : 'descending');
  }

  $('table-box').hidden = !rows.length;
  $('empty').hidden = !!rows.length;
  $('empty').textContent = $('status').classList.contains('error')
    ? 'Nessun dato: archivio fatture non trovato. Reinstalla FollowUp e seleziona wcFatture.mdb.'
    : searching() ? `Nessuna fattura trovata per «${query()}».`
    : ranged() ? 'Nessuna fattura in questi giorni.'
    : `Nessuna fattura da contattare in ${MONTHS[month - 1].toLowerCase()} ${year}.`;
  $('rows').replaceChildren(...rows.map(row));
}

function stateOf(r) {
  if (r.status === 'messaged') return ['messaged', 'Contattato'];
  if (r.status === 'dismissed') return ['dismissed', 'Eliminata'];
  return r.phone ? ['pending', 'Da contattare'] : ['nophone', 'Senza telefono'];
}

function row(r) {
  const [cls, label] = stateOf(r);
  const client = el('button', { className: 'client', textContent: titleCase(r.client) || '—' });
  const tr = el('tr', { className: isPending(r) ? '' : 'is-done' },
    el('td', { className: 'nowrap', textContent: searching() ? fmtDate(r.date) : fmtShort(r.date) }), // results span years
    el('td', { className: 'nowrap', textContent: r.number }),
    el('td', {}, client, el('small', { textContent: titleCase(r.place) })),
    el('td', {}, el('div', { textContent: r.car || '—' }), el('small', { textContent: r.plate })),
    el('td', { className: 'num', textContent: euro.format(r.total) }),
    el('td', {}, el('span', { className: `state ${cls}`, textContent: label })),
  );
  tr.setAttribute('aria-selected', String(r.key === selectedKey));
  tr.addEventListener('click', () => select(r.key));
  return tr;
}

function nextPending() {
  const i = rows.findIndex((r) => r.key === selectedKey);
  return rows.slice(i + 1).find(isPending) ?? rows.slice(0, i).find(isPending);
}

function renderDetail() {
  const r = rows.find((x) => x.key === selectedKey);
  $('detail').hidden = !r;
  if (!r) return;

  // A contact box: saved for the client when left; Enter leaves it.
  const contact = (type, value, placeholder, set) => {
    const input = el('input', { type, value, placeholder });
    input.addEventListener('change', async () => {
      await save(() => set(r.key, input.value));
      // Leaving the box by clicking a panel button: that button redraws itself, and redrawing now would eat its click.
      if (failed || !$('detail').contains(document.activeElement)) render();
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    return input;
  };
  const phone = contact('tel', r.phoneText, 'Aggiungi numero', window.api.setPhone);
  const email = contact('email', r.emailText, 'Aggiungi email', window.api.setEmail);
  const [hint, warn] =
    r.phoneText && !r.phone ? ['Numero non valido.', true]
    : !r.phoneText ? ['Aggiungi un numero per scrivere su WhatsApp.', true]
    : !r.mobile ? ['Numero fisso? WhatsApp potrebbe non funzionare.', true]
    : ['Se lo correggi, resta salvato per questo cliente.', false];

  // The message box: the chosen template filled for this invoice, or what the owner typed over it.
  const tpl = templates.find((t) => t.id === tplId) ?? templates[0];
  const choose = (t) => {
    const b = el('button', { className: 'template', textContent: t.name });
    b.setAttribute('aria-pressed', String(t === tpl));
    b.addEventListener('click', () => {
      tplId = t.id; draft = null; renderDetail();
      $('detail').querySelector('.template[aria-pressed="true"]').focus();
      $('detail').querySelector('textarea.message').closest('.field').scrollIntoView({ block: 'nearest' }); // the new text, and its warning, in view
    });
    return b;
  };
  const edit = el('button', { className: 'link', textContent: 'Modifica' });
  edit.addEventListener('click', () => editTemplate(tpl));
  const text = el('textarea', {
    className: 'message', rows: 6, maxLength: 1000, placeholder: 'Scrivi il tuo messaggio…',
    value: draft?.key === r.key ? draft.text : fill(tpl.text, r),
  });
  const todo = el('span', { className: 'hint warn', textContent: 'Completa le parti tra [parentesi quadre], qui o per sempre con Modifica.' });
  const emoji = el('button', { type: 'button', className: 'emoji', title: 'Inserisci emoji' }, icon('smile'));
  emoji.setAttribute('aria-label', 'Inserisci emoji');
  emoji.addEventListener('click', () => { text.focus(); window.api.showEmojiPanel(); });
  const count = el('span', { className: 'count' });

  const next = nextPending();
  const nextBtn = el('button', { className: 'btn btn-blue', textContent: 'Successiva', disabled: !next });
  nextBtn.addEventListener('click', () => select(next.key));
  const wa = action('Invia su WhatsApp', 'btn btn-wa', () => window.api.openWhatsApp(r.key, text.value), !r.phone);
  wa.prepend(icon('whatsapp'));
  if (!r.phone) wa.title = 'Aggiungi prima un numero di telefono';
  const mail = action('Invia Email', 'btn btn-mail btn-blue', () => window.api.openEmail(r.key, text.value), !r.email);
  mail.prepend(icon('mail'));
  if (!r.email) mail.title = 'Aggiungi prima un indirizzo email';
  const check = () => {
    todo.hidden = !/\[[^\]\n]*\]/.test(text.value);
    wa.disabled = !r.phone || !text.value.trim();
    mail.disabled = !r.email || !text.value.trim();
    count.textContent = `${text.value.length}/${text.maxLength}`;
  };
  text.addEventListener('input', () => { draft = { key: r.key, text: text.value }; check(); });
  check();
  const actions = isPending(r)
    ? [wa, mail,
       el('div', { className: 'actions-row' }, action('Elimina', 'btn btn-red', () => window.api.setStatus(r.key, 'dismissed')), nextBtn)]
    : [el('div', { className: 'closed-note' },
        el('span', { textContent: `${r.status === 'messaged' ? 'Contattato' : 'Eliminata'} il ${fmtTs(r.at)}` }),
        action('Annulla', 'link', () => window.api.setStatus(r.key, null))),
       r.status === 'messaged'
         ? el('div', { className: 'actions-row' }, action('Elimina', 'btn btn-red', () => window.api.remove(r.key)), nextBtn)
         : nextBtn];

  // A tall panel scrolls its body; the actions stay at the bottom, always in reach.
  $('detail').replaceChildren(el('div', { className: 'detail-body' },
    el('div', { className: 'detail-head' },
      el('span', { className: 'tile' }, icon('building')),
      el('div', {},
        el('h2', { textContent: titleCase(r.client) || '—' }),
        el('div', { className: 'muted', textContent: titleCase(r.place) }))),
    el('dl', {},
      el('dt', {}, icon('car'), 'Veicolo'), el('dd', { textContent: [r.vehicle, r.plate].filter(Boolean).join(' · ') || '—' }),
      el('dt', {}, icon('receipt'), 'Fattura'), el('dd', { className: 'nowrap', textContent: `n. ${r.number} del ${fmtDate(r.date)}` }),
      el('dt', {}, icon('card'), 'Pagamento'), el('dd', { textContent: r.payment || '—' }),
      el('dt', {}, icon('coins'), 'Totale'), el('dd', { className: 'nowrap total', textContent: euro.format(r.total) })),
    el('label', { className: 'field' },
      el('span', {}, icon('phone'), 'Telefono'), phone,
      el('span', { className: `hint${warn ? ' warn' : ''}`, textContent: hint })),
    el('label', { className: 'field' },
      el('span', {}, icon('mail'), 'Email'), email,
      r.emailText && !r.email && el('span', { className: 'hint warn', textContent: 'Email non valida.' })),
    // Only what is still to send gets a message.
    isPending(r) && el('div', { className: 'field' },
      el('span', {}, icon('file-text'), 'Template messaggi', edit),
      el('div', { className: 'templates' }, ...templates.map(choose))),
    isPending(r) && el('label', { className: 'field' }, el('span', {}, icon('message'), 'Messaggio libero'),
      el('div', { className: 'compose' }, text, el('div', { className: 'compose-foot' }, emoji, count)), todo)),
    el('div', { className: 'actions' }, ...actions,
      failed && el('p', { className: 'hint warn', role: 'alert', textContent: 'Operazione non riuscita. Riprova.' })),
  );
  failed = false;
}

// Rewrites a template for good; the panel's message box is for one invoice only.
function editTemplate(t) {
  editing = t;
  $('tpl-title').textContent = t.name;
  $('tpl-text').value = t.text;
  $('tpl-dialog').returnValue = ''; // Esc keeps the last value: it must not read as a save
  $('tpl-dialog').showModal();
}

// Decorative icon: a CSS mask over an assets/ SVG, so nothing here is parsed as markup.
const icon = (name) => el('span', { className: `ico i-${name}` });

// Runs a save in the main process; a failure is shown in the panel instead of being lost.
async function save(run) {
  try {
    await run();
  } catch {
    failed = true;
  }
}

// A button that saves something, then redraws.
function action(text, className, run, disabled = false) {
  const b = el('button', { textContent: text, className, disabled });
  b.addEventListener('click', async () => {
    b.disabled = true;
    await save(run);
    render();
  });
  return b;
}

$('year').addEventListener('change', () => { year = Number($('year').value); selectedKey = null; $('search').value = ''; clearRange(); render(); });
$('search').addEventListener('input', () => render()); // the selection stays while it is still in the list
// The other end follows so the span never runs backwards.
$('from').addEventListener('change', () => { if (span()[1] < span()[0]) $('to').value = $('from').value; selectedKey = null; render(); });
$('to').addEventListener('change', () => { if (span()[0] > span()[1]) $('from').value = $('to').value; selectedKey = null; render(); });
$('range-clear').addEventListener('click', () => { clearRange(); selectedKey = null; render(); });
$('refresh').addEventListener('click', () => refresh());
$('renew').addEventListener('click', () => showLock(true));
$('lock-close').addEventListener('click', () => showLock(false));
$('pick-db').addEventListener('click', async () => refresh(await window.api.pickDb()));
$('logo-pick').addEventListener('click', async () => showLogo(await window.api.pickLogo()));
$('logo-remove').addEventListener('click', async () => showLogo(await window.api.removeLogo()));
$('tpl-reset').addEventListener('click', () => { $('tpl-text').value = editing.original; });
$('tpl-dialog').addEventListener('close', async () => {
  if ($('tpl-dialog').returnValue !== 'save') return;
  await save(async () => { templates = await window.api.setTemplate(editing.id, $('tpl-text').value); });
  draft = null; // show the new wording
  renderDetail();
});
$('lock-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const meta = await window.api.activate($('key').value);
  if (!meta.rejected) $('key').value = '';
  refresh(meta);
});
// Same column flips the order; a new one starts A→Z for text, newest/highest first for the rest.
for (const b of document.querySelectorAll('th[data-sort] button')) {
  b.addEventListener('click', () => {
    const col = b.parentElement.dataset.sort;
    sort = { col, dir: col === sort.col ? -sort.dir : ['client', 'status'].includes(col) ? 1 : -1 };
    sortRows();
    select(selectedKey);
  });
}
window.api.version().then((v) => { $('version').textContent = `v${v}`; });
// Updates download on their own; the button appears once one is ready (it also installs on close).
window.api.onUpdateProgress((percent) => {
  $('version').dataset.progress = `Download aggiornamento ${percent}%`;
});
window.api.onUpdateReady((version) => {
  delete $('version').dataset.progress;
  $('update').textContent = `Aggiorna a v${version}`;
  $('update').title = "Riavvia FollowUp con la nuova versione";
  $('update').hidden = false;
});
$('update').addEventListener('click', () => window.api.installUpdate());
refresh();
