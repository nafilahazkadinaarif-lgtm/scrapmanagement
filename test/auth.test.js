'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, user } = require('./harness');

const DEFAULT_PW = 'warehouseportal';

function login(app, nik, pw) {
  return app.call('login', null, { nik, password: pw });
}

test('hash: sama input sama hasil, salt beda hasil beda, benar vs salah', () => {
  const app = createApp([]);
  const a = app.eval("Sec.hashPassword('rahasia123', 'salt1')");
  assert.equal(a, app.eval("Sec.hashPassword('rahasia123', 'salt1')"));
  assert.notEqual(a, app.eval("Sec.hashPassword('rahasia123', 'salt2')"));
  assert.notEqual(a, app.eval("Sec.hashPassword('rahasia124', 'salt1')"));
  assert.equal(a.length, 64);
});

test('hex byte bertanda: -1 jadi ff, 5 jadi 05', () => {
  const app = createApp([]);
  assert.equal(app.eval('Sec.toHex([-1, 5, -128, 127])'), 'ff0580' + '7f');
});

test('login pertama: password awal berhasil dan wajib ganti', () => {
  const app = createApp([user()]);
  const r = login(app, '100001', DEFAULT_PW);
  assert.equal(r.ok, true);
  assert.equal(r.data.user.mustChange, true);
  assert.ok(r.data.token);
});

test('login: password salah ditolak dengan pesan umum', () => {
  const app = createApp([user()]);
  const r = login(app, '100001', 'salah');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'NIK atau password salah.');
  assert.equal(login(app, '555000', 'x').error, 'NIK atau password salah.');
});

test('login: NIK dengan angka 0 di depan dipertahankan persis', () => {
  const app = createApp([user({ NIK: '007546' })]);
  assert.equal(login(app, '007546', DEFAULT_PW).ok, true);
  assert.equal(login(app, '07546', DEFAULT_PW).ok, false);
});

test('login: status No login ditolak', () => {
  const app = createApp([user({ Status: 'No login' })]);
  const r = login(app, '100001', DEFAULT_PW);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'DISABLED');
});

test('kunci akun setelah 5 kali salah, terbuka setelah 15 menit', () => {
  const app = createApp([user()]);
  for (let i = 0; i < 5; i++) login(app, '100001', 'salah');
  const locked = login(app, '100001', DEFAULT_PW);
  assert.equal(locked.ok, false);
  assert.equal(locked.code, 'LOCKED');
  app.advance(16 * 60000);
  assert.equal(login(app, '100001', DEFAULT_PW).ok, true);
});

test('ganti password: aturan password baru', () => {
  const app = createApp([user({ NIK: '12345678' })]);
  const token = login(app, '12345678', DEFAULT_PW).data.token;
  const change = (o, n) => app.call('changePassword', token, { oldPassword: o, newPassword: n });
  assert.match(change(DEFAULT_PW, 'pendek').error, /minimal 8/);
  assert.match(change(DEFAULT_PW, DEFAULT_PW).error, /password awal/);
  assert.match(change(DEFAULT_PW, '12345678').error, /NIK/);
  assert.match(change('bukanlama', 'passwordBaru1').error, /lama salah/);
});

test('ganti password: sukses, token lama mati, login password baru jalan', () => {
  const app = createApp([user()]);
  const first = login(app, '100001', DEFAULT_PW).data.token;
  const r = app.call('changePassword', first, { oldPassword: DEFAULT_PW, newPassword: 'passwordBaru1' });
  assert.equal(r.ok, true);
  assert.equal(r.data.user.mustChange, false);
  assert.equal(app.call('me', first).code, 'SESSION');
  assert.equal(app.call('me', r.data.token).ok, true);
  assert.equal(login(app, '100001', DEFAULT_PW).ok, false);
  const again = login(app, '100001', 'passwordBaru1');
  assert.equal(again.ok, true);
  assert.equal(again.data.user.mustChange, false);
  assert.equal(app.db.users[0].PassHash.length, 64);
});

test('wajib ganti password: aksi lain diblokir sampai password diganti', () => {
  const app = createApp([user({ Role: 'Admin' })]);
  const token = login(app, '100001', DEFAULT_PW).data.token;
  assert.equal(app.call('admin.listUsers', token).code, 'MUST_CHANGE');
  app.call('changePassword', token, { oldPassword: DEFAULT_PW, newPassword: 'passwordBaru1' });
  const t2 = login(app, '100001', 'passwordBaru1').data.token;
  assert.equal(app.call('admin.listUsers', t2).ok, true);
});

test('token: dirusak ditolak, kedaluwarsa ditolak', () => {
  const app = createApp([user()]);
  const token = login(app, '100001', DEFAULT_PW).data.token;
  assert.equal(app.call('me', token + 'x').code, 'SESSION');
  assert.equal(app.call('me', '').code, 'SESSION');
  assert.equal(app.call('me', token).ok, true);
  app.advance(9 * 3600 * 1000);
  assert.equal(app.call('me', token).code, 'SESSION');
});

test('akun dinonaktifkan: token yang masih berlaku ikut mati', () => {
  const app = createApp([user()]);
  const token = login(app, '100001', DEFAULT_PW).data.token;
  app.db.users[0].Status = 'No login';
  assert.equal(app.call('me', token).code, 'SESSION');
});

test('saran nama: min 3 huruf, hanya akun aktif, cocok nama atau nickname', () => {
  const app = createApp([
    user({ NIK: '1', Name: 'Ahmad Munandar', Nickname: 'A. Munandar' }),
    user({ NIK: '2', Name: 'Ahmad Fauzi', Nickname: 'Fauzi' }),
    user({ NIK: '3', Name: 'Ahmad Lama', Status: 'No login' })
  ]);
  assert.equal(app.call('suggest', null, { q: 'ah' }).data.length, 0);
  const r = app.call('suggest', null, { q: 'ahmad' }).data;
  assert.deepEqual(r.map((x) => x.nik).sort(), ['1', '2']);
  assert.equal(app.call('suggest', null, { q: 'fauz' }).data[0].nik, '2');
  assert.equal(r[0].PassHash, undefined);
});
