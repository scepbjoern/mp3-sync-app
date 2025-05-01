// webpack.main.config.js
const path = require('path');

module.exports = {
  /**
   * This is the main entry point for your application, it points to the root of your extensions
   */
  entry: './packages/main/src/main.ts', // Entry point for your main process code
  // Put the normal webpack config options here
  module: {
    rules: require('./webpack.rules'), // Use shared rules (we'll create this file next)
  },
  output: {
    filename: 'main.js', // Output filename
    path: path.resolve(__dirname, '.webpack/main'), // Output directory
    libraryTarget: 'commonjs2', // Ensure correct module format
  },
  // optimization: { // Optional: Helps reduce bundle size
  //   minimize: false // Generally disable minimize for main/preload for easier debugging
  // },
  resolve: {
    // Resolve .ts and .js extensions
    extensions: ['.js', '.ts', '.json'],
    // Optional: Aliases if needed, but often unnecessary with npm workspaces + tsconfig paths
    // alias: { ... },
  },
  // Important: Set target for electron main process
  target: 'electron-main',
  // Ensure __dirname and __filename work correctly
  node: {
    __dirname: false,
    __filename: false,
  }
};