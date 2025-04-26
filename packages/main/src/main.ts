// packages/main/src/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';

if (require('electron-squirrel-startup')) {
  app.quit();
}

const VITE_DEV_SERVER_DEFAULT_URL = 'http://localhost:5173'; // Vite's default port

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      sandbox: false,
    },
  });

  mainWindow.maximize();
  mainWindow.show();

  // Load the URL based on packaging status
  if (!app.isPackaged) {
    // Development: Load Vite dev server URL
    console.log(`[Main Process] Loading DEV URL: ${VITE_DEV_SERVER_DEFAULT_URL}`);
    mainWindow.loadURL(VITE_DEV_SERVER_DEFAULT_URL);
    mainWindow.webContents.openDevTools(); // Open DevTools in development
  } else {
    // Production: Load built index.html file
    const indexPath = path.join(__dirname, '../renderer/index.html');
    console.log(`[Main Process] Loading PROD file: ${indexPath}`);
    mainWindow.loadFile(indexPath);
  }

  console.log('[Main Process] NestJS application bootstrap would happen here.');
};

app.whenReady().then(() => {
  createWindow();
  // ... app lifecycle events ...
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});