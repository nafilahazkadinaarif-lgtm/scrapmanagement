/**
 * Login, sesi, ganti password, saran nama.
 * Password kosong (PassHash '') berarti masih memakai password awal.
 */
var Auth = {
  MSG_BAD: 'NIK atau password salah.',

  fail: function (error, code) { return { ok: false, error: error, code: code || 'ERROR' }; },

  find: function (users, nik) {
    nik = String(nik || '').trim();
    for (var i = 0; i < users.length; i++) if (users[i].NIK === nik) return users[i];
    return null;
  },

  pv: function (u) { return u.PassHash ? u.PassHash.substring(0, 10) : 'default'; },

  verifyPassword: function (u, password) {
    password = String(password || '');
    if (!u.PassHash) return Sec.safeEquals(password, CFG.DEFAULT_PASSWORD);
    return Sec.safeEquals(Sec.hashPassword(password, u.PassSalt), u.PassHash);
  },

  validateNewPassword: function (u, oldPw, newPw) {
    newPw = String(newPw || '');
    if (newPw.length < CFG.MIN_PASSWORD_LENGTH) return 'Password baru minimal ' + CFG.MIN_PASSWORD_LENGTH + ' karakter.';
    if (newPw === CFG.DEFAULT_PASSWORD) return 'Password baru tidak boleh sama dengan password awal.';
    if (newPw === u.NIK) return 'Password baru tidak boleh sama dengan NIK.';
    if (newPw === String(oldPw)) return 'Password baru harus berbeda dari password lama.';
    return '';
  },

  login: function (nik, password) {
    nik = String(nik || '').trim();
    password = String(password || '');
    if (!nik || !password) return Auth.fail('Isi NIK dan password.');
    return Repo.withLock(function () {
      var u = Auth.find(Repo.allUsers(), nik);
      if (!u) return Auth.fail(Auth.MSG_BAD);
      if (u.Status !== 'Active') return Auth.fail('Akun tidak diizinkan login. Hubungi admin.', 'DISABLED');
      var now = Sec.now();
      if (u.LockUntil && u.LockUntil > now) {
        return Auth.fail('Akun terkunci sementara. Coba lagi dalam ' +
          Math.ceil((u.LockUntil - now) / 60000) + ' menit.', 'LOCKED');
      }
      if (!Auth.verifyPassword(u, password)) {
        u.FailCount = (u.FailCount || 0) + 1;
        if (u.FailCount >= CFG.MAX_FAILED) {
          u.FailCount = 0;
          u.LockUntil = now + CFG.LOCK_MINUTES * 60000;
        }
        Repo.saveUser(u);
        return Auth.fail(Auth.MSG_BAD);
      }
      u.FailCount = 0;
      u.LockUntil = 0;
      u.LastLogin = new Date(now).toISOString();
      if (!u.PassHash) u.MustChange = true;
      Repo.saveUser(u);
      return { ok: true, data: { token: Sec.signToken(u.NIK, Auth.pv(u)), user: Roles.publicUser(u) } };
    });
  },

  session: function (token) {
    var t = Sec.verifyToken(token);
    var expired = Auth.fail('Sesi berakhir. Silakan login lagi.', 'SESSION');
    if (!t) return expired;
    var u = Auth.find(Repo.allUsers(), t.nik);
    if (!u || u.Status !== 'Active' || Auth.pv(u) !== t.pv) return expired;
    return { ok: true, user: u };
  },

  changePassword: function (sessionUser, oldPw, newPw) {
    return Repo.withLock(function () {
      var u = Auth.find(Repo.allUsers(), sessionUser.NIK);
      if (!u) return Auth.fail('Akun tidak ditemukan.');
      if (!Auth.verifyPassword(u, oldPw)) return Auth.fail('Password lama salah.');
      var err = Auth.validateNewPassword(u, oldPw, newPw);
      if (err) return Auth.fail(err);
      u.PassSalt = Sec.newSalt();
      u.PassHash = Sec.hashPassword(newPw, u.PassSalt);
      u.MustChange = false;
      Repo.saveUser(u);
      return { ok: true, data: { token: Sec.signToken(u.NIK, Auth.pv(u)), user: Roles.publicUser(u) } };
    });
  },

  // Tanpa login: hanya nama, NIK, departemen akun aktif
  suggest: function (query) {
    var q = String(query || '').trim().toLowerCase();
    if (q.length < CFG.SUGGEST_MIN_CHARS) return [];
    var hits = [];
    Repo.allUsers().forEach(function (u) {
      if (u.Status !== 'Active') return;
      var n = u.Name.toLowerCase().indexOf(q);
      var k = u.Nickname.toLowerCase().indexOf(q);
      if (n < 0 && k < 0) return;
      var pos = Math.min(n < 0 ? 999 : n, k < 0 ? 999 : k);
      hits.push({ pos: pos, nik: u.NIK, name: u.Name, department: u.Department });
    });
    hits.sort(function (a, b) { return a.pos - b.pos || a.name.localeCompare(b.name); });
    return hits.slice(0, CFG.SUGGEST_MAX).map(function (h) {
      return { nik: h.nik, name: h.name, department: h.department };
    });
  }
};
