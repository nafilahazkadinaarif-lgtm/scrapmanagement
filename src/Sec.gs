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
