// webpack.rules.js
module.exports = [
  {
    // Vercel loader handles JS, MJS, and potentially OTHER .node files
    test: /\.(m?js|node)$/,
    parser: { amd: false },
    use: {
      loader: '@vercel/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
  // REMOVED explicit WASM rule:
  // {
  //   test: /\.wasm$/,
  //   type: 'asset/resource',
  //   generator: { filename: '[name][ext]' }
  // },
  {
    // Typescript loader
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
      },
    },
  },
];