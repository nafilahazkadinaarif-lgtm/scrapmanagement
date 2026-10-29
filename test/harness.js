'use strict';
// Memuat file .gs ke konteks vm dengan tiruan Utilities dan Repo (memori),
// sehingga logika inti bisa diuji tanpa Google.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SRC = path.join(__dirname, '..', 'src');
const FILES = ['Config.gs', 'Sec.gs', 'Repo.gs', 'Roles.gs', 'Validate.gs', 'Workflow.gs', 'Auth.gs', 'Admin.gs', 'Pdf.gs', 'Subs.gs', 'Dept.gs', 'Router.gs', 'Code.gs', 'Setup.gs'];

function signedBytes(buf) {
  return Array.from(buf, (b) => (b > 127 ? b - 256 : b));
}

const Utilities = {
  DigestAlgorithm: { SHA_256: 'sha256' },
  Charset: { UTF_8: 'utf8' },
  computeDigest: (alg, value) => signedBytes(crypto.createHash('sha256').update(String(value), 'utf8').digest()),
  computeHmacSha256Signature: (value, key) =>
    signedBytes(crypto.createHmac('sha256', String(key)).update(String(value), 'utf8').digest()),
  getUuid: () => crypto.randomUUID()
};

function createApp(seedUsers) {
  const ctx = vm.createContext({ Utilities, console, Buffer_: Buffer });
  for (const f of FILES) {
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  }

  const db = {
    users: JSON.parse(JSON.stringify(seedUsers || [])),
    departments: [],
    tables: {},
    folders: {},
    files: {},
    seq: 0
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // Ganti Repo dengan versi memori
  ctx.__db = db;
  ctx.__clone = clone;
  vm.runInContext(`
    Repo.withLock = function (fn) { return fn(); };
    Repo.getSecret = function () { return 'test-secret'; };
    Repo.allUsers = function () { return __clone(__db.users); };
    Repo.saveUser = function (u) {
      var c = __clone(u);
      var i = __db.users.findIndex(function (x) { return x.NIK === c.NIK; });
      if (i >= 0) __db.users[i] = c; else __db.users.push(c);
    };
    Repo.replaceAllUsers = function (list) { __db.users = __clone(list); };
    Repo.allDepartments = function () { return __clone(__db.departments); };
    Repo.addDepartments = function (list) { __db.departments = __db.departments.concat(__clone(list)); };
    Repo.replaceDepartments = function (list) { __db.departments = __clone(list); };
    Repo.readTable = function (n) { return __clone(__db.tables[n] || []); };
    Repo.writeTable = function (n, rows) { __db.tables[n] = __clone(rows); };
    Repo.appendRow = function (n, row) { (__db.tables[n] = __db.tables[n] || []).push(__clone(row)); };
    Repo.createFolder = function (name) { var id = 'F' + (++__db.seq); __db.folders[id] = { name: name }; return id; };
    Repo.saveFile = function (folderId, name, mime, b64) {
      var id = 'X' + (++__db.seq); __db.files[id] = { folderId: folderId, name: name, b64: b64 }; return id;
    };
    Repo.readFile = function (id) { return 'data:image/jpeg;base64,' + __db.files[id].b64; };
    Repo.htmlToPdf = function (html, name) { return Buffer_.from(html, 'utf8').toString('base64'); };
    Repo.trashFile = function (id) { delete __db.files[id]; };
    Repo.trashFolder = function (id) { delete __db.folders[id]; };
  `, ctx);

  let clock = Date.now();
  ctx.__clock = () => clock;
  vm.runInContext('Sec.now = function () { return __clock(); };', ctx);

  return {
    ctx,
    db,
    advance: (ms) => { clock += ms; },
    call: (action, token, payload) => clone(ctx.Router.handle(action, token, payload)),
    eval: (code) => vm.runInContext(code, ctx)
  };
}

function user(over) {
  return Object.assign({
    NIK: '100001', Name: 'Budi Santoso', Nickname: 'Budi S.', Email: '', DeptCode: 'MMM',
    Department: 'Mechanical Maintenance', Level: '1. User Non Planner', Role: 'User', Status: 'Active',
    IsLogistic: false, PassHash: '', PassSalt: '', MustChange: false, FailCount: 0, LockUntil: 0, LastLogin: ''
  }, over || {});
}

module.exports = { createApp, user };
