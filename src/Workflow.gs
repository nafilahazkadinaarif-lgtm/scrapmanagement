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
  },

  deptOf_: function (sub, departments) {
    for (var i = 0; i < departments.length; i++) {
      if (departments[i].Department === sub.Department) return departments[i];
    }
    return null;
  },

  isHeadOrDeputy: function (user, dept) {
    return !!dept && (dept.HeadNIK === user.NIK || dept.DeputyNIK === user.NIK);
  },

  /**
   * Aksi yang boleh dilakukan user pada pengajuan:
   * edit, delete, cancel, reopen (pemohon); approve, reject, receive (penyetuju/Logistic).
   * Tidak ada yang boleh menyetujui/menolak pengajuan miliknya sendiri.
   */
  availableActions: function (user, sub, departments) {
    var S = CFG.STATUS, a = [];
    if (sub.Status === S.DELETED) return a;
    if (sub.RequesterNIK === user.NIK) {
      if (sub.Status === S.DRAFT) a.push('edit', 'delete');
      else if (sub.Status === S.WAIT_HEAD || sub.Status === S.WAIT_LOG || sub.Status === S.APPROVED) a.push('cancel');
      else if (sub.Status === S.REJECTED || sub.Status === S.CANCELLED) a.push('reopen');
      return a;
    }
    if (sub.Status === S.WAIT_HEAD && Workflow.isHeadOrDeputy(user, Workflow.deptOf_(sub, departments))) {
      a.push('approve', 'reject');
    } else if (sub.Status === S.WAIT_LOG && Roles.derive(user).isLogistic) {
      a.push('approve', 'reject');
    } else if (sub.Status === S.APPROVED && Roles.derive(user).isLogistic) {
      a.push('receive');
    }
    return a;
  }
};
