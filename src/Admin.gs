/**
 * Fitur admin: daftar akun, ubah status/Logistic, reset password, impor akun.
 */
var Admin = {
  adminView_: function (u, now) {
    return {
      nik: u.NIK, name: u.Name, nickname: u.Nickname, email: u.Email,
      deptCode: u.DeptCode, department: u.Department, level: u.Level, role: u.Role,
      status: u.Status, isLogistic: u.IsLogistic, mustChange: !!(u.MustChange || !u.PassHash),
      lastLogin: u.LastLogin, locked: u.LockUntil > now
    };
  },

  listUsers: function () {
    var now = Sec.now();
    return { ok: true, data: Repo.allUsers().map(function (u) { return Admin.adminView_(u, now); }) };
  },

  updateUser: function (actor, p) {
    return Repo.withLock(function () {
      var u = Auth.find(Repo.allUsers(), p.nik);
      if (!u) return Auth.fail('Akun tidak ditemukan.');
      if (p.status !== undefined) {
        if (CFG.STATUS_VALUES.indexOf(p.status) < 0) return Auth.fail('Status tidak valid.');
        if (u.NIK === actor.NIK && p.status !== 'Active') return Auth.fail('Tidak bisa menonaktifkan akun sendiri.');
        u.Status = p.status;
      }
      if (p.isLogistic !== undefined) u.IsLogistic = !!p.isLogistic;
      Repo.saveUser(u);
      return { ok: true, data: Admin.adminView_(u, Sec.now()) };
    });
  },

  resetPassword: function (actor, p) {
    return Repo.withLock(function () {
      var u = Auth.find(Repo.allUsers(), p.nik);
      if (!u) return Auth.fail('Akun tidak ditemukan.');
      u.PassHash = '';
      u.PassSalt = '';
      u.MustChange = true;
      u.FailCount = 0;
      u.LockUntil = 0;
      Repo.saveUser(u);
      return { ok: true, data: Admin.adminView_(u, Sec.now()) };
    });
  },

  // Nama kolom file -> field. Huruf besar/kecil dan spasi tidak dipersoalkan.
  FIELD_MAP_: {
    nik: 'NIK', name: 'Name', nickname: 'Nickname', email: 'Email',
    deptcode: 'DeptCode', department: 'Department', level: 'Level', role: 'Role', status: 'Status'
  },

  normalizeRow_: function (raw) {
    var out = {};
    Object.keys(raw || {}).forEach(function (k) {
      var f = Admin.FIELD_MAP_[String(k).toLowerCase().replace(/[^a-z]/g, '')];
      if (f) out[f] = String(raw[k] === null || raw[k] === undefined ? '' : raw[k]).trim();
    });
    return out;
  },

  importUsers: function (actor, p) {
    var rows = p.rows || [];
    var overwriteStatusRole = !!p.overwriteStatusRole;
    if (!rows.length) return Auth.fail('File kosong.');
    if (rows.length > 2000) return Auth.fail('Terlalu banyak baris (maks. 2000).');

    return Repo.withLock(function () {
      var users = Repo.allUsers();
      var byNik = {};
      users.forEach(function (u) { byNik[u.NIK] = u; });
      var seen = {};
      var res = { added: 0, updated: 0, excluded: 0, skipped: [], departmentsAdded: 0 };

      rows.forEach(function (raw, i) {
        var r = Admin.normalizeRow_(raw);
        var line = i + 2;
        if (!r.NIK || !r.Name) { res.skipped.push({ row: line, reason: 'NIK atau Name kosong' }); return; }
        if (CFG.IMPORT_EXCLUDE_NAMES.indexOf(r.Name) >= 0) { res.excluded++; return; }
        if (seen[r.NIK]) { res.skipped.push({ row: line, reason: 'NIK ganda di file (' + r.NIK + ')' }); return; }
        seen[r.NIK] = true;

        var status = CFG.STATUS_VALUES.indexOf(r.Status) >= 0 ? r.Status : 'Active';
        var role = CFG.ROLE_VALUES.indexOf(r.Role) >= 0 ? r.Role : 'User';
        var ex = byNik[r.NIK];
        if (ex) {
          ex.Name = r.Name; ex.Nickname = r.Nickname || ex.Nickname; ex.Email = r.Email || ex.Email;
          ex.DeptCode = r.DeptCode || ex.DeptCode; ex.Department = r.Department || ex.Department;
          ex.Level = r.Level || ex.Level;
          if (overwriteStatusRole) { ex.Status = status; ex.Role = role; }
          res.updated++;
        } else {
          var nu = {
            NIK: r.NIK, Name: r.Name, Nickname: r.Nickname || r.Name, Email: r.Email || '',
            DeptCode: r.DeptCode || '', Department: r.Department || '', Level: r.Level || CFG.DEFAULT_LEVEL,
            Role: role, Status: status, IsLogistic: false, PassHash: '', PassSalt: '',
            MustChange: true, FailCount: 0, LockUntil: 0, LastLogin: ''
          };
          users.push(nu);
          byNik[nu.NIK] = nu;
          res.added++;
        }
      });

      Repo.replaceAllUsers(users);

      var known = {};
      Repo.allDepartments().forEach(function (d) { known[d.Department] = true; });
      var fresh = Roles.buildDepartments(users).filter(function (d) { return !known[d.Department]; });
      Repo.addDepartments(fresh);
      res.departmentsAdded = fresh.length;
      return { ok: true, data: res };
    });
  },

  MATERIAL_KEYS_: { material: 'no', materialno: 'no', materialnumber: 'no', materialdescription: 'desc', description: 'desc', uom: 'uom' },

  // Daftar material SAP (MM60): hanya No. Material, Deskripsi, UoM yang disimpan. Mengganti seluruh daftar.
  importMaterials: function (actor, p) {
    var rows = p.rows || [];
    if (!rows.length) return Auth.fail('File kosong.');
    if (rows.length > CFG.MAX_MATERIALS) return Auth.fail('Terlalu banyak baris (maks. ' + CFG.MAX_MATERIALS + ').');
    var seen = {}, list = [], skipped = 0;
    rows.forEach(function (raw) {
      var r = {};
      Object.keys(raw || {}).forEach(function (k) {
        var f = Admin.MATERIAL_KEYS_[String(k).toLowerCase().replace(/[^a-z]/g, '')];
        if (f) r[f] = String(raw[k] === null || raw[k] === undefined ? '' : raw[k]).trim();
      });
      if (!r.no || !r.desc || seen[r.no]) { skipped++; return; }
      seen[r.no] = true;
      list.push({ MaterialNo: r.no, Description: r.desc.substring(0, 200), UoM: (r.uom || '').substring(0, 20) });
    });
    if (!list.length) return Auth.fail('Tidak ada baris valid. Kolom wajib: Material, Material Description, UoM.');
    return Repo.withLock(function () {
      Repo.writeTable('Materials', list);
      var known = Subs.uoms_(), added = [];
      list.forEach(function (m) {
        if (m.UoM && known.indexOf(m.UoM) < 0 && added.indexOf(m.UoM) < 0) added.push(m.UoM);
      });
      Subs.addUoms_(added);
      return { ok: true, data: { total: list.length, skipped: skipped, newUoms: added } };
    });
  },

  backupNow: function () {
    return { ok: true, data: { name: Backup.run() } };
  }
};
