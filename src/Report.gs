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
