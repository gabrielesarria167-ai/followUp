import { app, BrowserWindow, clipboard, dialog, ipcMain, screen, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { copyFileSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { loadInvoices, shopVats } from './db.js';
import { checkLicense } from './license.js';
import { contactKey, mailUrl, monthView, normalizeEmail, normalizePhone, openStore, rangeView, searchView, templateList, TEMPLATES, waUrl, yearView } from './store.js';

let store;
let win;
let invoices = [];
let dbError = null;
let shop = { vats: [], latest: null }; // what the license is checked against

// Fallback when the installer saved no path (dev runs): data/wcFatture.mdb.
// An ESEMPIO file next to the archive marks the client preview: only then are phones invented. Delete it with the real data.
const dataDir = () => join(app.isPackaged ? app.getPath('userData') : import.meta.dirname, 'data');

// Written by the installer page (build/installer.nsh): per-user installs in the profile, all-users ones in ProgramData.
function configuredDbPath() {
  const files = [
    join(app.getPath('userData'), 'followup.ini'),
    join(process.env.PROGRAMDATA ?? 'C:\\ProgramData', 'FollowUp', 'followup.ini'),
  ];
  for (const file of files.filter((f) => existsSync(f))) {
    const buf = readFileSync(file);
    const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le', 2) : buf.toString('utf8');
    const path = text.match(/^\s*path\s*=\s*(.+?)\s*$/m)?.[1];
    if (path) return path;
  }
  return null;
}

// The archive picked on the lock screen (the latest choice), else the installer's, else the one inside FollowUp.
const dbPath = () => store.data.dbPath ?? configuredDbPath() ?? join(dataDir(), 'wcFatture.mdb');

const checkKey = (key) => checkLicense(key, { ...shop, now: Date.now(), lastSeen: store.data.lastSeen });

function readDb() {
  const path = dbPath();
  const sample = existsSync(join(dirname(path), 'ESEMPIO'));
  let all = [];
  try {
    all = loadInvoices(path, { samplePhones: sample });
    shop = { vats: shopVats(path), latest: all[0]?.date ?? null };
    dbError = null;
  } catch (err) {
    shop = { vats: [], latest: null };
    dbError = existsSync(path) ? `Impossibile leggere ${path}: ${err.message}` : `Archivio fatture mancante: ${path}. Reinstalla FollowUp per selezionarlo`;
  }
  const license = checkKey(store.data.license);
  store.update((d) => { d.lastSeen = Math.max(d.lastSeen ?? 0, Date.now()); });
  // Locked: no invoices in the main process, so every other handler has nothing to act on.
  invoices = license.ok ? all : [];
  return {
    error: dbError,
    sample,
    years: [...new Set(invoices.map((i) => Number(i.date.slice(0, 4))))],
    latest: invoices[0]?.date ?? null,
    license: { ...license, needsDb: !shop.vats.length },
    logo: logoDataUrl(),
    templates: templateList(store.data),
  };
}

ipcMain.handle('refresh', () => readDb());

// A wrong key never replaces a working one.
ipcMain.handle('activate', (_e, key) => {
  const k = String(key ?? '').trim();
  const { ok, reason } = checkKey(k);
  if (ok) store.update((d) => { d.license = k; });
  return { ...readDb(), rejected: ok ? null : reason };
});

ipcMain.handle('pickDb', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Archivio fatture Wincar', properties: ['openFile'], filters: [{ name: 'Archivio Wincar', extensions: ['mdb'] }],
  });
  if (!canceled) store.update((d) => { d.dbPath = filePaths[0]; });
  return readDb();
});

const LOGO_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const LOGO_MAX = 2 * 1024 * 1024; // it travels with every refresh

// Sent as a data URL: the page may only load images from itself or inline.
function logoDataUrl() {
  const name = store.data.logo;
  if (!name) return null;
  try {
    return `data:${LOGO_TYPES[extname(name)]};base64,${readFileSync(join(app.getPath('userData'), name)).toString('base64')}`;
  } catch {
    return null; // deleted by hand: back to the building icon
  }
}

// Copied into FollowUp's own folder, so the logo stays if the original is moved or deleted.
ipcMain.handle('pickLogo', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Logo aziendale', properties: ['openFile'], filters: [{ name: 'Immagini', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }],
  });
  const ext = extname(filePaths[0] ?? '').toLowerCase();
  if (!canceled && LOGO_TYPES[ext]) {
    try {
      if (statSync(filePaths[0]).size > LOGO_MAX) throw new Error('il file supera 2 MB');
      copyFileSync(filePaths[0], join(app.getPath('userData'), `logo${ext}`));
      store.update((d) => { d.logo = `logo${ext}`; });
    } catch (err) {
      await dialog.showMessageBox(win, { type: 'warning', title: 'Logo aziendale', message: `Logo non salvato: ${err.message}` });
    }
  }
  return logoDataUrl();
});

// Back to the building icon; the copied file goes too.
ipcMain.handle('removeLogo', async () => {
  const name = store.data.logo;
  try {
    store.update((d) => { delete d.logo; });
    if (name) rmSync(join(app.getPath('userData'), name), { force: true });
  } catch (err) {
    await dialog.showMessageBox(win, { type: 'warning', title: 'Logo aziendale', message: `Logo non rimosso: ${err.message}` });
  }
  return logoDataUrl();
});

const MESSAGE_MAX = 1000; // the panel's limit too

// The owner's wording for a template; the original text, or none, brings the original back.
ipcMain.handle('setTemplate', (_e, id, text) => {
  const t = TEMPLATES.find((x) => x.id === id);
  const value = String(text ?? '').trim().slice(0, MESSAGE_MAX);
  if (t) {
    store.update(({ templates }) => {
      if (value && value !== t.text) templates[id] = value;
      else delete templates[id];
    });
  }
  return templateList(store.data);
});

ipcMain.handle('month', (_e, year, month) => monthView(invoices, store.data, year, month, Date.now()));

ipcMain.handle('range', (_e, from, to) => rangeView(invoices, store.data, String(from), String(to), Date.now()));

ipcMain.handle('search', (_e, query) => searchView(invoices, store.data, String(query ?? ''), Date.now()));

ipcMain.handle('year', (_e, year) => yearView(invoices, store.data, year, Date.now()));

// A phone or email as typed, kept for the client; an empty box forgets it.
const setContact = (list) => (_e, key, text) => {
  const inv = invoices.find((i) => i.key === key);
  if (!inv) return;
  const t = String(text ?? '').trim();
  store.update((data) => {
    if (t) data[list][contactKey(inv)] = t;
    else delete data[list][contactKey(inv)];
  });
};
ipcMain.handle('setPhone', setContact('phones'));
ipcMain.handle('setEmail', setContact('emails'));

ipcMain.handle('setStatus', (_e, key, status) => {
  store.update(({ states }) => {
    if (status === 'dismissed') states[key] = { status, at: Date.now() };
    else delete states[key];
  });
});

// Only a contacted invoice can be removed; it stays contacted, so it never comes back as to-do.
ipcMain.handle('remove', (_e, key) => {
  store.update(({ states }) => { if (states[key]?.status === 'messaged') states[key].removed = true; });
});

// The text is the panel's message box: a template filled for this invoice, maybe edited.
// The URL is always built here, so only wa.me and mailto links ever reach the OS.
async function send(key, text, toUrl) {
  const inv = invoices.find((i) => i.key === key);
  const message = String(text ?? '').trim().slice(0, MESSAGE_MAX);
  const url = inv && message && toUrl(inv, message);
  if (!url) return false;
  await shell.openExternal(url);
  return true;
}

const markMessaged = (key) => {
  if (!invoices.some((i) => i.key === key)) return;
  store.update(({ states }) => { states[key] = { status: 'messaged', at: Date.now() }; });
};

ipcMain.handle('openWhatsApp', async (_e, key, text) => {
  const sent = await send(key, text, (inv, message) => {
    const { phone } = normalizePhone(store.data.phones[contactKey(inv)] ?? inv.telefo);
    return phone && waUrl(phone, message);
  });
  if (sent) markMessaged(key);
});

const mailTo = (inv) => ({
  email: normalizeEmail(store.data.emails[contactKey(inv)]),
  subject: `Fattura n. ${inv.number} del ${inv.date.split('-').reverse().join('/')}`,
});

// Not marked here: Windows takes a mailto link even when the mail program behind it never opens
// (an old Outlook 2007 does just that), so the owner says whether it went out (confirmEmail).
ipcMain.handle('openEmail', (_e, key, text) => send(key, text, (inv, message) => {
  const { email, subject } = mailTo(inv);
  return email && mailUrl(email, subject, message);
}));

ipcMain.handle('confirmEmail', (_e, key) => markMessaged(key));

// The mail program didn't open: the same email as text, to paste into webmail.
ipcMain.handle('copyEmail', (_e, key, text) => {
  const inv = invoices.find((i) => i.key === key);
  const message = String(text ?? '').trim().slice(0, MESSAGE_MAX);
  const { email, subject } = inv ? mailTo(inv) : {};
  if (!email || !message) throw new Error('nothing to copy');
  clipboard.writeText(`A: ${email}\nOggetto: ${subject}\n\n${message}`);
});

// Two windows would each keep their own copy of followup.json and overwrite each other's saves.
if (!app.requestSingleInstanceLock()) app.quit();

// Italian date inputs (gg/mm/aaaa) whatever the PC language.
app.commandLine.appendSwitch('lang', 'it-IT');

app.whenReady().then(() => {
  store = openStore(join(app.getPath('userData'), 'followup.json'));
  // Never bigger than the screen: on a 1366×768 laptop the bottom bar would open off-screen.
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(880, height),
    minWidth: 960,
    title: 'FollowUp',
    icon: join(import.meta.dirname, 'assets', 'icon.png'),
    backgroundColor: '#0a1322',
    autoHideMenuBar: true,
    webPreferences: { preload: join(import.meta.dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(join(import.meta.dirname, 'index.html'));
  if (app.isPackaged) win.webContents.once('did-finish-load', checkForUpdates);
});

// Downloads in the background and installs when the app closes; the footer offers to restart sooner.
// Checked after the page loads, so a download cached by an earlier run still reaches the footer.
function checkForUpdates() {
  const { autoUpdater } = electronUpdater;
  autoUpdater.on('download-progress', ({ percent }) => win?.webContents.send('updateProgress', Math.floor(percent)));
  autoUpdater.on('update-downloaded', ({ version }) => win?.webContents.send('updateReady', version));
  autoUpdater.on('error', (err) => console.error('update:', err.message)); // offline is fine
  autoUpdater.checkForUpdates().catch(() => {});
}

ipcMain.handle('version', () => app.getVersion());

// The OS picker types into the focused field; Windows and macOS only.
ipcMain.handle('showEmojiPanel', () => app.showEmojiPanel());

ipcMain.handle('installUpdate',() => electronUpdater.autoUpdater.quitAndInstall(true, true));

app.on('second-instance', () => {
  if (win?.isMinimized()) win.restore();
  win?.focus();
});

app.on('window-all-closed', () => app.quit());
