/* PEOPL Email Templates — popup (the "use a template" view).
 * Loads templates from storage (PEOPL_STORE), renders a control for every
 * {{token}} (in recipients, subject and body), shows a live preview, and fills
 * the Outlook compose window: body at the cursor, plus Subject / To / Cc / Bcc.
 * Optional fields get an include/skip checkbox. Copy is a fallback. */
(function () {
  "use strict";

  var els = {};
  var TEMPLATES = [];
  var current = null;
  var values = {};
  var included = {};
  var tokenOrder = [];
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
    ["app", "tpl", "slots", "pv-meta", "pv-body", "btn-insert", "btn-copy", "btn-edit", "status"]
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
    [t.to, t.cc, t.bcc, t.subject, t.body].forEach(function (s) {
      tokensIn(s).forEach(function (id) { if (!seen[id]) { seen[id] = true; tokenOrder.push(id); } });
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
  function cleanBody(text) {
    return String(text).replace(/[ \t]+(\r?\n)/g, "$1").replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");
  }
  function cleanSubject(text) { return String(text).replace(/\s{2,}/g, " ").trim(); }
  function recipients(str) {
    if (!str) return "";
    return resolve(str).split(/[;,]+/).map(function (s) { return s.trim(); }).filter(Boolean).join("; ");
  }
  function resolvedBody() { return cleanBody(resolve(current.body)); }
  function resolvedSubject() { return current.subject ? cleanSubject(resolve(current.subject)) : ""; }

  function updatePreview() {
    if (!current) return;
    var meta = [];
    var to = recipients(current.to); if (to) meta.push(["To", to]);
    var cc = recipients(current.cc); if (cc) meta.push(["Cc", cc]);
    var bcc = recipients(current.bcc); if (bcc) meta.push(["Bcc", bcc]);
    var subj = resolvedSubject(); if (subj) meta.push(["Subject", subj]);
    els.pvMeta.innerHTML = meta.map(function (m) {
      return '<div class="pv-line"><span class="k">' + m[0] + ':</span> ' + esc(m[1]) + "</div>";
    }).join("");
    els.pvBody.innerHTML = PEOPL_MD.toHtml(resolvedBody());
  }

  // ---- fill the Outlook compose window (active tab) -----------------------
  function onInsert() {
    if (!current) return;
    var payload = {
      bodyHtml: PEOPL_MD.toHtml(resolvedBody()),
      subject: resolvedSubject(),
      to: recipients(current.to),
      cc: recipients(current.cc),
      bcc: recipients(current.bcc)
    };
    if (typeof chrome === "undefined" || !chrome.scripting || !chrome.tabs) {
      setStatus("Insert works inside the browser extension — use Copy here.", "err");
      return;
    }
    resolveOutlookTab(function (tabId) {
      if (tabId == null) { setStatus("Open Outlook in a window first, then click Insert.", "err"); return; }
      chrome.scripting.executeScript(
        { target: { tabId: tabId }, func: pageFill, args: [payload] },
        function (results) {
          if (chrome.runtime.lastError) {
            setStatus("Couldn't reach the Outlook window — use Copy, then paste.", "err");
            return;
          }
          var r = (results && results[0] && results[0].result) || {};
          setStatus(summarize(payload, r), r.body ? "ok" : "err");
        }
      );
    });
  }

  // Find the Outlook tab to act on: the one the launcher remembered, else any
  // open Outlook tab (works whether Outlook is a normal tab or an app/PWA window).
  function resolveOutlookTab(cb) {
    function ok(url) {
      return /^https:\/\/([^/]*\.)?(outlook\.(office|office365|live)\.com|outlook\.cloud\.microsoft)\//.test(url || "");
    }
    function fallback() {
      chrome.tabs.query({}, function (tabs) {
        var hits = (tabs || []).filter(function (t) { return ok(t.url); });
        var pick = hits.filter(function (t) { return t.active; })[0] || hits[0];
        cb(pick ? pick.id : null);
      });
    }
    if (chrome.storage && chrome.storage.session) {
      chrome.storage.session.get("targetTabId", function (res) {
        var id = res && res.targetTabId;
        if (id == null) return fallback();
        chrome.tabs.get(id, function (tab) {
          if (!chrome.runtime.lastError && tab && ok(tab.url)) cb(tab.id);
          else fallback();
        });
      });
    } else {
      fallback();
    }
  }

  function summarize(payload, r) {
    var done = [], missed = [];
    if (payload.bodyHtml) (r.body ? done : missed).push("body");
    if (payload.subject) (r.subject ? done : missed).push("subject");
    if (payload.to) (r.to ? done : missed).push("To");
    if (payload.cc) (r.cc ? done : missed).push("Cc");
    if (payload.bcc) (r.bcc ? done : missed).push("Bcc");
    if (!missed.length) return "Filled ✓ (" + done.join(", ") + ")";
    if (!done.length) return "Couldn't fill the compose window — use Copy, then paste.";
    return "Filled " + done.join(", ") + "; couldn't set " + missed.join(", ") + " — set those manually.";
  }

  /* Runs INSIDE the Outlook page (serialized by executeScript). Self-contained.
     Inserts body at the caret, then sets Subject / To / Cc / Bcc best-effort. */
  function pageFill(payload) {
    var report = { body: false, subject: false, to: false, cc: false, bcc: false };

    function visible(el) { return el && el.offsetParent !== null; }
    function findOne(selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var list = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < list.length; j++) if (visible(list[j])) return list[j];
      }
      return null;
    }
    function setNativeValue(el, val) {
      var proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) desc.set.call(el, val); else el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function pressEnter(el) {
      ["keydown", "keypress", "keyup"].forEach(function (type) {
        el.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      });
    }
    function isEditable(el) {
      return !!(el && (el.isContentEditable ||
        (el.getAttribute && (el.getAttribute("contenteditable") === "true" || el.getAttribute("contenteditable") === ""))));
    }

    // 1) BODY first, while the caret is still in the message body.
    if (payload.bodyHtml) {
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
          document.querySelectorAll('[contenteditable="true"],[contenteditable=""],[role="textbox"]'))
          .filter(function (e) { return e.offsetParent !== null; });
        cands.sort(function (a, b) { return (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight); });
        editable = cands[0];
      }
      if (isEditable(editable)) {
        editable.focus();
        try {
          var s = window.getSelection(), range;
          if (s && s.rangeCount && editable.contains(s.anchorNode)) range = s.getRangeAt(0);
          else { range = document.createRange(); range.selectNodeContents(editable); range.collapse(false); s.removeAllRanges(); s.addRange(range); }
          var ok = false;
          try { ok = document.execCommand("insertHTML", false, payload.bodyHtml); } catch (e) { ok = false; }
          if (!ok) { range.deleteContents(); range.insertNode(range.createContextualFragment(payload.bodyHtml)); }
          report.body = true;
        } catch (e) { report.body = false; }
      }
    }

    // 2) SUBJECT (reliable: plain input).
    if (payload.subject) {
      var subj = findOne(['input[aria-label="Add a subject"]', 'input[aria-label*="subject" i]',
                          'input[placeholder*="subject" i]', 'input[id*="Subject" i]']);
      if (subj) { setNativeValue(subj, payload.subject); report.subject = true; }
    }

    // 3) RECIPIENTS (best-effort: type each address + Enter to tokenise).
    function fillRecip(kind, value) {
      if (!value) return false;
      var labels = { to: ["To"], cc: ["Cc"], bcc: ["Bcc"] }[kind];
      var sel = [];
      labels.forEach(function (L) {
        sel.push('input[aria-label="' + L + '"]');
        sel.push('input[aria-label*="' + L + '" i]');
        sel.push('div[role="textbox"][aria-label*="' + L + '" i]');
        sel.push('[contenteditable="true"][aria-label*="' + L + '" i]');
      });
      var field = findOne(sel);
      if (!field) return false;
      field.focus();
      value.split(/[;,]+/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (a) {
        if (field.tagName === "INPUT" || field.tagName === "TEXTAREA") setNativeValue(field, a);
        else { field.textContent = a; field.dispatchEvent(new Event("input", { bubbles: true })); }
        pressEnter(field);
      });
      return true;
    }
    report.to = fillRecip("to", payload.to);
    report.cc = fillRecip("cc", payload.cc);
    report.bcc = fillRecip("bcc", payload.bcc);

    return report;
  }

  // ---- copy ---------------------------------------------------------------
  function onCopy() {
    if (!current) return;
    var md = resolvedBody();
    var html = PEOPL_MD.toHtml(md);
    var plain = PEOPL_MD.strip(md);
    // Prefer a rich copy so formatting survives the paste into Outlook.
    if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
      try {
        var item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" })
        });
        navigator.clipboard.write([item]).then(
          function () { setStatus("Copied with formatting ✓ — paste into your email.", "ok"); },
          plainCopy
        );
        return;
      } catch (e) { /* fall back */ }
    }
    plainCopy();
    function plainCopy() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plain).then(
          function () { setStatus("Copied ✓ — paste into your email.", "ok"); },
          function () { setStatus("Copy failed — select the preview text and copy manually.", "err"); }
        );
      } else {
        setStatus("Clipboard not available.", "err");
      }
    }
  }

  // ---- utilities ----------------------------------------------------------
  function esc(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
