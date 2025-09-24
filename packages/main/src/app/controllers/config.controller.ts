// packages/main/src/app/controllers/config.controller.ts
import { Controller, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ipcMain, dialog, app, shell } from 'electron'; // Import Electron modules
import { ConfigService, AppConfig } from '../config/config.service'; // Import ConfigService and interface
import {
    assertEnum,
    assertOptionalString,
    assertStringArray,
    ipcFailure,
    ipcSuccess,
    IpcResponse,
} from '../ipc/ipc-response';

// Define types for IPC payloads (optional but good practice)
interface SetPathsPayload {
    sourceAPath?: string | null;
    sourceBPath?: string | null;
    databasePath?: string | null;
    backupPath?: string | null;
    logFilePath?: string | null;
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
                return ipcSuccess(data);
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to get config due to unknown error');
            }
        });

        ipcMain.handle('config:setPaths', async (_event, paths: SetPathsPayload): Promise<IpcResponse<void>> => {
            const handlerName = 'config:setPaths';
            this.logger.log(`IPC Handler: ${handlerName}`, paths);
            try {
                // Update only the paths provided in the payload
                // Using Promise.all to run saves potentially concurrently (though saveConfig is likely sequential)
                const updates: Promise<void>[] = [];
                if (paths.sourceAPath !== undefined) updates.push(this.configService.setSourceAPath(assertOptionalString(paths.sourceAPath, 'Source A path')));
                if (paths.sourceBPath !== undefined) updates.push(this.configService.setSourceBPath(assertOptionalString(paths.sourceBPath, 'Source B path')));
                if (paths.databasePath !== undefined) updates.push(this.configService.setDatabasePath(assertOptionalString(paths.databasePath, 'Database path')));
                if (paths.backupPath !== undefined) updates.push(this.configService.setBackupPath(assertOptionalString(paths.backupPath, 'Backup path')));
                if (paths.logFilePath !== undefined) updates.push(this.configService.setLogFilePath(assertOptionalString(paths.logFilePath, 'Log file path')));
                await Promise.all(updates);
                return ipcSuccess();
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to set paths due to unknown error');
            }
        });

        ipcMain.handle('config:setLogLevel', async (_event, level: string): Promise<IpcResponse<void>> => {
            const handlerName = 'config:setLogLevel';
            this.logger.log(`IPC Handler: ${handlerName}: ${level}`);
            try {
                const safeLevel = assertEnum(level, ['error', 'warn', 'info', 'verbose', 'debug'], 'Log level');
                await this.configService.setLogLevel(safeLevel);
                return ipcSuccess();
            } catch (err) {
                 this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to set log level due to unknown error');
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
                    return ipcSuccess(null);
                }
                return ipcSuccess(result.filePaths[0]); // Return selected path
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to show directory dialog due to unknown error');
            }
        });

         ipcMain.handle('app:get-path', async (_event, name: 'userData' | 'logs' | 'backup' | 'db' | 'config'): Promise<IpcResponse<string>> => {
             const handlerName = 'app:get-path';
             this.logger.log(`IPC Handler: ${handlerName}: ${name}`);
             try {
                 let requestedPath: string;
                 switch (name) {
                    case 'userData': {
                        requestedPath = app.getPath('userData');
                        break;
                    }
                    case 'logs': {
                        requestedPath = this.configService.getLogFilePath();
                        break;
                    }
                    case 'backup': {
                        requestedPath = this.configService.getBackupPath();
                        break;
                    }
                    case 'db': {
                        requestedPath = this.configService.getDatabasePath();
                        break;
                    }
                    case 'config': {
                        requestedPath = this.configService.getConfigFilePath();
                        break;
                    }
                    default: {
                        const exhaustiveCheck: never = name;
                        throw new Error(`Unknown path name: ${exhaustiveCheck}`);
                    }
                }
                 return ipcSuccess(requestedPath);
             } catch (err) {
                  this.logger.error(`Error handling ${handlerName} (${name}):`, err);
                 return ipcFailure(err, `Failed to get path ${name}`);
             }
         });

        // Handler for the initial test/example
        ipcMain.handle('app:get-version', async (): Promise<IpcResponse<string>> => {
             const handlerName = 'app:get-version';
             this.logger.log(`IPC Handler: ${handlerName}`);
             try {
                 return ipcSuccess(app.getVersion());
             } catch (err) {
                  this.logger.error(`Error handling ${handlerName}:`, err);
                 return ipcFailure(err, 'Failed to get app version');
             }
        });

        ipcMain.handle('config:setTagsToSync', async (_event, tags: 'ALL' | string[]): Promise<IpcResponse<void>> => {
            const handlerName = 'config:setTagsToSync';
            this.logger.log(`IPC Handler: ${handlerName}`, tags);
            try {
                const safeTags = Array.isArray(tags) ? assertStringArray(tags, 'Tags to sync') : tags;
                await this.configService.setTagsToSync(safeTags);
                return ipcSuccess();
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to set tags to sync');
            }
        });
    
        ipcMain.handle('config:setBidirectionalTags', async (_event, tags: string[]): Promise<IpcResponse<void>> => {
            const handlerName = 'config:setBidirectionalTags';
            this.logger.log(`IPC Handler: ${handlerName}`, tags);
            try {
                const safeTags = assertStringArray(tags, 'Bidirectional tags');
                await this.configService.setBidirectionalTags(safeTags);
                return ipcSuccess();
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to set bidirectional tags');
            }
        });

        // --- Handler to Show Config File ---
        ipcMain.handle('config:show-in-folder', async (): Promise<IpcResponse<void>> => {
            const handlerName = 'config:show-in-folder';
            this.logger.log(`IPC Handler: ${handlerName}`);
            try {
                const configPath = this.configService.getConfigFilePath();

                if (!configPath) {
                    throw new Error('Configuration file path is not set.');
                }

                shell.showItemInFolder(configPath);
                return ipcSuccess();
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to show config file location');
            }
        });

        this.logger.log('Configuration IPC Handlers Registered.');
    }
}