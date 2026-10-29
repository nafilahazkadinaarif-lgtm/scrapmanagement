'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { build } = require('../tools/build-bundle');

const DIST = path.join(__dirname, '..', 'dist');

test('bundel dist/ sama dengan hasil build dari src/ (jalankan npm run build jika gagal)', () => {
  const out = build();
  Object.keys(out).forEach((name) => {
    assert.equal(fs.readFileSync(path.join(DIST, name), 'utf8'), out[name], name + ' kedaluwarsa');
  });
});

test('bundel: Code.gs bisa dimuat dan semua titik masuk ada', () => {
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(DIST, 'Code.gs'), 'utf8'), ctx);
  ['doGet', 'include', 'api', 'setupSheets', 'installWeeklyBackup', 'weeklyBackup'].forEach((fn) => {
    assert.equal(vm.runInContext('typeof ' + fn, ctx), 'function', fn);
  });
  ['CFG', 'Sec', 'Repo', 'Roles', 'Validate', 'Workflow', 'Auth', 'Admin', 'Pdf', 'Report', 'Backup', 'Subs', 'Dept', 'Router'].forEach((o) => {
    assert.equal(vm.runInContext('typeof ' + o, ctx), 'object', o);
  });
});

test('bundel: Index.html lengkap, tanpa include/scriptlet tersisa', () => {
  const html = fs.readFileSync(path.join(DIST, 'Index.html'), 'utf8');
  assert.ok(!html.includes('<?'));
  ['<style>', 'viewLogin', 'App.subs', 'viewForm', 'viewReport', 'Scrap Handover Portal'].forEach((t) => assert.ok(html.includes(t), t));
});

test('bundel: appsscript.json identik dengan src dan valid', () => {
  const m = JSON.parse(fs.readFileSync(path.join(DIST, 'appsscript.json'), 'utf8'));
  assert.equal(m.webapp.access, 'ANYONE_ANONYMOUS');
  assert.equal(m.webapp.executeAs, 'USER_DEPLOYING');
  assert.ok(m.oauthScopes.some((s) => s.endsWith('/script.scriptapp')));
});
