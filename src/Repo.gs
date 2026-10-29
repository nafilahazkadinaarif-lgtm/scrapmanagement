/**
 * Akses Google Sheet. Satu-satunya file yang menyentuh SpreadsheetApp,
 * jadi mudah diganti saat pengujian.
 */
var Repo = {
  db: function () {
    var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
    return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  },

  sheet: function (name) {
    var sh = Repo.db().getSheetByName(name);
    if (!sh) throw new Error('Sheet "' + name + '" belum ada. Jalankan setupSheets().');
    return sh;
  },

  withLock: function (fn) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { return fn(); } finally { lock.releaseLock(); }
  },

  getSecret: function () {
    var props = PropertiesService.getScriptProperties();
    var s = props.getProperty('TOKEN_SECRET');
    if (!s) {
      s = Utilities.getUuid() + Utilities.getUuid();
      props.setProperty('TOKEN_SECRET', s);
    }
    return s;
  },

  // ---- Users ----
  boolOf_: function (v) { return v === true || String(v).toUpperCase() === 'TRUE'; },

  rowToUser_: function (cols, row, rowNumber) {
    var u = { _row: rowNumber };
    for (var i = 0; i < cols.length; i++) {
      var v = row[i];
      u[cols[i]] = (v === null || v === undefined) ? '' : v;
    }
    ['NIK', 'Name', 'Nickname', 'Email', 'DeptCode', 'Department', 'Level', 'Role', 'Status',
      'PassHash', 'PassSalt', 'LastLogin'].forEach(function (k) { u[k] = String(u[k]).trim(); });
    u.IsLogistic = Repo.boolOf_(u.IsLogistic);
    u.MustChange = Repo.boolOf_(u.MustChange);
    u.FailCount = Number(u.FailCount) || 0;
    u.LockUntil = Number(u.LockUntil) || 0;
    return u;
  },

  userToRow_: function (u) {
    return CFG.USER_COLS.map(function (c) {
      var v = u[c];
      if (c === 'LockUntil') return v ? v : '';
      if (c === 'FailCount') return v || 0;
      return v === undefined || v === null ? '' : v;
    });
  },

  allUsers: function () {
    var sh = Repo.sheet(CFG.SHEETS.USERS);
    var last = sh.getLastRow();
    if (last < 2) return [];
    var width = CFG.USER_COLS.length;
    var data = sh.getRange(2, 1, last - 1, width).getValues();
    var users = [];
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === '') continue;
      users.push(Repo.rowToUser_(CFG.USER_COLS, data[i], i + 2));
    }
    return users;
  },

  saveUser: function (u) {
    var sh = Repo.sheet(CFG.SHEETS.USERS);
    var row = u._row || (sh.getLastRow() + 1);
    sh.getRange(row, 1, 1, CFG.USER_COLS.length).setValues([Repo.userToRow_(u)]);
    u._row = row;
  },

  replaceAllUsers: function (users) {
    var sh = Repo.sheet(CFG.SHEETS.USERS);
    var last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, CFG.USER_COLS.length).clearContent();
    if (!users.length) return;
    var rows = users.map(Repo.userToRow_);
    sh.getRange(2, 1, rows.length, CFG.USER_COLS.length).setValues(rows);
    for (var i = 0; i < users.length; i++) users[i]._row = i + 2;
  },

  // ---- Departments ----
  allDepartments: function () {
    var sh = Repo.sheet(CFG.SHEETS.DEPARTMENTS);
    var last = sh.getLastRow();
    if (last < 2) return [];
    var data = sh.getRange(2, 1, last - 1, CFG.DEPT_COLS.length).getValues();
    var out = [];
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === '') continue;
      var d = {};
      CFG.DEPT_COLS.forEach(function (c, j) { d[c] = String(data[i][j]).trim(); });
      out.push(d);
    }
    return out;
  },

  addDepartments: function (list) {
    if (!list.length) return;
    var sh = Repo.sheet(CFG.SHEETS.DEPARTMENTS);
    var rows = list.map(function (d) { return CFG.DEPT_COLS.map(function (c) { return d[c] || ''; }); });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, CFG.DEPT_COLS.length).setValues(rows);
  },

  // ---- Tabel generik (Submissions, Items, Photos, History, UoM) ----
  readTable: function (name) {
    var spec = CFG.TABLES[name];
    var sh = Repo.sheet(name);
    var last = sh.getLastRow();
    if (last < 2) return [];
    var data = sh.getRange(2, 1, last - 1, spec.cols.length).getValues();
    var out = [];
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === '') continue;
      var o = {};
      for (var j = 0; j < spec.cols.length; j++) {
        var c = spec.cols[j], v = data[i][j];
        if (v === null || v === undefined) v = '';
        o[c] = spec.text.indexOf(c) >= 0 || typeof v === 'string' ? String(v).trim() : v;
      }
      out.push(o);
    }
    return out;
  },

  rowOf_: function (spec, obj) {
    return spec.cols.map(function (c) { return obj[c] === undefined || obj[c] === null ? '' : obj[c]; });
  },

  writeTable: function (name, objs) {
    var spec = CFG.TABLES[name];
    var sh = Repo.sheet(name);
    var last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, spec.cols.length).clearContent();
    if (!objs.length) return;
    var rows = objs.map(function (o) { return Repo.rowOf_(spec, o); });
    sh.getRange(2, 1, rows.length, spec.cols.length).setValues(rows);
  },

  appendRow: function (name, obj) {
    var spec = CFG.TABLES[name];
    var sh = Repo.sheet(name);
    sh.getRange(sh.getLastRow() + 1, 1, 1, spec.cols.length).setValues([Repo.rowOf_(spec, obj)]);
  },

  // ---- Google Drive (foto) ----
  rootFolder_: function () {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('PHOTO_FOLDER_ID');
    if (id) {
      try { return DriveApp.getFolderById(id); } catch (e) { /* dibuat ulang di bawah */ }
    }
    var f = DriveApp.createFolder(CFG.PHOTO_FOLDER_NAME);
    props.setProperty('PHOTO_FOLDER_ID', f.getId());
    return f;
  },

  createFolder: function (name) { return Repo.rootFolder_().createFolder(name).getId(); },

  saveFile: function (folderId, name, mime, base64) {
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, name);
    return DriveApp.getFolderById(folderId).createFile(blob).getId();
  },

  readFile: function (fileId) {
    var blob = DriveApp.getFileById(fileId).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  },

  trashFile: function (fileId) { DriveApp.getFileById(fileId).setTrashed(true); },
  trashFolder: function (folderId) { DriveApp.getFolderById(folderId).setTrashed(true); }
};
