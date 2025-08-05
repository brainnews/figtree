#!/usr/bin/env node

/**
 * Build script for Figtree bookmarklet
 * Combines all source files into a single distributable file
 */

const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  srcDir: path.join(__dirname, '../src'),
  distDir: path.join(__dirname, '../dist'),
  outputFile: 'figtree-app.js',
  minifiedFile: 'figtree-app.min.js',
  loaderFile: 'figtree-loader.js',
  version: '2.0.0-bookmarklet'
};

// File order for concatenation
const sourceFiles = [
  'app/storage.js',
  'app/auth.js', 
  'app/figma-api.js',
  'app/main.js',
  'ui/panel.js',
  'ui/events.js',
  'ui/projects.js'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return '';
  }
}

function writeFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Created: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error writing file ${filePath}:`, error.message);
  }
}

function minifyJs(content) {
  // Simple minification - remove comments and extra whitespace
  return content
    // Remove single-line comments (but not URLs)
    .replace(/^\s*\/\/.*$/gm, '')
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove extra whitespace
    .replace(/^\s+/gm, '')
    .replace(/\s+$/gm, '')
    // Remove empty lines
    .replace(/\n\s*\n/g, '\n')
    // Compress some common patterns
    .replace(/\s*{\s*/g, '{')
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*=\s*/g, '=')
    .replace(/\s*\+\s*/g, '+')
    .replace(/\s*\|\|\s*/g, '||')
    .replace(/\s*&&\s*/g, '&&')
    .trim();
}

function buildCombinedFile() {
  console.log('🔨 Building Figtree bookmarklet...\n');
  
  // Ensure dist directory exists
  ensureDir(config.distDir);
  
  let combinedContent = '';
  
  // Add header comment
  combinedContent += `/**
 * Figtree Bookmarklet v${config.version}
 * Quick access to your Figma projects from any webpage
 * 
 * Built: ${new Date().toISOString()}
 * Source: https://github.com/your-username/figtree
 */

(function() {
  'use strict';
  
`;

  // Read and combine all source files
  console.log('📁 Reading source files:');
  
  for (const file of sourceFiles) {
    const filePath = path.join(config.srcDir, file);
    console.log(`  • ${file}`);
    
    const content = readFile(filePath);
    if (content) {
      combinedContent += `\n  // === ${file} ===\n`;
      combinedContent += content;
      combinedContent += '\n';
    }
  }
  
  // Add footer
  combinedContent += `
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[Figtree] Bookmarklet loaded');
    });
  } else {
    console.log('[Figtree] Bookmarklet loaded');
  }
  
})();
`;

  // Write unminified version
  const outputPath = path.join(config.distDir, config.outputFile);
  writeFile(outputPath, combinedContent);
  
  // Write minified version
  console.log('\n🗜️  Minifying...');
  const minifiedContent = minifyJs(combinedContent);
  const minifiedPath = path.join(config.distDir, config.minifiedFile);
  writeFile(minifiedPath, minifiedContent);
  
  // Copy loader
  console.log('\n📦 Copying loader...');
  const loaderContent = readFile(path.join(config.srcDir, 'loader.js'));
  const loaderPath = path.join(config.distDir, config.loaderFile);
  writeFile(loaderPath, loaderContent);
  
  // Generate bookmarklet
  console.log('\n🔗 Generating bookmarklet...');
  generateBookmarklet(loaderContent);
  
  // Show file sizes
  console.log('\n📊 Build results:');
  console.log(`  • ${config.outputFile}: ${getFileSize(outputPath)}`);
  console.log(`  • ${config.minifiedFile}: ${getFileSize(minifiedPath)}`);
  console.log(`  • ${config.loaderFile}: ${getFileSize(loaderPath)}`);
  
  console.log('\n✅ Build completed successfully!');
}

function generateBookmarklet(loaderContent) {
  // Extract the main function from loader and minify it
  const functionMatch = loaderContent.match(/\(function\(\)\s*{([\s\S]*?)}\)\(\);?$/);
  
  if (!functionMatch) {
    console.error('❌ Could not extract function from loader');
    return;
  }
  
  const functionBody = functionMatch[1];
  
  // Create bookmarklet with updated CDN URL (for production)
  const bookmarklet = `javascript:(function(){${minifyJs(functionBody)}})();`;
  
  // Create bookmarklet for development (localhost)
  const devBookmarklet = bookmarklet.replace(
    'https://cdn.jsdelivr.net/gh/yourusername/figtree@bookmarklet/bookmarklet/dist/',
    'http://localhost:3000/'
  );
  
  // Write bookmarklets
  const bookmarkletPath = path.join(config.distDir, 'bookmarklet.js');
  const devBookmarkletPath = path.join(config.distDir, 'bookmarklet-dev.js');
  
  writeFile(bookmarkletPath, bookmarklet);
  writeFile(devBookmarkletPath, devBookmarklet);
  
  console.log('  • Generated production bookmarklet');
  console.log('  • Generated development bookmarklet');
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const size = stats.size;
    
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  } catch (error) {
    return 'Unknown';
  }
}

// Run the build
if (require.main === module) {
  buildCombinedFile();
}

module.exports = { buildCombinedFile };