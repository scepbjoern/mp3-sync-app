// webpack.renderer.config.js
const path = require('path');
const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins'); // Optional, if using plugins like HtmlWebpackPlugin

rules.push({
  test: /\.css$/,
  use: [
    { loader: 'style-loader' }, // Injects styles into DOM
    { loader: 'css-loader' }, // Handles CSS imports
    { loader: 'postcss-loader' }, // Processes CSS with PostCSS (for Mantine)
 ],
});

// Add rule for assets like images, fonts etc. if needed later
// rules.push({
//   test: /\.(png|svg|jpg|jpeg|gif)$/i,
//   type: 'asset/resource',
// });

module.exports = {
  // NOTE: Entry is determined by the 'js' property in forge.config.js's renderer entryPoints
  module: {
    rules, // Use the combined rules (including CSS rule)
  },
  // plugins: plugins, // Add plugins if needed
  resolve: {
    // Resolve .js, .ts, .jsx, .tsx extensions
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    // Add alias for react-dom if needed for HMR, but try without first
    // alias: {
    //   'react-dom': '@hot-loader/react-dom',
    // },
  },
  // Important: Set target for electron renderer process
  target: 'web',
  node: false, 
};