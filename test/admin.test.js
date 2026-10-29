'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, user } = require('./harness');

const DEFAULT_PW = 'warehouseportal';

function adminApp(extra) {
  const app = createApp([
    user({ NIK: '900001', Name: 'Super Admin', Role: 'Super Admin', Level: '3. Departement Head',
      Department: 'Warehouse & Logistic', DeptCode: 'LOG', PassHash: '', MustChange: false })
  ].concat(extra || []));
  // admin sudah punya password sendiri
  const salt = 'saltadmin';
  app.db.users[0].PassSalt = salt;
  app.db.users[0].PassHash = app.eval("Sec.hashPassword('adminPass123', '" + salt + "')");
  const token = app.call('login', null, { nik: '900001', password: 'adminPass123' }).data.token;
  return { app, token };
}

test('roles: level diturunkan dari teks Level', () => {
  const app = createApp([]);
  const d = (level, extra) => app.eval(`Roles.derive(${JSON.stringify(Object.assign({ Level: level, Role: 'User' }, extra))})`);
  assert.equal(d('3. Departement Head').isDeptHead, true);
  assert.equal(d('4. Division Head').isDivisionHead, true);
  assert.equal(d('5. Management').isManagement, true);
  assert.equal(d('2. Planner').isDeptHead, false);
  assert.equal(d('1. User Non Planner', { Role: 'Admin' }).isAdmin, true);
  assert.equal(d('1. User Non Planner', { Role: 'Super Admin' }).isSuperAdmin, true);
  assert.equal(d('', {}).level, 1);
});

test('admin: non-admin ditolak', () => {
  const app = createApp([user()]);
  const t = app.call('login', null, { nik: '100001', password: DEFAULT_PW }).data.token;
  app.call('changePassword', t, { oldPassword: DEFAULT_PW, newPassword: 'passwordBaru1' });
  const t2 = app.call('login', null, { nik: '100001', password: 'passwordBaru1' }).data.token;
  assert.equal(app.call('admin.listUsers', t2).code, 'FORBIDDEN');
  assert.equal(app.call('admin.importUsers', t2, { rows: [{ NIK: '1', Name: 'x' }] }).code, 'FORBIDDEN');
});

test('admin: daftar akun tidak membocorkan hash', () => {
  const { app, token } = adminApp([user()]);
  const r = app.call('admin.listUsers', token);
  assert.equal(r.ok, true);
  assert.equal(r.data.length, 2);
  r.data.forEach((u) => { assert.equal(u.PassHash, undefined); assert.equal(u.passHash, undefined); });
});

test('admin: ubah status dan penanda Logistic; tidak bisa nonaktifkan diri sendiri', () => {
  const { app, token } = adminApp([user()]);
  assert.equal(app.call('admin.updateUser', token, { nik: '100001', isLogistic: true }).data.isLogistic, true);
  assert.equal(app.db.users[1].IsLogistic, true);
  assert.equal(app.call('admin.updateUser', token, { nik: '100001', status: 'No login' }).data.status, 'No login');
  assert.equal(app.call('admin.updateUser', token, { nik: '100001', status: 'Aneh' }).ok, false);
  assert.match(app.call('admin.updateUser', token, { nik: '900001', status: 'No login' }).error, /sendiri/);
});

test('admin: reset password kembali ke password awal dan wajib ganti', () => {
  const { app, token } = adminApp([user({ PassHash: 'abc', PassSalt: 'x', FailCount: 3 })]);
  assert.equal(app.call('admin.resetPassword', token, { nik: '100001' }).ok, true);
  const r = app.call('login', null, { nik: '100001', password: DEFAULT_PW });
  assert.equal(r.ok, true);
  assert.equal(r.data.user.mustChange, true);
});

const FILE_ROWS = [
  { Name: 'Kepala Satu', Nickname: 'Kepala S.', Email: 'a@x.id', NIK: '700001', 'Dept Code': 'CAH', Department: 'Coal Handling & Jetty', Level: '3. Departement Head', Role: 'User', Status: 'Active' },
  { Name: 'Staf Dua', Nickname: 'S. Dua', NIK: '700002', 'Dept Code': 'CAH', Department: 'Coal Handling & Jetty', Level: '2. Planner', Role: 'User', Status: 'Active' },
  { Name: 'Staf Tiga', NIK: '007546', 'Dept Code': 'LOG', Department: 'Warehouse & Logistic', Level: '2. Planner', Role: 'Admin', Status: 'Active' },
  { Name: 'Orang Civil', NIK: '300001', 'Dept Code': 'MMM', Department: 'Civil Maintenance', Level: '1. User Non Planner', Role: 'User', Status: 'Active' },
  { Name: 'Staf Mgmt A', NIK: '400001', 'Dept Code': 'PPS', Department: 'Management', Level: '5. Management', Role: 'User', Status: 'Active' },
  { Name: 'Staf Mgmt B', NIK: '400002', 'Dept Code': 'PPS', Department: 'Management', Level: '5. Management', Role: 'User', Status: 'Active' },
  { Name: 'Test Dept', NIK: '000003', 'Dept Code': 'DEPT', Department: 'Department', Level: '3. Departement Head', Role: 'User', Status: 'Active' },
  { Name: 'Tanpa NIK', NIK: '', Department: 'X' },
  { Name: 'Ganda', NIK: '700002', Department: 'Coal Handling & Jetty' }
];

test('impor: tambah, kecualikan akun uji, lewati baris rusak dan ganda', () => {
  const { app, token } = adminApp();
  const r = app.call('admin.importUsers', token, { rows: FILE_ROWS });
  assert.equal(r.ok, true);
  assert.equal(r.data.added, 6);
  assert.equal(r.data.excluded, 1);
  assert.equal(r.data.skipped.length, 2);
  const stafTiga = app.db.users.find((u) => u.Name === 'Staf Tiga');
  assert.equal(stafTiga.NIK, '007546');
  assert.equal(stafTiga.PassHash, '');
  assert.equal(stafTiga.MustChange, true);
  assert.equal(stafTiga.IsLogistic, false);
  assert.equal(app.db.users.find((u) => u.Name === 'Test Dept'), undefined);
});

test('impor: departemen per nama, Dept. Head dan Dept. Head sementara', () => {
  const { app, token } = adminApp();
  app.call('admin.importUsers', token, { rows: FILE_ROWS });
  const dep = (n) => app.db.departments.find((d) => d.Department === n);
  assert.equal(dep('Coal Handling & Jetty').HeadNIK, '700001');
  assert.equal(dep('Civil Maintenance').HeadNIK, '300001');
  assert.equal(dep('Management').HeadNIK, '');
  assert.equal(dep('Warehouse & Logistic').HeadNIK, '900001');
});

test('impor ulang: profil diperbarui, password/Logistic/status tidak ditimpa secara default', () => {
  const { app, token } = adminApp();
  app.call('admin.importUsers', token, { rows: FILE_ROWS });
  const u = app.db.users.find((x) => x.NIK === '700002');
  u.PassHash = 'h'.repeat(64); u.PassSalt = 's'; u.IsLogistic = true; u.Status = 'No login'; u.MustChange = false;
  const rows = [Object.assign({}, FILE_ROWS[1], { Name: 'Staf Dua Baru', Status: 'Active', Role: 'Admin' })];
  const r = app.call('admin.importUsers', token, { rows });
  assert.equal(r.data.updated, 1);
  const after = app.db.users.find((x) => x.NIK === '700002');
  assert.equal(after.Name, 'Staf Dua Baru');
  assert.equal(after.PassHash, 'h'.repeat(64));
  assert.equal(after.IsLogistic, true);
  assert.equal(after.Status, 'No login');
  assert.equal(after.Role, 'User');
  app.call('admin.importUsers', token, { rows, overwriteStatusRole: true });
  const forced = app.db.users.find((x) => x.NIK === '700002');
  assert.equal(forced.Status, 'Active');
  assert.equal(forced.Role, 'Admin');
});

test('impor ulang: departemen yang sudah ada tidak ditimpa/digandakan', () => {
  const { app, token } = adminApp();
  app.call('admin.importUsers', token, { rows: FILE_ROWS });
  const n = app.db.departments.length;
  app.db.departments.find((d) => d.Department === 'Management').HeadNIK = '400001';
  const r = app.call('admin.importUsers', token, { rows: FILE_ROWS });
  assert.equal(r.data.departmentsAdded, 0);
  assert.equal(app.db.departments.length, n);
  assert.equal(app.db.departments.find((d) => d.Department === 'Management').HeadNIK, '400001');
});

test('impor: kolom judul fleksibel dan nilai tidak valid dinormalkan', () => {
  const { app, token } = adminApp();
  const rows = [{ ' nik ': '555555', NAME: 'Uji Kolom', 'dept code': 'ELC', DEPARTMENT: 'Electrical Maintenance', LEVEL: '', ROLE: 'Dewa', STATUS: 'Aneh' }];
  const r = app.call('admin.importUsers', token, { rows });
  assert.equal(r.data.added, 1);
  const u = app.db.users.find((x) => x.NIK === '555555');
  assert.equal(u.Role, 'User');
  assert.equal(u.Status, 'Active');
  assert.equal(u.Level, '1. User Non Planner');
  assert.equal(u.DeptCode, 'ELC');
  assert.equal(app.call('admin.importUsers', token, { rows: [] }).ok, false);
});
