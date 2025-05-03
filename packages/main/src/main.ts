// packages/main/src/main.ts
import { app, BrowserWindow } from 'electron';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
const dev = process.env.NODE_ENV !== 'production';
async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration:  dev,   //  ✅  Node im Renderer
      contextIsolation: !dev,  //  ✅  aus, solange Node aktiv
      sandbox: false,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  win.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (process.env.NODE_ENV !== 'production') {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(bootstrap);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
