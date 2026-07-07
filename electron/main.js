const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: 'Nexusora Books',
    // icon: path.join(__dirname, 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    backgroundColor: '#1A3560',
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function createMenu() {
  const template = [
    {
      label: 'Nexusora Books',
      submenu: [
        { label: 'About Nexusora Books', click: () => {
          const { dialog } = require('electron');
          dialog.showMessageBox(mainWindow, {
            type: 'info', title: 'About Nexusora Books',
            message: 'Nexusora Books v1.0.0',
            detail: 'Multi-Tenant Accounting Management System\n\nDeveloped by Nexusora Technologies\nWhere Knowledge Meets Technology\n\n© 2026 Nexusora Technologies',
          });
        }},
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' },
        { role: 'toggleDevTools' }, { type: 'separator' },
        { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' }, { role: 'maximize' }, { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Documentation', click: () => shell.openExternal('https://nexusorabooks.com/docs') },
        { label: 'Support', click: () => shell.openExternal('https://nexusorabooks.com/support') },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// IPC handlers
ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('file:save', async (event, { content, filename, type }) => {
  const { dialog } = require('electron');
  const fs = require('fs');

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    filters: [
      { name: type === 'csv' ? 'CSV Files' : 'PDF Files', extensions: [type || 'csv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (filePath) {
    fs.writeFileSync(filePath, content);
    return { success: true, path: filePath };
  }
  return { success: false };
});

app.whenReady().then(() => {
  createMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });