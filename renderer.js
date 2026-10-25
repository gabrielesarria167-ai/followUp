const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const $ = (id) => document.getElementById(id);
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const fmtDate = (iso) => iso.split('-').reverse().join('/');
const fmtShort = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fmtTs = (ts) => new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
const isPending = (r) => r.status === 'pending';

let year = null;
let month = null;
let rows = []; // in display order
let selectedKey = null;
let failed = false; // the last save failed; the panel says so once
let sort = { col: 'date', dir: -1 }; // newest first
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

async function refresh() {
  const meta = await window.api.refresh();
  $('status').textContent = meta.error ?? [
    meta.latest ? `Fatture fino al ${fmtDate(meta.latest)}` : 'Nessuna fattura',
    meta.sample && 'Anteprima: numeri di telefono di esempio',
  ].filter(Boolean).join(' · ');
  $('status').classList.toggle('error', !!meta.error);

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

// Dal/al pick a span of days inside the selected month; untouched, they cover the whole month.
const daysIn = () => new Date(year, month, 0).getDate();
const iso = (day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const span = () => [Number($('from').value), Number($('to').value)];
const ranged = () => { const [from, to] = span(); return from > 1 || to < daysIn(); };

function periodTitle() {
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
  const [months, list] = await Promise.all([
    window.api.year(year),
    ranged() ? window.api.range(...span().map(iso)) : window.api.month(year, month),
  ]);
  rows = list;
  sortRows();
  if (!rows.some((r) => r.key === selectedKey)) selectedKey = (rows.find(isPending) ?? rows[0])?.key ?? null;
  renderMonths(months);
  renderList();
  renderDetail();
}

// Ties stay newest first, like the archive order.
function sortRows() {
  const by = SORTS[sort.col];
  rows.sort((a, b) => sort.dir * by(a, b) || b.date.localeCompare(a.date) || b.key.localeCompare(a.key, undefined, { numeric: true }));
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
    }, el('span', { textContent: MONTHS[i] }), m.open ? el('small', { textContent: m.open }) : null);
    b.setAttribute('aria-current', String(i + 1 === month));
    b.addEventListener('click', () => { month = i + 1; selectedKey = null; clearRange(); render(); });
    return b;
  }));
}

function renderList() {
  const pending = rows.filter(isPending);
  const noPhone = pending.filter((r) => !r.phone).length;
  const messaged = rows.filter((r) => r.status === 'messaged').length;
  $('title').textContent = periodTitle();
  $('range-clear').hidden = !ranged();
  $('summary').textContent = rows.length && !pending.length
    ? [ranged() ? 'Periodo completato' : `${MONTHS[month - 1]} completato`, messaged && `${messaged} contattate`].filter(Boolean).join(' · ')
    : [
      `${rows.length} fatture`, `${pending.length} da contattare`,
      messaged && `${messaged} contattate`, noPhone && `${noPhone} senza telefono`,
    ].filter(Boolean).join(' · ');
  for (const th of document.querySelectorAll('th[data-sort]')) {
    th.setAttribute('aria-sort', th.dataset.sort !== sort.col ? 'none' : sort.dir > 0 ? 'ascending' : 'descending');
  }

  $('table-box').hidden = !rows.length;
  $('empty').hidden = !!rows.length;
  $('empty').textContent = $('status').classList.contains('error')
    ? 'Nessun dato: archivio fatture non trovato. Reinstalla FollowUp e seleziona wcFatture.mdb.'
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
    el('td', { className: 'nowrap', textContent: fmtShort(r.date) }),
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

  const phone = el('input', { type: 'tel', value: r.phoneText, placeholder: 'Aggiungi numero' });
  phone.addEventListener('change', async () => {
    await save(() => window.api.setPhone(r.key, phone.value));
    // Leaving the box by clicking a panel button: that button redraws itself, and redrawing now would eat its click.
    if (failed || !$('detail').contains(document.activeElement)) render();
  });
  phone.addEventListener('keydown', (e) => { if (e.key === 'Enter') phone.blur(); });
  const [hint, warn] =
    r.phoneText && !r.phone ? ['Numero non valido.', true]
    : !r.phoneText ? ['Aggiungi un numero per scrivere su WhatsApp.', true]
    : !r.mobile ? ['Numero fisso? WhatsApp potrebbe non funzionare.', true]
    : ['Se lo correggi, resta salvato per questo cliente.', false];

  const next = nextPending();
  const nextBtn = el('button', { className: 'btn', textContent: 'Successiva', disabled: !next });
  nextBtn.addEventListener('click', () => select(next.key));
  const wa = action('Apri WhatsApp', 'btn btn-wa', () => window.api.openWhatsApp(r.key), !r.phone);
  if (!r.phone) wa.title = 'Aggiungi prima un numero di telefono';
  const actions = isPending(r)
    ? [wa,
       el('div', { className: 'actions-row' }, action('Elimina', 'btn', () => window.api.setStatus(r.key, 'dismissed')), nextBtn)]
    : [el('div', { className: 'closed-note' },
        el('span', { textContent: `${r.status === 'messaged' ? 'Contattato' : 'Eliminata'} il ${fmtTs(r.at)}` }),
        action('Annulla', 'link', () => window.api.setStatus(r.key, null))),
       nextBtn];

  $('detail').replaceChildren(
    el('div', {},
      el('h2', { textContent: titleCase(r.client) || '—' }),
      el('div', { className: 'muted', textContent: [titleCase(r.place), `Fattura ${r.number} del ${fmtDate(r.date)}`].filter(Boolean).join(' · ') })),
    el('dl', {},
      el('dt', { textContent: 'Veicolo' }), el('dd', { textContent: [r.vehicle, r.plate].filter(Boolean).join(' · ') || '—' }),
      el('dt', { textContent: 'Pagamento' }), el('dd', { textContent: r.payment || '—' }),
      el('dt', { textContent: 'Totale' }), el('dd', { className: 'nowrap', textContent: euro.format(r.total) })),
    el('label', { className: 'field' },
      el('span', { textContent: 'Telefono' }), phone,
      el('span', { className: `hint${warn ? ' warn' : ''}`, textContent: hint })),
    el('div', { className: 'field' },
      el('span', { textContent: 'Messaggio' }),
      el('p', { className: 'message', textContent: r.message })),
    el('div', { className: 'actions' }, ...actions,
      failed && el('p', { className: 'hint warn', role: 'alert', textContent: 'Operazione non riuscita. Riprova.' })),
  );
  failed = false;
}

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

$('year').addEventListener('change', () => { year = Number($('year').value); selectedKey = null; clearRange(); render(); });
// The other end follows so the span never runs backwards.
$('from').addEventListener('change', () => { if (span()[1] < span()[0]) $('to').value = $('from').value; selectedKey = null; render(); });
$('to').addEventListener('change', () => { if (span()[0] > span()[1]) $('from').value = $('to').value; selectedKey = null; render(); });
$('range-clear').addEventListener('click', () => { clearRange(); selectedKey = null; render(); });
$('refresh').addEventListener('click', refresh);
// Same column flips the order; a new one starts A→Z for text, newest/highest first for the rest.
for (const b of document.querySelectorAll('th[data-sort] button')) {
  b.addEventListener('click', () => {
    const col = b.parentElement.dataset.sort;
    sort = { col, dir: col === sort.col ? -sort.dir : ['client', 'status'].includes(col) ? 1 : -1 };
    sortRows();
    select(selectedKey);
  });
}
refresh();
