const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const dotenv = require('dotenv');

const env = dotenv.config({ path: path.join(__dirname, '.env') }).parsed;

const envKeys = Object.keys(env).reduce((prev, key) => {
  prev[`process.env.${key}`] = JSON.stringify(env[key]);
  return prev;
}, {});

module.exports = {
  entry: {
    main: './src/frontend/views/main.js',
    auth: './src/frontend/views/auth.js',
    'data-collect': './src/frontend/views/data-collect.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/frontend/index.html',
      filename: 'main.html',
      chunks: ['main']
    }),
    new HtmlWebpackPlugin({
      template: './src/frontend/views/auth.html',
      filename: 'auth.html',
      chunks: ['auth']
    }),
    new HtmlWebpackPlugin({
      template: './src/frontend/views/data-collect.html',
      filename: 'data-collect.html',
      chunks: ['data-collect']
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/css', to: 'css' },
        { from: 'public/js', to: 'js' },
        { from: 'public/image', to: 'image' },
        { from: '.env', to: '.' },
        { from: 'app.ico', to: '.' }
      ]
    }),
    new webpack.DefinePlugin(envKeys)
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public')
    },
    compress: true,
    port: process.env.PORT || 5000,
    hot: true,
    historyApiFallback: true
  },
  resolve: {
    extensions: ['.js']
  },
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'
};
