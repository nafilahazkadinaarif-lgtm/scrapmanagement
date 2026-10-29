'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, user } = require('./harness');

const PW = 'warehouseportal';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

function setup() {
  const users = [
    user({ NIK: '1', Name: 'Pemohon <b>Satu</b>', Department: 'Mechanical Maintenance' }),
    user({ NIK: '2', Name: 'Rekan', Department: 'Mechanical Maintenance' }),
    user({ NIK: '3', Name: 'Kepala Mek', Department: 'Mechanical Maintenance', Level: '3. Departement Head' }),
    user({ NIK: '5', Name: 'Logistik A', Department: 'Warehouse & Logistic', DeptCode: 'LOG', IsLogistic: true }),
    user({ NIK: '6', Name: 'Logistik B', Department: 'Warehouse & Logistic', DeptCode: 'LOG', IsLogistic: true }),
    user({ NIK: '7', Name: 'Kepala Logistik', Department: 'Warehouse & Logistic', DeptCode: 'LOG', Level: '3. Departement Head' }),
    user({ NIK: '9', Name: 'Orang Lain', Department: 'Electrical Maintenance', DeptCode: 'ELC' })
  ];
  const app = createApp(users);
  app.db.departments = [
    { Department: 'Mechanical Maintenance', DeptCode: 'MMM', HeadNIK: '3', DeputyNIK: '' },
    { Department: 'Warehouse & Logistic', DeptCode: 'LOG', HeadNIK: '7', DeputyNIK: '' },
    { Department: 'Electrical Maintenance', DeptCode: 'ELC', HeadNIK: '', DeputyNIK: '' }
  ];
  const t = {};
  users.forEach((u) => {
    t[u.NIK] = app.call('login', null, { nik: u.NIK, password: PW }).data.token;
    app.db.users.find((x) => x.NIK === u.NIK).MustChange = false;
  });
  const item = { materialNo: '10002003', description: 'Bearing <script>alert(1)</script>', qty: '2,5', uom: 'PC', reason: 'Aus & rusak' };
  const send = (nik) => {
    const id = app.call('sub.save', t[nik], { source: 'Other', sourceOther: 'Banjir', items: [item] }).data.id;
    app.call('sub.addPhoto', t[nik], { id, data: JPG });
    app.call('sub.addPhoto', t[nik], { id, data: JPG });
    app.call('sub.submit', t[nik], { id });
    return id;
  };
  const act = (nik, id, action, note) => app.call('sub.act', t[nik], { id, action, note });
  const status = (id) => app.db.tables.Submissions.find((s) => s.ID === id).Status;
  const approved = () => { const id = send('1'); act('3', id, 'approve'); act('5', id, 'approve'); return id; };
  return { app, t, send, act, status, approved };
}

test('konfirmasi terima: hanya Logistic, hanya setelah Disetujui, menjadi Selesai', () => {
  const { act, status, send, approved, app, t } = setup();
  const early = send('1');
  assert.equal(act('5', early, 'receive').code, 'FORBIDDEN'); // belum disetujui
  const id = approved();
  assert.equal(status(id), 'Disetujui');
  assert.equal(act('3', id, 'receive').code, 'FORBIDDEN');  // Dept Head bukan Logistic
  assert.equal(act('1', id, 'receive').code, 'FORBIDDEN');  // pemohon
  assert.equal(act('6', id, 'receive', 'diterima di gudang').ok, true);
  assert.equal(status(id), 'Selesai');
  assert.equal(act('5', id, 'receive').code, 'FORBIDDEN');  // dua kali
  assert.equal(act('1', id, 'cancel').code, 'FORBIDDEN');   // sudah diterima, tidak bisa batal
  const g = app.call('sub.get', t['1'], { id }).data;
  assert.equal(g.history[g.history.length - 1].action, 'Diterima Logistic');
  assert.equal(g.history[g.history.length - 1].byName, 'Logistik B');
});

test('Logistic tidak boleh mengonfirmasi terima pengajuannya sendiri', () => {
  const { act, send, status } = setup();
  const id = send('5');
  assert.equal(act('7', id, 'approve').ok, true); // Dept Head Logistic dulu
  assert.equal(act('5', id, 'approve').code, 'FORBIDDEN');
  assert.equal(act('6', id, 'approve').ok, true);
  assert.equal(act('5', id, 'receive').code, 'FORBIDDEN');
  assert.equal(act('6', id, 'receive').ok, true);
  assert.equal(status(id), 'Selesai');
});

test('antrean Logistic berisi yang menunggu terima; pemohon melihat status menunggu siapa', () => {
  const { approved, app, t } = setup();
  const id = approved();
  assert.deepEqual(app.call('inbox', t['5']).data.map((x) => x.id), [id]);
  assert.deepEqual(app.call('inbox', t['3']).data, []);
  assert.match(app.call('sub.get', t['1'], { id }).data.waitingFor, /konfirmasi terima/);
});

test('PDF: hanya yang berhak, bukan draft', () => {
  const { approved, app, t } = setup();
  const id = approved();
  const draft = app.call('sub.save', t['1'], { source: 'Outage', items: [{ description: 'x', qty: 1, uom: 'PC', reason: 'y' }] }).data.id;
  assert.match(app.call('sub.pdf', t['1'], { id: draft }).error, /Kirim pengajuan dulu/);
  assert.equal(app.call('sub.pdf', t['9'], { id }).ok, false);
  assert.equal(app.call('sub.pdf', t['2'], { id }).ok, false);
  const r = app.call('sub.pdf', t['5'], { id });
  assert.equal(r.ok, true);
  assert.match(r.data.filename, /^SCR-\d{4}-0001\.pdf$/);
  assert.ok(r.data.base64.length > 100);
});

function htmlOf(app, t, who, id) {
  const r = app.call('sub.pdf', t[who], { id });
  return Buffer.from(r.data.base64, 'base64').toString('utf8');
}

test('PDF: isi lengkap, HTML dari pengguna di-escape', () => {
  const { approved, app, t, act } = setup();
  const id = approved();
  act('6', id, 'receive');
  const html = htmlOf(app, t, '1', id);
  assert.match(html, /FORM HANDOVER SCRAP MATERIAL/);
  assert.match(html, /SCR-\d{4}-0001/);
  assert.match(html, /10002003/);
  assert.match(html, /2,5/);
  assert.match(html, /Banjir/);
  assert.match(html, /Aus &amp; rusak/);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<b>Satu</b>'));
  assert.match(html, /&lt;script&gt;/);
  assert.equal((html.match(/<img /g) || []).length, 2);
  assert.match(html, /Selesai/);
});

test('PDF: empat kolom tanda tangan dengan nama yang benar', () => {
  const { approved, app, t, act } = setup();
  const id = approved();
  act('6', id, 'receive');
  const html = htmlOf(app, t, '5', id);
  ['Pemohon', 'Dept. Head', 'Logistic Staff (Penerima)', 'Logistic Dept. Head'].forEach((c) => assert.ok(html.includes(c), c));
  assert.match(html, /\(Kepala Mek\)/);
  assert.match(html, /\(Logistik B\)/);          // penerima
  assert.match(html, /\(Kepala Logistik\)/);     // Logistic Dept Head dari data departemen
  assert.match(html, /Diterima Logistic/);
  assert.match(html, /Disetujui Dept Head/);
});

test('PDF: sebelum disetujui kolom belum terisi nama approver', () => {
  const { send, app, t } = setup();
  const id = send('1');
  const html = htmlOf(app, t, '5', id);
  assert.match(html, /\(Kepala Mek\)/);        // nama Dept Head departemen tetap tercetak
  assert.match(html, /\(\.{5,}\)/);            // Logistic Staff masih kosong
  assert.ok(!html.includes('Riwayat Persetujuan'));
});

test('format tanggal WITA', () => {
  const { app } = setup();
  assert.equal(app.eval("Pdf.fmt_('2026-10-29T06:05:00.000Z', true)"), '29 Okt 2026 14:05');
  assert.equal(app.eval("Pdf.fmt_('2026-12-31T20:00:00.000Z', false)"), '1 Jan 2027');
  assert.equal(app.eval("Pdf.fmt_('', true)"), '');
  assert.equal(app.eval("Pdf.fmt_('bukan tanggal', true)"), '');
});
