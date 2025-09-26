// forge.config.js  –  Electron Forge + Webpack

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackPlugin = require('@electron-forge/plugin-webpack').default;
const webpack = require('webpack');
const { spawnSync } = require('child_process');
const runtimeDeps = require('./scripts/runtime-deps');
const { BUNDLE_PACKAGES, getRuntimePackages, ensureRuntimeDepsPackaged } = runtimeDeps;
const RUNTIME_PACKAGES = getRuntimePackages();

const ensureRuntimeDeps = (arch) => {
  ensureRuntimeDepsPackaged(arch || 'x64');
};

/* Prisma‑Runtime für native DLL + WASM */
const prismaRuntimeDir = path.resolve(
  __dirname,
  'node_modules/@prisma/client/runtime',
);

/** @type {import('@electron-forge/core').ForgeConfig} */
module.exports = {
  packagerConfig: {
    appId: 'click.allesauseinerhand.mp3syncapp',
    asar: true,
    // Avoid slow/npm prune stalls with complex workspaces
    prune: false,
    // Ensure native modules and Prisma engines remain loadable
    asarUnpack: [
      '**/*.node',
      '**/*.wasm',
      '.webpack/main/.prisma/client/**',
      'node_modules/@prisma/**',
      'resources/db/**',
      '.webpack/main/resources/db/**',
    ],
    // Windows icon (omit extension for electron-packager)
    icon: path.resolve(__dirname, 'assets', 'icons', 'icon'),
  },

  // Keep the rebuild step minimal to avoid long/hanging native rebuilds
  rebuildConfig: {
    onlyModules: [],
    force: false,
    usePrebuild: true,
  },

  hooks: {
    prePackage: async (forgeConfig, platform, arch) => {
      console.log(`[forge] prePackage start platform=${platform} arch=${arch}`);
      // Generate a template SQLite DB with the current Prisma schema so first run has tables.
      try {
        const script = path.resolve(__dirname, 'scripts/init-db-template.js');
        const res = spawnSync(process.execPath, [script], { stdio: 'inherit', env: process.env });
        if (res.status !== 0) {
          throw new Error(`init-db-template failed with exit code ${res.status}`);
        }
      } catch (e) {
        console.warn('[forge] init-db-template failed, continuing without template DB:', e?.message || e);
      }
    },
    postPackage: async (forgeConfig, packageResult) => {
      console.log('[forge] postPackage validating runtime dependencies...');
      try {
        ensureRuntimeDeps(packageResult?.arch || 'x64');
        console.log('[forge] postPackage runtime deps OK');
      } catch (err) {
        console.error('[forge] runtime dependency check failed:', err);
        throw err;
      }
      console.log('[forge] postPackage done', Object.keys(packageResult || {}));
    },
    preMake: async () => {
      console.log('[forge] preMake start');
    },
    postMake: async (_forgeConfig, makeResults) => {
      console.log('[forge] postMake done; targets=', makeResults?.map(r => r.packageJSON?.name || r.artifacts?.length));
    },
  },

  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'mp3-sync-app',
        setupIcon: path.resolve(__dirname, 'assets', 'icons', 'icon.ico'),
        // Nuspec metadata required by Squirrel
        authors: 'mp3-sync-app',
        description: 'Synchronize MP3 tags between two folders with conflict reports and playlists.',
        title: 'MP3 Sync App',
        setupExe: 'MP3 Sync App Setup.exe',
        // Ensure shortcuts are created with a friendly name
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: 'MP3 Sync App',
      },
    },
  ],

  /* ─────────  Plugin‑Instanz statt Array‑Shorthand  ───────── */
  plugins: [
    new WebpackPlugin({
      /* ─────────────  MAIN Config  ───────────── */
      mainConfig: {
        mode: process.env.NODE_ENV || 'development',
        entry: './packages/main/src/main.ts',
        target: 'electron-main',
        externalsPresets: { electronMain: true },
        externals: [
          // Externalize any non-relative/absolute import (treat as Node runtime dependency)
          ({ request }, callback) => {
            if (!request) return callback();
            // Allowlist: bundle these (do NOT externalize)
            if (BUNDLE_PACKAGES.has(request) || [...BUNDLE_PACKAGES].some((d) => request.startsWith(d + '/'))) {
              return callback();
            }
            const isRelative = request.startsWith('.') || request.startsWith('/') || /^(?:[A-Za-z]:)/.test(request);
            if (!isRelative) {
              return callback(null, 'commonjs ' + request);
            }
            callback();
          },
          {
            '@prisma/client': 'commonjs @prisma/client',
            '.prisma/client': 'commonjs .prisma/client',
          },
        ],
        module: {
          rules: [
            {
              test: /\.tsx?$/,
              exclude: /node_modules/,
              use: {
                loader: 'ts-loader',
                options: { transpileOnly: true },   // ➜ schnell & vermeidet "no output" Fehler
              },
            },
          ],
        },
        stats: 'verbose',
        infrastructureLogging: { level: 'verbose' },
        resolve: {
          extensions: ['.ts', '.tsx', '.js'],
          // Allow resolving runtime deps from the main workspace node_modules
          modules: [
            path.resolve(__dirname, 'packages/main/node_modules'),
            path.resolve(__dirname, 'node_modules'),
          ],
          alias: {
            'kafkajs': false,
            'nats': false,
            'amqplib': false,
            'mqtt': false,
            '@grpc/grpc-js': false,
            '@grpc/proto-loader': false,
            '@nestjs/websockets/socket-module': false,
            '@nestjs/websockets': false,
            '@nestjs/platform-socket.io': false,
          },
        },
        plugins: [
          new webpack.IgnorePlugin({
            resourceRegExp: /^(kafkajs|nats|amqplib|mqtt|@grpc\/grpc-js|@grpc\/proto-loader|@nestjs\/websockets(?:\/.*)?|@nestjs\/platform-socket\.io(?:\/.*)?)$/,
          }),
          new CopyWebpackPlugin({
            patterns: [
              {
                from: path.resolve(__dirname, 'node_modules/.prisma/client'),
                to:   path.resolve(__dirname, '.webpack/main/.prisma/client'),
              },
              // Ship a template SQLite DB for first-run initialization
              {
                from: path.resolve(__dirname, 'resources/db'),
                to:   path.resolve(__dirname, '.webpack/main/resources/db'),
                noErrorOnMissing: true,
              },
              // Copy all main process runtime dependencies
              {
                from: path.resolve(__dirname, 'packages/main/node_modules'),
                to:   path.resolve(__dirname, '.webpack/main/node_modules'),
              },
              // Ensure hoisted deps are present even if not under packages/main/node_modules
              {
                from: path.resolve(__dirname, 'node_modules/@nestjs'),
                to:   path.resolve(__dirname, '.webpack/main/node_modules/@nestjs'),
              },
              {
                from: path.resolve(__dirname, 'node_modules/rxjs'),
                to:   path.resolve(__dirname, '.webpack/main/node_modules/rxjs'),
              },
              {
                from: path.resolve(__dirname, 'node_modules/reflect-metadata'),
                to:   path.resolve(__dirname, '.webpack/main/node_modules/reflect-metadata'),
              },
              {
                from: path.resolve(__dirname, 'node_modules/tslib'),
                to:   path.resolve(__dirname, '.webpack/main/node_modules/tslib'),
              },
              {
                from: path.resolve(__dirname, 'node_modules/express'),
                to:   path.resolve(__dirname, '.webpack/main/node_modules/express'),
              },
              // Dynamically include runtime deps from root node_modules if hoisted
              ...RUNTIME_PACKAGES.map((dep) => ({
                from: path.resolve(__dirname, 'node_modules', dep),
                to:   path.resolve(__dirname, '.webpack/main/node_modules', dep),
                noErrorOnMissing: true,
              })),
            ],
          }),
        ],
        output: {
          filename: 'index.js',
          path: path.resolve(__dirname, '.webpack/main'),
        },
        node: { __dirname: false, __filename: false },
      },

      /* ─────────────  RENDERER Config  ───────────── */
      renderer: {
        config: {
          mode: process.env.NODE_ENV || 'development',
          target: 'electron-renderer',
          module: {
            rules: [
              {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: {
                  loader: 'ts-loader',
                  options: { transpileOnly: true },   // ➜ schnell & vermeidet "no output" Fehler
                },
              },
              {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
              },
            ],
          },
          resolve: { extensions: ['.ts', '.tsx', '.js'] },
          output: {
            filename: '[name].js',
            path: path.resolve(__dirname, '.webpack/renderer'),
          },
        },
        /*  <<< Pflichtfeld – ein BrowserWindow‑Entry >>> */
        entryPoints: [
          {
            name: 'main_window',
            html: './packages/renderer/index.html',
            js:   './packages/renderer/src/main.tsx',
            preload: {
              js: './packages/main/src/preload.ts',
            },
          },
        ],
      },
      // Ensure these runtime deps are shipped alongside the app when externalized
      externalDependencies: [
        '@prisma/client',
        '@nestjs/common',
        '@nestjs/core',
        '@nestjs/microservices',
        // common runtime deps used by the main process
        'uid',
        'tslib',
        'express',
        'reflect-metadata',
        'rxjs',
      ],
    }),
  ],
};
