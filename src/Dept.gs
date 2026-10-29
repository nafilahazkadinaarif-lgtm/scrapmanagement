/**
 * Pengaturan Deputy oleh Dept. Head. Deputy berlaku sampai dicabut.
 */
var Dept = {
  view_: function (d, users, head) {
    var name = function (nik) { var u = Auth.find(users, nik); return u ? u.Name : ''; };
    var candidates = users.filter(function (u) {
      return u.Status === 'Active' && u.Department === d.Department && u.NIK !== d.HeadNIK;
    }).map(function (u) { return { nik: u.NIK, name: u.Name }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    return { department: d.Department, headNik: d.HeadNIK, deputyNik: d.DeputyNIK, deputyName: name(d.DeputyNIK), candidates: candidates };
  },

  mine: function (user) {
    var users = Repo.allUsers();
    var out = Repo.allDepartments().filter(function (d) { return d.HeadNIK === user.NIK; })
      .map(function (d) { return Dept.view_(d, users); });
    return { ok: true, data: out };
  },

  // Dept. Head mengatur departemennya. Admin boleh mengatur departemen mana pun.
  setDeputy: function (user, p) {
    var department = String(p.department || '');
    var nik = String(p.nik || '').trim();
    var isAdmin = Roles.derive(user).isAdmin;
    return Repo.withLock(function () {
      var depts = Repo.allDepartments();
      var users = Repo.allUsers();
      var d = null;
      depts.forEach(function (x) { if (x.Department === department) d = x; });
      if (!d || (d.HeadNIK !== user.NIK && !isAdmin)) return Auth.fail('Anda bukan Dept. Head departemen ini.', 'FORBIDDEN');
      if (nik) {
        var u = Auth.find(users, nik);
        if (!u || u.Status !== 'Active' || u.Department !== d.Department) return Auth.fail('Deputy harus karyawan aktif di departemen yang sama.');
        if (u.NIK === d.HeadNIK) return Auth.fail('Dept. Head tidak bisa menjadi Deputy sendiri.');
      }
      d.DeputyNIK = nik;
      Repo.replaceDepartments(depts);
      return { ok: true, data: Dept.view_(d, users) };
    });
  }
};
