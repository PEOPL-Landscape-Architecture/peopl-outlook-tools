/* PEOPL Email Templates — task pane logic (Outlook add-in / web page).
 * Reads templates from templates.js (window.PEOPL_TEMPLATES), renders a control
 * for every {{token}}, shows a live preview, and inserts into the open email.
 * Optional fields get an include/skip checkbox. */
(function () {
  "use strict";

  var els = {};
  var current = null;     // selected template object
  var values = {};        // slot id -> current string value
  var included = {};      // slot id -> whether to insert it (optional fields can be off)
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
    els.tpl.selectedIndex = 0;
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
        var lab = (o.label != null && o.label !== "") ? o.label : o.text;
        return { label: lab, text: o.text != null ? o.text : "" };
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
    included = {};
    tokenOrder = [];
    var seen = {};
    tokensIn(t.subject).concat(tokensIn(t.body)).forEach(function (id) {
      if (!seen[id]) { seen[id] = true; tokenOrder.push(id); }
    });

    els.slots.innerHTML = "";
    tokenOrder.forEach(function (id) {
      var slot = (t.slots && t.slots[id]) || { label: prettify(id), type: "text" };
      var kind = slotKind(slot);
      var optional = !!slot.optional;
      included[id] = optional ? !slot.omitByDefault : true;

      var wrap = document.createElement("div");
      wrap.className = "slot";

      var head = document.createElement("label");
      head.className = "slot-head";
      var chk = null;
      if (optional) {
        chk = document.createElement("input");
        chk.type = "checkbox";
        chk.id = "chk-" + id;
        chk.checked = included[id];
        head.appendChild(chk);
        head.setAttribute("for", "chk-" + id);
      } else {
        head.setAttribute("for", "f-" + id);
      }
      var span = document.createElement("span");
      span.textContent = slot.label || prettify(id);
      head.appendChild(span);
      wrap.appendChild(head);

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
      if (optional && !included[id]) ctrl.disabled = true;
      wrap.appendChild(ctrl);

      if (optional && chk) {
        chk.addEventListener("change", function () {
          included[id] = chk.checked;
          ctrl.disabled = !chk.checked;
          updatePreview();
        });
      }

      els.slots.appendChild(wrap);
    });

    updatePreview();
    if (hostType) setStatus("");
  }

  // ---- resolve + cleanup + preview ---------------------------------------
  function resolve(str) {
    return (str || "").replace(TOKEN, function (whole, id) {
      if (included[id] === false) return "";
      return (values[id] != null) ? values[id] : whole;
    });
  }
  function cleanBody(text) {
    return String(text)
      .replace(/[ \t]+(\r?\n)/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+|\s+$/g, "");
  }
  function cleanSubject(text) { return String(text).replace(/\s{2,}/g, " ").trim(); }
  function resolvedBody() { return cleanBody(resolve(current.body)); }
  function resolvedSubject() { return cleanSubject(resolve(current.subject)); }

  function updatePreview() {
    if (!current) return;
    els.pvSubject.textContent = resolvedSubject();
    els.pvBody.textContent = resolvedBody();
  }

  // ---- insert / copy ------------------------------------------------------
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
      var html = textToHtml(resolvedBody());
      if (els.optReplace.checked) item.body.setAsync(html, opts, cb);
      else item.body.setSelectedDataAsync(html, opts, cb);
    };

    if (els.optSubject.checked && item.subject && item.subject.setAsync) {
      item.subject.setAsync(resolvedSubject(), function () { afterSubject(); });
    } else {
      afterSubject();
    }
  }

  function onCopy() {
    if (!current) return;
    var text = resolvedBody();
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
