const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  const srcDir = path.join(__dirname, 'node_modules', '@pdftron', 'webviewer', 'public');
  const destDir = path.join(__dirname, 'public', 'lib', 'webviewer');

  // Remove existing directory if it exists
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }

  // Copy files
  copyDir(srcDir, destDir);
  console.log('WebViewer files copied successfully!');
} catch (error) {
  console.error('Error copying WebViewer files:', error);
  process.exit(1);
}