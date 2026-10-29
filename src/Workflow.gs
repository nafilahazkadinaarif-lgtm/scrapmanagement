/**
 * Aturan jalur approval dan hak akses lihat. Fungsi murni.
 */
var Workflow = {
  /**
   * Status awal saat pengajuan dikirim.
   * Langsung ke Logistic bila: pemohon berlevel Dept. Head ke atas, departemennya tanpa Dept. Head,
   * atau pemohon sendiri adalah Dept. Head departemen itu.
   */
  initialStatus: function (requester, departments) {
    if (Roles.levelNumber(requester.Level) >= 3) return CFG.STATUS.WAIT_LOG;
    var dept = null;
    for (var i = 0; i < departments.length; i++) {
      if (departments[i].Department === requester.Department) { dept = departments[i]; break; }
    }
    if (!dept || !dept.HeadNIK) return CFG.STATUS.WAIT_LOG;
    if (dept.HeadNIK === requester.NIK) return CFG.STATUS.WAIT_LOG;
    return CFG.STATUS.WAIT_HEAD;
  },

  canView: function (user, sub, departments) {
    if (sub.Status === CFG.STATUS.DELETED) return false;
    if (sub.RequesterNIK === user.NIK) return true;
    if (sub.Status === CFG.STATUS.DRAFT) return false;
    var r = Roles.derive(user);
    if (r.isLogistic || r.isAdmin || r.isDivisionHead || r.isManagement) return true;
    for (var i = 0; i < departments.length; i++) {
      var d = departments[i];
      if (d.Department === sub.Department && (d.HeadNIK === user.NIK || d.DeputyNIK === user.NIK)) return true;
    }
    return false;
  }
};
