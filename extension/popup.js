/* PEOPL Email Templates — popup (the "use a template" view).
 * Loads templates from storage (PEOPL_STORE), renders a control for every
 * {{token}}, shows a live preview, and inserts into the Outlook compose box in
 * the active tab. Optional fields get an include/skip checkbox. Copy is a fallback. */
(function () {
  "use strict";

  var els = {};
  var TEMPLATES = [];   // working set (from storage, falls back to bundled defaults)
  var current = null;   // selected template
  var values = {};      // slot id -> current string value
  var included = {};    // slot id -> whether to insert it (optional fields can be off)
  var tokenOrder = [];  // slot ids in first-appearance order
  var TOKEN = /\{\{\s*([\w.\-]+)\s*\}\}/g;

  document.addEventListener("DOMContentLoaded", function () {
    cacheEls();
    wireEvents();
    PEOPL_STORE.load(function (list) {
      TEMPLATES = list || [];
      buildTemplateList();
      if (current) renderTemplate(current);
    });
  });

  // ---- setup --------------------------------------------------------------
  function cacheEls() {
    ["app", "tpl", "slots", "pv-subject", "pv-body", "btn-insert", "btn-copy", "btn-edit", "status"]
      .forEach(function (id) { els[camel(id)] = document.getElementById(id); });
  }

  function buildTemplateList() {
    els.tpl.innerHTML = "";
    TEMPLATES.forEach(function (t, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = t.name || t.id || ("Template " + (i + 1));
      els.tpl.appendChild(o);
    });
    current = TEMPLATES[0] || null;
    els.tpl.selectedIndex = 0;
    if (!TEMPLATES.length) setStatus("No templates yet — click ✎ Edit to add one.", "err");
  }

  function wireEvents() {
    els.tpl.addEventListener("change", function () {
      current = TEMPLATES[Number(els.tpl.value)] || null;
      if (current) renderTemplate(current);
    });
    els.btnInsert.addEventListener("click", onInsert);
    els.btnCopy.addEventListener("click", onCopy);
    els.btnEdit.addEventListener("click", function () {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        setStatus("Open the editor from the extension's options.", "err");
      }
    });
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
    setStatus("");
  }

  // ---- resolve + cleanup + preview ---------------------------------------
  function resolve(str) {
    return (str || "").replace(TOKEN, function (whole, id) {
      if (included[id] === false) return "";
      return (values[id] != null) ? values[id] : whole;
    });
  }
  // Collapse the gaps left by omitted fields: trim spaces before newlines,
  // squeeze 3+ blank lines down to one, and trim the ends.
  function cleanBody(text) {
    return String(text)
      .replace(/[ \t]+(\r?\n)/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+|\s+$/g, "");
  }
  function cleanSubject(text) {
    return String(text).replace(/\s{2,}/g, " ").trim();
  }
  function resolvedBody() { return cleanBody(resolve(current.body)); }
  function resolvedSubject() { return cleanSubject(resolve(current.subject)); }

  function updatePreview() {
    if (!current) return;
    els.pvSubject.textContent = resolvedSubject();
    els.pvBody.textContent = resolvedBody();
  }

  // ---- insert into the Outlook compose box (active tab) --------------------
  function onInsert() {
    if (!current) return;
    var html = textToHtml(resolvedBody());
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
    if (!current) return;
    var text = resolvedBody();
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
