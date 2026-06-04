/* PEOPL Email Templates — editor page.
 * A form-based template manager. Reads/writes the working set via PEOPL_STORE
 * (chrome.storage.local), with Export/Import for backup. No code editing needed. */
(function () {
  "use strict";

  var TOKEN = /\{\{\s*([\w.\-]+)\s*\}\}/g;
  var state = { templates: [], selected: 0 };
  var saveTimer = null;

  document.addEventListener("DOMContentLoaded", function () {
    PEOPL_STORE.load(function (list) {
      state.templates = PEOPL_STORE.clone(list || []);
      state.selected = state.templates.length ? 0 : -1;
      wireTopbar();
      renderAll();
    });
  });

  // ---- top bar ------------------------------------------------------------
  function wireTopbar() {
    byId("btn-new").addEventListener("click", onNew);
    byId("btn-export").addEventListener("click", onExport);
    byId("btn-reset").addEventListener("click", onReset);
    byId("btn-import").addEventListener("click", function () { byId("import-file").click(); });
    byId("import-file").addEventListener("change", onImportFile);
  }

  function onNew() {
    var t = {
      id: uid("template"),
      name: "New template",
      subject: "",
      body: "Hi {{client}},\n\n\n\nKind regards,\n{{signoff}}",
      slots: {
        client: { label: "Client name", type: "text" },
        signoff: { label: "Sign-off", type: "textarea" }
      }
    };
    state.templates.push(t);
    state.selected = state.templates.length - 1;
    save();
    renderAll();
    var n = byId("f-name"); if (n) { n.focus(); n.select(); }
  }

  function onExport() {
    var data = JSON.stringify(state.templates, null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "peopl-templates.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    flashSaved("Exported");
  }

  function onImportFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("not a template list");
        state.templates = parsed;
        state.selected = parsed.length ? 0 : -1;
        save();
        renderAll();
        flashSaved("Imported " + parsed.length);
      } catch (err) {
        alert("Couldn't import that file: " + err.message);
      }
      byId("import-file").value = "";
    };
    reader.readAsText(file);
  }

  function onReset() {
    if (!confirm("Replace ALL templates with the original samples?\n\nYour current templates will be lost unless you've Exported them.")) return;
    state.templates = PEOPL_STORE.defaults();
    state.selected = state.templates.length ? 0 : -1;
    save();
    renderAll();
    flashSaved("Reset");
  }

  // ---- list ---------------------------------------------------------------
  function renderAll() { renderList(); renderEditor(); }

  function renderList() {
    var ul = byId("tpl-list");
    ul.innerHTML = "";
    state.templates.forEach(function (t, i) {
      var li = document.createElement("li");
      if (i === state.selected) li.className = "active";
      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = t.name || t.id || ("Template " + (i + 1));
      li.appendChild(nm);
      var del = document.createElement("button");
      del.className = "del"; del.type = "button"; del.title = "Delete"; del.textContent = "×";
      del.addEventListener("click", function (ev) { ev.stopPropagation(); onDelete(i); });
      li.appendChild(del);
      li.addEventListener("click", function () { state.selected = i; renderAll(); });
      ul.appendChild(li);
    });
  }

  function onDelete(i) {
    var t = state.templates[i];
    if (!confirm('Delete "' + (t && t.name) + '"?')) return;
    state.templates.splice(i, 1);
    if (state.selected >= state.templates.length) state.selected = state.templates.length - 1;
    save();
    renderAll();
  }

  // ---- editor pane --------------------------------------------------------
  function cur() { return state.templates[state.selected]; }

  function renderEditor() {
    var pane = byId("edit-pane");
    pane.innerHTML = "";
    var t = cur();
    if (!t) {
      pane.innerHTML = '<div class="empty">No template selected. Click <strong>+ New template</strong> to create one.</div>';
      return;
    }

    pane.appendChild(rowInput("Template name", "f-name", t.name || "", function (v) { t.name = v; renderList(); }));
    pane.appendChild(rowInput("Subject  (you can use {{fields}} here too)", "f-subject", t.subject || "", function (v) {
      t.subject = v; rebuildFields(); updatePreview();
    }));

    var recHdr = document.createElement("div");
    recHdr.className = "group-label"; recHdr.style.marginTop = "2px";
    recHdr.textContent = "Recipients (optional) — type fixed addresses or use {{fields}}; separate several with ;";
    pane.appendChild(recHdr);
    pane.appendChild(rowInput("To", "f-to", t.to || "", function (v) { t.to = v; rebuildFields(); updatePreview(); }));
    pane.appendChild(rowInput("Cc", "f-cc", t.cc || "", function (v) { t.cc = v; rebuildFields(); updatePreview(); }));
    pane.appendChild(rowInput("Bcc", "f-bcc", t.bcc || "", function (v) { t.bcc = v; rebuildFields(); updatePreview(); }));

    // body + toolbar
    var bodyRow = document.createElement("div");
    bodyRow.className = "row";
    var bl = document.createElement("label"); bl.textContent = "Email body"; bl.setAttribute("for", "f-body");
    bodyRow.appendChild(bl);
    var ta = document.createElement("textarea");
    ta.id = "f-body"; ta.value = t.body || "";
    ta.addEventListener("input", function () { t.body = ta.value; rebuildFields(); updatePreview(); });
    bodyRow.appendChild(ta);
    var tb = document.createElement("div");
    tb.className = "body-toolbar";
    var mk = document.createElement("button");
    mk.className = "btn tiny"; mk.type = "button"; mk.textContent = "Make selected text a field";
    mk.addEventListener("click", wrapSelection);
    tb.appendChild(mk);
    var hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "Tip: select a word (e.g. a name) and click this, or just type {{anything}}.";
    tb.appendChild(hint);
    bodyRow.appendChild(tb);
    pane.appendChild(bodyRow);

    // fields
    var fh = document.createElement("h3"); fh.textContent = "Fields";
    pane.appendChild(fh);
    var fields = document.createElement("div");
    fields.id = "fields"; fields.className = "fields";
    pane.appendChild(fields);

    // preview
    var pw = document.createElement("div");
    pw.className = "preview-wrap";
    pw.innerHTML = '<div class="ph">Preview (using default values)</div><div class="pv-meta" id="pv-meta"></div><div class="pv-body" id="pv-body"></div>';
    pane.appendChild(pw);

    rebuildFields();
    updatePreview();
  }

  function rowInput(labelText, id, value, onInput) {
    var row = document.createElement("div");
    row.className = "row";
    var l = document.createElement("label"); l.textContent = labelText; l.setAttribute("for", id);
    var inp = document.createElement("input"); inp.type = "text"; inp.id = id; inp.value = value;
    inp.addEventListener("input", function () { onInput(inp.value); scheduleSave(); });
    row.appendChild(l); row.appendChild(inp);
    return row;
  }

  // ---- fields (slots) -----------------------------------------------------
  function uniqueTokens(t) {
    var ids = [], seen = {};
    [t.to, t.cc, t.bcc, t.subject, t.body].forEach(function (s) {
      var m; TOKEN.lastIndex = 0;
      while ((m = TOKEN.exec(s || "")) !== null) { if (!seen[m[1]]) { seen[m[1]] = 1; ids.push(m[1]); } }
    });
    return ids;
  }
  function slotType(slot) {
    if (slot && slot.options) return "select";
    if (slot && slot.type === "textarea") return "textarea";
    return "text";
  }

  function rebuildFields() {
    var t = cur(); if (!t) return;
    t.slots = t.slots || {};
    var toks = uniqueTokens(t);
    toks.forEach(function (tok) { if (!t.slots[tok]) t.slots[tok] = { label: prettify(tok), type: "text" }; });

    var box = byId("fields");
    if (!box) return;
    box.innerHTML = "";
    if (!toks.length) {
      box.innerHTML = '<p class="hint">No fields yet. Add a {{field}} in the subject or body and it appears here to configure.</p>';
      return;
    }
    toks.forEach(function (tok) { box.appendChild(fieldCard(t, tok)); });
  }

  function fieldCard(t, tok) {
    var slot = t.slots[tok];
    var type = slotType(slot);
    var card = document.createElement("div");
    card.className = "field-card";

    // header row: token + type select
    var head = document.createElement("div");
    head.className = "fc-row";
    var code = document.createElement("code"); code.textContent = "{{" + tok + "}}";
    head.appendChild(code);
    var typeSel = document.createElement("select");
    typeSel.className = "fc-type";
    [["text", "Text field"], ["textarea", "Paragraph field"], ["select", "Dropdown"]].forEach(function (o) {
      var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1];
      if (o[0] === type) op.selected = true;
      typeSel.appendChild(op);
    });
    typeSel.addEventListener("change", function () {
      changeType(slot, typeSel.value);
      rebuildFields(); updatePreview(); scheduleSave();
    });
    head.appendChild(typeSel);
    card.appendChild(head);

    // label (common)
    var lblRow = document.createElement("div"); lblRow.className = "row";
    var ll = document.createElement("label"); ll.textContent = "Label shown in the form";
    var li = document.createElement("input"); li.type = "text"; li.value = slot.label || "";
    li.addEventListener("input", function () { slot.label = li.value; updatePreview(); scheduleSave(); });
    lblRow.appendChild(ll); lblRow.appendChild(li); card.appendChild(lblRow);

    // optional / omit controls (apply to every field type)
    var optWrap = document.createElement("div");
    optWrap.className = "row";
    var optLine = document.createElement("label"); optLine.className = "check-line";
    var optChk = document.createElement("input"); optChk.type = "checkbox"; optChk.checked = !!slot.optional;
    var optTxt = document.createElement("span"); optTxt.textContent = "Optional — show an include / skip checkbox when composing";
    optLine.appendChild(optChk); optLine.appendChild(optTxt); optWrap.appendChild(optLine);

    var omitLine = document.createElement("label"); omitLine.className = "check-line sub";
    var omitChk = document.createElement("input"); omitChk.type = "checkbox"; omitChk.checked = !!slot.omitByDefault;
    var omitTxt = document.createElement("span"); omitTxt.textContent = "Leave it OFF by default (omitted unless ticked)";
    omitLine.appendChild(omitChk); omitLine.appendChild(omitTxt);
    omitLine.style.display = slot.optional ? "" : "none";
    optWrap.appendChild(omitLine);

    optChk.addEventListener("change", function () {
      slot.optional = optChk.checked;
      if (!slot.optional) delete slot.omitByDefault;
      omitLine.style.display = slot.optional ? "" : "none";
      updatePreview(); scheduleSave();
    });
    omitChk.addEventListener("change", function () {
      slot.omitByDefault = omitChk.checked; updatePreview(); scheduleSave();
    });
    card.appendChild(optWrap);

    if (type === "select") {
      card.appendChild(optionsEditor(slot));
    } else {
      var grid = document.createElement("div"); grid.className = "fc-grid";
      // placeholder
      var pw = document.createElement("div");
      pw.innerHTML = '<label class="group-label">Placeholder (optional)</label>';
      var pi = document.createElement("input"); pi.type = "text"; pi.value = slot.placeholder || "";
      pi.addEventListener("input", function () { slot.placeholder = pi.value; scheduleSave(); });
      pw.appendChild(pi); grid.appendChild(pw);
      // default
      var dw = document.createElement("div");
      dw.innerHTML = '<label class="group-label">Default value (optional)</label>';
      var di = document.createElement(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") di.type = "text";
      di.value = slot.default != null ? slot.default : "";
      di.addEventListener("input", function () { slot.default = di.value; updatePreview(); scheduleSave(); });
      dw.appendChild(di); grid.appendChild(dw);
      card.appendChild(grid);
    }
    return card;
  }

  function changeType(slot, newType) {
    if (newType === "select") {
      delete slot.type;
      if (!slot.options || !slot.options.length) slot.options = [{ label: "", text: "" }];
      if (typeof slot.default === "string" && !optionLabels(slot).includes(slot.default)) delete slot.default;
    } else {
      delete slot.options;
      slot.type = newType; // 'text' | 'textarea'
      if (slot.default && typeof slot.default !== "string") slot.default = "";
    }
  }

  function optionLabels(slot) {
    return (slot.options || []).map(function (o) { return (o && o.label) || (o && o.text) || ""; });
  }

  function optionsEditor(slot) {
    var wrap = document.createElement("div");
    wrap.innerHTML = '<label class="group-label">Dropdown options &mdash; menu label (optional) and the text inserted into the email</label>';
    var list = document.createElement("div"); list.className = "opts";
    (slot.options || []).forEach(function (opt, idx) { list.appendChild(optionRow(slot, idx)); });
    wrap.appendChild(list);

    var add = document.createElement("button");
    add.className = "btn tiny add-opt"; add.type = "button"; add.textContent = "+ Add option";
    add.addEventListener("click", function () {
      slot.options = slot.options || [];
      slot.options.push({ label: "", text: "" });
      rebuildFields(); scheduleSave();
    });
    wrap.appendChild(add);

    // default option chooser
    var dw = document.createElement("div"); dw.className = "row"; dw.style.marginTop = "10px";
    dw.innerHTML = '<label class="group-label">Default selection</label>';
    var sel = document.createElement("select");
    (slot.options || []).forEach(function (opt) {
      var lab = (opt.label || opt.text || "(empty)");
      var op = document.createElement("option"); op.value = lab; op.textContent = lab;
      if (slot.default != null && (opt.label === slot.default || opt.text === slot.default)) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener("change", function () { slot.default = sel.value; updatePreview(); scheduleSave(); });
    dw.appendChild(sel);
    wrap.appendChild(dw);
    return wrap;
  }

  function optionRow(slot, idx) {
    var opt = slot.options[idx];
    var row = document.createElement("div"); row.className = "opt";
    var labI = document.createElement("input"); labI.type = "text"; labI.className = "opt-label";
    labI.placeholder = "Menu label"; labI.value = opt.label || "";
    labI.addEventListener("input", function () { opt.label = labI.value; scheduleSave(); });
    var txtI = document.createElement("textarea"); txtI.className = "opt-text"; txtI.rows = 2;
    txtI.placeholder = "Text inserted into the email"; txtI.value = opt.text || "";
    txtI.addEventListener("input", function () { opt.text = txtI.value; updatePreview(); scheduleSave(); });
    var rm = document.createElement("button");
    rm.className = "rm"; rm.type = "button"; rm.title = "Remove option"; rm.textContent = "×";
    rm.addEventListener("click", function () { slot.options.splice(idx, 1); rebuildFields(); updatePreview(); scheduleSave(); });
    row.appendChild(labI); row.appendChild(txtI); row.appendChild(rm);
    return row;
  }

  function wrapSelection() {
    var ta = byId("f-body"); if (!ta) return;
    var s = ta.selectionStart, e = ta.selectionEnd;
    var picked = ta.value.slice(s, e);
    var name = prompt("Field name (letters/numbers, e.g. client):", picked ? slug(picked) : "field");
    if (name == null) return;
    name = slug(name) || "field";
    var token = "{{" + name + "}}";
    var t = cur();
    ta.value = ta.value.slice(0, s) + token + ta.value.slice(e);
    t.body = ta.value;
    t.slots = t.slots || {};
    if (!t.slots[name]) t.slots[name] = { label: prettify(name), type: "text", default: picked || "" };
    rebuildFields(); updatePreview(); scheduleSave();
    ta.focus();
    var pos = s + token.length;
    ta.setSelectionRange(pos, pos);
  }

  // ---- preview ------------------------------------------------------------
  function previewValue(slot) {
    if (!slot) return "";
    if (slot.options) {
      var opts = slot.options;
      var pick = opts[0];
      if (slot.default != null) {
        for (var i = 0; i < opts.length; i++) {
          if (opts[i].label === slot.default || opts[i].text === slot.default) { pick = opts[i]; break; }
        }
      }
      return pick ? (pick.text || "") : "";
    }
    if (slot.default) return slot.default;
    return "[" + (slot.label || "") + "]";
  }
  function resolvePreview(str, t) {
    return (str || "").replace(TOKEN, function (whole, id) {
      var slot = t.slots && t.slots[id];
      if (!slot) return whole;
      if (slot.optional && slot.omitByDefault) return "";
      return previewValue(slot);
    });
  }
  function updatePreview() {
    var t = cur(); if (!t) return;
    var meta = [];
    var to = recipPreview(t.to, t); if (to) meta.push(["To", to]);
    var cc = recipPreview(t.cc, t); if (cc) meta.push(["Cc", cc]);
    var bcc = recipPreview(t.bcc, t); if (bcc) meta.push(["Bcc", bcc]);
    var subj = cleanSubject(resolvePreview(t.subject, t)); if (subj) meta.push(["Subject", subj]);
    var m = byId("pv-meta");
    if (m) m.innerHTML = meta.map(function (x) {
      return '<div class="pv-line"><span class="k">' + x[0] + ':</span> ' + esc(x[1]) + "</div>";
    }).join("");
    var body = byId("pv-body");
    if (body) body.textContent = cleanBody(resolvePreview(t.body, t));
  }
  function recipPreview(str, t) {
    return resolvePreview(str, t).split(/[;,]+/).map(function (s) { return s.trim(); }).filter(Boolean).join("; ");
  }

  // ---- save ---------------------------------------------------------------
  function scheduleSave() {
    flashSaved("Saving…", true);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 350);
  }
  function save() {
    PEOPL_STORE.save(state.templates, function () { flashSaved("Saved ✓"); });
  }
  function flashSaved(msg, pending) {
    var el = byId("saved");
    if (el) el.textContent = msg;
  }

  // ---- utils --------------------------------------------------------------
  function byId(id) { return document.getElementById(id); }
  function cleanBody(text) {
    return String(text).replace(/[ \t]+(\r?\n)/g, "$1").replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");
  }
  function cleanSubject(text) { return String(text).replace(/\s{2,}/g, " ").trim(); }
  function esc(text) { return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function prettify(id) { return id.replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40); }
  function uid(name) { return (slug(name) || "tpl") + "-" + Date.now().toString(36); }
})();
