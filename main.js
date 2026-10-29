import { app, BrowserWindow, clipboard, dialog, ipcMain, screen, shell, utilityProcess } from 'electron';
import electronUpdater from 'electron-updater';
import { copyFileSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { readInChild } from './child.js';
import { MESSAGE_MAX } from './outreach.js';
import { createSession } from './session.js';
import { openStore, templateList, TEMPLATES } from './store.js';

let store;
let session;
let win;

// Fallback when the installer saved no path (dev runs): data/wcFatture.mdb.
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

// In its own process (reader.js): read in here, the raw files would keep the app at ~400 MB instead of ~80 MB.
const readArchive = (path) =>
  readInChild(() => utilityProcess.fork(join(import.meta.dirname, 'reader.js'), [], { serviceName: 'FollowUp archivio' }), path);

// Locked or not, the page also gets the logo, which is a file in FollowUp's own folder.
const meta = (view) => ({ ...view, logo: logoDataUrl() });

ipcMain.handle('refresh', async () => meta(await session.refresh()));

ipcMain.handle('activate', async (_e, key) => meta(await session.activate(key)));

ipcMain.handle('pickDb', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Archivio fatture Wincar', properties: ['openFile'], filters: [{ name: 'Archivio Wincar', extensions: ['mdb'] }],
  });
  return meta(await (canceled ? session.refresh() : session.useArchive(filePaths[0])));
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

ipcMain.handle('month', (_e, year, month) => session.month(year, month));

ipcMain.handle('range', (_e, from, to) => session.range(String(from), String(to)));

ipcMain.handle('search', (_e, query) => session.search(String(query ?? '')));

ipcMain.handle('year', (_e, year) => session.year(year));

ipcMain.handle('setPhone', (_e, key, text) => session.setContact('phones', key, text));
ipcMain.handle('setLandline', (_e, key, text) => session.setContact('landlines', key, text));
ipcMain.handle('setEmail', (_e, key, text) => session.setContact('emails', key, text));

ipcMain.handle('setStatus', (_e, key, status) => session.setStatus(key, status));

ipcMain.handle('remove', (_e, key) => session.remove(key));

// The text is the panel's message box: a template filled for this invoice, maybe edited.
// The URL is always built by Outreach, so only wa.me and mailto links ever reach the OS.
ipcMain.handle('openWhatsApp', async (_e, key, text) => {
  const { url, marks } = session.outreach(key, text, 'whatsapp');
  if (!url) return;
  await shell.openExternal(url);
  if (marks) session.markMessaged(key);
});

// Not marked here: the owner says whether it went out (confirmEmail).
ipcMain.handle('openEmail', async (_e, key, text) => {
  const { url } = session.outreach(key, text, 'email');
  if (url) await shell.openExternal(url);
  return !!url;
});

ipcMain.handle('confirmEmail', (_e, key) => session.markMessaged(key));

// The mail program didn't open: the same email as text, to paste into webmail.
ipcMain.handle('copyEmail', (_e, key, text) => {
  const { copy } = session.outreach(key, text, 'email');
  if (!copy) throw new Error('nothing to copy');
  clipboard.writeText(copy);
});

// Two windows would each keep their own copy of followup.json and overwrite each other's saves.
if (!app.requestSingleInstanceLock()) app.quit();

// Italian date inputs (gg/mm/aaaa) whatever the PC language.
app.commandLine.appendSwitch('lang', 'it-IT');

app.whenReady().then(() => {
  store = openStore(join(app.getPath('userData'), 'followup.json'));
  session = createSession({
    store,
    dbPath,
    readArchive,
  });
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

const UPDATE_CHECK_MS = 30 * 60 * 1000;

// Downloads in the background and installs when the app closes; the footer offers to restart sooner.
// Checked after the page loads, so a download cached by an earlier run still reaches the footer, and again
// every 30 minutes, so a release reaches a FollowUp left open all day.
function checkForUpdates() {
  const { autoUpdater } = electronUpdater;
  autoUpdater.on('download-progress', ({ percent }) => win?.webContents.send('updateProgress', Math.floor(percent)));
  autoUpdater.on('update-downloaded', ({ version }) => win?.webContents.send('updateReady', version));
  autoUpdater.on('error', (err) => console.error('update:', err.message)); // offline is fine
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, UPDATE_CHECK_MS);
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
