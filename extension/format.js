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

  function toHtml(src) {
    var lines = esc(src).split(/\r\n|\r|\n/);
    var out = [], para = [], list = null;
    function flushPara() { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } }
    function flushList() {
      if (!list) return;
      // Render list items as styled lines with the marker baked in as TEXT (not
      // <ol>/<ul>). Outlook's compose editor strips inserted <ol> lists, which
      // loses the numbering; literal markers + a hanging indent (inline CSS)
      // survive insertion and render identically in the preview.
      var n = 1;
      list.items.forEach(function (it) {
        var marker = (list.t === "ol") ? (n++) + "." : "•";
        out.push('<div style="padding-left:1.8em;text-indent:-1.8em;margin:2px 0">' + marker + "&nbsp;&nbsp;" + inline(it) + "</div>");
      });
      list = null;
    }
    lines.forEach(function (line) {
      var ul = line.match(/^\s*[-*]\s+(.*)$/);
      var ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul) { flushPara(); if (!list || list.t !== "ul") { flushList(); list = { t: "ul", items: [] }; } list.items.push(ul[1]); }
      else if (ol) { flushPara(); if (!list || list.t !== "ol") { flushList(); list = { t: "ol", items: [] }; } list.items.push(ol[1]); }
      // A blank line ends a paragraph, but NOT a list — a following item of the
      // same kind keeps the same list, so numbering carries across blank lines.
      else if (/^\s*$/.test(line)) { flushPara(); }
      else { flushList(); para.push(line); }
    });
    flushPara(); flushList();
    return out.join("");
  }

  // Email/clipboard version: explicit black text, and a blank line between
  // paragraphs (Outlook drops <p> margins, so spacing is added as spacer rows).
  // Lists use the same baked-in markers as the preview.
  function toEmailHtml(src) {
    var lines = esc(src).split(/\r\n|\r|\n/);
    var blocks = [], para = [], list = null;
    function flushPara() { if (para.length) { blocks.push("<div>" + para.map(inline).join("<br>") + "</div>"); para = []; } }
    function flushList() {
      if (!list) return;
      var n = 1;
      blocks.push(list.items.map(function (it) {
        var marker = (list.t === "ol") ? (n++) + "." : "•";
        return '<div style="padding-left:1.8em;text-indent:-1.8em;margin:0">' + marker + "&nbsp;&nbsp;" + inline(it) + "</div>";
      }).join(""));
      list = null;
    }
    lines.forEach(function (line) {
      var ul = line.match(/^\s*[-*]\s+(.*)$/);
      var ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul) { flushPara(); if (!list || list.t !== "ul") { flushList(); list = { t: "ul", items: [] }; } list.items.push(ul[1]); }
      else if (ol) { flushPara(); if (!list || list.t !== "ol") { flushList(); list = { t: "ol", items: [] }; } list.items.push(ol[1]); }
      else if (/^\s*$/.test(line)) { flushPara(); }
      else { flushList(); para.push(line); }
    });
    flushPara(); flushList();
    return '<div style="color:#000000">' + blocks.join('<div><br></div>') + "</div>";
  }

  // Plain-text version (markers removed) for the clipboard fallback.
  function strip(src) {
    return String(src == null ? "" : src)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/_([^_\n]+)_/g, "$1");
  }

  window.PEOPL_MD = { toHtml: toHtml, toEmailHtml: toEmailHtml, strip: strip };
})();
