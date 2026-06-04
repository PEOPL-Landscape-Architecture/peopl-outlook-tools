/* PEOPL Email Templates — task pane logic.
 * Reads templates from templates.js (window.PEOPL_TEMPLATES), renders a control
 * for every {{token}}, shows a live preview, and inserts into the open email. */
(function () {
  "use strict";

  var els = {};
  var current = null;     // selected template object
  var values = {};        // slot id -> current string value
  var tokenOrder = [];    // slot ids in first-appearance order
  var hostType = null;    // Office host, or null when previewed in a browser
  var booted = false;

  var TOKEN = /\{\{\s*([\w.\-]+)\s*\}\}/g;

  // ---- boot ---------------------------------------------------------------
  function boot(host) {
    if (booted) return;
    booted = true;
    hostType = host || null;
    cacheEls();
    buildTemplateList();
    wireEvents();
    els.loading.hidden = true;
    els.app.hidden = false;
    if (current) renderTemplate(current);
    if (!hostType) setStatus("Preview mode — open inside Outlook to insert.", "");
  }

  if (typeof Office !== "undefined" && Office.onReady) {
    Office.onReady(function (info) { boot(info && info.host); });
  }
  // Fallback so the UI also works in a plain browser (for editing/previewing).
  setTimeout(function () { boot(null); }, 1500);

  // ---- setup --------------------------------------------------------------
  function cacheEls() {
    ["app", "loading", "tpl", "slots", "pv-subject", "pv-body",
     "opt-subject", "opt-replace", "btn-insert", "btn-copy", "status"]
      .forEach(function (id) { els[camel(id)] = document.getElementById(id); });
  }

  function buildTemplateList() {
    var list = window.PEOPL_TEMPLATES || [];
    els.tpl.innerHTML = "";
    list.forEach(function (t, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = t.name || t.id || ("Template " + (i + 1));
      els.tpl.appendChild(o);
    });
    current = list[0] || null;
    if (!list.length) setStatus("No templates found in templates.js.", "err");
  }

  function wireEvents() {
    els.tpl.addEventListener("change", function () {
      var list = window.PEOPL_TEMPLATES || [];
      current = list[Number(els.tpl.value)] || null;
      if (current) renderTemplate(current);
    });
    els.btnInsert.addEventListener("click", onInsert);
    els.btnCopy.addEventListener("click", onCopy);
  }

  // ---- token helpers ------------------------------------------------------
  function tokensIn(str) {
    var ids = [], m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(str || "")) !== null) ids.push(m[1]);
    return ids;
  }
  function slotKind(slot) {
    if (slot && slot.options) return "select";
    if (slot && slot.type === "textarea") return "textarea";
    return "text";
  }
  function normOptions(slot) {
    return (slot.options || []).map(function (o) {
      if (o && typeof o === "object") {
        return { label: o.label != null ? o.label : o.text, text: o.text != null ? o.text : "" };
      }
      return { label: String(o), text: String(o) };
    });
  }
  function defaultIndex(slot, opts) {
    if (slot.default == null) return 0;
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].label === slot.default || opts[i].text === slot.default) return i;
    }
    return 0;
  }

  // ---- render -------------------------------------------------------------
  function renderTemplate(t) {
    values = {};
    tokenOrder = [];
    var seen = {};
    tokensIn(t.subject).concat(tokensIn(t.body)).forEach(function (id) {
      if (!seen[id]) { seen[id] = true; tokenOrder.push(id); }
    });

    els.slots.innerHTML = "";
    tokenOrder.forEach(function (id) {
      var slot = (t.slots && t.slots[id]) || { label: prettify(id), type: "text" };
      var kind = slotKind(slot);

      var wrap = document.createElement("div");
      wrap.className = "slot";
      var lab = document.createElement("label");
      lab.textContent = slot.label || prettify(id);
      lab.setAttribute("for", "f-" + id);
      wrap.appendChild(lab);

      var ctrl;
      if (kind === "select") {
        ctrl = document.createElement("select");
        var opts = normOptions(slot);
        opts.forEach(function (op, i) {
          var o = document.createElement("option");
          o.value = String(i);
          o.textContent = op.label;
          ctrl.appendChild(o);
        });
        var di = defaultIndex(slot, opts);
        ctrl.value = String(di);
        values[id] = opts.length ? opts[di].text : "";
        ctrl.addEventListener("change", function () {
          values[id] = opts[Number(ctrl.value)].text;
          updatePreview();
        });
      } else {
        ctrl = document.createElement(kind === "textarea" ? "textarea" : "input");
        if (kind !== "textarea") ctrl.type = "text";
        ctrl.value = slot.default != null ? slot.default : "";
        if (slot.placeholder) ctrl.placeholder = slot.placeholder;
        values[id] = ctrl.value;
        ctrl.addEventListener("input", function () { values[id] = ctrl.value; updatePreview(); });
      }
      ctrl.id = "f-" + id;
      wrap.appendChild(ctrl);
      els.slots.appendChild(wrap);
    });

    updatePreview();
    if (hostType) setStatus("");
  }

  // ---- resolve + preview --------------------------------------------------
  function resolve(str) {
    return (str || "").replace(TOKEN, function (whole, id) {
      return (values[id] != null) ? values[id] : whole;
    });
  }
  function updatePreview() {
    if (!current) return;
    els.pvSubject.textContent = resolve(current.subject);
    els.pvBody.textContent = resolve(current.body);
  }

  // ---- actions ------------------------------------------------------------
  function inOutlook() {
    return typeof Office !== "undefined" && Office.context &&
           Office.context.mailbox && Office.context.mailbox.item;
  }

  function onInsert() {
    if (!current) return;
    if (!inOutlook()) { setStatus("Open a new email or reply in Outlook, then insert.", "err"); return; }
    var item = Office.context.mailbox.item;

    var afterSubject = function () {
      var opts = { coercionType: Office.CoercionType.Html };
      var cb = function (res) {
        if (res.status === Office.AsyncResultStatus.Succeeded) setStatus("Inserted ✓", "ok");
        else setStatus("Couldn't insert: " + (res.error && res.error.message), "err");
      };
      var html = textToHtml(resolve(current.body));
      if (els.optReplace.checked) item.body.setAsync(html, opts, cb);
      else item.body.setSelectedDataAsync(html, opts, cb);
    };

    if (els.optSubject.checked && item.subject && item.subject.setAsync) {
      item.subject.setAsync(resolve(current.subject), function () { afterSubject(); });
    } else {
      afterSubject();
    }
  }

  function onCopy() {
    var text = resolve(current.body);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { setStatus("Copied to clipboard ✓", "ok"); },
        function () { setStatus("Copy failed — select the preview and copy manually.", "err"); }
      );
    } else {
      setStatus("Clipboard not available in this view.", "err");
    }
  }

  // ---- small utilities ----------------------------------------------------
  function textToHtml(text) {
    var esc = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return "<div>" + esc.replace(/\r\n|\r|\n/g, "<br>") + "</div>";
  }
  function prettify(id) {
    return id.replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function camel(id) {
    return id.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }
  function setStatus(msg, kind) {
    if (!els.status) return;
    els.status.textContent = msg || "";
    els.status.className = "status" + (kind ? " " + kind : "");
  }
})();
