// Test script to verify local development setup
// Run with: node test-setup.js

const fs = require('fs');
const path = require('path');

console.log('🧪 Figtree Local Testing Setup Verification\n');

// Check required files exist
const requiredFiles = [
    'manifest.json',
    'background.js', 
    'content.js',
    'website-auth.html',
    'dev-server.py',
    'LOCAL_TESTING.md'
];

let allFilesExist = true;
console.log('📁 Checking required files:');

requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
    console.log('\n❌ Missing required files. Please ensure all files are present.');
    process.exit(1);
}

// Check manifest.json structure
console.log('\n📋 Checking manifest.json:');
try {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    
    const checks = [
        ['name', manifest.name === 'Figtree'],
        ['version', !!manifest.version],
        ['manifest_version', manifest.manifest_version === 3],
        ['web_accessible_resources includes website-auth.html', 
         manifest.web_accessible_resources?.[0]?.resources?.includes('website-auth.html')],
        ['permissions include storage', manifest.permissions?.includes('storage')],
        ['oauth2 client_id exists', !!manifest.oauth2?.client_id]
    ];
    
    checks.forEach(([check, passed]) => {
        console.log(`  ${passed ? '✅' : '❌'} ${check}`);
    });
} catch (error) {
    console.log('  ❌ Failed to parse manifest.json:', error.message);
}

// Check background.js for key functions
console.log('\n🔧 Checking background.js:');
try {
    const background = fs.readFileSync('background.js', 'utf8');
    
    const checks = [
        ['getWebsiteAuthUrl function exists', background.includes('function getWebsiteAuthUrl')],
        ['startWebsiteAuthFlow function exists', background.includes('function startWebsiteAuthFlow')],
        ['checkWebsiteForAuthResult function exists', background.includes('function checkWebsiteForAuthResult')],
        ['development URL configured', background.includes('127.0.0.1:5500')],
        ['production URL configured', background.includes('getfigtree.com')]
    ];
    
    checks.forEach(([check, passed]) => {
        console.log(`  ${passed ? '✅' : '❌'} ${check}`);
    });
} catch (error) {
    console.log('  ❌ Failed to read background.js:', error.message);
}

// Check website-auth.html
console.log('\n🌐 Checking website-auth.html:');
try {
    const html = fs.readFileSync('website-auth.html', 'utf8');
    
    const checks = [
        ['Contains OAuth logic', html.includes('figma.com/oauth')],
        ['Contains sessionStorage handling', html.includes('sessionStorage')],
        ['Contains state validation', html.includes('extension_state')],
        ['Contains Figma client ID', html.includes('qTujZ7BNoSdMdVikl3RaeD')]
    ];
    
    checks.forEach(([check, passed]) => {
        console.log(`  ${passed ? '✅' : '❌'} ${check}`);
    });
} catch (error) {
    console.log('  ❌ Failed to read website-auth.html:', error.message);
}

console.log('\n🚀 Setup verification complete!');
console.log('\n📖 Next steps:');
console.log('  1. Run: npm run dev (or python3 dev-server.py)');
console.log('  2. Open Chrome → chrome://extensions/');
console.log('  3. Enable Developer Mode');
console.log('  4. Click "Load unpacked" → Select this directory');
console.log('  5. Click the Figtree extension icon to test');
console.log('\n📚 See LOCAL_TESTING.md for detailed testing guide');