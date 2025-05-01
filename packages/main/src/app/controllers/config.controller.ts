// packages/main/src/app/controllers/config.controller.ts
import { Controller, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ipcMain, dialog, app, shell } from 'electron'; // Import Electron modules
import { ConfigService, AppConfig } from '../config/config.service'; // Import ConfigService and interface

// Define types for IPC payloads (optional but good practice)
interface SetPathsPayload {
    sourceAPath?: string | null;
    sourceBPath?: string | null;
    databasePath?: string | null;
    backupPath?: string | null;
    logFilePath?: string | null;
}

// Define a standard response structure
interface IpcResponse<T = any> {
    success: boolean;
    data?: T;
    error?: { message: string; code?: string };
}

@Injectable() // Controllers are injectable providers
@Controller() // No base route needed for IPC handlers
export class ConfigController implements OnModuleInit {
    private readonly logger = new Logger(ConfigController.name);

    constructor(private configService: ConfigService) {}

    // Register IPC handlers when the module initializes
    onModuleInit() {
        this.logger.log('Registering Configuration IPC Handlers...');

        ipcMain.handle('config:get', async (): Promise<IpcResponse<Partial<AppConfig>>> => {
            const handlerName = 'config:get'; // For logging context
            this.logger.log(`IPC Handler: ${handlerName}`);
            try {
                // Return relevant parts of the config needed by the UI
                const data: Partial<AppConfig> = {
                    sourceAPath: this.configService.getSourceAPath(),
                    sourceBPath: this.configService.getSourceBPath(),
                    databasePath: this.configService.getDatabasePath(),
                    backupPath: this.configService.getBackupPath(),
                    logFilePath: this.configService.getLogFilePath(),
                    logLevel: this.configService.getLogLevel(),
                    bidirectionalTags: this.configService.getBidirectionalTags(),
                    tagsToSync: this.configService.getTagsToSync(),
                };
                return { success: true, data };
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                // Type Guard for error message
                const message = (err instanceof Error) ? err.message : 'Failed to get config due to unknown error';
                return { success: false, error: { message } };
            }
        });

        ipcMain.handle('config:setPaths', async (_event, paths: SetPathsPayload): Promise<IpcResponse<void>> => {
            const handlerName = 'config:setPaths';
            this.logger.log(`IPC Handler: ${handlerName}`, paths);
            try {
                // Update only the paths provided in the payload
                // Using Promise.all to run saves potentially concurrently (though saveConfig is likely sequential)
                const updates: Promise<void>[] = [];
                if (paths.sourceAPath !== undefined) updates.push(this.configService.setSourceAPath(paths.sourceAPath));
                if (paths.sourceBPath !== undefined) updates.push(this.configService.setSourceBPath(paths.sourceBPath));
                if (paths.databasePath !== undefined) updates.push(this.configService.setDatabasePath(paths.databasePath));
                if (paths.backupPath !== undefined) updates.push(this.configService.setBackupPath(paths.backupPath));
                if (paths.logFilePath !== undefined) updates.push(this.configService.setLogFilePath(paths.logFilePath));
                await Promise.all(updates);
                return { success: true };
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                // Type Guard for error message
                const message = (err instanceof Error) ? err.message : 'Failed to set paths due to unknown error';
                return { success: false, error: { message } };
            }
        });

        ipcMain.handle('config:setLogLevel', async (_event, level: string): Promise<IpcResponse<void>> => {
            const handlerName = 'config:setLogLevel';
            this.logger.log(`IPC Handler: ${handlerName}: ${level}`);
             try {
                await this.configService.setLogLevel(level);
                // TODO: Signal logger service to update level dynamically if needed
                return { success: true };
            } catch (err) {
                 this.logger.error(`Error handling ${handlerName}:`, err);
                 // Type Guard for error message
                 const message = (err instanceof Error) ? err.message : 'Failed to set log level due to unknown error';
                return { success: false, error: { message } };
            }
        });

        ipcMain.handle('dialog:selectDirectory', async (): Promise<IpcResponse<string | null>> => {
            const handlerName = 'dialog:selectDirectory';
            this.logger.log(`IPC Handler: ${handlerName}`);
            try {
                // We need access to the BrowserWindow to make the dialog modal
                // For now, it will open non-modally. Refine later if needed.
                const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
                if (result.canceled || result.filePaths.length === 0) {
                    return { success: true, data: null }; // User cancelled
                }
                return { success: true, data: result.filePaths[0] }; // Return selected path
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                 // Type Guard for error message
                const message = (err instanceof Error) ? err.message : 'Failed to show directory dialog due to unknown error';
                return { success: false, error: { message } };
            }
        });

         ipcMain.handle('app:get-path', async (_event, name: 'userData' | 'logs' | 'backup' | 'db'): Promise<IpcResponse<string>> => {
             const handlerName = 'app:get-path';
             this.logger.log(`IPC Handler: ${handlerName}: ${name}`);
             try {
                 let requestedPath: string;
                 switch (name) {
                     case 'userData': requestedPath = app.getPath('userData'); break;
                     case 'logs': requestedPath = this.configService.getLogFilePath(); break;
                     case 'backup': requestedPath = this.configService.getBackupPath(); break;
                     case 'db': requestedPath = this.configService.getDatabasePath(); break;
                     default:
                         // Ensure exhaustive check with a utility function if preferred
                         const exhaustiveCheck: never = name;
                         throw new Error(`Unknown path name: ${exhaustiveCheck}`);
                 }
                 return { success: true, data: requestedPath };
             } catch (err) {
                  this.logger.error(`Error handling ${handlerName} (${name}):`, err);
                 // Type Guard for error message
                 const message = (err instanceof Error) ? err.message : `Failed to get path ${name}`;
                 return { success: false, error: { message } };
             }
         });

        // Handler for the initial test/example
        ipcMain.handle('app:get-version', async (): Promise<IpcResponse<string>> => {
             const handlerName = 'app:get-version';
             this.logger.log(`IPC Handler: ${handlerName}`);
             try {
                 return { success: true, data: app.getVersion() };
             } catch (err) {
                  this.logger.error(`Error handling ${handlerName}:`, err);
                  // Type Guard for error message
                  const message = (err instanceof Error) ? err.message : 'Failed to get app version';
                 return { success: false, error: { message } };
             }
        });

        ipcMain.handle('config:setTagsToSync', async (_event, tags: 'ALL' | string[]): Promise<IpcResponse<void>> => {
            const handlerName = 'config:setTagsToSync';
            this.logger.log(`IPC Handler: ${handlerName}`, tags);
            try {
                await this.configService.setTagsToSync(tags);
                return { success: true };
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                const message = (err instanceof Error) ? err.message : 'Failed to set tags to sync';
                return { success: false, error: { message } };
            }
        });
    
        ipcMain.handle('config:setBidirectionalTags', async (_event, tags: string[]): Promise<IpcResponse<void>> => {
            const handlerName = 'config:setBidirectionalTags';
            this.logger.log(`IPC Handler: ${handlerName}`, tags);
            try {
                // Basic validation could be added here if needed
                if (!Array.isArray(tags)) {
                    throw new Error('Bidirectional tags must be an array of strings.');
                }
                await this.configService.setBidirectionalTags(tags);
                return { success: true };
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                const message = (err instanceof Error) ? err.message : 'Failed to set bidirectional tags';
                return { success: false, error: { message } };
            }
        });

        // --- ADD Handler to Show Config File ---
        ipcMain.handle('config:show-in-folder', async (): Promise<IpcResponse<void>> => {
            const handlerName = 'config:show-in-folder';
            this.logger.log(`IPC Handler: ${handlerName}`);
            try {
                // Get the dynamically determined config file path from the service
                // NOTE: ConfigService constructor determines configFilePath based on override or default logic
                const configPath = this.configService['configFilePath']; // Access private prop (or add getter)

                if (!configPath) {
                    throw new Error('Configuration file path is not set.');
                }

                this.logger.log(`Attempting to show item in folder: ${configPath}`);
                shell.showItemInFolder(configPath); // Electron API to open folder and select file

                return { success: true };
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                const message = (err instanceof Error) ? err.message : 'Failed to show config file location';
                return { success: false, error: { message } };
            }
        });

        this.logger.log('Configuration IPC Handlers Registered.');
    }
}