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
  const devBookmarklet = generateBookmarklet(loaderContent);
  
  // Update demo page with new bookmarklet
  console.log('\n📄 Updating demo page...');
  updateDemoPage(devBookmarklet);
  
  // Show file sizes
  console.log('\n📊 Build results:');
  console.log(`  • ${config.outputFile}: ${getFileSize(outputPath)}`);
  console.log(`  • ${config.minifiedFile}: ${getFileSize(minifiedPath)}`);
  console.log(`  • ${config.loaderFile}: ${getFileSize(loaderPath)}`);
  
  console.log('\n✅ Build completed successfully!');
}

function generateBookmarklet(loaderContent) {
  // Create bookmarklets for different environments
  const productionBookmarklet = createSimpleBookmarklet('https://cdn.jsdelivr.net/gh/yourusername/figtree@bookmarklet/bookmarklet/dist/');
  const devBookmarklet = createSimpleBookmarklet('http://localhost:3000/');
  const liveServerBookmarklet = createSimpleBookmarklet('http://127.0.0.1:5500/bookmarklet/dist/');
  
  // Write bookmarklets
  const bookmarkletPath = path.join(config.distDir, 'bookmarklet.js');
  const devBookmarkletPath = path.join(config.distDir, 'bookmarklet-dev.js');
  const liveServerBookmarkletPath = path.join(config.distDir, 'bookmarklet-liveserver.js');
  
  writeFile(bookmarkletPath, productionBookmarklet);
  writeFile(devBookmarkletPath, devBookmarklet);
  writeFile(liveServerBookmarkletPath, liveServerBookmarklet);
  
  console.log('  • Generated production bookmarklet');
  console.log('  • Generated development bookmarklet (localhost:3000)');
  console.log('  • Generated Live Server bookmarklet (127.0.0.1:5500)');
  
  return liveServerBookmarklet; // Return Live Server version for demo page
}

function createSimpleBookmarklet(baseUrl) {
  // Create a much simpler bookmarklet that avoids HTML/CSS issues
  const code = `
    (function() {
      if (window.FigtreeApp) return window.FigtreeApp.toggle();
      if (window.FigtreeLoading) return;
      window.FigtreeLoading = true;
      
      var loading = document.createElement('div');
      loading.id = 'figtree-loading';
      loading.style.cssText = 'position:fixed;top:20px;right:20px;background:#2c2c2c;color:white;padding:12px 16px;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
      loading.innerHTML = '🌳 Loading Figtree...';
      document.body.appendChild(loading);
      
      var script = document.createElement('script');
      script.src = '${baseUrl}figtree-app.min.js';
      script.onload = function() {
        loading.remove();
        window.FigtreeLoading = false;
        if (window.FigtreeApp) window.FigtreeApp.init();
      };
      script.onerror = function() {
        loading.remove();
        window.FigtreeLoading = false;
        alert('Failed to load Figtree');
      };
      document.head.appendChild(script);
    })();
  `.replace(/\s+/g, ' ').trim();
  
  return 'javascript:' + encodeURIComponent(code);
}

function updateDemoPage(devBookmarklet) {
  const demoPath = path.join(__dirname, '../demo/index.html');
  let demoContent = readFile(demoPath);
  
  if (!demoContent) {
    console.error('❌ Could not read demo page');
    return;
  }
  
  // Replace the bookmarklet href with the new one
  const bookmarkletRegex = /href="javascript:[^"]*"/;
  const newHref = `href="${devBookmarklet}"`;
  
  const updatedContent = demoContent.replace(bookmarkletRegex, newHref);
  
  if (updatedContent === demoContent) {
    console.log('  • Demo page already up to date');
  } else {
    writeFile(demoPath, updatedContent);
    console.log('  • Updated demo page with new bookmarklet');
  }
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