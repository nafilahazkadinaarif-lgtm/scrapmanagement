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
      return Workflow.availableActions(user, s, depts).indexOf('approve') >= 0;
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
    if (['approve', 'reject', 'cancel', 'reopen'].indexOf(action) < 0) return Subs.fail('Aksi tidak dikenal.');
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
      fresh.forEach(function (c) { Repo.appendRow('UoM', { Code: c }); });

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
  }
};
