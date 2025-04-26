// packages/main/src/main.ts
import 'reflect-metadata';
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { NestFactory } from '@nestjs/core'; // Assuming you'll use NestFactory
import { AppModule } from './app/app.module'; // Assuming AppModule path
import { LoggerService } from './app/logger/logger.service'; // Import custom logger

async function bootstrapNestApp() {
  // Create context/app WITHOUT default NestJS logger initially
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false, // Disable default console logger
  });

  // --- Set Custom Logger ---
  // Get instance of our custom logger (which uses ConfigService)
  // and tell NestJS to use it globally
  const customLogger = app.get(LoggerService);
  app.useLogger(customLogger);

  // Now we can use the NestJS logger (which routes to Pino)
  customLogger.log('NestJS Application Context Initialized. Logger is active.');

  console.log('[Main Process] NestJS application bootstrap complete.');
  return app; // Return app context if needed elsewhere
}

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

app.whenReady().then(async () => { 
  await bootstrapNestApp(); 
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});