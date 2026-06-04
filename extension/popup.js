/* PEOPL Email Templates — Chrome / Edge extension popup.
 * Reads templates from templates.js (window.PEOPL_TEMPLATES), renders a control
 * for every {{token}}, shows a live preview, and inserts the result into the
 * Outlook compose box in the active tab. Copy is always available as a fallback. */
(function () {
  "use strict";

  var els = {};
  var current = null;   // selected template
  var values = {};      // slot id -> current string value
  var tokenOrder = [];  // slot ids in first-appearance order
  var TOKEN = /\{\{\s*([\w.\-]+)\s*\}\}/g;

  document.addEventListener("DOMContentLoaded", function () {
    cacheEls();
    buildTemplateList();
    wireEvents();
    if (current) renderTemplate(current);
  });

  // ---- setup --------------------------------------------------------------
  function cacheEls() {
    ["app", "tpl", "slots", "pv-subject", "pv-body", "btn-insert", "btn-copy", "status"]
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
    setStatus("");
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

  // ---- insert into the Outlook compose box (active tab) --------------------
  function onInsert() {
    if (!current) return;
    var html = textToHtml(resolve(current.body));
    if (typeof chrome === "undefined" || !chrome.scripting || !chrome.tabs) {
      setStatus("Insert works inside the browser extension — use Copy here.", "err");
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || tab.id == null) { setStatus("No active tab found.", "err"); return; }
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: pageInsert, args: [html] },
        function (results) {
          if (chrome.runtime.lastError) {
            setStatus("Can't insert on this page — use Copy, then paste.", "err");
            return;
          }
          var r = results && results[0] && results[0].result;
          if (r && r.ok) setStatus("Inserted into your email ✓", "ok");
          else setStatus("Couldn't find the message box. Click into the email body, then Insert — or use Copy.", "err");
        }
      );
    });
  }

  /* Runs INSIDE the Outlook page (serialized by executeScript). Self-contained:
     uses only its argument and page globals. Inserts html at the caret of the
     focused/largest editable region. */
  function pageInsert(html) {
    function isEditable(el) {
      return !!(el && (el.isContentEditable ||
        (el.getAttribute && (el.getAttribute("contenteditable") === "true" ||
                             el.getAttribute("contenteditable") === ""))));
    }
    var sel = window.getSelection();
    var editable = document.activeElement;

    if (!isEditable(editable) && sel && sel.rangeCount) {
      var node = sel.anchorNode;
      while (node && node.nodeType === 3) node = node.parentNode;
      while (node && !isEditable(node)) node = node.parentElement;
      if (node) editable = node;
    }
    if (!isEditable(editable)) {
      var cands = Array.prototype.slice.call(
        document.querySelectorAll('[contenteditable="true"],[contenteditable=""],[role="textbox"]'));
      cands = cands.filter(function (e) { return e.offsetParent !== null; });
      cands.sort(function (a, b) {
        return (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight);
      });
      editable = cands[0];
    }
    if (!isEditable(editable)) return { ok: false, reason: "no-editable" };

    editable.focus();
    try {
      var s = window.getSelection(), range;
      if (s && s.rangeCount && editable.contains(s.anchorNode)) {
        range = s.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(editable);
        range.collapse(false);
        s.removeAllRanges();
        s.addRange(range);
      }
      var ok = false;
      try { ok = document.execCommand("insertHTML", false, html); } catch (e) { ok = false; }
      if (!ok) {
        range.deleteContents();
        range.insertNode(range.createContextualFragment(html));
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  }

  // ---- copy ---------------------------------------------------------------
  function onCopy() {
    var text = resolve(current.body);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { setStatus("Copied to clipboard ✓ — paste into your email.", "ok"); },
        function () { setStatus("Copy failed — select the preview text and copy manually.", "err"); }
      );
    } else {
      setStatus("Clipboard not available.", "err");
    }
  }

  // ---- utilities ----------------------------------------------------------
  function textToHtml(text) {
    var esc = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc.replace(/\r\n|\r|\n/g, "<br>");
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
