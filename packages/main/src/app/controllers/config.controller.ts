// packages/main/src/app/controllers/config.controller.ts
import { Controller, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ipcMain, app, shell } from 'electron'; // Import Electron modules
import path from 'node:path';
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
    playlistDirectory?: string | null;
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
                    playlistDirectory: this.configService.getPlaylistDirectory(),
                    logLevel: this.configService.getLogLevel(),
                    bidirectionalTags: this.configService.getBidirectionalTags(),
                    tagsToSync: this.configService.getTagsToSync(),
                    mirrorPattern: this.configService.getMirrorPattern(),
                };
                return ipcSuccess(data);
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to get config due to unknown error');
            }
        });

        const handleSetPaths = async (paths: SetPathsPayload): Promise<IpcResponse<void>> => {
            const handlerName = 'config:set-paths';
            this.logger.log(`IPC Handler: ${handlerName}`, paths);
            try {
                const updates: Promise<void>[] = [];
                if (paths.sourceAPath !== undefined) updates.push(this.configService.setSourceAPath(assertOptionalString(paths.sourceAPath, 'Source A path')));
                if (paths.sourceBPath !== undefined) updates.push(this.configService.setSourceBPath(assertOptionalString(paths.sourceBPath, 'Source B path')));
                if (paths.databasePath !== undefined) updates.push(this.configService.setDatabasePath(assertOptionalString(paths.databasePath, 'Database path')));
                if (paths.backupPath !== undefined) updates.push(this.configService.setBackupPath(assertOptionalString(paths.backupPath, 'Backup path')));
                if (paths.logFilePath !== undefined) updates.push(this.configService.setLogFilePath(assertOptionalString(paths.logFilePath, 'Log file path')));
                if (paths.playlistDirectory !== undefined) updates.push(this.configService.setPlaylistDirectory(assertOptionalString(paths.playlistDirectory, 'Playlist directory')));
                await Promise.all(updates);
                return ipcSuccess();
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to set paths due to unknown error');
            }
        };
        // Kebab-case only
        ipcMain.handle('config:set-paths', async (_event, paths: SetPathsPayload) => handleSetPaths(paths));

        const handleSetLogLevel = async (level: string): Promise<IpcResponse<void>> => {
            const handlerName = 'config:set-log-level';
            this.logger.log(`IPC Handler: ${handlerName}: ${level}`);
            try {
                const safeLevel = assertEnum(level, ['error', 'warn', 'info', 'verbose', 'debug'], 'Log level');
                await this.configService.setLogLevel(safeLevel);
                return ipcSuccess();
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to set log level due to unknown error');
            }
        };
        ipcMain.handle('config:set-log-level', async (_e, level: string) => handleSetLogLevel(level));

        const handleSetMirrorPattern = async (pattern: string): Promise<IpcResponse<void>> => {
            const handlerName = 'config:set-mirror-pattern';
            this.logger.log(`IPC Handler: ${handlerName}`);
            try {
                if (typeof pattern !== 'string') {
                    throw new Error('Pattern must be a string');
                }
                await this.configService.setMirrorPattern(pattern);
                return ipcSuccess();
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to set mirror pattern');
            }
        };
        ipcMain.handle('config:set-mirror-pattern', async (_e, pattern: string) => handleSetMirrorPattern(pattern));

        ipcMain.handle('config:open-playlist-folder', async (): Promise<IpcResponse<void>> => {
            const handlerName = 'config:open-playlist-folder';
            this.logger.log(`IPC Handler: ${handlerName}`);
            try {
                const playlistDir = this.configService.getPlaylistDirectory();
                const result = await shell.openPath(playlistDir);
                if (result) throw new Error(result);
                return ipcSuccess();
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to open playlist folder');
            }
        });

        // Removed duplicate 'dialog:selectDirectory' in favor of FileSystemController 'dialog:select-directory'.

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

        const handleSetTagsToSync = async (tags: 'ALL' | string[]): Promise<IpcResponse<void>> => {
            const handlerName = 'config:set-tags-to-sync';
            this.logger.log(`IPC Handler: ${handlerName}`, tags);
            try {
                const safeTags = Array.isArray(tags) ? assertStringArray(tags, 'Tags to sync') : tags;
                await this.configService.setTagsToSync(safeTags);
                return ipcSuccess();
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to set tags to sync');
            }
        };
        ipcMain.handle('config:set-tags-to-sync', async (_e, tags: 'ALL' | string[]) => handleSetTagsToSync(tags));
    
        const handleSetBidirectionalTags = async (tags: string[]): Promise<IpcResponse<void>> => {
            const handlerName = 'config:set-bidirectional-tags';
            this.logger.log(`IPC Handler: ${handlerName}`, tags);
            try {
                const safeTags = assertStringArray(tags, 'Bidirectional tags');
                await this.configService.setBidirectionalTags(safeTags);
                return ipcSuccess();
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to set bidirectional tags');
            }
        };
        ipcMain.handle('config:set-bidirectional-tags', async (_e, tags: string[]) => handleSetBidirectionalTags(tags));

        // --- Handler to Show Config File ---
        ipcMain.handle('config:show-in-folder', async (): Promise<IpcResponse<void>> => {
            const handlerName = 'config:show-in-folder';
            this.logger.log(`IPC Handler: ${handlerName}`);
            try {
                const configPath = this.configService.getConfigFilePath();

                if (!configPath) {
                    throw new Error('Configuration file path is not set.');
                }

                const configDir = path.dirname(configPath);
                const openResult = await shell.openPath(configDir);
                if (openResult) {
                    throw new Error(openResult);
                }

                return ipcSuccess();
            } catch (err) {
                this.logger.error(`Error handling ${handlerName}:`, err);
                return ipcFailure(err, 'Failed to show config file location');
            }
        });

        this.logger.log('Configuration IPC Handlers Registered.');
    }
}