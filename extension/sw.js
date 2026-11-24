/* Background service worker.
 * Opens the template tool in its own resizable, persistent window — which works
 * whether Outlook is a normal browser tab OR installed as an app/PWA window
 * (app windows don't show the toolbar popup or side panel).
 *
 * Trigger: the toolbar icon, or the Alt+Shift+E keyboard shortcut (the shortcut
 * works even inside an Outlook app window). We remember which tab was Outlook so
 * the floating window knows where to insert. */

var BOUNDS_KEY = "peoplWindowBounds";   // last size + position of our window {left, top, width, height}
var DEFAULT_BOUNDS = { width: 780, height: 940 };
var saveTimer = null;

// The service worker sleeps after ~30 s idle and loses its variables, so our
// window is found by its page URL rather than a remembered id.
function popupUrl() { return chrome.runtime.getURL("popup.html"); }
function findOurWindow(cb) {
  chrome.windows.getAll({ populate: true, windowTypes: ["popup", "normal"] }, function (wins) {
    var hit = (wins || []).filter(function (w) {
      return (w.tabs || []).some(function (t) { return (t.url || t.pendingUrl || "").indexOf(popupUrl()) === 0; });
    })[0];
    cb(hit || null);
  });
}

function isOutlook(url) {
  return /^https:\/\/([^/]*\.)?(outlook\.(office|office365|live)\.com|outlook\.cloud\.microsoft)\//.test(url || "");
}

function rememberTarget(tab, done) {
  if (tab && isOutlook(tab.url)) {
    chrome.storage.session.set({ targetTabId: tab.id }, done);
    return;
  }
  chrome.tabs.query({}, function (tabs) {
    var hits = (tabs || []).filter(function (t) { return isOutlook(t.url); });
    var pick = hits.filter(function (t) { return t.active; })[0] || hits[0];
    if (pick) chrome.storage.session.set({ targetTabId: pick.id }, done);
    else if (done) done();
  });
}

function createWindow() {
  chrome.storage.local.get(BOUNDS_KEY, function (res) {
    var b = (res && res[BOUNDS_KEY]) || {};
    var opts = { url: popupUrl(), type: "popup",
                 width: b.width >= 360 ? b.width : DEFAULT_BOUNDS.width,
                 height: b.height >= 300 ? b.height : DEFAULT_BOUNDS.height };
    if (typeof b.left === "number" && typeof b.top === "number") { opts.left = b.left; opts.top = b.top; }
    chrome.windows.create(opts, function () {
      // A saved position on a monitor that's gone: fall back to the default spot.
      if (chrome.runtime.lastError && opts.left != null) {
        delete opts.left; delete opts.top;
        chrome.windows.create(opts);
      }
    });
  });
}

function openWindow() {
  findOurWindow(function (w) {
    if (w) chrome.windows.update(w.id, { focused: true, state: w.state === "minimized" ? "normal" : w.state });
    else createWindow();
  });
}

// Remember the size and position whenever our window is moved or resized
// (only in its normal state, not maximised or minimised).
function saveBounds(win) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    chrome.windows.get(win.id, { populate: true }, function (w) {
      if (chrome.runtime.lastError || !w || w.state !== "normal") return;
      var ours = (w.tabs || []).some(function (t) { return (t.url || "").indexOf(popupUrl()) === 0; });
      if (!ours) return;
      var nb = { left: w.left, top: w.top, width: w.width, height: w.height };
      chrome.storage.local.get(BOUNDS_KEY, function (res) {
        var ob = res && res[BOUNDS_KEY];
        // Windows rounds a reopened window by a pixel or so; ignoring changes of
        // 2 px or less stops the saved size creeping on every open.
        if (ob && ["left", "top", "width", "height"].every(function (k) { return Math.abs((ob[k] || 0) - nb[k]) <= 2; })) return;
        var o = {}; o[BOUNDS_KEY] = nb;
        chrome.storage.local.set(o);
      });
    });
  }, 400);
}
if (chrome.windows.onBoundsChanged) chrome.windows.onBoundsChanged.addListener(saveBounds);

chrome.action.onClicked.addListener(function (tab) { rememberTarget(tab, openWindow); });

if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(function (cmd) {
    if (cmd !== "open_templates") return;
    chrome.windows.getLastFocused({ populate: true }, function (w) {
      var t = w && w.tabs && w.tabs.filter(function (x) { return x.active; })[0];
      rememberTarget(t, openWindow);
    });
  });
}
