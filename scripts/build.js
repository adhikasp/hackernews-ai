const fs = require('fs-extra');
const path = require('path');
const webpack = require('webpack');
const webpackConfig = require('../webpack.config.js');

const sourceDir = path.join(__dirname, '..');
const distDir = path.join(sourceDir, 'dist');

const filesToCopy = [
  'manifest.json',
  'popup.html'
];

async function build() {
  try {
    await fs.ensureDir(distDir);
    
    for (const file of filesToCopy) {
      await fs.copy(path.join(sourceDir, file), path.join(distDir, file));
    }
    
    await new Promise((resolve, reject) => {
      webpack(webpackConfig, (err, stats) => {
        if (err || stats.hasErrors()) {
          console.error(err || stats.toString());
          reject(err || new Error('Webpack build failed'));
        } else {
          console.log(stats.toString({ colors: true }));
          resolve();
        }
      });
    });
    
    console.log('Build completed successfully!');
  } catch (err) {
    console.error('Build failed:', err);
  }
}

build();

if (process.argv.includes('--watch')) {
  console.log('Watching for changes...');
  fs.watch(sourceDir, { recursive: true }, (eventType, filename) => {
    if (filename) {
      if (filesToCopy.includes(filename)) {
        console.log(`File changed: ${filename}`);
        fs.copy(path.join(sourceDir, filename), path.join(distDir, filename))
          .then(() => console.log(`${filename} updated in dist folder`))
          .catch(err => console.error(`Error updating ${filename}:`, err));
      } else if (filename.endsWith('.js')) {
        console.log(`JavaScript file changed: ${filename}`);
        build();
      }
    }
  });
}