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
