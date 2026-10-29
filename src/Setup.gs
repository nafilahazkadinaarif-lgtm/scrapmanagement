/**
 * Jalankan sekali dari editor Apps Script: setupSheets().
 * Aman dijalankan ulang (tidak menghapus data).
 */
function setupSheets() {
  var ss = Repo.db();
  ensureSheet_(ss, CFG.SHEETS.USERS, CFG.USER_COLS, CFG.USER_TEXT_COLS);
  ensureSheet_(ss, CFG.SHEETS.DEPARTMENTS, CFG.DEPT_COLS, CFG.DEPT_TEXT_COLS);
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
