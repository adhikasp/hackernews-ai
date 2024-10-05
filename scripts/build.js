const webpack = require('webpack');
const path = require('path');
const fs = require('fs-extra');
const config = require('../webpack.config.js');

console.log('Building extension...');

// Ensure the dist directory exists
fs.ensureDirSync(path.resolve(__dirname, '../dist'));

// Copy static files
const staticFiles = ['manifest.json', 'popup.html', 'background.js', 'popup.js'];
staticFiles.forEach(file => {
  fs.copySync(path.resolve(__dirname, `../${file}`), path.resolve(__dirname, `../dist/${file}`));
  console.log(`Copied ${file} to dist folder`);
});

// Run webpack
webpack(config, (err, stats) => {
  if (err || stats.hasErrors()) {
    console.error(err || stats.toString({
      chunks: false,
      colors: true
    }));
    process.exit(1);
  }

  console.log(stats.toString({
    chunks: false,
    colors: true
  }));

  console.log('Build completed successfully!');
});