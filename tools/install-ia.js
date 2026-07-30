'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const requiredFiles = [
  'functions/ia/core/identity.js',
  'functions/ia/core/config.js',
  'functions/ia/core/response.js',
  'functions/ia/tools/tool-registry.js',
  'functions/ia/memory/session-memory.js'
];

console.log('=== INSTALADOR IA CUICHAPA ===');

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(ROOT, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error('Falta el archivo: ' + relativePath);
  }

  execFileSync(
    process.execPath,
    ['--check', absolutePath],
    { stdio: 'inherit' }
  );

  console.log('✓', relativePath);
}

console.log('');
console.log('✓ Instalación base validada');
console.log('✓ No se modificó functions/index.js');
console.log('✓ No se realizó deploy');
