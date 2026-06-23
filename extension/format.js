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
    // links first (so ** inside labels still works)
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
      if (list) {
        out.push("<" + list.t + ">" + list.items.map(function (it) { return "<li>" + inline(it) + "</li>"; }).join("") + "</" + list.t + ">");
        list = null;
      }
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

  // Plain-text version (markers removed) for the clipboard fallback.
  function strip(src) {
    return String(src == null ? "" : src)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/_([^_\n]+)_/g, "$1");
  }

  window.PEOPL_MD = { toHtml: toHtml, strip: strip };
})();
