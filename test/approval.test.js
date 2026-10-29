'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, user } = require('./harness');

const PW = 'warehouseportal';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const ITEM = { materialNo: '', description: 'Bearing', qty: '1', uom: 'PC', reason: 'Aus' };

function setup() {
  const users = [
    user({ NIK: '1', Name: 'Pemohon', Department: 'Mechanical Maintenance' }),
    user({ NIK: '2', Name: 'Rekan', Department: 'Mechanical Maintenance' }),
    user({ NIK: '3', Name: 'Kepala Mek', Department: 'Mechanical Maintenance', Level: '3. Departement Head' }),
    user({ NIK: '4', Name: 'Deputi Mek', Department: 'Mechanical Maintenance' }),
    user({ NIK: '5', Name: 'Logistik A', Department: 'Warehouse & Logistic', DeptCode: 'LOG', IsLogistic: true }),
    user({ NIK: '6', Name: 'Logistik B', Department: 'Warehouse & Logistic', DeptCode: 'LOG', IsLogistic: true }),
    user({ NIK: '7', Name: 'Kepala Listrik', Department: 'Electrical Maintenance', DeptCode: 'ELC', Level: '3. Departement Head' }),
    user({ NIK: '8', Name: 'Admin', Department: 'Warehouse & Logistic', DeptCode: 'LOG', Role: 'Admin' }),
    user({ NIK: '9', Name: 'Staf Listrik', Department: 'Electrical Maintenance', DeptCode: 'ELC' })
  ];
  const app = createApp(users);
  app.db.departments = [
    { Department: 'Mechanical Maintenance', DeptCode: 'MMM', HeadNIK: '3', DeputyNIK: '' },
    { Department: 'Electrical Maintenance', DeptCode: 'ELC', HeadNIK: '7', DeputyNIK: '' }
  ];
  const t = {};
  users.forEach((u) => {
    t[u.NIK] = app.call('login', null, { nik: u.NIK, password: PW }).data.token;
    app.db.users.find((x) => x.NIK === u.NIK).MustChange = false;
  });
  const send = (nik) => {
    const id = app.call('sub.save', t[nik], { source: 'Outage', items: [ITEM] }).data.id;
    app.call('sub.addPhoto', t[nik], { id, data: JPG });
    return { id, r: app.call('sub.submit', t[nik], { id }) };
  };
  const act = (nik, id, action, note) => app.call('sub.act', t[nik], { id, action, note });
  const status = (id) => app.db.tables.Submissions.find((s) => s.ID === id).Status;
  return { app, t, send, act, status };
}

test('jalur penuh: Dept Head lalu Logistic lalu Disetujui', () => {
  const { send, act, status } = setup();
  const { id } = send('1');
  assert.equal(status(id), 'Menunggu Dept Head');
  assert.equal(act('3', id, 'approve').ok, true);
  assert.equal(status(id), 'Menunggu Logistic');
  assert.equal(act('5', id, 'approve').ok, true);
  assert.equal(status(id), 'Disetujui');
});

test('pemohon level kepala: langsung Logistic', () => {
  const { send, act, status } = setup();
  const { id } = send('3');
  assert.equal(status(id), 'Menunggu Logistic');
  assert.equal(act('5', id, 'approve').ok, true);
  assert.equal(status(id), 'Disetujui');
});

test('tidak boleh menyetujui/menolak pengajuan sendiri', () => {
  const { send, act, status, app, t } = setup();
  // Logistic A mengajukan sendiri
  const mine = send('5').id;
  assert.equal(status(mine), 'Menunggu Logistic'); // departemennya tanpa Dept Head di data
  assert.equal(act('5', mine, 'approve').code, 'FORBIDDEN');
  assert.equal(act('5', mine, 'reject', 'x').code, 'FORBIDDEN');
  assert.equal(act('6', mine, 'approve').ok, true); // Logistic lain boleh
  const g = app.call('sub.get', t['5'], { id: mine }).data;
  assert.ok(!g.actions.includes('approve'));
});

test('hanya penyetuju yang berwenang: rekan, kepala lain, logistic di tahap Dept Head, admin', () => {
  const { send, act } = setup();
  const { id } = send('1');
  assert.equal(act('2', id, 'approve').ok, false); // rekan: pengajuan tidak terlihat
  assert.equal(act('7', id, 'approve').ok, false);        // kepala departemen lain
  assert.equal(act('5', id, 'approve').code, 'FORBIDDEN'); // logistic belum gilirannya
  assert.equal(act('8', id, 'approve').code, 'FORBIDDEN'); // admin bukan penyetuju
  assert.equal(act('3', id, 'approve').ok, true);
  assert.equal(act('3', id, 'approve').code, 'FORBIDDEN'); // dua kali
  assert.equal(act('1', id, 'approve').code, 'FORBIDDEN'); // pemohon sendiri
  assert.equal(act('2', id, 'approve').ok, false);         // rekan di tahap Logistic
});

test('tolak: alasan wajib, status Ditolak, alasan terlihat, bisa buka kembali', () => {
  const { send, act, status, app, t } = setup();
  const { id } = send('1');
  assert.match(act('3', id, 'reject', '  ').error, /Alasan penolakan/);
  assert.equal(act('3', id, 'reject', 'Foto kurang jelas').ok, true);
  assert.equal(status(id), 'Ditolak');
  const g = app.call('sub.get', t['1'], { id }).data;
  assert.match(g.lastNote, /Foto kurang jelas/);
  assert.deepEqual(g.actions, ['reopen']);
  assert.equal(act('3', id, 'approve').ok, false);
});

test('buka kembali: jadi Draft, nomor tetap, ubah, kirim ulang mengulang jalur', () => {
  const { send, act, status, app, t } = setup();
  const { id, r } = send('1');
  const number = r.data.number;
  act('3', id, 'approve');
  act('5', id, 'reject', 'Qty tidak sesuai');
  assert.equal(status(id), 'Ditolak');
  assert.equal(act('1', id, 'reopen').ok, true);
  assert.equal(status(id), 'Draft');
  assert.equal(app.call('sub.save', t['1'], { id, source: 'Project', items: [Object.assign({}, ITEM, { qty: '3' })] }).ok, true);
  const again = app.call('sub.submit', t['1'], { id });
  assert.equal(again.data.number, number);
  assert.equal(again.data.status, 'Menunggu Dept Head'); // mulai dari awal
  const acts = app.call('sub.get', t['1'], { id }).data.history.map((h) => h.action);
  assert.deepEqual(acts, ['Draft dibuat', 'Diajukan', 'Disetujui Dept Head', 'Ditolak Logistic', 'Dibuka kembali', 'Diajukan']);
});

test('batal: pemohon boleh sebelum diterima, penyetuju tidak; bisa dibuka kembali', () => {
  const { send, act, status } = setup();
  const a = send('1').id;
  assert.equal(act('3', a, 'cancel').code, 'FORBIDDEN');
  assert.equal(act('1', a, 'cancel', 'salah input').ok, true);
  assert.equal(status(a), 'Dibatalkan');
  assert.equal(act('1', a, 'cancel').ok, false);
  assert.equal(act('1', a, 'reopen').ok, true);
  assert.equal(status(a), 'Draft');
  // setelah disetujui masih bisa dibatalkan
  const b = send('1').id;
  act('3', b, 'approve'); act('5', b, 'approve');
  assert.equal(status(b), 'Disetujui');
  assert.equal(act('1', b, 'cancel').ok, true);
});

test('Selesai tidak bisa dibatalkan', () => {
  const { send, act, app } = setup();
  const { id } = send('1');
  act('3', id, 'approve'); act('5', id, 'approve');
  app.db.tables.Submissions.find((s) => s.ID === id).Status = 'Selesai';
  assert.equal(act('1', id, 'cancel').code, 'FORBIDDEN');
});

test('aksi tidak dikenal dan pengajuan tak terlihat', () => {
  const { send, act } = setup();
  const { id } = send('1');
  assert.match(act('3', id, 'hapussemua').error, /tidak dikenal/);
  assert.equal(act('9', id, 'approve').ok, false);
  assert.equal(act('3', 'S-ngawur', 'approve').ok, false);
});

test('Deputy: dipilih Dept Head, boleh menyetujui, tercatat, tidak bisa untuk dept lain', () => {
  const { send, act, app, t, status } = setup();
  const set = (nik, department, deputy) => app.call('dept.setDeputy', t[nik], { department, nik: deputy });
  const m = app.call('dept.mine', t['3']).data;
  assert.equal(m.length, 1);
  assert.equal(m[0].department, 'Mechanical Maintenance');
  assert.ok(m[0].candidates.some((c) => c.nik === '4'));
  assert.ok(!m[0].candidates.some((c) => c.nik === '3'));
  assert.equal(set('3', 'Mechanical Maintenance', '4').data.deputyName, 'Deputi Mek');
  assert.equal(app.db.departments[0].DeputyNIK, '4');

  const { id } = send('1');
  assert.equal(act('4', id, 'approve').ok, true);
  assert.equal(status(id), 'Menunggu Logistic');
  const h = app.call('sub.get', t['1'], { id }).data.history.map((x) => x.action);
  assert.ok(h.includes('Disetujui Dept Head (Deputy)'));
  // deputi tidak berwenang atas departemen lain
  const other = send('9').id;
  assert.equal(act('4', other, 'approve').ok, false);
});

test('Deputy: validasi dan hak mengatur', () => {
  const { app, t } = setup();
  const set = (nik, department, deputy) => app.call('dept.setDeputy', t[nik], { department, nik: deputy });
  assert.equal(set('2', 'Mechanical Maintenance', '4').code, 'FORBIDDEN'); // bukan kepala
  assert.equal(set('7', 'Mechanical Maintenance', '4').code, 'FORBIDDEN'); // kepala lain
  assert.match(set('3', 'Mechanical Maintenance', '9').error, /departemen yang sama/);
  assert.match(set('3', 'Mechanical Maintenance', '3').error, /sendiri/);
  assert.match(set('3', 'Mechanical Maintenance', '999').error, /departemen yang sama/);
  assert.equal(set('8', 'Mechanical Maintenance', '4').ok, true); // admin boleh
  assert.equal(set('3', 'Mechanical Maintenance', '').data.deputyNik, ''); // cabut
  assert.equal(app.db.departments[0].DeputyNIK, '');
  assert.equal(app.call('dept.mine', t['1']).data.length, 0);
});

test('Deputy dicabut: tidak bisa menyetujui lagi', () => {
  const { send, act, app, t } = setup();
  app.call('dept.setDeputy', t['3'], { department: 'Mechanical Maintenance', nik: '4' });
  const { id } = send('1');
  app.call('dept.setDeputy', t['3'], { department: 'Mechanical Maintenance', nik: '' });
  assert.equal(act('4', id, 'approve').ok, false);
});

test('antrean: Dept Head lihat tahap kepala, Logistic tahap Logistic, sendiri dikecualikan', () => {
  const { send, act, app, t } = setup();
  const a = send('1').id;
  const b = send('9').id;
  const c = send('3').id;
  const inbox = (nik) => app.call('inbox', t[nik]).data.map((x) => x.id).sort();
  assert.deepEqual(inbox('3'), [a]);
  assert.deepEqual(inbox('7'), [b]);
  assert.deepEqual(inbox('5'), [c]);
  assert.deepEqual(inbox('2'), []);
  act('3', a, 'approve');
  assert.deepEqual(inbox('3'), []);
  assert.deepEqual(inbox('5'), [a, c].sort());
  const own = send('5').id; // Logistic mengajukan sendiri: tidak muncul di antreannya sendiri
  assert.ok(!inbox('5').includes(own));
  assert.ok(inbox('6').includes(own));
});

test('daftar semua: sesuai hak lihat, tanpa draft orang lain', () => {
  const { send, app, t } = setup();
  send('1'); send('9');
  app.call('sub.save', t['2'], { source: 'Outage', items: [ITEM] }); // draft rekan
  const ids = (nik) => app.call('sub.listVisible', t[nik]).data.length;
  assert.equal(ids('1'), 1);
  assert.equal(ids('2'), 1); // hanya drafnya sendiri
  assert.equal(ids('3'), 1);
  assert.equal(ids('7'), 1);
  assert.equal(ids('5'), 2);
  assert.equal(ids('8'), 2);
});

test('menunggu siapa: tampil nama Dept Head dan Deputy', () => {
  const { send, app, t } = setup();
  app.call('dept.setDeputy', t['3'], { department: 'Mechanical Maintenance', nik: '4' });
  const { id } = send('1');
  assert.equal(app.call('sub.get', t['1'], { id }).data.waitingFor, 'Dept. Head Kepala Mek / Deputy Deputi Mek');
});
