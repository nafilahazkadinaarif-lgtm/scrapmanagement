// HASIL OTOMATIS dari tools/build-bundle.js. Jangan diedit di sini.
// Ubah file di src/ lalu jalankan: npm run build

// ===== Config.gs =====
/**
 * Konfigurasi global. Tidak ada data pribadi di sini (repositori publik).
 */
var CFG = {
  SHEETS: { USERS: 'Users', DEPARTMENTS: 'Departments' },

  USER_COLS: [
    'NIK', 'Name', 'Nickname', 'Email', 'DeptCode', 'Department', 'Level', 'Role', 'Status',
    'IsLogistic', 'PassHash', 'PassSalt', 'MustChange', 'FailCount', 'LockUntil', 'LastLogin'
  ],
  DEPT_COLS: ['Department', 'DeptCode', 'HeadNIK', 'DeputyNIK'],

  // Kolom yang harus tetap teks (jaga angka 0 di depan)
  USER_TEXT_COLS: ['NIK', 'DeptCode', 'PassHash', 'PassSalt'],
  DEPT_TEXT_COLS: ['DeptCode', 'HeadNIK', 'DeputyNIK'],

  DEFAULT_PASSWORD: 'warehouseportal',
  MIN_PASSWORD_LENGTH: 8,
  MAX_FAILED: 5,
  LOCK_MINUTES: 15,
  SESSION_HOURS: 8,
  HASH_ROUNDS: 1000,

  SUGGEST_MIN_CHARS: 3,
  SUGGEST_MAX: 8,

  STATUS_VALUES: ['Active', 'No login'],
  ROLE_VALUES: ['User', 'Admin', 'Super Admin'],
  DEFAULT_LEVEL: '1. User Non Planner',

  // Akun uji tidak ikut diimpor
  IMPORT_EXCLUDE_NAMES: ['Test Dept', 'Test Planner', 'Test User', 'Administrator'],

  // ---- Pengajuan scrap ----
  SOURCES: ['Outage', 'Project', 'Routine Usage', 'Other'],
  STATUS: {
    DRAFT: 'Draft',
    WAIT_HEAD: 'Menunggu Dept Head',
    WAIT_LOG: 'Menunggu Logistic',
    APPROVED: 'Disetujui',
    DONE: 'Selesai',
    REJECTED: 'Ditolak',
    CANCELLED: 'Dibatalkan',
    DELETED: 'Dihapus'
  },
  DEFAULT_UOMS: ['PC', 'CAN', 'DRUM', 'LOT', 'SET', 'M', 'KG', 'L', 'BOX', 'ROL', 'PAC', 'TON'],
  UOM_OTHER: 'Other',
  MAX_ITEMS: 50,
  MAX_PHOTOS: 5,
  MAX_PHOTO_B64: 2000000, // ~1,5 MB biner, foto sudah dikompres di HP
  PHOTO_FOLDER_NAME: 'Scrap Portal Photos',
  ID_PREFIX: 'SCR',
  LOGISTIC_DEPARTMENT: 'Warehouse & Logistic', // nama departemen Logistic (untuk kolom tanda tangan PDF)
  UTC_OFFSET_HOURS: 8, // WITA

  // Tabel tambahan (kolom teks tetap berformat teks agar 0 di depan dan tanggal ISO aman)
  TABLES: {
    Submissions: {
      cols: ['ID', 'Number', 'Status', 'RequesterNIK', 'RequesterName', 'Department', 'Source', 'SourceOther',
        'FolderId', 'CreatedAt', 'UpdatedAt', 'SubmittedAt'],
      text: ['ID', 'Number', 'RequesterNIK', 'FolderId', 'CreatedAt', 'UpdatedAt', 'SubmittedAt']
    },
    Items: {
      cols: ['SubmissionID', 'Line', 'MaterialNo', 'Description', 'Qty', 'UoM', 'Reason'],
      text: ['SubmissionID', 'MaterialNo']
    },
    Photos: {
      cols: ['SubmissionID', 'FileId', 'Name', 'AddedAt'],
      text: ['SubmissionID', 'FileId', 'AddedAt']
    },
    History: {
      cols: ['SubmissionID', 'At', 'ByNIK', 'ByName', 'Action', 'Note'],
      text: ['SubmissionID', 'At', 'ByNIK']
    },
    UoM: { cols: ['Code'], text: ['Code'] },
    Materials: { cols: ['MaterialNo', 'Description', 'UoM'], text: ['MaterialNo', 'UoM'] }
  },

  MAX_MATERIALS: 30000,
  SUGGEST_MATERIAL_MIN_CHARS: 3,
  BACKUP_FOLDER_NAME: 'Scrap Portal Backups',
  BACKUP_KEEP: 8
};

// ===== Admin.gs =====
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

// ===== Auth.gs =====
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

// ===== Backup.gs =====
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

// ===== Dept.gs =====
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

// ===== Pdf.gs =====
/**
 * Susunan HTML formulir handover untuk dijadikan PDF A4.
 * Hanya tabel dan gaya inline karena konverter PDF Google tidak mendukung CSS modern.
 * Fungsi murni: tanpa akses Sheet/Drive.
 */
var Pdf = {
  MONTHS_: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],

  esc_: function (v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  pad_: function (n) { return (n < 10 ? '0' : '') + n; },

  // ISO -> "29 Okt 2026 14:05" (zona WITA)
  fmt_: function (iso, withTime) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var d = new Date(t + CFG.UTC_OFFSET_HOURS * 3600000);
    var s = d.getUTCDate() + ' ' + Pdf.MONTHS_[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    return withTime ? s + ' ' + Pdf.pad_(d.getUTCHours()) + ':' + Pdf.pad_(d.getUTCMinutes()) : s;
  },

  headName_: function (department, depts, users) {
    for (var i = 0; i < depts.length; i++) {
      if (depts[i].Department === department && depts[i].HeadNIK) {
        var u = Auth.find(users, depts[i].HeadNIK);
        return u ? u.Name : '';
      }
    }
    return '';
  },

  // Nama yang dicetak di bawah tiap kolom tanda tangan
  signers_: function (view, deptHead, logisticHead) {
    var by = function (prefix) {
      var name = '';
      (view.history || []).forEach(function (e) { if (e.action.indexOf(prefix) === 0) name = e.byName; });
      return name;
    };
    return {
      requester: view.requesterName,
      head: by('Disetujui Dept Head') || deptHead || '',
      logistic: by('Diterima Logistic') || by('Disetujui Logistic') || '',
      logisticHead: logisticHead || ''
    };
  },

  buildHtml: function (o) {
    var v = o.view, e = Pdf.esc_;
    var sg = Pdf.signers_(v, o.deptHead, o.logisticHead);
    var cell = 'border:1px solid #444;padding:4px 6px;font-size:10pt;vertical-align:top;';
    var head = 'border:1px solid #444;padding:4px 6px;font-size:10pt;background:#e8e8e8;font-weight:bold;';

    var info = [
      ['No. Pengajuan', v.number],
      ['Tanggal Pengajuan', Pdf.fmt_(v.submittedAt || v.createdAt, true)],
      ['Pemohon', v.requesterName + ' (NIK ' + v.requesterNik + ')'],
      ['Departemen', v.department],
      ['Sumber Scrap', v.source + (v.sourceOther ? ' - ' + v.sourceOther : '')],
      ['Status', v.status]
    ].map(function (r) {
      return '<tr><td style="' + cell + 'width:32%;background:#f3f3f3;">' + e(r[0]) + '</td><td style="' + cell + '">' + e(r[1]) + '</td></tr>';
    }).join('');

    var items = v.items.map(function (i, idx) {
      return '<tr><td style="' + cell + 'text-align:center;">' + (idx + 1) + '</td>' +
        '<td style="' + cell + '">' + e(i.materialNo) + '</td>' +
        '<td style="' + cell + '">' + e(i.description) + '</td>' +
        '<td style="' + cell + 'text-align:right;">' + e(String(i.qty).replace('.', ',')) + '</td>' +
        '<td style="' + cell + '">' + e(i.uom) + '</td>' +
        '<td style="' + cell + '">' + e(i.reason) + '</td></tr>';
    }).join('');

    var photoRows = '';
    for (var k = 0; k < o.photos.length; k += 2) {
      var tds = '';
      for (var j = k; j < k + 2; j++) {
        tds += '<td style="padding:4px;width:50%;text-align:center;">' +
          (o.photos[j] ? '<img src="' + e(o.photos[j]) + '" width="200">' : '') + '</td>';
      }
      photoRows += '<tr>' + tds + '</tr>';
    }

    var approvals = (v.history || []).filter(function (h) {
      return /^(Disetujui|Ditolak|Diterima)/.test(h.action);
    }).map(function (h) {
      return '<tr><td style="' + cell + '">' + e(h.action) + '</td><td style="' + cell + '">' + e(h.byName) +
        '</td><td style="' + cell + '">' + e(Pdf.fmt_(h.at, true)) + '</td></tr>';
    }).join('');

    var boxes = [
      ['Pemohon', sg.requester],
      ['Dept. Head', sg.head],
      ['Logistic Staff (Penerima)', sg.logistic],
      ['Logistic Dept. Head', sg.logisticHead]
    ].map(function (b) {
      return '<td style="border:1px solid #444;width:25%;height:110px;vertical-align:top;text-align:center;font-size:9pt;padding:4px;">' +
        '<b>' + e(b[0]) + '</b><br><br><br><br><br><br>' +
        '<span style="font-size:9pt;">(' + (b[1] ? e(b[1]) : '.......................') + ')</span><br>' +
        '<span style="font-size:8pt;color:#555;">Tanggal: ..................</span></td>';
    }).join('');

    return '<html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;">' +
      '<div style="text-align:center;"><b style="font-size:14pt;">FORM HANDOVER SCRAP MATERIAL</b><br>' +
      '<span style="font-size:10pt;">PT DSSP Power Kendari</span></div><br>' +
      '<table style="width:100%;border-collapse:collapse;">' + info + '</table><br>' +
      '<b style="font-size:11pt;">Daftar Item</b>' +
      '<table style="width:100%;border-collapse:collapse;"><tr>' +
      '<td style="' + head + 'width:5%;">No</td><td style="' + head + 'width:15%;">No. Material</td>' +
      '<td style="' + head + 'width:30%;">Material Description</td><td style="' + head + 'width:8%;">Qty</td>' +
      '<td style="' + head + 'width:8%;">UoM</td><td style="' + head + '">Scrap Reason</td></tr>' + items + '</table><br>' +
      (photoRows ? '<b style="font-size:11pt;">Foto Scrap</b><table style="width:100%;border-collapse:collapse;">' + photoRows + '</table><br>' : '') +
      (approvals ? '<b style="font-size:11pt;">Riwayat Persetujuan (sistem)</b>' +
        '<table style="width:100%;border-collapse:collapse;">' + approvals + '</table><br>' : '') +
      '<b style="font-size:11pt;">Tanda Tangan</b>' +
      '<table style="width:100%;border-collapse:collapse;"><tr>' + boxes + '</tr></table>' +
      '<p style="font-size:8pt;color:#555;">Dicetak oleh ' + e(o.printedBy) + ' pada ' + e(Pdf.fmt_(o.printedAt, true)) +
      ' WITA. Nomor ' + e(v.number) + '.</p></body></html>';
  }
};

// ===== Repo.gs =====
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

  replaceDepartments: function (list) {
    var sh = Repo.sheet(CFG.SHEETS.DEPARTMENTS);
    var last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, CFG.DEPT_COLS.length).clearContent();
    if (!list.length) return;
    var rows = list.map(function (d) { return CFG.DEPT_COLS.map(function (c) { return d[c] || ''; }); });
    sh.getRange(2, 1, rows.length, CFG.DEPT_COLS.length).setValues(rows);
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

  // HTML -> PDF (konverter bawaan Google), hasil base64
  htmlToPdf: function (html, name) {
    var pdf = Utilities.newBlob(html, 'text/html', name + '.html').getAs('application/pdf');
    return Utilities.base64Encode(pdf.getBytes());
  },

  // ---- Cadangan Sheet ----
  backupFolder_: function () {
    var it = DriveApp.getFoldersByName(CFG.BACKUP_FOLDER_NAME);
    return it.hasNext() ? it.next() : DriveApp.createFolder(CFG.BACKUP_FOLDER_NAME);
  },

  backupCopy: function (name) {
    var file = DriveApp.getFileById(Repo.db().getId());
    return file.makeCopy(name, Repo.backupFolder_()).getId();
  },

  listBackups: function () {
    var out = [], it = Repo.backupFolder_().getFiles();
    while (it.hasNext()) { var f = it.next(); out.push({ id: f.getId(), name: f.getName() }); }
    return out;
  },

  trashFile: function (fileId) { DriveApp.getFileById(fileId).setTrashed(true); },
  trashFolder: function (folderId) { DriveApp.getFolderById(folderId).setTrashed(true); }
};

// ===== Report.gs =====
/**
 * Rekap bulanan/tahunan. Cakupan otomatis mengikuti hak lihat pengguna
 * (Logistic/Admin/Division Head/Management: semua, Dept. Head: departemennya, lainnya: miliknya).
 * Tanggal acuan = tanggal pengajuan dikirim (WITA). Draft dan yang dihapus tidak dihitung.
 */
var Report = {
  MONTHS: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],

  ym_: function (iso) {
    var t = new Date(iso).getTime();
    if (!iso || isNaN(t)) return null;
    var d = new Date(t + CFG.UTC_OFFSET_HOURS * 3600000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  },

  bump_: function (map, key, items) {
    if (!map[key]) map[key] = { count: 0, items: 0 };
    map[key].count++;
    map[key].items += items;
  },

  sorted_: function (map, keyName) {
    return Object.keys(map).map(function (k) {
      var o = { count: map[k].count, items: map[k].items };
      o[keyName] = k;
      return o;
    }).sort(function (a, b) { return b.count - a.count || String(a[keyName]).localeCompare(String(b[keyName])); });
  },

  /**
   * subs: baris Submissions yang sudah difilter hak lihat. items: semua baris Items.
   * o: { year, month (0 = setahun), status ('' = semua) }
   */
  compute: function (subs, items, o) {
    var S = CFG.STATUS;
    var itemsBySub = {};
    items.forEach(function (it) { (itemsBySub[it.SubmissionID] = itemsBySub[it.SubmissionID] || []).push(it); });

    var years = {};
    var picked = [];
    subs.forEach(function (s) {
      if (s.Status === S.DRAFT || s.Status === S.DELETED) return;
      var ym = Report.ym_(s.SubmittedAt);
      if (!ym) return;
      years[ym.y] = true;
      if (ym.y !== o.year) return;
      if (o.month && ym.m !== o.month) return;
      if (o.status && s.Status !== o.status) return;
      picked.push({ s: s, ym: ym });
    });
    picked.sort(function (a, b) { return a.s.SubmittedAt < b.s.SubmittedAt ? -1 : 1; });

    var byStatus = {}, byDept = {}, bySource = {}, byMonth = {}, byUom = {};
    var rows = [], list = [], itemTotal = 0;
    picked.forEach(function (p) {
      var s = p.s;
      var its = (itemsBySub[s.ID] || []).slice().sort(function (a, b) { return a.Line - b.Line; });
      itemTotal += its.length;
      byStatus[s.Status] = (byStatus[s.Status] || 0) + 1;
      Report.bump_(byDept, s.Department, its.length);
      Report.bump_(bySource, s.Source, its.length);
      Report.bump_(byMonth, p.ym.m, its.length);
      list.push({
        number: s.Number, submittedAt: s.SubmittedAt, status: s.Status, requester: s.RequesterName,
        department: s.Department, source: s.Source, sourceOther: s.SourceOther, itemCount: its.length
      });
      its.forEach(function (it) {
        byUom[it.UoM] = Math.round(((byUom[it.UoM] || 0) + Number(it.Qty)) * 10) / 10;
        rows.push({
          number: s.Number, submittedAt: s.SubmittedAt, status: s.Status, department: s.Department,
          requester: s.RequesterName, source: s.Source, sourceOther: s.SourceOther, line: it.Line,
          materialNo: it.MaterialNo, description: it.Description, qty: Number(it.Qty), uom: it.UoM, reason: it.Reason
        });
      });
    });

    var months = [];
    if (!o.month) {
      for (var m = 1; m <= 12; m++) {
        months.push({ month: m, label: Report.MONTHS[m - 1], count: (byMonth[m] || {}).count || 0, items: (byMonth[m] || {}).items || 0 });
      }
    }
    var yearList = Object.keys(years).map(Number).sort(function (a, b) { return b - a; });
    return {
      period: { year: o.year, month: o.month, label: (o.month ? Report.MONTHS[o.month - 1] + ' ' : 'Tahun ') + o.year },
      years: yearList,
      totals: { count: picked.length, items: itemTotal, byStatus: byStatus },
      byDepartment: Report.sorted_(byDept, 'department'),
      bySource: Report.sorted_(bySource, 'source'),
      byMonth: months,
      byUom: Object.keys(byUom).sort().map(function (u) { return { uom: u, qty: byUom[u] }; }),
      submissions: list,
      rows: rows
    };
  },

  build: function (user, p) {
    var nowYm = Report.ym_(new Date(Sec.now()).toISOString());
    var year = parseInt(p.year, 10);
    if (!year || year < 2000 || year > 2100) year = nowYm.y;
    var month = parseInt(p.month, 10) || 0;
    if (month < 0 || month > 12) month = 0;
    var status = String(p.status || '');
    var depts = Repo.allDepartments();
    var subs = Repo.readTable('Submissions').filter(function (s) { return Workflow.canView(user, s, depts); });
    var data = Report.compute(subs, Repo.readTable('Items'), { year: year, month: month, status: status });
    if (data.years.indexOf(nowYm.y) < 0) data.years.unshift(nowYm.y);
    if (data.years.indexOf(year) < 0) data.years.push(year);
    data.years.sort(function (a, b) { return b - a; });
    return { ok: true, data: data };
  }
};

// ===== Roles.gs =====
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

// ===== Router.gs =====
/**
 * Pintu masuk API. auth: 'none' | 'user' | 'admin'.
 * allowMustChange: boleh dipanggil walau wajib ganti password.
 */
var Router = {
  actions: {
    suggest: {
      auth: 'none',
      fn: function (ctx, p) { return { ok: true, data: Auth.suggest(p.q) }; }
    },
    login: {
      auth: 'none',
      fn: function (ctx, p) { return Auth.login(p.nik, p.password); }
    },
    me: {
      auth: 'user', allowMustChange: true,
      fn: function (ctx) { return { ok: true, data: { user: Roles.publicUser(ctx.user) } }; }
    },
    changePassword: {
      auth: 'user', allowMustChange: true,
      fn: function (ctx, p) { return Auth.changePassword(ctx.user, p.oldPassword, p.newPassword); }
    },
    meta: {
      auth: 'user',
      fn: function () { return Subs.meta(); }
    },
    'sub.list': {
      auth: 'user',
      fn: function (ctx) { return Subs.list(ctx.user); }
    },
    'sub.get': {
      auth: 'user',
      fn: function (ctx, p) { return Subs.get(ctx.user, p); }
    },
    'sub.save': {
      auth: 'user',
      fn: function (ctx, p) { return Subs.save(ctx.user, p); }
    },
    'sub.addPhoto': {
      auth: 'user',
      fn: function (ctx, p) { return Subs.addPhoto(ctx.user, p); }
    },
    'sub.removePhoto': {
      auth: 'user',
      fn: function (ctx, p) { return Subs.removePhoto(ctx.user, p); }
    },
    'sub.photo': {
      auth: 'user',
      fn: function (ctx, p) { return Subs.photo(ctx.user, p); }
    },
    'sub.submit': {
      auth: 'user',
      fn: function (ctx, p) { return Subs.submit(ctx.user, p); }
    },
    inbox: {
      auth: 'user',
      fn: function (ctx) { return Subs.inbox(ctx.user); }
    },
    'sub.listVisible': {
      auth: 'user',
      fn: function (ctx) { return Subs.listVisible(ctx.user); }
    },
    'sub.act': {
      auth: 'user',
      fn: function (ctx, p) { return Subs.act(ctx.user, p); }
    },
    'dept.mine': {
      auth: 'user',
      fn: function (ctx) { return Dept.mine(ctx.user); }
    },
    'dept.setDeputy': {
      auth: 'user',
      fn: function (ctx, p) { return Dept.setDeputy(ctx.user, p); }
    },
    'sub.pdf': {
      auth: 'user',
      fn: function (ctx, p) { return Subs.pdf(ctx.user, p); }
    },
    report: {
      auth: 'user',
      fn: function (ctx, p) { return Report.build(ctx.user, p); }
    },
    'sub.deleteDraft': {
      auth: 'user',
      fn: function (ctx, p) { return Subs.deleteDraft(ctx.user, p); }
    },
    'admin.listUsers': {
      auth: 'admin',
      fn: function () { return Admin.listUsers(); }
    },
    'admin.updateUser': {
      auth: 'admin',
      fn: function (ctx, p) { return Admin.updateUser(ctx.user, p); }
    },
    'admin.resetPassword': {
      auth: 'admin',
      fn: function (ctx, p) { return Admin.resetPassword(ctx.user, p); }
    },
    'materials.all': {
      auth: 'user',
      fn: function () {
        return { ok: true, data: { items: Repo.readTable('Materials').map(function (m) { return [m.MaterialNo, m.Description, m.UoM]; }) } };
      }
    },
    'admin.importMaterials': {
      auth: 'admin',
      fn: function (ctx, p) { return Admin.importMaterials(ctx.user, p); }
    },
    'admin.backupNow': {
      auth: 'admin',
      fn: function () { return Admin.backupNow(); }
    },
    'admin.importUsers': {
      auth: 'admin',
      fn: function (ctx, p) { return Admin.importUsers(ctx.user, p); }
    }
  },

  handle: function (action, token, payload) {
    var a = Router.actions[action];
    if (!a) return Auth.fail('Aksi tidak dikenal.');
    var ctx = {};
    if (a.auth !== 'none') {
      var s = Auth.session(token);
      if (!s.ok) return s;
      ctx.user = s.user;
      if (s.user.MustChange && !a.allowMustChange) {
        return Auth.fail('Ganti password dulu.', 'MUST_CHANGE');
      }
      if (a.auth === 'admin' && !Roles.derive(s.user).isAdmin) {
        return Auth.fail('Anda tidak punya akses.', 'FORBIDDEN');
      }
    }
    return a.fn(ctx, payload || {});
  }
};

// ===== Sec.gs =====
/**
 * Hash password dan token sesi. Hanya memakai Utilities bawaan Apps Script.
 */
var Sec = {
  now: function () { return Date.now(); },

  // Utilities mengembalikan byte bertanda (-128..127)
  toHex: function (bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      if (b < 0) b += 256;
      s += (b < 16 ? '0' : '') + b.toString(16);
    }
    return s;
  },

  sha256Hex: function (text) {
    return Sec.toHex(Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
  },

  hmacHex: function (message, key) {
    return Sec.toHex(Utilities.computeHmacSha256Signature(message, key));
  },

  newSalt: function () {
    return Sec.sha256Hex(Utilities.getUuid() + Utilities.getUuid()).substring(0, 32);
  },

  hashPassword: function (password, salt) {
    var h = salt + ':' + String(password);
    for (var i = 0; i < CFG.HASH_ROUNDS; i++) {
      h = Sec.sha256Hex(h + salt);
    }
    return h;
  },

  safeEquals: function (a, b) {
    a = String(a); b = String(b);
    var diff = a.length ^ b.length;
    var n = Math.max(a.length, b.length);
    for (var i = 0; i < n; i++) {
      diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return diff === 0;
  },

  // Token: nik.exp.pv.sig  (pv = potongan hash password, supaya token mati saat password diganti)
  signToken: function (nik, pv) {
    var exp = Sec.now() + CFG.SESSION_HOURS * 3600 * 1000;
    var body = encodeURIComponent(nik) + '.' + exp + '.' + pv;
    return body + '.' + Sec.hmacHex(body, Repo.getSecret());
  },

  verifyToken: function (token) {
    var parts = String(token || '').split('.');
    if (parts.length !== 4) return null;
    var body = parts[0] + '.' + parts[1] + '.' + parts[2];
    if (!Sec.safeEquals(Sec.hmacHex(body, Repo.getSecret()), parts[3])) return null;
    var exp = Number(parts[1]);
    if (!exp || exp < Sec.now()) return null;
    return { nik: decodeURIComponent(parts[0]), pv: parts[2] };
  }
};

// ===== Setup.gs =====
/**
 * Jalankan sekali dari editor Apps Script: setupSheets().
 * Aman dijalankan ulang (tidak menghapus data).
 */
function setupSheets() {
  // Simpan ID spreadsheet agar web app tidak bergantung pada "active spreadsheet"
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) PropertiesService.getScriptProperties().setProperty('DB_ID', active.getId());
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

// ===== Subs.gs =====
/**
 * Layanan pengajuan scrap: draft, foto, kirim.
 */
var Subs = {
  newId_: function () { return 'S' + Sec.sha256Hex(Utilities.getUuid()).substring(0, 10); },
  iso_: function () { return new Date(Sec.now()).toISOString(); },
  fail: function (msg, code) { return Auth.fail(msg, code); },

  uoms_: function () {
    var rows = Repo.readTable('UoM').map(function (r) { return r.Code; });
    return rows.length ? rows : CFG.DEFAULT_UOMS.slice();
  },

  // Tambah kode UoM ke sheet. Bila sheet masih kosong, isi daftar awal dulu agar tidak hilang.
  addUoms_: function (codes) {
    if (!codes.length) return;
    if (!Repo.readTable('UoM').length) {
      CFG.DEFAULT_UOMS.forEach(function (c) { if (codes.indexOf(c) < 0) Repo.appendRow('UoM', { Code: c }); });
    }
    codes.forEach(function (c) { Repo.appendRow('UoM', { Code: c }); });
  },

  log_: function (user, id, action, note) {
    Repo.appendRow('History', {
      SubmissionID: id, At: Subs.iso_(), ByNIK: user.NIK, ByName: user.Name, Action: action, Note: note || ''
    });
  },

  find_: function (id) {
    id = String(id || '');
    var all = Repo.readTable('Submissions');
    for (var i = 0; i < all.length; i++) if (all[i].ID === id) return { sub: all[i], all: all };
    return null;
  },

  saveSub_: function (all, sub) {
    var replaced = false;
    for (var i = 0; i < all.length; i++) {
      if (all[i].ID === sub.ID) { all[i] = sub; replaced = true; break; }
    }
    if (!replaced) all.push(sub);
    Repo.writeTable('Submissions', all);
  },

  // Tahun dari waktu server; nomor berikut = maksimum nomor tahun itu + 1
  nextNumber_: function (all) {
    var year = new Date(Sec.now()).getFullYear();
    var prefix = CFG.ID_PREFIX + '-' + year + '-';
    var max = 0;
    all.forEach(function (s) {
      if (s.Number && s.Number.indexOf(prefix) === 0) {
        var n = parseInt(s.Number.substring(prefix.length), 10);
        if (n > max) max = n;
      }
    });
    var seq = String(max + 1);
    while (seq.length < 4) seq = '0' + seq;
    return prefix + seq;
  },

  view_: function (sub, withHistory) {
    var items = Repo.readTable('Items').filter(function (r) { return r.SubmissionID === sub.ID; })
      .sort(function (a, b) { return a.Line - b.Line; })
      .map(function (r) {
        return { line: r.Line, materialNo: r.MaterialNo, description: r.Description, qty: r.Qty, uom: r.UoM, reason: r.Reason };
      });
    var photos = Repo.readTable('Photos').filter(function (r) { return r.SubmissionID === sub.ID; })
      .map(function (r) { return { fileId: r.FileId, name: r.Name }; });
    var v = {
      id: sub.ID, number: sub.Number, status: sub.Status,
      requesterNik: sub.RequesterNIK, requesterName: sub.RequesterName, department: sub.Department,
      source: sub.Source, sourceOther: sub.SourceOther,
      createdAt: sub.CreatedAt, updatedAt: sub.UpdatedAt, submittedAt: sub.SubmittedAt,
      items: items, photos: photos
    };
    if (withHistory) {
      v.history = Repo.readTable('History').filter(function (r) { return r.SubmissionID === sub.ID; })
        .map(function (r) { return { at: r.At, byNik: r.ByNIK, byName: r.ByName, action: r.Action, note: r.Note }; });
    }
    return v;
  },

  ownDraft_: function (user, id) {
    var f = Subs.find_(id);
    if (!f) return { err: Subs.fail('Pengajuan tidak ditemukan.') };
    if (f.sub.RequesterNIK !== user.NIK) return { err: Subs.fail('Bukan pengajuan Anda.', 'FORBIDDEN') };
    if (f.sub.Status !== CFG.STATUS.DRAFT) return { err: Subs.fail('Hanya Draft yang bisa diubah.') };
    return f;
  },

  meta: function () {
    return { ok: true, data: {
      sources: CFG.SOURCES, uoms: Subs.uoms_(), uomOther: CFG.UOM_OTHER,
      maxPhotos: CFG.MAX_PHOTOS, maxItems: CFG.MAX_ITEMS
    } };
  },

  list: function (user) {
    var items = Repo.readTable('Items');
    var out = Repo.readTable('Submissions')
      .filter(function (s) { return s.RequesterNIK === user.NIK && s.Status !== CFG.STATUS.DELETED; })
      .map(function (s) {
        var mine = items.filter(function (r) { return r.SubmissionID === s.ID; })
          .sort(function (a, b) { return a.Line - b.Line; });
        return {
          id: s.ID, number: s.Number, status: s.Status, updatedAt: s.UpdatedAt,
          itemCount: mine.length, firstItem: mine.length ? mine[0].Description : ''
        };
      });
    out.sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
    return { ok: true, data: out };
  },

  waitingFor_: function (sub, depts) {
    if (sub.Status === CFG.STATUS.WAIT_LOG) return 'Logistic Staff';
    if (sub.Status === CFG.STATUS.APPROVED) return 'Penyerahan scrap dan konfirmasi terima Logistic';
    if (sub.Status !== CFG.STATUS.WAIT_HEAD) return '';
    var d = Workflow.deptOf_(sub, depts);
    if (!d) return 'Dept. Head';
    var users = Repo.allUsers();
    var name = function (nik) { var u = Auth.find(users, nik); return u ? u.Name : nik; };
    return 'Dept. Head ' + name(d.HeadNIK) + (d.DeputyNIK ? ' / Deputy ' + name(d.DeputyNIK) : '');
  },

  get: function (user, p) {
    var f = Subs.find_(p.id);
    var depts = Repo.allDepartments();
    if (!f || !Workflow.canView(user, f.sub, depts)) return Subs.fail('Pengajuan tidak ditemukan.');
    var v = Subs.view_(f.sub, true);
    v.actions = Workflow.availableActions(user, f.sub, depts);
    v.waitingFor = Subs.waitingFor_(f.sub, depts);
    v.lastNote = '';
    v.history.forEach(function (e) {
      if (e.action.indexOf('Ditolak') === 0 || e.action === 'Dibatalkan') v.lastNote = e.byName + ': ' + (e.note || '-');
    });
    return { ok: true, data: v };
  },

  summary_: function (s, itemsByRow) {
    var mine = itemsByRow.filter(function (r) { return r.SubmissionID === s.ID; })
      .sort(function (a, b) { return a.Line - b.Line; });
    return {
      id: s.ID, number: s.Number, status: s.Status, updatedAt: s.UpdatedAt,
      requesterName: s.RequesterName, department: s.Department, source: s.Source,
      itemCount: mine.length, firstItem: mine.length ? mine[0].Description : ''
    };
  },

  // Antrean: pengajuan yang menunggu tindakan user ini
  inbox: function (user) {
    var depts = Repo.allDepartments(), items = Repo.readTable('Items');
    var out = Repo.readTable('Submissions').filter(function (s) {
      var acts = Workflow.availableActions(user, s, depts);
      return acts.indexOf('approve') >= 0 || acts.indexOf('receive') >= 0;
    }).map(function (s) { return Subs.summary_(s, items); });
    out.sort(function (a, b) { return a.updatedAt < b.updatedAt ? -1 : 1; });
    return { ok: true, data: out };
  },

  // Semua pengajuan yang boleh dilihat user (tanpa draft orang lain)
  listVisible: function (user) {
    var depts = Repo.allDepartments(), items = Repo.readTable('Items');
    var out = Repo.readTable('Submissions').filter(function (s) {
      return Workflow.canView(user, s, depts);
    }).map(function (s) { return Subs.summary_(s, items); });
    out.sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
    return { ok: true, data: out.slice(0, 500) };
  },

  act: function (user, p) {
    var action = String(p.action || '');
    var note = String(p.note || '').trim().substring(0, 500);
    if (['approve', 'reject', 'receive', 'cancel', 'reopen'].indexOf(action) < 0) return Subs.fail('Aksi tidak dikenal.');
    if (action === 'reject' && !note) return Subs.fail('Alasan penolakan wajib diisi.');
    return Repo.withLock(function () {
      var f = Subs.find_(p.id);
      var depts = Repo.allDepartments();
      if (!f || !Workflow.canView(user, f.sub, depts)) return Subs.fail('Pengajuan tidak ditemukan.');
      var sub = f.sub, S = CFG.STATUS;
      if (Workflow.availableActions(user, sub, depts).indexOf(action) < 0) {
        return Subs.fail('Aksi tidak diizinkan untuk status pengajuan ini.', 'FORBIDDEN');
      }
      var label;
      if (action === 'approve') {
        if (sub.Status === S.WAIT_HEAD) {
          var d = Workflow.deptOf_(sub, depts);
          label = 'Disetujui Dept Head' + (d && d.HeadNIK !== user.NIK ? ' (Deputy)' : '');
          sub.Status = S.WAIT_LOG;
        } else {
          label = 'Disetujui Logistic';
          sub.Status = S.APPROVED;
        }
      } else if (action === 'reject') {
        label = sub.Status === S.WAIT_HEAD ? 'Ditolak Dept Head' : 'Ditolak Logistic';
        sub.Status = S.REJECTED;
      } else if (action === 'receive') {
        label = 'Diterima Logistic';
        sub.Status = S.DONE;
      } else if (action === 'cancel') {
        label = 'Dibatalkan';
        sub.Status = S.CANCELLED;
      } else {
        label = 'Dibuka kembali';
        sub.Status = S.DRAFT;
        sub.SubmittedAt = '';
      }
      sub.UpdatedAt = Subs.iso_();
      Subs.saveSub_(f.all, sub);
      Subs.log_(user, sub.ID, label, note);
      return { ok: true, data: { id: sub.ID, status: sub.Status } };
    });
  },

  save: function (user, p) {
    var v = Validate.submission(p, Subs.uoms_());
    if (v.error) return Subs.fail(v.error);
    return Repo.withLock(function () {
      var f, sub, creating = !p.id;
      var now = Subs.iso_();
      if (creating) {
        f = { all: Repo.readTable('Submissions') };
        sub = {
          ID: Subs.newId_(), Number: '', Status: CFG.STATUS.DRAFT, RequesterNIK: user.NIK,
          RequesterName: user.Name, Department: user.Department, FolderId: '',
          CreatedAt: now, SubmittedAt: ''
        };
      } else {
        f = Subs.ownDraft_(user, p.id);
        if (f.err) return f.err;
        sub = f.sub;
      }
      sub.Source = v.value.source;
      sub.SourceOther = v.value.sourceOther;
      sub.UpdatedAt = now;
      Subs.saveSub_(f.all, sub);

      var others = Repo.readTable('Items').filter(function (r) { return r.SubmissionID !== sub.ID; });
      var mine = v.value.items.map(function (it, i) {
        return { SubmissionID: sub.ID, Line: i + 1, MaterialNo: it.materialNo, Description: it.description,
          Qty: it.qty, UoM: it.uom, Reason: it.reason };
      });
      Repo.writeTable('Items', others.concat(mine));

      // UoM baru dari "Other" otomatis masuk daftar pilihan
      var known = Subs.uoms_();
      var fresh = [];
      v.value.items.forEach(function (it) {
        if (known.indexOf(it.uom) < 0 && fresh.indexOf(it.uom) < 0) fresh.push(it.uom);
      });
      Subs.addUoms_(fresh);

      if (creating) Subs.log_(user, sub.ID, 'Draft dibuat', '');
      return { ok: true, data: Subs.view_(sub, false) };
    });
  },

  addPhoto: function (user, p) {
    var data = String(p.data || '');
    var m = /^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/.exec(data);
    if (!m) return Subs.fail('Foto harus berformat JPEG.');
    if (m[1].length > CFG.MAX_PHOTO_B64) return Subs.fail('Foto terlalu besar.');
    return Repo.withLock(function () {
      var f = Subs.ownDraft_(user, p.id);
      if (f.err) return f.err;
      var photos = Repo.readTable('Photos').filter(function (r) { return r.SubmissionID === f.sub.ID; });
      if (photos.length >= CFG.MAX_PHOTOS) return Subs.fail('Maksimal ' + CFG.MAX_PHOTOS + ' foto.');
      if (!f.sub.FolderId) {
        f.sub.FolderId = Repo.createFolder(f.sub.ID);
        Subs.saveSub_(f.all, f.sub);
      }
      var name = 'foto-' + (photos.length + 1) + '-' + Sec.now() + '.jpg';
      var fileId = Repo.saveFile(f.sub.FolderId, name, 'image/jpeg', m[1]);
      Repo.appendRow('Photos', { SubmissionID: f.sub.ID, FileId: fileId, Name: name, AddedAt: Subs.iso_() });
      return { ok: true, data: { fileId: fileId, name: name, count: photos.length + 1 } };
    });
  },

  removePhoto: function (user, p) {
    return Repo.withLock(function () {
      var f = Subs.ownDraft_(user, p.id);
      if (f.err) return f.err;
      var all = Repo.readTable('Photos');
      var hit = all.filter(function (r) { return r.SubmissionID === f.sub.ID && r.FileId === String(p.fileId); });
      if (!hit.length) return Subs.fail('Foto tidak ditemukan.');
      Repo.writeTable('Photos', all.filter(function (r) { return r !== hit[0]; }));
      Repo.trashFile(hit[0].FileId);
      return { ok: true, data: { count: all.length - 1 } };
    });
  },

  photo: function (user, p) {
    var f = Subs.find_(p.id);
    if (!f || !Workflow.canView(user, f.sub, Repo.allDepartments())) return Subs.fail('Pengajuan tidak ditemukan.');
    var ok = Repo.readTable('Photos').some(function (r) { return r.SubmissionID === f.sub.ID && r.FileId === String(p.fileId); });
    if (!ok) return Subs.fail('Foto tidak ditemukan.');
    return { ok: true, data: { dataUrl: Repo.readFile(String(p.fileId)) } };
  },

  submit: function (user, p) {
    return Repo.withLock(function () {
      var f = Subs.ownDraft_(user, p.id);
      if (f.err) return f.err;
      var view = Subs.view_(f.sub, false);
      var check = Validate.submission({
        source: view.source, sourceOther: view.sourceOther,
        items: view.items.map(function (i) {
          return { materialNo: i.materialNo, description: i.description, qty: i.qty, uom: i.uom, reason: i.reason };
        })
      }, null);
      if (check.error) return Subs.fail(check.error);
      if (view.photos.length < 1) return Subs.fail('Unggah minimal 1 foto.');

      var requester = Auth.find(Repo.allUsers(), user.NIK) || user;
      if (!f.sub.Number) f.sub.Number = Subs.nextNumber_(f.all);
      f.sub.Status = Workflow.initialStatus(requester, Repo.allDepartments());
      f.sub.SubmittedAt = Subs.iso_();
      f.sub.UpdatedAt = f.sub.SubmittedAt;
      Subs.saveSub_(f.all, f.sub);
      Subs.log_(user, f.sub.ID, 'Diajukan', 'Status: ' + f.sub.Status);
      return { ok: true, data: Subs.view_(f.sub, false) };
    });
  },

  deleteDraft: function (user, p) {
    return Repo.withLock(function () {
      var f = Subs.ownDraft_(user, p.id);
      if (f.err) return f.err;
      f.sub.Status = CFG.STATUS.DELETED;
      f.sub.UpdatedAt = Subs.iso_();
      Subs.saveSub_(f.all, f.sub);
      Subs.log_(user, f.sub.ID, 'Draft dihapus', '');
      if (f.sub.FolderId) { try { Repo.trashFolder(f.sub.FolderId); } catch (e) { /* abaikan */ } }
      return { ok: true, data: { id: f.sub.ID } };
    });
  },

  // PDF formulir handover (tanda tangan basah). Hanya pengajuan yang sudah dikirim.
  pdf: function (user, p) {
    var f = Subs.find_(p.id);
    var depts = Repo.allDepartments();
    if (!f || !Workflow.canView(user, f.sub, depts)) return Subs.fail('Pengajuan tidak ditemukan.');
    if (f.sub.Status === CFG.STATUS.DRAFT) return Subs.fail('Kirim pengajuan dulu sebelum mencetak.');
    var view = Subs.view_(f.sub, true);
    var users = Repo.allUsers();
    var photos = view.photos.map(function (ph) { return Repo.readFile(ph.fileId); });
    var html = Pdf.buildHtml({
      view: view, photos: photos, printedBy: user.Name, printedAt: new Date(Sec.now()).toISOString(),
      logisticHead: Pdf.headName_(CFG.LOGISTIC_DEPARTMENT, depts, users),
      deptHead: Pdf.headName_(f.sub.Department, depts, users)
    });
    var number = view.number || view.id;
    return { ok: true, data: { filename: number + '.pdf', base64: Repo.htmlToPdf(html, number) } };
  }
};

// ===== Validate.gs =====
/**
 * Validasi isian pengajuan. Fungsi murni, tanpa akses Sheet/Drive.
 */
var Validate = {
  // "2,5" -> 2.5 ; hasil NaN bila bukan angka
  parseQty: function (v) {
    if (typeof v === 'number') return v;
    var s = String(v === null || v === undefined ? '' : v).trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  },

  isOneDecimal: function (n) { return Math.abs(Math.round(n * 10) - n * 10) < 1e-9; },

  clean_: function (v, max) { return String(v === null || v === undefined ? '' : v).trim().substring(0, max); },

  /**
   * Masukan: { source, sourceOther, items:[{materialNo, description, qty, uom, uomOther, reason}] }
   * Keluaran: { error } atau { value: { source, sourceOther, items:[{materialNo, description, qty, uom, reason}] } }
   */
  submission: function (p, uomList) {
    p = p || {};
    var source = Validate.clean_(p.source, 40);
    if (CFG.SOURCES.indexOf(source) < 0) return { error: 'Pilih Sumber Scrap.' };
    var sourceOther = Validate.clean_(p.sourceOther, 120);
    if (source === 'Other' && !sourceOther) return { error: 'Isi keterangan Sumber Scrap (Other).' };
    if (source !== 'Other') sourceOther = '';

    var raw = p.items || [];
    if (!raw.length) return { error: 'Tambahkan minimal 1 item.' };
    if (raw.length > CFG.MAX_ITEMS) return { error: 'Maksimal ' + CFG.MAX_ITEMS + ' item per pengajuan.' };

    var items = [];
    for (var i = 0; i < raw.length; i++) {
      var r = raw[i] || {};
      var n = i + 1;
      var desc = Validate.clean_(r.description, 200);
      if (!desc) return { error: 'Item ' + n + ': Material Description wajib diisi.' };
      var qty = Validate.parseQty(r.qty);
      if (isNaN(qty) || qty <= 0) return { error: 'Item ' + n + ': Qty harus angka lebih dari 0.' };
      if (!Validate.isOneDecimal(qty)) return { error: 'Item ' + n + ': Qty maksimal 1 angka di belakang koma.' };
      if (qty > 1000000) return { error: 'Item ' + n + ': Qty terlalu besar.' };
      var uom = Validate.clean_(r.uom, 20);
      if (!uom) return { error: 'Item ' + n + ': pilih UoM.' };
      if (uom === CFG.UOM_OTHER) {
        uom = Validate.clean_(r.uomOther, 20).toUpperCase();
        if (!uom) return { error: 'Item ' + n + ': isi UoM (Other).' };
      } else if (uomList && uomList.indexOf(uom) < 0) {
        return { error: 'Item ' + n + ': UoM tidak dikenal.' };
      }
      var reason = Validate.clean_(r.reason, 500);
      if (!reason) return { error: 'Item ' + n + ': Scrap Reason wajib diisi.' };
      items.push({
        materialNo: Validate.clean_(r.materialNo, 40),
        description: desc,
        qty: Math.round(qty * 10) / 10,
        uom: uom,
        reason: reason
      });
    }
    return { value: { source: source, sourceOther: sourceOther, items: items } };
  }
};

// ===== Workflow.gs =====
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

// ===== Code.gs =====
/**
 * Titik masuk web app.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Scrap Handover Portal')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Dipanggil dari browser lewat google.script.run.api(action, token, payload) */
function api(action, token, payload) {
  try {
    return Router.handle(String(action), token, payload);
  } catch (err) {
    console.error(action + ': ' + (err && err.stack ? err.stack : err));
    return { ok: false, code: 'SERVER', error: 'Terjadi kesalahan di server. Coba lagi.' };
  }
}
