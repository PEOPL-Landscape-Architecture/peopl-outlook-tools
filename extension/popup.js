/* PEOPL Email Templates — popup (the single app window: compose form + Saved
 * Forms, with the editor as a slide-out panel).
 *
 * - Loads templates from storage (PEOPL_STORE); editor lives in an iframe panel.
 * - The form REMEMBERS what you typed: edits persist across template changes /
 *   re-renders (kept in formValues / formIncluded, keyed by field id).
 * - Saved Forms = a template + your entered values, saved under a name. */
(function () {
  "use strict";

  var FORMS_KEY = "peoplForms";
  var els = {};
  var TEMPLATES = [];
  var FORMS = [];
  var current = null;

  // effective values used for preview/insert (recomputed each render)
  var values = {};
  var included = {};
  // user overrides that PERSIST across re-renders and template switches
  var formValues = {};
  var formIncluded = {};

  var tokenOrder = [];
  var TOKEN = /\{\{\s*([\w.\-]+)\s*\}\}/g;

  var HEIGHTS_KEY = "peoplFieldHeights";
  var fieldHeights = {};                 // slot id -> remembered textarea height (px)
  var hSaveTimer = null;
  var hObserver = (typeof ResizeObserver !== "undefined") ? new ResizeObserver(onFieldResize) : null;

  document.addEventListener("DOMContentLoaded", function () {
    cacheEls();
    wireEvents();
    loadFieldHeights(function () {
      PEOPL_STORE.load(function (list) {
        TEMPLATES = list || [];
        buildTemplateList();
        if (current) renderTemplate(current);
      });
    });
    refreshForms();
    setupComposeSplitter();
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== "local") return;
        if (changes[PEOPL_STORE.KEY]) reloadTemplates();   // live sync from the editor panel
        if (changes[FORMS_KEY]) refreshForms();
      });
    }
  });

  // ---- setup --------------------------------------------------------------
  function cacheEls() {
    ["app", "tpl", "forms", "form-save", "form-del", "slots", "pv-meta", "pv-body",
     "btn-insert", "btn-copy", "btn-reset", "btn-edit", "editor-panel", "editor-frame",
     "editor-close", "status"]
      .forEach(function (id) { els[camel(id)] = document.getElementById(id); });
  }

  function buildTemplateList(preserveId) {
    els.tpl.innerHTML = "";
    TEMPLATES.forEach(function (t, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = t.name || t.id || ("Template " + (i + 1));
      els.tpl.appendChild(o);
    });
    var idx = 0;
    if (preserveId) { for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === preserveId) { idx = i; break; } }
    current = TEMPLATES[idx] || null;
    els.tpl.selectedIndex = TEMPLATES.length ? idx : -1;
    if (!TEMPLATES.length) setStatus("No templates yet — click ✎ Edit templates to add one.", "err");
  }

  function reloadTemplates() {
    var keep = current && current.id;
    PEOPL_STORE.load(function (list) {
      TEMPLATES = list || [];
      buildTemplateList(keep);
      if (current) renderTemplate(current);   // re-render keeps formValues
    });
  }

  function wireEvents() {
    els.tpl.addEventListener("change", function () {
      current = TEMPLATES[Number(els.tpl.value)] || null;
      els.forms.value = "";
      if (current) renderTemplate(current);   // retains formValues across the switch
    });
    els.btnInsert.addEventListener("click", onInsert);
    els.btnCopy.addEventListener("click", onCopy);
    els.btnReset.addEventListener("click", onReset);
    els.btnEdit.addEventListener("click", openEditor);
    els.editorClose.addEventListener("click", closeEditor);
    els.forms.addEventListener("change", onPickForm);
    els.formSave.addEventListener("click", onSaveForm);
    els.formDel.addEventListener("click", onDeleteForm);
  }

  // ---- editor slide-out panel --------------------------------------------
  function openEditor() {
    var f = els.editorFrame;
    if (!f.getAttribute("src")) f.setAttribute("src", "editor.html");
    els.editorPanel.classList.add("open");
  }
  function closeEditor() { els.editorPanel.classList.remove("open"); }

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
    for (var i = 0; i < opts.length; i++) if (opts[i].label === slot.default || opts[i].text === slot.default) return i;
    return 0;
  }
  function indexByText(opts, text) {
    for (var i = 0; i < opts.length; i++) if (opts[i].text === text) return i;
    return -1;
  }

  // ---- render -------------------------------------------------------------
  function renderTemplate(t) {
    values = {};
    included = {};
    tokenOrder = [];
    if (hObserver) hObserver.disconnect();
    var seen = {};
    [t.to, t.cc, t.bcc, t.subject, t.body].forEach(function (s) {
      tokensIn(s).forEach(function (id) { if (!seen[id]) { seen[id] = true; tokenOrder.push(id); } });
    });

    els.slots.innerHTML = "";
    tokenOrder.forEach(function (id) {
      var slot = (t.slots && t.slots[id]) || { label: prettify(id), type: "text" };
      var kind = slotKind(slot);
      var optional = !!slot.optional;
      var hasOverride = Object.prototype.hasOwnProperty.call(formValues, id);
      included[id] = Object.prototype.hasOwnProperty.call(formIncluded, id)
        ? formIncluded[id] : (optional ? !slot.omitByDefault : true);

      var wrap = document.createElement("div");
      wrap.className = "slot";

      var head = document.createElement("label");
      head.className = "slot-head";
      var chk = null;
      if (optional) {
        chk = document.createElement("input");
        chk.type = "checkbox"; chk.id = "chk-" + id; chk.checked = included[id];
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
          o.value = String(i); o.textContent = op.label;
          ctrl.appendChild(o);
        });
        var idx = defaultIndex(slot, opts);
        if (hasOverride) { var k = indexByText(opts, formValues[id]); if (k >= 0) idx = k; }
        ctrl.value = String(idx);
        values[id] = opts.length ? opts[idx].text : "";
        ctrl.addEventListener("change", function () {
          var v = opts[Number(ctrl.value)].text;
          values[id] = v; formValues[id] = v;
          updatePreview();
        });
      } else {
        var eff = hasOverride ? formValues[id] : (slot.default != null ? slot.default : "");
        // A single-line <input> silently drops line breaks, which would flatten a
        // numbered/bulleted list. If the value spans lines, use a textarea so the
        // formatting survives into the preview/email.
        var multiline = (kind === "textarea") || /\r|\n/.test(eff);
        ctrl = document.createElement(multiline ? "textarea" : "input");
        if (!multiline) ctrl.type = "text";
        ctrl.value = eff;
        if (slot.placeholder) ctrl.placeholder = slot.placeholder;
        values[id] = eff;
        ctrl.addEventListener("input", function () {
          values[id] = ctrl.value; formValues[id] = ctrl.value;
          updatePreview();
        });
      }
      ctrl.id = "f-" + id;
      if (optional && !included[id]) ctrl.disabled = true;
      if (ctrl.tagName === "TEXTAREA" && window.PEOPL_TT) wrap.appendChild(PEOPL_TT.bar(ctrl));
      wrap.appendChild(ctrl);
      if (ctrl.tagName === "TEXTAREA") {
        ctrl.dataset.fid = id;
        if (fieldHeights[id]) ctrl.style.height = fieldHeights[id] + "px";
        if (hObserver) hObserver.observe(ctrl);
      }

      if (optional && chk) {
        chk.addEventListener("change", function () {
          included[id] = chk.checked; formIncluded[id] = chk.checked;
          ctrl.disabled = !chk.checked;
          updatePreview();
        });
      }

      els.slots.appendChild(wrap);
    });

    updatePreview();
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

  // ---- Saved Forms --------------------------------------------------------
  function loadForms(cb) {
    if (typeof chrome === "undefined" || !chrome.storage) { cb([]); return; }
    chrome.storage.local.get(FORMS_KEY, function (res) { cb((res && res[FORMS_KEY]) || []); });
  }
  function saveForms(arr, cb) {
    if (typeof chrome === "undefined" || !chrome.storage) { if (cb) cb(); return; }
    var o = {}; o[FORMS_KEY] = arr;
    chrome.storage.local.set(o, cb || function () {});
  }
  function refreshForms(keepSelection) {
    var sel = keepSelection ? els.forms.value : null;
    loadForms(function (arr) {
      FORMS = arr;
      els.forms.innerHTML = '<option value="">— none —</option>';
      FORMS.forEach(function (f) {
        var o = document.createElement("option");
        o.value = f.id; o.textContent = f.name;
        els.forms.appendChild(o);
      });
      if (sel) els.forms.value = sel;
    });
  }
  function onSaveForm() {
    if (!current) return;
    var hint = values.client || values.project || "draft";
    var name = window.prompt("Save this form as:", (current.name || "Form") + " — " + hint);
    if (name == null) return;
    name = name.trim();
    if (!name) return;

    // Match an existing form by name (case-insensitive) -> offer to overwrite.
    var existing = null;
    for (var i = 0; i < FORMS.length; i++) {
      if ((FORMS[i].name || "").trim().toLowerCase() === name.toLowerCase()) { existing = FORMS[i]; break; }
    }
    if (existing && !window.confirm('A saved form named "' + existing.name + '" already exists.\n\nOverwrite it?')) return;

    var target = existing || { id: "form-" + Date.now().toString(36) };
    target.name = name;
    target.templateId = current.id;
    target.values = shallow(values);
    target.included = shallow(included);
    target.ts = Date.now();
    if (!existing) FORMS.push(target);

    saveForms(FORMS, function () {
      refreshForms();
      els.forms.value = target.id;
      setStatus(existing ? "Form updated ✓" : "Form saved ✓", "ok");
    });
  }
  function onPickForm() {
    var id = els.forms.value; if (!id) return;
    var form = FORMS.filter(function (f) { return f.id === id; })[0]; if (!form) return;
    var t = TEMPLATES.filter(function (x) { return x.id === form.templateId; })[0];
    if (!t) { setStatus("That form's template was deleted.", "err"); return; }
    current = t;
    buildTemplateList(t.id);
    formValues = shallow(form.values || {});
    formIncluded = shallow(form.included || {});
    renderTemplate(current);
    els.forms.value = id;
    setStatus('Loaded form "' + form.name + '"', "ok");
  }
  function onDeleteForm() {
    var id = els.forms.value;
    if (!id) { setStatus("Pick a saved form to delete.", "err"); return; }
    var form = FORMS.filter(function (f) { return f.id === id; })[0]; if (!form) return;
    if (!window.confirm('Delete saved form "' + form.name + '"?')) return;
    FORMS = FORMS.filter(function (f) { return f.id !== id; });
    saveForms(FORMS, function () { refreshForms(); setStatus("Form deleted.", "ok"); });
  }
  function onReset() {
    formValues = {}; formIncluded = {};
    els.forms.value = "";
    if (current) renderTemplate(current);
    setStatus("Form cleared.", "");
  }

  // ---- fill the Outlook compose window -----------------------------------
  function onInsert() {
    if (!current) return;
    var payload = {
      bodyHtml: PEOPL_MD.toHtml(resolvedBody()),
      subject: resolvedSubject(),
      to: recipients(current.to), cc: recipients(current.cc), bcc: recipients(current.bcc)
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
          if (chrome.runtime.lastError) { setStatus("Couldn't reach the Outlook window — use Copy, then paste.", "err"); return; }
          var r = (results && results[0] && results[0].result) || {};
          setStatus(summarize(payload, r), r.body ? "ok" : "err");
        }
      );
    });
  }

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
          if (!chrome.runtime.lastError && tab && ok(tab.url)) cb(tab.id); else fallback();
        });
      });
    } else { fallback(); }
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
        var cands = Array.prototype.slice.call(document.querySelectorAll('[contenteditable="true"],[contenteditable=""],[role="textbox"]'))
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
          var okIns = false;
          try { okIns = document.execCommand("insertHTML", false, payload.bodyHtml); } catch (e) { okIns = false; }
          if (!okIns) { range.deleteContents(); range.insertNode(range.createContextualFragment(payload.bodyHtml)); }
          report.body = true;
        } catch (e) { report.body = false; }
      }
    }

    if (payload.subject) {
      var subj = findOne(['input[aria-label="Add a subject"]', 'input[aria-label*="subject" i]',
                          'input[placeholder*="subject" i]', 'input[id*="Subject" i]']);
      if (subj) { setNativeValue(subj, payload.subject); report.subject = true; }
    }

    function fillRecip(kind, value) {
      if (!value) return false;
      var labels = { to: ["To"], cc: ["Cc"], bcc: ["Bcc"] }[kind];
      var sels = [];
      labels.forEach(function (L) {
        sels.push('input[aria-label="' + L + '"]');
        sels.push('input[aria-label*="' + L + '" i]');
        sels.push('div[role="textbox"][aria-label*="' + L + '" i]');
        sels.push('[contenteditable="true"][aria-label*="' + L + '" i]');
      });
      var field = findOne(sels);
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
      } else { setStatus("Clipboard not available.", "err"); }
    }
  }

  // ---- remember expanded paragraph-field heights -------------------------
  function loadFieldHeights(cb) {
    if (typeof chrome === "undefined" || !chrome.storage) { fieldHeights = {}; cb(); return; }
    chrome.storage.local.get(HEIGHTS_KEY, function (res) { fieldHeights = (res && res[HEIGHTS_KEY]) || {}; cb(); });
  }
  function onFieldResize(entries) {
    var changed = false;
    entries.forEach(function (e) {
      var id = e.target.dataset && e.target.dataset.fid;
      if (!id) return;
      var h = Math.round(e.target.offsetHeight);
      if (h > 0 && fieldHeights[id] !== h) { fieldHeights[id] = h; changed = true; }
    });
    if (changed) scheduleHeightsSave();
  }
  function scheduleHeightsSave() {
    if (typeof chrome === "undefined" || !chrome.storage) return;
    if (hSaveTimer) clearTimeout(hSaveTimer);
    hSaveTimer = setTimeout(function () {
      var o = {}; o[HEIGHTS_KEY] = fieldHeights;
      try { chrome.storage.local.set(o); } catch (e) {}
    }, 400);
  }

  // ---- resizable preview pane (compose) ----------------------------------
  function setupComposeSplitter() {
    var sp = document.getElementById("cmp-splitter");
    var cols = document.querySelector(".cols");
    if (!sp || !cols) return;
    var GUT = 6, MINFIELDS = 220;
    function clampPw(pw) {
      var w = cols.getBoundingClientRect().width;
      var maxPw = w - GUT - MINFIELDS;
      return Math.max(220, Math.min(pw, Math.max(260, maxPw)));
    }
    function setPw(pw) { cols.style.setProperty("--pw", clampPw(pw) + "px"); }
    function curPw() { return parseInt(getComputedStyle(cols).getPropertyValue("--pw"), 10); }
    var dragging = false;
    function onMove(e) { if (dragging) setPw(cols.getBoundingClientRect().right - e.clientX); }
    function onUp() {
      if (!dragging) return;
      dragging = false; sp.classList.remove("dragging"); document.body.style.cursor = "";
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      var w = curPw();
      if (w && typeof chrome !== "undefined" && chrome.storage) chrome.storage.local.set({ peoplComposePreviewW: w });
    }
    sp.addEventListener("pointerdown", function (e) {
      dragging = true; sp.classList.add("dragging"); document.body.style.cursor = "col-resize"; e.preventDefault();
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
    window.addEventListener("resize", function () { var c = curPw(); if (c) setPw(c); });
    function applyInitial(w) { requestAnimationFrame(function () { setPw(w || 320); }); }
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("peoplComposePreviewW", function (res) { applyInitial(res && res.peoplComposePreviewW); });
    } else { applyInitial(320); }
  }

  // ---- utilities ----------------------------------------------------------
  function shallow(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function esc(text) { return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function prettify(id) { return id.replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function camel(id) { return id.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }
  function setStatus(msg, kind) {
    if (!els.status) return;
    els.status.textContent = msg || "";
    els.status.className = "status" + (kind ? " " + kind : "");
  }
})();
