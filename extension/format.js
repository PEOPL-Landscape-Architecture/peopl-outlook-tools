/* Lightweight Markdown -> HTML for email bodies (shared by popup + editor).
 * Supports: **bold**, *italic* / _italic_, bulleted lists (- ), numbered lists
 * (1. ), and [label](https://url) links. Everything else is plain text. Raw HTML
 * is escaped first, so only the tags this file generates can appear. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inline(s) {
    // colour: [c:VALUE]text[/c]  (VALUE sanitised to a safe colour token)
    s = s.replace(/\[c:([^\]]+)\]([\s\S]*?)\[\/c\]/g, function (_, col, inner) {
      col = col.trim();
      return /^#?[0-9a-zA-Z]+$/.test(col) ? '<span style="color:' + col + '">' + inner + "</span>" : inner;
    });
    // links (so ** inside labels still works)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, label, url) {
      return '<a href="' + url + '">' + label + "</a>";
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");
    return s;
  }

  // Line-for-line rendering: every blank line in the source becomes one empty
  // line in the output, so 2+ blank lines show as 2+ (Outlook drops <p>
  // margins, so all spacing is explicit spacer rows, never CSS margins).
  // List items get their marker baked in as TEXT (not <ol>/<ul>): Outlook's
  // compose editor strips inserted <ol> lists, which loses the numbering;
  // literal markers + a hanging indent (inline CSS) survive insertion.
  // Numbering carries across blank lines; any other line restarts it.
  function render(src) {
    var lines = esc(src).split(/\r\n|\r|\n/);
    var out = [], para = [], list = null;
    function flushPara() { if (para.length) { out.push("<div>" + para.map(inline).join("<br>") + "</div>"); para = []; } }
    function item(t, text) {
      flushPara();
      if (!list || list.t !== t) list = { t: t, n: 1 };
      var marker = (t === "ol") ? (list.n++) + "." : "•";
      out.push('<div style="padding-left:1.8em;text-indent:-1.8em;margin:0">' + marker + "&nbsp;&nbsp;" + inline(text) + "</div>");
    }
    lines.forEach(function (line) {
      var ul = line.match(/^\s*[-*]\s+(.*)$/);
      var ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul) item("ul", ul[1]);
      else if (ol) item("ol", ol[1]);
      else if (/^\s*$/.test(line)) { flushPara(); out.push("<div><br></div>"); }
      else { list = null; para.push(line); }
    });
    flushPara();
    return out.join("");
  }

  // Preview version: inherits the panel's text colour.
  function toHtml(src) { return render(src); }

  // Email/clipboard version: explicit black text, same markup as the preview.
  function toEmailHtml(src) { return '<div style="color:#000000">' + render(src) + "</div>"; }

  // Tidies a resolved body. A line that held nothing but omitted/empty fields
  // (marked with OMIT by the caller's resolver) is removed together with the
  // blank line above it, so dropping a field never leaves a double gap; every
  // blank line the template itself contains is kept.
  var OMIT = "\u0000";
  function cleanBody(text) {
    var out = [];
    String(text == null ? "" : text).split(/\r\n|\r|\n/).forEach(function (line) {
      if (line.indexOf(OMIT) !== -1 && /^[\s\u0000]*$/.test(line)) {
        if (out.length && /^\s*$/.test(out[out.length - 1])) out.pop();
        return;
      }
      out.push(line.split(OMIT).join("").replace(/[ \t]+$/, ""));
    });
    return out.join("\n").replace(/^\s+|\s+$/g, "");
  }

  // Plain-text version (markers removed) for the clipboard fallback.
  function strip(src) {
    return String(src == null ? "" : src)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/_([^_\n]+)_/g, "$1");
  }

  window.PEOPL_MD = { toHtml: toHtml, toEmailHtml: toEmailHtml, strip: strip, cleanBody: cleanBody, OMIT: OMIT };
})();
