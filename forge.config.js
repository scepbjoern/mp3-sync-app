// forge.config.js  –  Electron Forge + Webpack

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackPlugin = require('@electron-forge/plugin-webpack').default;

/* Prisma‑Runtime für native DLL + WASM */
const prismaRuntimeDir = path.resolve(
  __dirname,
  'node_modules/@prisma/client/runtime',
);

/** @type {import('@electron-forge/core').ForgeConfig} */
module.exports = {
  packagerConfig: { asar: true },

  /* ─────────  Plugin‑Instanz statt Array‑Shorthand  ───────── */
  plugins: [
    new WebpackPlugin({
      /* ─────────────  MAIN Config  ───────────── */
      mainConfig: {
        mode: process.env.NODE_ENV || 'development',
        entry: './packages/main/src/main.ts',
        target: 'electron-main',
        externalsPresets: { electronMain: true },
        externals: {
          '@prisma/client': 'commonjs @prisma/client',
          '.prisma/client': 'commonjs .prisma/client',
        },
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
        resolve: { extensions: ['.ts', '.tsx', '.js'] },
        plugins: [
          new CopyWebpackPlugin({
            patterns: [
              {
                from: path.resolve(__dirname, 'node_modules/.prisma/client/query_engine-windows.dll.node'),
                to:   path.resolve(__dirname, '.webpack/main/.prisma/client'),
              },
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
    }),
  ],
};
