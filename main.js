import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { loadInvoices, shopVats } from './db.js';
import { checkLicense } from './license.js';
import { buildMessage, monthView, normalizePhone, openStore, phoneKey, rangeView, searchView, waUrl, yearView } from './store.js';

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
    copyFileSync(filePaths[0], join(app.getPath('userData'), `logo${ext}`));
    store.update((d) => { d.logo = `logo${ext}`; });
  }
  return readDb();
});

ipcMain.handle('month', (_e, year, month) => monthView(invoices, store.data, year, month, Date.now()));

ipcMain.handle('range', (_e, from, to) => rangeView(invoices, store.data, String(from), String(to), Date.now()));

ipcMain.handle('search', (_e, query) => searchView(invoices, store.data, String(query ?? ''), Date.now()));

ipcMain.handle('year', (_e, year) => yearView(invoices, store.data, year, Date.now()));

ipcMain.handle('setPhone', (_e, key, text) => {
  const inv = invoices.find((i) => i.key === key);
  if (!inv) return;
  const t = String(text ?? '').trim();
  store.update(({ phones }) => {
    if (t) phones[phoneKey(inv)] = t;
    else delete phones[phoneKey(inv)];
  });
});

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

ipcMain.handle('openWhatsApp', async (_e, key) => {
  const inv = invoices.find((i) => i.key === key);
  if (!inv) return;
  const { phone } = normalizePhone(store.data.phones[phoneKey(inv)] ?? inv.telefo);
  if (!phone) return;
  // The URL is always built here, so only wa.me links ever reach the OS.
  await shell.openExternal(waUrl(phone, buildMessage(inv)));
  store.update(({ states }) => { states[key] = { status: 'messaged', at: Date.now() }; });
});

// Two windows would each keep their own copy of followup.json and overwrite each other's saves.
if (!app.requestSingleInstanceLock()) app.quit();

// Italian date inputs (gg/mm/aaaa) whatever the PC language.
app.commandLine.appendSwitch('lang', 'it-IT');

app.whenReady().then(() => {
  store = openStore(join(app.getPath('userData'), 'followup.json'));
  win = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 960,
    title: 'FollowUp',
    icon: join(import.meta.dirname, 'assets', 'icon.png'),
    backgroundColor: '#17181A',
    autoHideMenuBar: true,
    webPreferences: { preload: join(import.meta.dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(join(import.meta.dirname, 'index.html'));
  if (app.isPackaged) electronUpdater.autoUpdater.checkForUpdatesAndNotify().catch(() => {}); // offline is fine
});

app.on('second-instance', () => {
  if (win?.isMinimized()) win.restore();
  win?.focus();
});

app.on('window-all-closed', () => app.quit());
