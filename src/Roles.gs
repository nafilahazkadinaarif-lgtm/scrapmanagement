/**
 * Turunan peran dari data akun, dan penyusunan daftar departemen.
 */
var Roles = {
  // "3. Departement Head" -> 3
  levelNumber: function (level) {
    var n = parseInt(String(level || '').trim(), 10);
    return isNaN(n) ? 1 : n;
  },

  derive: function (u) {
    var n = Roles.levelNumber(u.Level);
    var role = String(u.Role || 'User');
    return {
      level: n,
      isDeptHead: n === 3,
      isDivisionHead: n === 4,
      isManagement: n === 5,
      isLogistic: !!u.IsLogistic,
      isAdmin: role === 'Admin' || role === 'Super Admin',
      isSuperAdmin: role === 'Super Admin'
    };
  },

  publicUser: function (u) {
    return {
      nik: u.NIK,
      name: u.Name,
      nickname: u.Nickname,
      department: u.Department,
      deptCode: u.DeptCode,
      level: u.Level,
      roles: Roles.derive(u),
      mustChange: !!u.MustChange
    };
  },

  /**
   * Satu baris per NAMA departemen (satu kode bisa berisi banyak departemen).
   * Dept. Head = anggota berlevel 3. Tanpa Dept. Head dan hanya 1 anggota:
   * anggota itu jadi Dept. Head sementara. Selain itu kosong (langsung ke Logistic).
   */
  buildDepartments: function (users) {
    var order = [];
    var map = {};
    users.forEach(function (u) {
      var name = u.Department;
      if (!name) return;
      if (!map[name]) { map[name] = { code: u.DeptCode, members: [] }; order.push(name); }
      map[name].members.push(u);
    });
    return order.map(function (name) {
      var g = map[name];
      var head = '';
      for (var i = 0; i < g.members.length; i++) {
        if (Roles.levelNumber(g.members[i].Level) === 3) { head = g.members[i].NIK; break; }
      }
      if (!head && g.members.length === 1) head = g.members[0].NIK;
      return { Department: name, DeptCode: g.code, HeadNIK: head, DeputyNIK: '' };
    });
  }
};
