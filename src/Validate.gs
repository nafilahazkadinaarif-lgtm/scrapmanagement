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
