// forge.config.js (Disable HMR temporarily)
const path = require('node:path');

module.exports = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    // ... your makers ...
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        // Add devServer options here:
        devServer: {
          hot: false // <-- Disable Hot Module Replacement
        },
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './packages/renderer/index.html',
              js: './packages/renderer/src/main.tsx',
              name: 'main_window',
              preload: {
                config: './webpack.preload.config.js',
                js: './packages/main/src/preload.ts',
              },
            },
          ],
        },
      },
    },
  ],
  mainConfig: path.join(__dirname, 'packages/main/package.json'),
};