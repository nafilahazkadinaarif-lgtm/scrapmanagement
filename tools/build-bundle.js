'use strict';
// Gabungkan src/ menjadi 3 file siap tempel ke Apps Script:
//   dist/Code.gs          semua file .gs digabung (Config pertama, Code terakhir)
//   dist/Index.html       Index.html dengan semua include() sudah disisipkan
//   dist/appsscript.json  salinan manifest
// Jalankan: npm run build
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

function build() {
  const gs = fs.readdirSync(SRC).filter((f) => f.endsWith('.gs'));
  const order = ['Config.gs']
    .concat(gs.filter((f) => f !== 'Config.gs' && f !== 'Code.gs').sort())
    .concat(['Code.gs']);
  if (gs.length !== order.length || order.some((f) => !gs.includes(f))) {
    throw new Error('Config.gs dan Code.gs wajib ada di src/');
  }

  const header = '// HASIL OTOMATIS dari tools/build-bundle.js. Jangan diedit di sini.\n' +
    '// Ubah file di src/ lalu jalankan: npm run build\n';
  const code = header + order.map((f) =>
    '\n// ===== ' + f + ' =====\n' + fs.readFileSync(path.join(SRC, f), 'utf8').trim() + '\n').join('');

  let html = fs.readFileSync(path.join(SRC, 'Index.html'), 'utf8');
  html = html.replace(/<\?!=\s*include\('([A-Za-z]+)'\);?\s*\?>/g, (m, name) => {
    const f = path.join(SRC, name + '.html');
    if (!fs.existsSync(f)) throw new Error('include tidak ditemukan: ' + name);
    return fs.readFileSync(f, 'utf8').trim();
  });
  if (/<\?/.test(html)) throw new Error('Masih ada scriptlet <? ... ?> di Index.html hasil gabungan');

  return {
    'Code.gs': code,
    'Index.html': html,
    'appsscript.json': fs.readFileSync(path.join(SRC, 'appsscript.json'), 'utf8')
  };
}

if (require.main === module) {
  fs.mkdirSync(DIST, { recursive: true });
  const out = build();
  Object.keys(out).forEach((name) => {
    fs.writeFileSync(path.join(DIST, name), out[name]);
    console.log('dist/' + name + '  ' + Buffer.byteLength(out[name]) + ' bytes');
  });
}

module.exports = { build };
