import { app, BrowserWindow, ipcMain, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadInvoices } from './db.js';
import { buildMessage, monthView, normalizePhone, openStore, phoneKey, rangeView, waUrl, yearView } from './store.js';

let store;
let win;
let invoices = [];
let dbError = null;

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

function readDb() {
  const path = configuredDbPath() ?? join(dataDir(), 'wcFatture.mdb');
  const sample = existsSync(join(dirname(path), 'ESEMPIO'));
  try {
    invoices = loadInvoices(path, { samplePhones: sample });
    dbError = null;
  } catch (err) {
    invoices = [];
    dbError = existsSync(path) ? `Impossibile leggere ${path}: ${err.message}` : `Archivio fatture mancante: ${path}. Reinstalla FollowUp per selezionarlo`;
  }
  return {
    error: dbError,
    sample,
    years: [...new Set(invoices.map((i) => Number(i.date.slice(0, 4))))],
    latest: invoices[0]?.date ?? null,
  };
}

ipcMain.handle('refresh', () => readDb());

ipcMain.handle('month', (_e, year, month) => monthView(invoices, store.data, year, month, Date.now()));

ipcMain.handle('range', (_e, from, to) => rangeView(invoices, store.data, String(from), String(to), Date.now()));

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
