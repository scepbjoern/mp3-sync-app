// webpack.preload.config.js
const path = require('path');

module.exports = {
  // NOTE: Entry is determined by the 'preload.js' property in forge.config.js's renderer entryPoints
  // This config mainly defines the rules and output options for preload scripts
  module: {
    rules: require('./webpack.rules'), // Use shared rules
  },
  // optimization: {
  //   minimize: false
  // },
  resolve: {
    extensions: ['.js', '.ts', '.json'],
  },
  // Important: Set target for electron preload context
  target: 'electron-preload',
  // Ensure __dirname and __filename work correctly
  node: {
    __dirname: false,
    __filename: false,
  }
};