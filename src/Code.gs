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
