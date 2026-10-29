'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, user } = require('./harness');

const PW = 'warehouseportal';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

function setup() {
  const users = [
    user({ NIK: '200001', Name: 'Pemohon Satu', Department: 'Mechanical Maintenance' }),
    user({ NIK: '200002', Name: 'Pemohon Dua', Department: 'Mechanical Maintenance' }),
    user({ NIK: '200003', Name: 'Kepala Mekanik', Department: 'Mechanical Maintenance', Level: '3. Departement Head' }),
    user({ NIK: '200004', Name: 'Orang Civil', Department: 'Civil Maintenance', DeptCode: 'MMM' }),
    user({ NIK: '200005', Name: 'Staf Mgmt', Department: 'Management', DeptCode: 'PPS', Level: '5. Management' }),
    user({ NIK: '200006', Name: 'Staf Logistik', Department: 'Warehouse & Logistic', DeptCode: 'LOG', IsLogistic: true }),
    user({ NIK: '200007', Name: 'Orang Lain', Department: 'Electrical Maintenance', DeptCode: 'ELC' }),
    user({ NIK: '200008', Name: 'Kepala Listrik', Department: 'Electrical Maintenance', DeptCode: 'ELC', Level: '3. Departement Head' }),
    user({ NIK: '200009', Name: 'Div Head', Department: 'Operation', DeptCode: 'OP1', Level: '4. Division Head' })
  ];
  const app = createApp(users);
  app.db.departments = [
    { Department: 'Mechanical Maintenance', DeptCode: 'MMM', HeadNIK: '200003', DeputyNIK: '' },
    { Department: 'Civil Maintenance', DeptCode: 'MMM', HeadNIK: '200004', DeputyNIK: '' },
    { Department: 'Management', DeptCode: 'PPS', HeadNIK: '', DeputyNIK: '' },
    { Department: 'Electrical Maintenance', DeptCode: 'ELC', HeadNIK: '200008', DeputyNIK: '' }
  ];
  const tokens = {};
  users.forEach((u) => {
    const t = app.call('login', null, { nik: u.NIK, password: PW }).data.token;
    // lewati kewajiban ganti password untuk uji
    const i = app.db.users.findIndex((x) => x.NIK === u.NIK);
    app.db.users[i].MustChange = false;
    tokens[u.NIK] = t;
  });
  return { app, t: tokens };
}

const ITEM = { materialNo: '', description: 'Bearing 6205', qty: '2,5', uom: 'PC', reason: 'Aus' };
const BODY = (over) => Object.assign({ source: 'Outage', items: [ITEM] }, over);

test('validasi: sumber, item, qty, uom, reason', () => {
  const { app } = setup();
  const v = (p) => app.eval(`Validate.submission(${JSON.stringify(p)}, ['PC','CAN'])`);
  assert.match(v({ items: [ITEM] }).error, /Sumber Scrap/);
  assert.match(v({ source: 'Other', items: [ITEM] }).error, /Other/);
  assert.match(v({ source: 'Outage', items: [] }).error, /minimal 1 item/);
  const bad = (o) => v(BODY({ items: [Object.assign({}, ITEM, o)] })).error;
  assert.match(bad({ description: ' ' }), /Description/);
  assert.match(bad({ qty: '0' }), /lebih dari 0/);
  assert.match(bad({ qty: 'abc' }), /angka/);
  assert.match(bad({ qty: '1,25' }), /1 angka/);
  assert.match(bad({ qty: '-3' }), /angka/);
  assert.match(bad({ uom: '' }), /UoM/);
  assert.match(bad({ uom: 'XYZ' }), /tidak dikenal/);
  assert.match(bad({ uom: 'Other', uomOther: '' }), /Other/);
  assert.match(bad({ reason: '' }), /Scrap Reason/);
  const ok = v(BODY({ items: [Object.assign({}, ITEM, { qty: '2,5' })] })).value;
  assert.equal(ok.items[0].qty, 2.5);
  const oth = v(BODY({ items: [Object.assign({}, ITEM, { uom: 'Other', uomOther: ' pail ' })] })).value;
  assert.equal(oth.items[0].uom, 'PAIL');
  assert.equal(v({ source: 'Project', sourceOther: 'abaikan', items: [ITEM] }).value.sourceOther, '');
  assert.equal(v({ source: 'Other', sourceOther: 'Rusak banjir', items: [ITEM] }).value.sourceOther, 'Rusak banjir');
});

test('jalur awal: pemohon biasa ke Dept Head, lainnya langsung Logistic', () => {
  const { app } = setup();
  const st = (nik) => app.eval(`Workflow.initialStatus(${JSON.stringify(app.db.users.find((u) => u.NIK === nik))}, __db.departments)`);
  assert.equal(st('200001'), 'Menunggu Dept Head');
  assert.equal(st('200003'), 'Menunggu Logistic'); // Dept Head sendiri
  assert.equal(st('200004'), 'Menunggu Logistic'); // Civil: dirinya Dept Head sementara
  assert.equal(st('200005'), 'Menunggu Logistic'); // Management
  assert.equal(st('200009'), 'Menunggu Logistic'); // Division Head
});

test('jalur awal: departemen tanpa Dept Head atau tak dikenal ke Logistic', () => {
  const { app } = setup();
  const u = { NIK: '1', Department: 'Tidak Ada', Level: '1. User Non Planner' };
  assert.equal(app.eval(`Workflow.initialStatus(${JSON.stringify(u)}, __db.departments)`), 'Menunggu Logistic');
  const m = { NIK: '1', Department: 'Management', Level: '1. User Non Planner' };
  assert.equal(app.eval(`Workflow.initialStatus(${JSON.stringify(m)}, __db.departments)`), 'Menunggu Logistic');
});

test('simpan draft: buat, ubah, item diganti, hanya milik sendiri', () => {
  const { app, t } = setup();
  const r = app.call('sub.save', t['200001'], BODY({ items: [ITEM, Object.assign({}, ITEM, { description: 'Seal' })] }));
  assert.equal(r.ok, true);
  assert.equal(r.data.status, 'Draft');
  assert.equal(r.data.number, '');
  assert.equal(r.data.items.length, 2);
  const id = r.data.id;
  const r2 = app.call('sub.save', t['200001'], BODY({ id, source: 'Project', items: [ITEM] }));
  assert.equal(r2.data.items.length, 1);
  assert.equal(r2.data.source, 'Project');
  assert.equal(app.db.tables.Items.length, 1);
  assert.equal(app.call('sub.save', t['200002'], BODY({ id })).code, 'FORBIDDEN');
  assert.equal(app.db.tables.Submissions.length, 1);
});

test('simpan draft: item pengajuan lain tidak ikut terhapus', () => {
  const { app, t } = setup();
  const a = app.call('sub.save', t['200001'], BODY()).data.id;
  const b = app.call('sub.save', t['200002'], BODY({ items: [ITEM, ITEM] })).data.id;
  app.call('sub.save', t['200001'], BODY({ id: a, items: [ITEM, ITEM, ITEM] }));
  assert.equal(app.call('sub.get', t['200002'], { id: b }).data.items.length, 2);
  assert.equal(app.call('sub.get', t['200001'], { id: a }).data.items.length, 3);
});

test('UoM Other masuk daftar pilihan otomatis', () => {
  const { app, t } = setup();
  assert.ok(app.call('meta', t['200001']).data.uoms.length >= 4);
  app.call('sub.save', t['200001'], BODY({ items: [Object.assign({}, ITEM, { uom: 'Other', uomOther: 'pail' })] }));
  assert.ok(app.call('meta', t['200001']).data.uoms.includes('PAIL'));
  const again = app.call('sub.save', t['200001'], BODY({ items: [Object.assign({}, ITEM, { uom: 'PAIL' })] }));
  assert.equal(again.ok, true);
  assert.equal(app.db.tables.UoM.filter((u) => u.Code === 'PAIL').length, 1);
});

test('foto: tambah, batas 5, format, hapus, tampil', () => {
  const { app, t } = setup();
  const id = app.call('sub.save', t['200001'], BODY()).data.id;
  assert.match(app.call('sub.addPhoto', t['200001'], { id, data: 'data:image/png;base64,AAAA' }).error, /JPEG/);
  assert.match(app.call('sub.addPhoto', t['200001'], { id, data: 'bukan foto' }).error, /JPEG/);
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(2000001);
  assert.match(app.call('sub.addPhoto', t['200001'], { id, data: big }).error, /terlalu besar/);
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push(app.call('sub.addPhoto', t['200001'], { id, data: JPG }).data.fileId);
  assert.match(app.call('sub.addPhoto', t['200001'], { id, data: JPG }).error, /Maksimal 5/);
  assert.equal(Object.keys(app.db.folders).length, 1);
  assert.equal(app.call('sub.get', t['200001'], { id }).data.photos.length, 5);
  assert.equal(app.call('sub.removePhoto', t['200001'], { id, fileId: ids[0] }).data.count, 4);
  assert.equal(app.db.files[ids[0]], undefined);
  assert.match(app.call('sub.removePhoto', t['200001'], { id, fileId: 'nope' }).error, /tidak ditemukan/);
  assert.match(app.call('sub.photo', t['200001'], { id, fileId: ids[1] }).data.dataUrl, /^data:image\/jpeg/);
  assert.equal(app.call('sub.addPhoto', t['200002'], { id, data: JPG }).code, 'FORBIDDEN');
});

test('kirim: wajib foto, nomor SCR-tahun-0001 berurutan, status sesuai jalur', () => {
  const { app, t } = setup();
  const year = new Date().getFullYear();
  const a = app.call('sub.save', t['200001'], BODY()).data.id;
  assert.match(app.call('sub.submit', t['200001'], { id: a }).error, /minimal 1 foto/);
  app.call('sub.addPhoto', t['200001'], { id: a, data: JPG });
  const s1 = app.call('sub.submit', t['200001'], { id: a });
  assert.equal(s1.ok, true);
  assert.equal(s1.data.number, `SCR-${year}-0001`);
  assert.equal(s1.data.status, 'Menunggu Dept Head');

  const b = app.call('sub.save', t['200003'], BODY()).data.id;
  app.call('sub.addPhoto', t['200003'], { id: b, data: JPG });
  const s2 = app.call('sub.submit', t['200003'], { id: b });
  assert.equal(s2.data.number, `SCR-${year}-0002`);
  assert.equal(s2.data.status, 'Menunggu Logistic');

  assert.match(app.call('sub.submit', t['200001'], { id: a }).error, /Draft/);
  assert.match(app.call('sub.save', t['200001'], BODY({ id: a })).error, /Draft/);
});

test('nomor: urut per tahun, tahun baru mulai dari 0001 lagi', () => {
  const { app, t } = setup();
  const send = (nik) => {
    const id = app.call('sub.save', t[nik], BODY()).data.id;
    app.call('sub.addPhoto', t[nik], { id, data: JPG });
    return app.call('sub.submit', t[nik], { id }).data.number;
  };
  const y = new Date().getFullYear();
  assert.equal(send('200001'), `SCR-${y}-0001`);
  assert.equal(send('200002'), `SCR-${y}-0002`);
  app.advance(366 * 24 * 3600 * 1000);
  t['200001'] = app.call('login', null, { nik: '200001', password: PW }).data.token;
  app.db.users.find((u) => u.NIK === '200001').MustChange = false;
  assert.equal(send('200001'), `SCR-${y + 1}-0001`);
});

test('kirim ulang validasi isi: item cacat di sheet ditolak', () => {
  const { app, t } = setup();
  const id = app.call('sub.save', t['200001'], BODY()).data.id;
  app.call('sub.addPhoto', t['200001'], { id, data: JPG });
  app.db.tables.Items[0].Qty = 0;
  assert.match(app.call('sub.submit', t['200001'], { id }).error, /Qty/);
});

test('hapus draft: status Dihapus, hilang dari daftar, tidak bisa dibuka', () => {
  const { app, t } = setup();
  const id = app.call('sub.save', t['200001'], BODY()).data.id;
  app.call('sub.addPhoto', t['200001'], { id, data: JPG });
  assert.equal(app.call('sub.list', t['200001']).data.length, 1);
  assert.equal(app.call('sub.deleteDraft', t['200001'], { id }).ok, true);
  assert.equal(app.call('sub.list', t['200001']).data.length, 0);
  assert.equal(app.call('sub.get', t['200001'], { id }).ok, false);
  assert.equal(Object.keys(app.db.folders).length, 0);
});

test('daftar: hanya milik sendiri, terbaru di atas, ringkasan item', () => {
  const { app, t } = setup();
  const a = app.call('sub.save', t['200001'], BODY()).data.id;
  app.advance(1000);
  const b = app.call('sub.save', t['200001'], BODY({ items: [ITEM, ITEM] })).data.id;
  app.call('sub.save', t['200002'], BODY());
  const r = app.call('sub.list', t['200001']).data;
  assert.deepEqual(r.map((x) => x.id), [b, a]);
  assert.equal(r[0].itemCount, 2);
  assert.equal(r[0].firstItem, 'Bearing 6205');
});

test('akses lihat: draft hanya pemilik; terkirim terbuka untuk peran berwenang', () => {
  const { app, t } = setup();
  const id = app.call('sub.save', t['200001'], BODY()).data.id;
  const can = (nik) => app.call('sub.get', t[nik], { id }).ok;
  assert.equal(can('200001'), true);
  assert.equal(can('200003'), false);
  assert.equal(can('200006'), false);
  app.call('sub.addPhoto', t['200001'], { id, data: JPG });
  app.call('sub.submit', t['200001'], { id });
  assert.equal(can('200003'), true);  // Dept Head departemen sama
  assert.equal(can('200006'), true);  // Logistic
  assert.equal(can('200009'), true);  // Division Head
  assert.equal(can('200005'), true);  // Management
  assert.equal(can('200002'), false); // rekan biasa
  assert.equal(can('200007'), false); // departemen lain
  assert.equal(can('200008'), false); // Dept Head departemen lain
  const fileId = app.call('sub.get', t['200001'], { id }).data.photos[0].fileId;
  assert.equal(app.call('sub.photo', t['200007'], { id, fileId }).ok, false);
  assert.equal(app.call('sub.photo', t['200003'], { id, fileId }).ok, true);
});

test('riwayat tercatat', () => {
  const { app, t } = setup();
  const id = app.call('sub.save', t['200001'], BODY()).data.id;
  app.call('sub.addPhoto', t['200001'], { id, data: JPG });
  app.call('sub.submit', t['200001'], { id });
  const h = app.call('sub.get', t['200001'], { id }).data.history;
  assert.deepEqual(h.map((x) => x.action), ['Draft dibuat', 'Diajukan']);
  assert.equal(h[1].byNik, '200001');
});
