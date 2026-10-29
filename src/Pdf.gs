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
