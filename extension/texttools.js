/* Shared rich-textarea helpers for the popup (compose) and the editor:
 *  - PEOPL_TT.bar(textarea)  -> a B / i / • / 1. / link toolbar bound to it
 *  - PEOPL_TT.applyFormat(textarea, kind)
 *  - PEOPL_TT.autoList(textarea) -> pressing Enter continues a numbered/bulleted list
 * All edits dispatch an "input" event so the owning model/preview/save updates. */
(function () {
  "use strict";

  function fire(ta) { ta.dispatchEvent(new Event("input", { bubbles: true })); }

  function applyFormat(ta, kind) {
    if (!ta) return;
    var s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
    var before = val.slice(0, s), sel = val.slice(s, e), after = val.slice(e);
    var text, cs, ce;
    if (kind === "bold" || kind === "italic") {
      var mark = kind === "bold" ? "**" : "*";
      var inner = sel || (kind === "bold" ? "bold text" : "italic text");
      var ins = mark + inner + mark;
      text = before + ins + after; cs = before.length + mark.length; ce = cs + inner.length;
    } else if (kind === "ul" || kind === "ol") {
      var src = sel || "First item\nSecond item";
      var n = 1;
      var block = src.split(/\n/).map(function (l) { return (kind === "ul" ? "- " : (n++) + ". ") + l; }).join("\n");
      var pre = (before && !/\n$/.test(before)) ? before + "\n" : before;
      var post = (after && !/^\n/.test(after)) ? "\n" + after : after;
      text = pre + block + post; cs = pre.length; ce = pre.length + block.length;
    } else { // link
      var label = sel || "link text";
      var head = "[" + label + "](https://";
      text = before + head + ")" + after; cs = before.length + head.length; ce = cs;
    }
    ta.value = text;
    fire(ta);
    ta.focus(); ta.setSelectionRange(cs, ce);
  }

  // Pressing Enter inside a "- " or "1. " line continues the list; pressing it
  // on an empty list item ends the list.
  function autoList(ta) {
    if (ta._ttAuto) return;
    ta._ttAuto = true;
    ta.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      if (ta.selectionStart !== ta.selectionEnd) return;
      var val = ta.value, pos = ta.selectionStart;
      var lineStart = val.lastIndexOf("\n", pos - 1) + 1;
      var line = val.slice(lineStart, pos);
      var ol = line.match(/^(\s*)(\d+)([.)])(\s+)(.*)$/);
      var ul = line.match(/^(\s*)([-*])(\s+)(.*)$/);
      function set(from, to, insert, caret) {
        ta.value = val.slice(0, from) + insert + val.slice(to);
        ta.setSelectionRange(caret, caret);
        fire(ta);
      }
      if (ol) {
        e.preventDefault();
        if (ol[5].trim() === "") { set(lineStart, pos, "", lineStart); return; }   // empty item -> end list
        var insO = "\n" + ol[1] + (parseInt(ol[2], 10) + 1) + ol[3] + ol[4];
        set(pos, pos, insO, pos + insO.length);
      } else if (ul) {
        e.preventDefault();
        if (ul[4].trim() === "") { set(lineStart, pos, "", lineStart); return; }
        var insU = "\n" + ul[1] + ul[2] + ul[3];
        set(pos, pos, insU, pos + insU.length);
      }
    });
  }

  function bar(ta) {
    autoList(ta);
    var el = document.createElement("div");
    el.className = "fmt-bar";
    [["B", "bold", "Bold"], ["i", "italic", "Italic"], ["•", "ul", "Bulleted list"],
     ["1.", "ol", "Numbered list"], ["↗", "link", "Link"]].forEach(function (spec) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "fmt-btn"; b.textContent = spec[0]; b.title = spec[2];
      if (spec[1] === "bold") b.style.fontWeight = "700";
      if (spec[1] === "italic") b.style.fontStyle = "italic";
      b.addEventListener("mousedown", function (ev) { ev.preventDefault(); }); // keep textarea selection
      b.addEventListener("click", function () { applyFormat(ta, spec[1]); });
      el.appendChild(b);
    });
    return el;
  }

  window.PEOPL_TT = { bar: bar, applyFormat: applyFormat, autoList: autoList };
})();
