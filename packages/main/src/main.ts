// packages/main/src/main.ts (with detailed logging and error handling)
import 'reflect-metadata';
import { app, BrowserWindow, ipcMain } from 'electron'; // Added ipcMain for potential use later
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { LoggerService } from './app/logger/logger.service'; // Assuming LoggerService class name
// Import ConfigService ONLY IF needed directly in this file (unlikely now)
// import { ConfigService } from './app/config/config.service';

// Declare the magic constant for TypeScript (it's injected by Forge/Webpack)
declare const MAIN_WINDOW_WEBPACK_ENTRY: string; // For the main window URL
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string; // For the preload script

console.log('[Main Process] Script starting...'); // Log start

// Keep Squirrel Startup commented out for development
/*
if (require('electron-squirrel-startup')) {
  app.quit();
}
*/

let nestAppInstance: any = null; // Hold the instance for potential cleanup/access

async function bootstrapNestApp() {
  console.log('[Main Process] bootstrapNestApp() called.');
  try {
    // Create application context. This also triggers OnModuleInit hooks.
    const appContext = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log', 'debug'], // Using custom logger afterwards
    });
    console.log('[Main Process] Nest context created.');

    // Get logger instance AFTER context is created
    const customLogger = appContext.get(LoggerService);
    appContext.useLogger(customLogger); // Set for internal NestJS logs
    nestAppInstance = appContext; // Store instance

    customLogger.log('NestJS Application Context Initialized. Logger is active.');
    console.log('[Main Process] NestJS application bootstrap complete.');
    return appContext;
  } catch (error) {
    // Catch errors during NestJS bootstrap (e.g., module init failures)
    console.error('[Main Process] !!!! NestJS Bootstrap Error !!!!', error);
    app.quit(); // Quit if Nest fails
    throw error; // Re-throw
  }
}

// Use the Vite dev server URL provided by electron-vite, or default
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

const createWindow = (): void => {
  console.log('[Main Process] createWindow() called.');
  try {
    // Use the magic constant provided by Electron Forge Webpack plugin
    const preloadScriptPath = MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY;
    console.log(`[Main Process] Preload script path attempting to use: ${preloadScriptPath}`);

    const mainWindow = new BrowserWindow({
      width: 900,
      height: 670,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: preloadScriptPath, // Use the variable here
        sandbox: false,
      },
    });
    console.log('[Main Process] BrowserWindow instance created.');

    // --- CORRECTED Event listeners ---
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => { // <-- ADDED FUNCTION
        console.error(`[Main Process] Window content FAILED to load: ${validatedURL}, Error ${errorCode}: ${errorDescription}`);
    });
    mainWindow.webContents.on('did-finish-load', () => { // <-- This one was correct
        console.log(`[Main Process] Window content FINISHED loading: ${mainWindow.webContents.getURL()}`);
        mainWindow.maximize(); // Maximize after load finished
        mainWindow.show();
        console.log('[Main Process] Window shown after content load finished.');
    });
    mainWindow.on('ready-to-show', () => { // <-- ADDED FUNCTION
        console.log('[Main Process] Window ready-to-show event fired.');
    });
    mainWindow.on('closed', () => { // <-- ADDED FUNCTION (empty for now, could set mainWindow = null;)
         console.log('[Main Process] Main window closed event.');
    });
    // --- END CORRECTED Event listeners ---


    // Load the URL
    if (!app.isPackaged && process.env.WEBPACK_DEV_SERVER_URL) {
        const devUrl = MAIN_WINDOW_WEBPACK_ENTRY;
        console.log(`[Main Process] Loading DEV URL: ${devUrl}`);
        mainWindow.loadURL(devUrl);
        mainWindow.webContents.openDevTools();
    } else {
        // Check if MAIN_WINDOW_WEBPACK_ENTRY is defined (it should be in dev via forge start)
        // Fallback primarily for production builds
        if (!app.isPackaged && MAIN_WINDOW_WEBPACK_ENTRY) {
             const devUrl = MAIN_WINDOW_WEBPACK_ENTRY;
             console.log(`[Main Process] Loading DEV URL (Fallback): ${devUrl}`);
             mainWindow.loadURL(devUrl);
             mainWindow.webContents.openDevTools();
        } else {
            // Production mode: Load file
            const indexPath = path.join(__dirname, `../renderer/main_window/index.html`);
            console.log(`[Main Process] Loading PROD file: ${indexPath}`);
            mainWindow.loadFile(indexPath);
        }
    }
    console.log('[Main Process] loadURL/loadFile command issued.');

  } catch(error) {
      console.error('[Main Process] !!!! Error during createWindow function !!!!', error);
      app.quit();
  }
};

console.log('[Main Process] Setting up app lifecycle event listeners...');

// Standard Electron lifecycle events
app.on('window-all-closed', () => {
  console.log('[Main Process] window-all-closed event received.');
  if (process.platform !== 'darwin') {
    console.log('[Main Process] Quitting app (not macOS).');
    app.quit();
  } else {
      console.log('[Main Process] Not quitting app (macOS).');
  }
});

// Graceful shutdown handling for NestJS context
const gracefulShutdown = async (signal: string) => {
    console.log(`[Main Process] Received ${signal}. Attempting graceful shutdown...`);
    if (nestAppInstance) {
        console.log('[Main Process] Closing NestJS application context...');
        try {
            await nestAppInstance.close(); // Calls OnApplicationShutdown
            console.log('[Main Process] NestJS context closed.');
        } catch (closeError) {
             console.error('[Main Process] Error closing NestJS context:', closeError);
        }
    } else {
         console.log('[Main Process] No NestJS context instance found to close.');
    }
    app.quit();
};
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Termination signal

// Main application entry point
app.whenReady().then(async () => {
  console.log('[Main Process] App is ready.');
  try {
      await bootstrapNestApp(); // Bootstrap NestJS first
      createWindow(); // Then create the window

      app.on('activate', () => {
        console.log('[Main Process] activate event received.');
        // For macOS dock behavior
        if (BrowserWindow.getAllWindows().length === 0) {
          console.log('[Main Process] No windows open, creating new one on activate.');
          createWindow();
        }
      });
  } catch (error) {
       console.error('[Main Process] !!!! Error during app.whenReady sequence !!!!', error);
       app.quit();
  }
}).catch(error => {
   // Catch errors that might happen even before app.whenReady() promise resolves
   console.error('[Main Process] !!!! Error occurred BEFORE app was ready !!!!', error);
   process.exit(1); // Hard exit if essential pre-ready setup fails
});

console.log('[Main Process] Script execution reached end (event listeners set up). Waiting for Electron events...');