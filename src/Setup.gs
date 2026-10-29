/**
 * Jalankan sekali dari editor Apps Script: setupSheets().
 * Aman dijalankan ulang (tidak menghapus data).
 */
function setupSheets() {
  var ss = Repo.db();
  ensureSheet_(ss, CFG.SHEETS.USERS, CFG.USER_COLS, CFG.USER_TEXT_COLS);
  ensureSheet_(ss, CFG.SHEETS.DEPARTMENTS, CFG.DEPT_COLS, CFG.DEPT_TEXT_COLS);
  Object.keys(CFG.TABLES).forEach(function (name) {
    ensureSheet_(ss, name, CFG.TABLES[name].cols, CFG.TABLES[name].text);
  });
  seedUoms_();
  Repo.rootFolder_(); // folder foto di Google Drive
  Repo.getSecret();
  console.log('Selesai. Isi baris admin pertama di sheet "Users", lalu Deploy sebagai Web app.');
}

function ensureSheet_(ss, name, cols, textCols) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
  sh.setFrozenRows(1);
  textCols.forEach(function (c) {
    var idx = cols.indexOf(c) + 1;
    sh.getRange(1, idx, sh.getMaxRows(), 1).setNumberFormat('@');
  });
}

function seedUoms_() {
  if (Repo.readTable('UoM').length) return;
  CFG.DEFAULT_UOMS.forEach(function (c) { Repo.appendRow('UoM', { Code: c }); });
}

/** Jalankan sekali: cadangan otomatis tiap Senin dini hari. */
function installWeeklyBackup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'weeklyBackup') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(2).create();
  console.log('Cadangan mingguan dipasang (Senin ~02:00).');
}

function weeklyBackup() { Backup.run(); }
