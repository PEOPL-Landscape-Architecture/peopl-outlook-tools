/* Background service worker.
 * Opens the template tool in its own resizable, persistent window — which works
 * whether Outlook is a normal browser tab OR installed as an app/PWA window
 * (app windows don't show the toolbar popup or side panel).
 *
 * Trigger: the toolbar icon, or the Alt+Shift+E keyboard shortcut (the shortcut
 * works even inside an Outlook app window). We remember which tab was Outlook so
 * the floating window knows where to insert. */

var WIN_ID = null;

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
  chrome.windows.create(
    { url: chrome.runtime.getURL("popup.html"), type: "popup", width: 780, height: 940 },
    function (w) { WIN_ID = w && w.id; }
  );
}

function openWindow() {
  if (WIN_ID != null) {
    chrome.windows.update(WIN_ID, { focused: true }, function () {
      if (chrome.runtime.lastError) { WIN_ID = null; createWindow(); }
    });
  } else {
    createWindow();
  }
}

chrome.windows.onRemoved.addListener(function (id) { if (id === WIN_ID) WIN_ID = null; });

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
