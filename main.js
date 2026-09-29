const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

// Lets tests point the app at a throwaway data folder.
if (process.env.HABIT_DATA_DIR) app.setPath('userData', process.env.HABIT_DATA_DIR);

const dataFile = () => path.join(app.getPath('userData'), 'habits.json');
const backupFile = () => path.join(app.getPath('userData'), 'habits.backup.json');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function isValidData(d) {
  return d && Array.isArray(d.habits) && d.log && typeof d.log === 'object';
}

ipcMain.handle('store:load', () => {
  const main = readJson(dataFile());
  if (isValidData(main)) return { data: main, recovered: false };

  const backup = readJson(backupFile());
  if (isValidData(backup)) {
    // Keep the broken file around instead of silently overwriting it.
    if (fs.existsSync(dataFile())) {
      fs.copyFileSync(dataFile(), path.join(app.getPath('userData'), `habits.corrupt-${Date.now()}.json`));
    }
    return { data: backup, recovered: true };
  }
  return { data: null, recovered: false };
});

ipcMain.handle('store:save', (_e, data) => {
  if (!isValidData(data)) throw new Error('Refusing to save invalid data');
  fs.mkdirSync(app.getPath('userData'), { recursive: true });

  // Only back up the current file if it is good, so a bad file never replaces a good backup.
  if (isValidData(readJson(dataFile()))) fs.copyFileSync(dataFile(), backupFile());

  // Write to a temp file first, then swap it in, so a crash mid-write can't wipe the data.
  const tmp = dataFile() + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  fs.writeSync(fd, JSON.stringify(data, null, 2));
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmp, dataFile());
  return true;
});

ipcMain.handle('store:path', () => dataFile());

ipcMain.handle('store:export', async (e, data) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export habit backup',
    defaultPath: path.join(app.getPath('documents'), `habit-backup-${stamp}.json`),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
});

ipcMain.handle('store:import', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import habit backup',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths.length) return null;
  const data = readJson(filePaths[0]);
  if (!isValidData(data)) throw new Error('That file is not a habit tracker backup.');
  return data;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: 'Habit Tracker',
    backgroundColor: '#0b0b0b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
