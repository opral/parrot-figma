const HtmlWebpackPlugin = require('html-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');

const path = require('path');
const { sentryWebpackPlugin } = require("@sentry/webpack-plugin");
const webpack = require('webpack');
const dotenv = require('dotenv');


const { version } = require('./package.json');

module.exports = (env, argv) => {

  //Needed to load the process.env variables for sentry


  return {
    mode: argv.mode === 'production' ? 'production' : 'development',

    // This is necessary because Figma's 'eval' works differently than normal eval
    devtool: argv.mode === 'production' ? 'source-map' : 'inline-source-map',
    
    // defie the entrypoints for compilation
    entry: {
      ui: './src/ui/ui.tsx',
      code: './src/sandbox/code.ts',
    },

    module: {
      
      rules: [
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

    resolve: {
      extensions: ['.js', '.jsx', '.tsx', '.ts'],
      // TODO document aliases i think i needed this for some library to work...
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
        process: '(' +JSON.stringify({
          env: {
            ENVIRONMENT: argv.mode,
            
            // provide sentry process env variables
            SENTRY_ORG: process.env.SENTRY_ORG,
            SENTRY_PROJECT: process.env.SENTRY_PROJECT,
            SENTRY_DSN: process.env.SENTRY_DSN,
            
            // mixed panel key must be added to the client :-(
            MIXPANEL_ACCESS_TOKEN: process.env.MIXPANEL_ACCESS_TOKEN,
          }
        }) + ')',
      }),
      
      // TODO fail build if we are in a release build and the token is missing!
      process.env.SENTRY_AUTH_TOKEN ?
        sentryWebpackPlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          debug: true,
          // Auth tokens can be obtained from https://sentry.io/settings/account/api/auth-tokens/
          // and need `project:releases` and `org:read` scopes
          authToken: process.env.SENTRY_AUTH_TOKEN,
          telemetry: false,
          sourcemaps: {
            filesToDeleteAfterUpload: ['dist/*.js.map', '*.js.map', 'ui.js']
          },
          release: {
            name: 'figma-parrotss@' + version,
            finalize: true,
            cleanArtifacts: true,
            deploy: {
              name: 'plugin@' + version,
              env: process.env.ENVIRONMENT
            },
            setCommits: {
              auto: true,
              ignoreMissing: true,
            }
          },
        }) : () => {},

  
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
  }
  
};
