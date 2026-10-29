'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, user } = require('./harness');

const PW = 'warehouseportal';

function setup() {
  const users = [
    user({ NIK: '1', Name: 'Admin', Role: 'Admin', Department: 'Warehouse & Logistic', DeptCode: 'LOG' }),
    user({ NIK: '2', Name: 'Pemohon', Department: 'Mechanical Maintenance' })
  ];
  const app = createApp(users);
  const t = {};
  users.forEach((u) => {
    t[u.NIK] = app.call('login', null, { nik: u.NIK, password: PW }).data.token;
    app.db.users.find((x) => x.NIK === u.NIK).MustChange = false;
  });
  return { app, t };
}

const SAP = [
  { Material: '10000000', 'Material Description': 'FUEL;GASOIL,HSD', UoM: 'L', 'Material Type': 'CHM', Price: 1.19 },
  { Material: '10000001', 'Material Description': 'COAL;GAR3000', UoM: 'TON' },
  { Material: '10000008', 'Material Description': 'BEARING;6205,SKF', UoM: 'UNI' },
  { Material: '10000008', 'Material Description': 'DUPLIKAT', UoM: 'PC' },
  { Material: '', 'Material Description': 'tanpa nomor', UoM: 'PC' },
  { Material: '10000009', 'Material Description': '', UoM: 'PC' }
];

test('impor material: hanya 3 kolom, duplikat dan baris rusak dilewati, UoM baru ditambahkan', () => {
  const { app, t } = setup();
  const r = app.call('admin.importMaterials', t['1'], { rows: SAP });
  assert.equal(r.ok, true);
  assert.equal(r.data.total, 3);
  assert.equal(r.data.skipped, 3);
  assert.deepEqual(r.data.newUoms, ['UNI']); // TON dan L sudah ada di daftar awal
  const stored = app.db.tables.Materials;
  assert.deepEqual(Object.keys(stored[0]).sort(), ['Description', 'MaterialNo', 'UoM']);
  assert.equal(stored.find((m) => m.MaterialNo === '10000008').Description, 'BEARING;6205,SKF');
  const meta = app.call('meta', t['2']).data;
  assert.ok(meta.uoms.includes('UNI') && meta.uoms.includes('TON') && meta.uoms.includes('PC')); // daftar awal tidak hilang
});

test('impor material: mengganti seluruh daftar lama, hanya admin', () => {
  const { app, t } = setup();
  assert.equal(app.call('admin.importMaterials', t['2'], { rows: SAP }).code, 'FORBIDDEN');
  app.call('admin.importMaterials', t['1'], { rows: SAP });
  app.call('admin.importMaterials', t['1'], { rows: [{ Material: '20000000', 'Material Description': 'BARU', UoM: 'PC' }] });
  assert.equal(app.db.tables.Materials.length, 1);
  assert.equal(app.call('admin.importMaterials', t['1'], { rows: [] }).ok, false);
  assert.match(app.call('admin.importMaterials', t['1'], { rows: [{ foo: 'bar' }] }).error, /Tidak ada baris valid/);
});

test('daftar material untuk saran: bentuk ringkas, bisa dibaca semua pengguna', () => {
  const { app, t } = setup();
  assert.deepEqual(app.call('materials.all', t['2']).data.items, []);
  app.call('admin.importMaterials', t['1'], { rows: SAP });
  const items = app.call('materials.all', t['2']).data.items;
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], ['10000000', 'FUEL;GASOIL,HSD', 'L']);
});

test('material hasil impor bisa dipakai di pengajuan dengan UoM SAP', () => {
  const { app, t } = setup();
  app.call('admin.importMaterials', t['1'], { rows: SAP });
  const r = app.call('sub.save', t['2'], { source: 'Outage',
    items: [{ materialNo: '10000008', description: 'BEARING;6205,SKF', qty: '2', uom: 'UNI', reason: 'aus' }] });
  assert.equal(r.ok, true);
  assert.equal(r.data.items[0].uom, 'UNI');
});

test('cadangan: simpan 8 terbaru, hapus yang lebih tua, abaikan file lain', () => {
  const { app } = setup();
  const files = [];
  for (let m = 1; m <= 10; m++) files.push({ id: 'b' + m, name: 'Backup-2026-' + String(m).padStart(2, '0') + '-01_0200' });
  files.push({ id: 'x', name: 'Catatan.txt' });
  app.ctx.__files = files;
  const del = JSON.parse(app.eval('JSON.stringify(Backup.toDelete(__files, 8))'));
  assert.deepEqual(del.map((f) => f.id), ['b2', 'b1']);
  assert.equal(JSON.parse(app.eval('JSON.stringify(Backup.toDelete(__files.slice(0,3), 8))')).length, 0);
});

test('cadangan sekarang: salinan bernama tanggal WITA, dipangkas ke 8, hanya admin', () => {
  const { app, t } = setup();
  assert.equal(app.call('admin.backupNow', t['1']).ok, true);
  assert.equal(app.call('admin.backupNow', t['2']).code, 'FORBIDDEN');
  for (let i = 0; i < 9; i++) { app.advance(24 * 3600 * 1000); app.eval('Backup.run()'); }
  assert.equal(app.db.backups.length, 8);
  assert.match(app.db.backups[7].name, /^Backup-\d{4}-\d{2}-\d{2}_\d{4}$/);
});
