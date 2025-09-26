// packages/main/src/main.ts
import { app, BrowserWindow, Menu } from 'electron';

// Handle Squirrel startup events to create/remove Windows shortcuts silently.
// When this returns true (during install/uninstall), we exit early to let Squirrel finish.
if (require('electron-squirrel-startup')) {
  app.quit();
}
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Treat anything that's not a packaged build as development
const isDevelopment = !app.isPackaged;
async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      devTools: isDevelopment,           // disable DevTools in production
      nodeIntegration:  isDevelopment,   //  ✅  Node im Renderer nur in dev
      contextIsolation: !isDevelopment,  //  ✅  in Prod aktiv für Sicherheit
      sandbox: false,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
    autoHideMenuBar: !isDevelopment,     // hide menubar in production
  });

  win.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (!isDevelopment) {
    try { Menu.setApplicationMenu(null); } catch {}
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools();
    });
  } else {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(bootstrap);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
