const path = require('path');

module.exports = {
  entry: {
    content: './content.js',
    popup: './popup.js',
    background: './background.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'development',
  devtool: 'source-map',
  optimization: {
    minimize: false
  }
};