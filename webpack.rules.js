// webpack.rules.js
// Common rules used by main, preload, and renderer webpack configs

module.exports = [
    // Add support for native node modules
    {
      // We're specifying native_modules in the main process as 'ignored',
      // which causes webpack not to bundle them anymore - requiring them at runtime.
      test: /native_modules\/.+\.node$/,
      use: 'node-loader',
    },
    {
      test: /\.(m?js|node)$/,
      parser: { amd: false },
      use: {
        loader: '@vercel/webpack-asset-relocator-loader',
        options: {
          outputAssetBase: 'native_modules',
        },
      },
    },
    {
      // Typescript loader
      test: /\.tsx?$/,
      exclude: /(node_modules|\.webpack)/,
      use: {
        loader: 'ts-loader',
        options: {
          transpileOnly: true, // Speeds up build, relies on ForkTsCheckerWebpackPlugin for type checking
        },
      },
    },
  ];