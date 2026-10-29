/**
 * Cadangan Google Sheet ke folder Drive. Menyimpan BACKUP_KEEP salinan terbaru.
 */
var Backup = {
  stamp_: function () {
    var d = new Date(Sec.now() + CFG.UTC_OFFSET_HOURS * 3600000);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + '_' + p(d.getUTCHours()) + p(d.getUTCMinutes());
  },

  // Nama berawalan "Backup-" yang melebihi batas, tertua dulu
  toDelete: function (files, keep) {
    var mine = files.filter(function (f) { return f.name.indexOf('Backup-') === 0; })
      .sort(function (a, b) { return a.name < b.name ? 1 : -1; }); // terbaru di depan
    return mine.slice(keep);
  },

  run: function () {
    var name = 'Backup-' + Backup.stamp_();
    Repo.backupCopy(name);
    Backup.toDelete(Repo.listBackups(), CFG.BACKUP_KEEP).forEach(function (f) { Repo.trashFile(f.id); });
    return name;
  }
};
