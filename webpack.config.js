const HtmlWebpackPlugin = require('html-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');

const path = require('path');
const webpack = require('webpack');

module.exports = (env, argv) => ({
  devtool: argv.mode === 'production' ? false : 'inline-source-map',

  module: {
    rules: [
      // Converts TypeScript code to JavaScript

      // Converts TypeScript code to JavaScript
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },

      // Enables including CSS by doing "import './file.css'" in your TypeScript code
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ],
      },
      {
        test: /\.ejs$/,
        use: [
          'raw-loader',
        ],
      },
      {

        test: /\.(png)$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 25000,
          },
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/i,
        // More information here https://webpack.js.org/guides/asset-modules/
        type: 'asset',
      },
    ],
  },

  // defie the entrypoints for compilation
  entry: {
    ui: './src/ui/ui.tsx',
    code: './src/sandbox/code.ts',
  },

  resolve: {
    extensions: ['.js', '.jsx', '.tsx', '.ts'],
    alias: {
      fs: false, // or any other value that makes sense for your project
      path: false, // or any other value that makes sense for your project
    }
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new webpack.DefinePlugin({
      global: {}, // Fix missing symbol error when running in developer VM
    }),

    new HtmlWebpackPlugin({
      inject: 'body',

      template: './src/ui/ui.html',
      filename: 'ui.html',
      // inlineSource: '.(js)$',
      cache: false,

      chunks: ['ui'],
    }),
    new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/ui/]),

  ],
});
