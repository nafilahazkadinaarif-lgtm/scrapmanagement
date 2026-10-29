'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, user } = require('./harness');

const PW = 'warehouseportal';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

function setup() {
  const users = [
    user({ NIK: '1', Name: 'Mek Satu', Department: 'Mechanical Maintenance' }),
    user({ NIK: '2', Name: 'Listrik Satu', Department: 'Electrical Maintenance', DeptCode: 'ELC' }),
    user({ NIK: '3', Name: 'Kepala Mek', Department: 'Mechanical Maintenance', Level: '3. Departement Head' }),
    user({ NIK: '5', Name: 'Logistik', Department: 'Warehouse & Logistic', DeptCode: 'LOG', IsLogistic: true }),
    user({ NIK: '8', Name: 'Div Head', Department: 'Operation', DeptCode: 'OP1', Level: '4. Division Head' })
  ];
  const app = createApp(users);
  app.db.departments = [
    { Department: 'Mechanical Maintenance', DeptCode: 'MMM', HeadNIK: '3', DeputyNIK: '' },
    { Department: 'Electrical Maintenance', DeptCode: 'ELC', HeadNIK: '', DeputyNIK: '' }
  ];
  const t = {};
  users.forEach((u) => {
    t[u.NIK] = app.call('login', null, { nik: u.NIK, password: PW }).data.token;
    app.db.users.find((x) => x.NIK === u.NIK).MustChange = false;
  });
  const send = (nik, source, items, when) => {
    const id = app.call('sub.save', t[nik], { source, sourceOther: source === 'Other' ? 'x' : '', items }).data.id;
    app.call('sub.addPhoto', t[nik], { id, data: JPG });
    app.call('sub.submit', t[nik], { id });
    const row = app.db.tables.Submissions.find((s) => s.ID === id);
    if (when) row.SubmittedAt = when;
    return row;
  };
  const it = (d, q, u) => ({ description: d, qty: q, uom: u || 'PC', reason: 'r' });
  return { app, t, send, it };
}

function seed() {
  const c = setup();
  const { send, it } = c;
  const a = send('1', 'Outage', [it('Bearing', '2'), it('Seal', '1,5', 'KG')], '2026-03-10T02:00:00.000Z');
  const b = send('1', 'Project', [it('Pompa', '1')], '2026-03-20T02:00:00.000Z');
  const d = send('2', 'Routine Usage', [it('Kabel', '10', 'M')], '2026-05-02T02:00:00.000Z');
  const e = send('2', 'Outage', [it('Lampu', '4')], '2025-12-31T20:00:00.000Z'); // 1 Jan 2026 WITA
  const f = send('2', 'Outage', [it('Fan', '1')], '2025-12-31T10:00:00.000Z'); // 31 Des 2025 WITA
  // baris di db diganti salinan baru tiap penulisan, jadi cari ulang berdasarkan ID
  const setStatus = (row, status) => { c.app.db.tables.Submissions.find((x) => x.ID === row.ID).Status = status; };
  setStatus(a, 'Selesai'); setStatus(b, 'Ditolak'); setStatus(d, 'Disetujui'); setStatus(e, 'Menunggu Logistic'); setStatus(f, 'Selesai');
  return c;
}

const rep = (c, who, p) => c.app.call('report', c.t[who], p);

test('rekap bulan: hitung pengajuan, item, per departemen dan sumber', () => {
  const c = seed();
  const r = rep(c, '5', { year: 2026, month: 3 }).data;
  assert.equal(r.period.label, 'Maret 2026');
  assert.equal(r.totals.count, 2);
  assert.equal(r.totals.items, 3);
  assert.deepEqual(r.totals.byStatus, { Selesai: 1, Ditolak: 1 });
  assert.deepEqual(r.byDepartment, [{ department: 'Mechanical Maintenance', count: 2, items: 3 }]);
  assert.deepEqual(r.bySource.map((s) => s.source).sort(), ['Outage', 'Project']);
  assert.deepEqual(r.byUom, [{ uom: 'KG', qty: 1.5 }, { uom: 'PC', qty: 3 }]);
  assert.equal(r.rows.length, 3);
  assert.equal(r.rows[0].description, 'Bearing');
  assert.equal(r.byMonth.length, 0);
});

test('rekap tahun: rincian per bulan, batas tahun mengikuti WITA', () => {
  const c = seed();
  const r = rep(c, '5', { year: 2026, month: 0 }).data;
  assert.equal(r.totals.count, 4); // 31 Des 2025 WITA tidak ikut, 1 Jan 2026 WITA ikut
  assert.equal(r.byMonth.length, 12);
  assert.equal(r.byMonth[0].count, 1);  // Jan
  assert.equal(r.byMonth[2].count, 2);  // Mar
  assert.equal(r.byMonth[4].count, 1);  // Mei
  assert.equal(r.byMonth[5].count, 0);
  assert.equal(r.byMonth.reduce((n, m) => n + m.count, 0), 4);
  const y25 = rep(c, '5', { year: 2025 }).data;
  assert.equal(y25.totals.count, 1);
});

test('rekap: filter status', () => {
  const c = seed();
  const r = rep(c, '5', { year: 2026, status: 'Selesai' }).data;
  assert.equal(r.totals.count, 1);
  assert.equal(r.submissions[0].status, 'Selesai');
});

test('rekap: draft dan yang dihapus tidak dihitung', () => {
  const c = seed();
  c.app.call('sub.save', c.t['1'], { source: 'Outage', items: [c.it('Draf', '1')] });
  const gone = c.app.call('sub.save', c.t['1'], { source: 'Outage', items: [c.it('Hapus', '1')] }).data.id;
  c.app.call('sub.deleteDraft', c.t['1'], { id: gone });
  assert.equal(rep(c, '5', { year: 2026 }).data.totals.count, 4);
});

test('rekap: cakupan mengikuti hak lihat', () => {
  const c = seed();
  const count = (who) => rep(c, who, { year: 2026 }).data.totals.count;
  assert.equal(count('5'), 4); // Logistic
  assert.equal(count('8'), 4); // Division Head
  assert.equal(count('3'), 2); // Dept Head Mekanik: hanya departemennya
  assert.equal(count('1'), 2); // pemohon: miliknya
  assert.equal(count('2'), 2); // pemohon Listrik: miliknya (2 di 2026)
});

test('rekap: daftar tahun, parameter ngawur jatuh ke nilai aman', () => {
  const c = seed();
  const r = rep(c, '5', { year: 'abc', month: 99, status: '' }).data;
  assert.equal(r.period.year, new Date().getFullYear());
  assert.equal(r.period.month, 0);
  assert.ok(r.years.includes(2025) && r.years.includes(2026));
  assert.deepEqual(r.years, r.years.slice().sort((x, y) => y - x));
});

test('rekap kosong tidak error', () => {
  const c = setup();
  const r = rep(c, '5', { year: 2026, month: 1 }).data;
  assert.equal(r.totals.count, 0);
  assert.deepEqual(r.rows, []);
  assert.deepEqual(r.byDepartment, []);
});
