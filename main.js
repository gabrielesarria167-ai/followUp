import { app, BrowserWindow, ipcMain, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadInvoices } from './db.js';
import { buildMessage, monthView, normalizePhone, openStore, phoneKey, rangeView, waUrl, yearView } from './store.js';

let store;
let win;
let invoices = [];
let dbError = null;

// Installed app: invoices live in the user profile (data/wcFatture.mdb), so app updates never overwrite them.
// data/ESEMPIO marks the client preview: only then are phones invented. Delete it with the real data.
const dataDir = () => join(app.isPackaged ? app.getPath('userData') : import.meta.dirname, 'data');

function readDb() {
  const path = join(dataDir(), 'wcFatture.mdb');
  const sample = existsSync(join(dataDir(), 'ESEMPIO'));
  try {
    invoices = loadInvoices(path, { samplePhones: sample });
    dbError = null;
  } catch (err) {
    invoices = [];
    dbError = existsSync(path) ? `Impossibile leggere ${path}: ${err.message}` : `Archivio fatture mancante: ${path}`;
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
