const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
require('dotenv').config();

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: argv.mode || 'development',
    entry: './src/renderer.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.js'
    },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            sourceType: 'unambiguous',
            presets: [
              ['@babel/preset-env', { modules: 'commonjs' }],
              ['@babel/preset-react', { runtime: 'automatic' }]
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      three: path.resolve(__dirname, 'node_modules/three'),
      '@pixiv/three-vrm-animation': path.resolve(
        __dirname,
        'temp-bvh2vrma/node_modules/@pixiv/three-vrm-animation/lib/three-vrm-animation.module.js'
      )
    },
    fallback: {
      "path": false,
      "fs": false,
      "process/browser": require.resolve('process/browser.js')
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '' }
      ]
    }),
    new webpack.DefinePlugin({
      'process.env.BACKEND_API_URL': JSON.stringify(process.env.BACKEND_API_URL),
      'process.env.REPLICATE_API_KEY': JSON.stringify(process.env.REPLICATE_API_KEY),
      'process.env.NEWS_API_KEY': JSON.stringify(process.env.NEWS_API_KEY)
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser.js'
    })
  ],
  optimization: isProduction ? {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true, // production時は全てのconsole.*を削除
            drop_debugger: true,
          },
        },
        extractComments: false,
      }),
    ],
  } : {},
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },
    port: 8080,
    hot: true
  }
  };
};
