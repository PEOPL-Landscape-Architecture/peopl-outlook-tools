/* Shared template storage for the popup and the editor.
 * The working set of templates lives in chrome.storage.local under 'peoplTemplates'.
 * The bundled templates.js (window.PEOPL_TEMPLATES) is the initial seed and the
 * "Reset to samples" target. */
(function () {
  "use strict";
  var KEY = "peoplTemplates";
  function defaults() { return clone(window.PEOPL_TEMPLATES || []); }
  function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return x; } }

  window.PEOPL_STORE = {
    KEY: KEY,
    defaults: defaults,
    clone: clone,
    load: function (cb) {
      try {
        chrome.storage.local.get(KEY, function (res) {
          var t = res && res[KEY];
          cb(Array.isArray(t) && t.length ? t : defaults());
        });
      } catch (e) { cb(defaults()); }
    },
    save: function (arr, cb) {
      var o = {}; o[KEY] = arr;
      try { chrome.storage.local.set(o, cb || function () {}); }
      catch (e) { if (cb) cb(e); }
    },
    reset: function (cb) {
      try { chrome.storage.local.remove(KEY, cb || function () {}); }
      catch (e) { if (cb) cb(e); }
    }
  };
})();
